import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotifyHub } from '../notifications/notify-hub.service';
import { mentionedIds } from './mentions';
import { cleanCompletionNote, startDue, NEEDS_COMPLETION_NOTE, NEEDS_HOLD_REASON, NO_ASSIGNEE_IN_PROGRESS, holdReasonMissing } from './task-rules';
import { SettingsService } from '../settings/settings.service';
import { withAutoChecklists } from '../project-tasks/auto-checklist';
import { backfillSerials, logSerialKind, nextSerial, serialYear } from '../database/serials';
import { PRIORITY_DEFS_KEY, parsePriorityDefs, storePriorityDefs, type PriorityDef } from './priority-definitions';
import { DEFAULT_LOG_STATUSES, LOG_STATUSES_KEY, bucketOf, isClosedStatus, isInProgress, parseLogStatuses, withBuckets, type LogStatus } from './log-statuses';

/** Confirmed Request Log tasks leave the list this many days later. */
export const LOG_ARCHIVE_DAYS = 7;
import { ChangeOrderEntity, TaskEntity, UserEntity, ChecklistTemplateEntity, DealEntity, LeadEntity, ProjectEntity } from '../database/entities';
import { isLeadId, leadDisplayName, resolveLead } from './lead-link';
import { holdNotices, overdue, stillTrue, type PendingNotice } from '../notifications/pending-notices';
import {
  diffEvents, event, normalizeAttachments, normalizeList, subId,
  type ActivityEvent, type TaskAttachment, type TaskComment,
  normalizeCollaborators, collaboratorChanges,
  cleanPriority,
} from '../database/task.types';
import { backfillAssignees, resolveAssignee } from '../database/assignee.util';
import { NotificationsService } from '../notifications/notifications.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';

const SCOPE = 'Request Log';

@Injectable()
export class TasksService implements OnApplicationBootstrap {
  private readonly log = new Logger('TasksService');

  constructor(
    @InjectRepository(TaskEntity) private readonly repo: Repository<TaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly attachments: AttachmentsService,
    private readonly notifications: NotificationsService,
    private readonly settings?: SettingsService,
    @Optional() @InjectRepository(ChangeOrderEntity) private readonly cos?: Repository<ChangeOrderEntity>,
    @Optional() @InjectRepository(ChecklistTemplateEntity) private readonly checklistTemplates?: Repository<ChecklistTemplateEntity>,
    @Optional() @InjectRepository(LeadEntity) private readonly leads?: Repository<LeadEntity>,
    @Optional() @InjectRepository(DealEntity) private readonly deals?: Repository<DealEntity>,
    @Optional() @InjectRepository(ProjectEntity) private readonly projects?: Repository<ProjectEntity>,
    @Optional() private readonly hub?: NotifyHub,
  ) {}

  /** What each priority means: the defaults, or the wording an administrator set in Settings. */
  async priorityDefinitions(): Promise<PriorityDef[]> {
    return parsePriorityDefs(this.settings ? await this.settings.get(PRIORITY_DEFS_KEY).catch(() => null) : null);
  }

  async savePriorityDefinitions(list: unknown): Promise<PriorityDef[]> {
    const clean = parsePriorityDefs(list);
    await this.settings!.set(PRIORITY_DEFS_KEY, storePriorityDefs(clean));
    return clean;
  }

  /** The Request Log's statuses -- the defaults, or the list an administrator set in Settings. */
  async statuses(): Promise<LogStatus[]> {
    if (!this.settings) return DEFAULT_LOG_STATUSES;
    return parseLogStatuses(await this.settings.get(LOG_STATUSES_KEY).catch(() => null));
  }

  async saveStatuses(list: unknown): Promise<LogStatus[]> {
    const clean = parseLogStatuses(list);
    await this.settings!.set(LOG_STATUSES_KEY, JSON.stringify(clean));
    return clean;
  }

  async onApplicationBootstrap() {
    const tick = setInterval(() => { this.flushOverdue().catch((e) => this.log.warn('Held task emails: ' + (e as Error).message)); }, 60_000);
    tick.unref?.();
    // Start dates that arrive start their tasks (checked at boot and every 30 minutes).
    const starts = setInterval(() => { this.startDueTasks().catch((e) => this.log.warn('Task start dates: ' + (e as Error).message)); }, 30 * 60_000);
    starts.unref?.();
    this.startDueTasks().catch(() => undefined);
    try {
      await backfillAssignees(this.repo, this.users, 'assignedToId', 'assignedTo', this.log);
    } catch (err) {
      this.log.error('Assignee backfill failed: ' + (err as Error).message);
    }
    try {
      const n = await this.moveToBuckets();
      if (n) this.log.log(`Moved ${n} Request Log entries onto the task buckets`);
    } catch (err) {
      this.log.error('Request Log bucket move failed: ' + (err as Error).message);
    }
    try {
      const n = await this.linkLeads();
      if (n) this.log.log(`Linked ${n} Request Log entries to their lead`);
    } catch (err) {
      this.log.error('Request Log lead links failed: ' + (err as Error).message);
    }
    try {
      const n = await this.numberUnnumbered();
      if (n) this.log.log(`Gave ${n} Request Log entries a serial number`);
    } catch (err) {
      this.log.error('Request Log serial numbers failed: ' + (err as Error).message);
    }
  }

  /**
   * Entries the CRM filed under a lead's id as their "project" get a real lead
   * link instead; the project is blank until the lead becomes one.
   */
  async linkLeads() {
    if (!this.deals || !this.leads) return 0;
    const dealIds = new Set((await this.deals.find({ select: { id: true } as any })).map((d) => d.id));
    const rows = (await this.repo.find()).filter((t) => t.project && dealIds.has(t.project) && !t.leadId);
    if (!rows.length) return 0;
    const leads = new Map((await this.leads.find()).map((l) => [l.id, leadDisplayName(l)]));
    const converted = new Map(((await this.projects?.find()) || []).filter((p: any) => p.leadId && p.stage !== 'Kickoff').map((p: any) => [p.leadId, p.name]));
    for (const t of rows) await this.repo.update({ id: t.id }, { leadId: t.project, leadName: leads.get(t.project) || '', project: converted.get(t.project) || '' });
    return rows.length;
  }

  /**
   * What a task can be linked to: every project (not the placeholder a lead
   * keeps until it's converted) and every open lead -- work often starts
   * before a contract is signed.
   */
  async linkTargets() {
    const projects = ((await this.projects?.find()) || []) as any[];
    const deals = this.deals ? (await this.deals.find()).filter((d) => !d.archived && !d.convertedProjectId) : [];
    const leads = new Map(((await this.leads?.find()) || []).map((l) => [l.id, leadDisplayName(l)]));
    return {
      projects: projects.filter((p) => !(p.leadId && p.stage === 'Kickoff')).map((p) => ({ id: p.id, name: p.name, stage: p.stage })).sort((a, b) => a.name.localeCompare(b.name)),
      leads: deals.map((d) => ({ id: d.id, name: leads.get(d.id) || d.id, stage: d.stage })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** A lead became a project: its tasks with no project go to it (and stay linked to the lead). */
  async adoptLead(leadId: string, projectName: string) {
    const rows = await this.repo.findBy({ leadId });
    for (const t of rows.filter((x) => !x.project)) await this.repo.update({ id: t.id }, { project: projectName });
    return rows.length;
  }

  /** The lead fields of a create or patch: a lead's id given as the "project" becomes the lead link. */
  private async leadFields(dto: Record<string, any>) {
    const out: Record<string, any> = {};
    if (dto.project !== undefined && (await isLeadId(this.deals, dto.project))) { out.leadId = dto.project; out.project = ''; }
    else if (dto.leadId === undefined) return out;
    Object.assign(out, await resolveLead(this.leads, out.leadId ?? dto.leadId));
    return out;
  }

  /** Entries made before serial numbers get one: T- for tasks, FR- for FOR RECORD, per project and year. */
  async numberUnnumbered() {
    const rows = await this.repo.find();
    if (!rows.some((t) => !t.serial)) return 0;
    const made = (t: TaskEntity) => (/^\d{8}-/.test(t.id) ? `${t.id.slice(0, 4)}-${t.id.slice(4, 6)}-${t.id.slice(6, 8)}` : t.meetingDate);
    const pairs = backfillSerials(rows, (t) => logSerialKind(t.topicType) + '|' + (t.project || ''), (t) => logSerialKind(t.topicType), made);
    for (const [id, serial] of pairs) await this.repo.update({ id }, { serial });
    return pairs.length;
  }

  /**
   * Once: the Request Log moves onto the task buckets (Oct 16). A saved status
   * list gets the buckets ("Open" is To Do, "Closed" is Complete) and entries
   * on the old names move with it. Returns how many entries changed.
   */
  async moveToBuckets() {
    if (!this.settings || (await this.settings.get('requestLog.bucketsV1'))) return 0;
    const saved = await this.settings.get(LOG_STATUSES_KEY).catch(() => null);
    if (saved) await this.settings.set(LOG_STATUSES_KEY, JSON.stringify(withBuckets(parseLogStatuses(saved))));
    let n = 0;
    for (const t of await this.repo.find()) {
      const next = bucketOf(t.status, !!(t.assignedToId || String(t.assignedTo || '').trim()));
      if (next && next !== t.status) { await this.repo.update({ id: t.id }, { status: next }); n++; }
    }
    await this.settings.set('requestLog.bucketsV1', new Date().toISOString());
    return n;
  }

  private async isAdmin(actor: { id?: string }) {
    if (!actor.id) return false;
    return (await this.users.findOneBy({ id: actor.id }))?.roleKey === 'admin';
  }

  /** Who raised an entry: its creator in the history, else the originator's name. */
  private raisedBy(t: TaskEntity) {
    const created = normalizeList<ActivityEvent>(t.activity).find((e) => e.type === 'created');
    return { id: created?.byId, name: String(t.originator || created?.by || '').trim() };
  }

  /**
   * The bucket rules, as on the task board: old names map onto the buckets,
   * To Do and Assigned follow whether someone is assigned, and only whoever
   * raised it (or an admin) moves it to Confirmed -- it's archived 7 days later.
   * The start date is set the first time it goes In Progress.
   */
  private async bucketRules(task: TaskEntity, patch: Record<string, any>, actor: UploadActor) {
    const assigned = 'assignedTo' in patch || 'assignedToId' in patch
      ? !!(patch.assignedToId || String(patch.assignedTo || '').trim())
      : !!(task.assignedToId || String(task.assignedTo || '').trim());
    if (patch.status) patch.status = bucketOf(patch.status, assigned);
    const cur = patch.status ?? task.status;
    if (cur === 'To Do' && assigned) patch.status = 'Assigned';
    if (cur === 'Assigned' && !assigned) patch.status = 'To Do';
    // A start date that has arrived starts the work; nothing is in progress without an assignee.
    const pending = (s?: string | null) => !s || s === 'To Do' || s === 'Assigned';
    if ('startDate' in patch && patch.startDate !== task.startDate && pending(patch.status ?? task.status) && startDue(patch.startDate, assigned)) {
      patch.status = 'In Progress';
    }
    let next = patch.status ?? task.status;
    if (isInProgress(next) && !isInProgress(task.status) && !assigned) {
      if (!['Complete', 'Confirmed'].includes(task.status)) throw new BadRequestException(NO_ASSIGNEE_IN_PROGRESS);
      patch.status = next = 'To Do';
    }
    if (isInProgress(next) && !isInProgress(task.status) && !task.startDate && !patch.startDate) {
      patch.startDate = new Date().toISOString().slice(0, 10);
    }
    if (next === 'Confirmed' && task.status !== 'Confirmed') {
      const by = this.raisedBy(task);
      const mine = (by.id && by.id === actor.id) || (!by.id && by.name && by.name.toLowerCase() === String(actor.name || '').toLowerCase());
      if ((by.id || by.name) && !mine && !(await this.isAdmin(actor))) {
        throw new BadRequestException(`Only ${by.name || 'whoever raised it'} (or an admin) can confirm this.`);
      }
      patch.confirmedAt = new Date().toISOString();
    } else if (next !== 'Confirmed' && task.confirmedAt) {
      // Leaving Confirmed stops the archive clock.
      patch.confirmedAt = null;
      patch.archivedAt = null;
    }
    // Reopened (its status changed): out of the archive.
    if ((task.archivedAt || task.closedAt) && 'status' in patch && patch.status !== task.status) {
      patch.archivedAt = null;
      patch.closedAt = null;
    }
  }

  /** Confirmed a week ago or more: archived (out of the list unless asked for). */
  private async archiveConfirmed(rows: TaskEntity[]) {
    const cutoff = new Date(Date.now() - LOG_ARCHIVE_DAYS * 86400000).toISOString();
    const now = new Date().toISOString();
    for (const t of rows) {
      // A week after it's confirmed -- unless it was moved or changed since.
      if (t.status === 'Confirmed' && t.confirmedAt && !t.archivedAt && t.confirmedAt <= cutoff && (!t.updatedAt || t.updatedAt <= cutoff)) {
        t.archivedAt = now;
        await this.repo.update({ id: t.id }, { archivedAt: now });
      }
    }
    return rows;
  }

  /** Fill in the json columns so the client never has to null-check them. */
  private hydrate(task: TaskEntity): TaskEntity {
    return {
      ...task,
      attachments: normalizeAttachments(task.attachments),
      comments: normalizeList<TaskComment>(task.comments),
      activity: normalizeList<ActivityEvent>(task.activity),
      checklist: normalizeList(task.checklist),
      labels: normalizeList<string>(task.labels),
      linkedTaskIds: normalizeList<string>(task.linkedTaskIds),
      changeOrderIds: normalizeList<string>(task.changeOrderIds),
    } as TaskEntity;
  }

  async findAll(tab?: string, project?: string) {
    const where: Record<string, string> = {};
    if (tab) where.tab = tab;
    // A lead's id finds the entries linked to that lead.
    const rows = await this.archiveConfirmed(await this.repo.find({ where: project ? [{ ...where, project }, { ...where, leadId: project }] : where }));
    return rows.map((t) => this.hydrate(t));
  }

  async findOne(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.hydrate(task);
  }

  private async load(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  /**
   * Days between the meeting and either the close date or today.
   *
   * Only computed for real ISO dates: legacy rows store human strings like
   * "Apr 5", which Date.parse happily reads as the year 2001 and turns into a
   * nonsense age. Those keep whatever value they already had.
   */
  private daysOpen(task: TaskEntity): number {
    const iso = /^\d{4}-\d{2}-\d{2}/;
    const current = task.daysOpen ?? 0;
    if (!iso.test(task.meetingDate ?? '')) return current;
    const start = Date.parse(task.meetingDate);
    if (Number.isNaN(start)) return current;
    const end = task.dateClosed && iso.test(task.dateClosed) ? Date.parse(task.dateClosed) : Date.now();
    if (Number.isNaN(end)) return current;
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  async create(dto: any, actor: UploadActor) {
    const rows = await this.repo.find();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq =
      rows
        .filter((t) => String(t.id).startsWith(dateStr + '-'))
        .reduce((max, t) => Math.max(max, parseInt(String(t.id).split('-')[1], 10) || 0), 0) + 1;
    const id = dto.id || `${dateStr}-${String(seq).padStart(2, '0')}`;

    if (!String(dto.subject || '').trim() && !String(dto.description || '').trim()) throw new BadRequestException('Give the task a subject.');
    dto = { ...dto, ...(await this.leadFields(dto)) };
    const defer = !!dto.deferNotify;
    delete dto.deferNotify; delete dto.pendingNotices;
    const assignee = await resolveAssignee(this.users, { id: dto.assignedToId, name: dto.assignedTo });
    // Checklist templates marked "add automatically to" this kind of entry.
    const templates = this.checklistTemplates ? await this.checklistTemplates.find().catch(() => []) : [];
    const checklist = withAutoChecklists(templates, { kind: logSerialKind(dto.topicType || 'Task') as 'task' | 'record', type: dto.topicType || 'Task', labels: normalizeList<string>(dto.labels) }, normalizeList(dto.checklist));

    const task = this.repo.create({
      tab: 'internal',
      meetingType: 'Internal',
      meetingDate: new Date().toISOString().slice(0, 10),
      status: 'To Do',
      topicType: 'Task',
      description: '',
      project: '',
      daysOpen: 0,
      ...dto,
      id,
      // Who raised it: whoever created it, unless the form named someone else.
      originator: String(dto.originator || '').trim() || actor.name || '',
      assignedTo: assignee.name,
      assignedToId: assignee.id ?? undefined,
      attachments: [],
      comments: [],
      checklist,
      labels: normalizeList<string>(dto.labels),
      priority: cleanPriority(dto.priority),
      linkedTaskIds: cleanIds(dto.linkedTaskIds),
      changeOrderIds: cleanIds(dto.changeOrderIds),
      collaborators: normalizeCollaborators(dto.collaborators, assignee.id),
      activity: [event('created', actor, { text: 'created this task' })],
      updatedAt: new Date().toISOString(),
    } as Partial<TaskEntity>);
    // New entries start in To Do, or Assigned when someone is named.
    task.status = bucketOf(task.status || 'To Do', !!(task.assignedToId || String(task.assignedTo || '').trim())) || 'To Do';
    if (task.status === 'To Do' && (task.assignedToId || String(task.assignedTo || '').trim())) task.status = 'Assigned';
    if ((task.status === 'To Do' || task.status === 'Assigned') && task.assignedTo && startDue(task.startDate, true)) task.status = 'In Progress';
    if (isInProgress(task.status) && !(task.assignedToId || String(task.assignedTo || '').trim())) throw new BadRequestException(NO_ASSIGNEE_IN_PROGRESS);
    if (isInProgress(task.status) && !task.startDate) task.startDate = new Date().toISOString().slice(0, 10);
    task.serial = nextSerial(rows.filter((r) => (r.project || '') === (task.project || '')).map((r) => r.serial), logSerialKind(task.topicType), serialYear());

    const at = new Date().toISOString();
    const who = { id: actor.id, name: actor.name };
    const followers = normalizeCollaborators(task.collaborators);
    const notices: PendingNotice[] = [
      ...(assignee.id ? [{ kind: 'assigned' as const, ids: [String(assignee.id)], actor: who, at }] : []),
      ...(followers.length ? [{ kind: 'added' as const, ids: followers.map((c) => c.id), actor: who, at }] : []),
    ];
    if (defer) task.pendingNotices = holdNotices(null, notices);
    const saved = await this.repo.save(task);
    if (!defer) this.sendNotices(saved, notices);
    return this.hydrate(saved);
  }

  /** The task card an email carries. */
  private notice(t: TaskEntity, actor: UploadActor) {
    return { surface: 'log' as const, taskId: t.id, title: taskTitle(t), description: t.subject ? t.description || undefined : undefined, projectName: t.project, dueDate: t.dueDate, priority: t.topicType, status: t.status, actor };
  }

  /**
   * Patch a task. Records one activity entry per changed field, keeps
   * `daysOpen`/`dateClosed` consistent, and resolves the assignee to a user id.
   */
  async update(id: string, dto: any, actor: UploadActor) {
    const task = await this.load(id);
    const patch: Record<string, any> = { ...dto };
    delete patch.id; delete patch.serial; delete patch.pendingNotices;
    // From the task editor (autosave): emails wait for its Save button.
    const defer = !!patch.deferNotify; delete patch.deferNotify;
    // "Close task": complete and archived at once (reopened by changing its status).
    const closingNow = !!patch.close; delete patch.close; delete patch.closedAt; delete patch.archivedAt;
    if (closingNow && !['Complete', 'Confirmed'].includes(task.status)) patch.status = 'Complete';
    Object.assign(patch, await this.leadFields(patch));

    if ('assignedTo' in patch || 'assignedToId' in patch) {
      const assignee = await resolveAssignee(this.users, {
        id: patch.assignedToId,
        name: patch.assignedTo,
      });
      patch.assignedTo = assignee.name;
      patch.assignedToId = assignee.id ?? null;
    }

    const note = cleanCompletionNote(patch.completionNote); delete patch.completionNote;
    await this.bucketRules(task, patch, actor);
    if ('priority' in patch) patch.priority = cleanPriority(patch.priority);

    // Closing a task (any status marked "closed" in Settings) stamps the close
    // date; reopening clears it. "Blocked" is the board's old word for On hold.
    const statuses = await this.statuses();
    if (patch.status && /^(blocked|on[\s-]*hold)$/i.test(String(patch.status))) patch.status = statuses.find((s) => /^on[\s-]*hold$/i.test(s.name))?.name || patch.status;
    const closing = !!patch.status && isClosedStatus(statuses, patch.status);
    const wasClosed = isClosedStatus(statuses, task.status);
    if (closing && !wasClosed && !patch.dateClosed) {
      patch.dateClosed = new Date().toISOString().slice(0, 10);
    }
    if (patch.status && !closing) patch.dateClosed = '';
    for (const k of ['linkedTaskIds', 'changeOrderIds'] as const) if (k in patch) patch[k] = cleanIds(patch[k]);

    // Collaborators: a clean list, recorded in the activity, and newcomers told.
    let joined: { id: string; name: string }[] = [];
    const collabEvents: ActivityEvent[] = [];
    if ('collaborators' in patch) {
      patch.collaborators = normalizeCollaborators(patch.collaborators, patch.assignedToId ?? task.assignedToId);
      const { added, removed } = collaboratorChanges(task.collaborators, patch.collaborators);
      joined = added;
      if (added.length) collabEvents.push(event('collaborators', actor, { text: `added ${added.map((c) => c.name).join(', ')} as collaborator${added.length === 1 ? '' : 's'}` }));
      if (removed.length) collabEvents.push(event('collaborators', actor, { text: `removed ${removed.map((c) => c.name).join(', ')} from collaborators` }));
    }
    const finished = closing && !wasClosed;
    // Any other status move tells everyone on the entry (To Do <-> Assigned just follows the assignee).
    const moved = !finished && !closingNow && 'status' in patch && patch.status !== task.status
      && !(['Assigned', 'To Do'].includes(patch.status) && ('assignedToId' in patch || 'assignedTo' in patch));
    // Marking it complete says what was done (a resolution counts; closing it is the assigner's call).
    const noteEvents: ActivityEvent[] = [];
    if (finished && !closingNow && !note && !String(patch.resolution ?? '').trim()) throw new BadRequestException(NEEDS_COMPLETION_NOTE);
    if (finished && note) {
      patch.completionNote = note;
      noteEvents.push(event('comment', actor, { text: `Completion note: ${note}` }));
    }

    if (closingNow) { const at = new Date().toISOString(); patch.archivedAt = at; patch.closedAt = at; }
    const events = [...diffEvents(task, patch, actor), ...collabEvents, ...noteEvents, ...(closingNow ? [event('status', actor, { text: 'closed this task (archived)' })] : [])];
    const reassignedTo = 'assignedToId' in patch && patch.assignedToId && patch.assignedToId !== task.assignedToId
      ? String(patch.assignedToId)
      : null;

    if (holdReasonMissing(task, patch)) throw new BadRequestException(NEEDS_HOLD_REASON);
    // Off hold: the reason goes with it (it stays in the history).
    if ((patch.status ?? task.status) !== 'On hold' && task.holdReason) patch.holdReason = null;

    const at = new Date().toISOString();
    const who = { id: actor.id, name: actor.name };
    const notices: PendingNotice[] = [
      ...(reassignedTo ? [{ kind: 'assigned' as const, ids: [reassignedTo], actor: who, at }] : []),
      ...(joined.length ? [{ kind: 'added' as const, ids: joined.map((c) => c.id), actor: who, at }] : []),
      ...(finished ? [{ kind: 'done' as const, ids: [], actor: who, at }] : []),
      ...(moved ? [{ kind: 'status' as const, ids: [], actor: who, at, status: patch.status }] : []),
    ];
    Object.assign(task, patch, { id });
    task.activity = [...normalizeList<ActivityEvent>(task.activity), ...events];
    task.daysOpen = this.daysOpen(task);
    task.updatedAt = new Date().toISOString();
    if (defer && notices.length) task.pendingNotices = holdNotices(task.pendingNotices, notices);

    const saved = await this.repo.save(task);
    if (!defer) this.sendNotices(saved, notices);
    if (moved || finished) {
      void this.hub?.highVizTask({ labels: normalizeList<string>(saved.labels), projectName: saved.project || null },
        { title: `${taskTitle(saved)} — ${saved.status}`, path: `/tasks?task=${encodeURIComponent(saved.id)}&type=log`, actorId: actor.id }).catch(() => undefined);
    }
    return this.hydrate(saved);
  }

  /** Send task emails now. */
  private sendNotices(t: TaskEntity, notices: PendingNotice[]) {
    void (async () => {
      for (const n of notices) {
        const notice = this.notice(t, n.actor);
        if (n.kind === 'assigned') this.notifications.taskAssigned({ ...notice, assigneeId: n.ids[0] });
        else if (n.kind === 'added') this.notifications.taskFollowUp(notice, n.ids, { kind: 'added' });
        else if (n.kind === 'status') this.notifications.taskFollowUp({ ...notice, status: n.status || t.status }, await this.involved(t), { kind: 'status' });
        else this.notifications.taskFollowUp(notice, await this.involved(t), { kind: 'done' });
      }
    })().catch((e) => this.log.warn('Task notices: ' + (e as Error).message));
  }

  /** Everyone on an entry: assignee, collaborators, whoever entered it (the assigner) and its source. */
  private async involved(t: TaskEntity) {
    const by = this.raisedBy(t);
    const source = t.originator ? (await this.users.find()).find((u) => u.name.trim().toLowerCase() === t.originator.trim().toLowerCase()) : null;
    return [t.assignedToId, ...normalizeCollaborators(t.collaborators).map((c) => c.id), by.id, source?.id].filter(Boolean) as string[];
  }

  /** Save pressed: send the emails held on this entry (the ones still true). */
  async flushNotices(id: string) {
    const t = await this.repo.findOneBy({ id });
    if (!t?.pendingNotices?.length) return { sent: 0 };
    const closed = new Set((await this.statuses()).filter((s) => s.closed).map((s) => s.name));
    const live = stillTrue(t.pendingNotices, { assigneeId: t.assignedToId, collaboratorIds: normalizeCollaborators(t.collaborators).map((c) => c.id), done: closed.has(t.status), status: t.status });
    await this.repo.update({ id }, { pendingNotices: null } as any);
    this.sendNotices(t, live);
    return { sent: live.length };
  }

  /** Emails held more than 15 minutes (the page was closed without Save) go out anyway. */
  /** Assigned entries whose start date has arrived go In Progress. Returns how many moved. */
  async startDueTasks() {
    const rows = (await this.repo.find()).filter((t) => !t.archivedAt && (t.status === 'To Do' || t.status === 'Assigned')
      && startDue(t.startDate, !!(t.assignedToId || String(t.assignedTo || '').trim())));
    for (const t of rows) {
      try { await this.update(t.id, { status: 'In Progress' }, { name: 'System' }); }
      catch (e) { this.log.warn(`Start ${t.id}: ${(e as Error).message}`); }
    }
    return rows.length;
  }

  async flushOverdue() {
    for (const t of (await this.repo.find()).filter((x) => overdue(x.pendingNotices))) await this.flushNotices(t.id);
  }

  async remove(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (task) {
      await this.attachments.discardAll(normalizeAttachments(task.attachments));
      await this.repo.remove(task);
    }
    return { id, deleted: true };
  }

  // ------------------------------------------------------------- attachments

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const task = await this.load(id);
    const added = await this.attachments.upload(files, SCOPE, actor);
    task.attachments = [...normalizeAttachments(task.attachments), ...added];
    task.activity = [
      ...normalizeList<ActivityEvent>(task.activity),
      ...added.map((a) => event('attachment', actor, { text: `attached ${a.name}` })),
    ];
    task.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(task));
  }

  /** Attach an external link rather than a stored file. */
  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const task = await this.load(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString() };
    task.attachments = [...normalizeAttachments(task.attachments), att];
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('attachment', actor, { text: `linked ${att.name}` })];
    return this.hydrate(await this.repo.save(task));
  }

  async removeAttachment(id: string, attId: string, actor: UploadActor) {
    const task = await this.load(id);
    const all = normalizeAttachments(task.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments.discard(target);
    task.attachments = all.filter((a) => a.id !== attId);
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('attachment', actor, { text: `removed ${target.name}` })];
    return this.hydrate(await this.repo.save(task));
  }

  /** Look an attachment up on its own task — a Drive id alone is never enough. */
  async attachment(id: string, attId: string) {
    const task = await this.load(id);
    const att = normalizeAttachments(task.attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  // ------------------------------------------------------------ FOR RECORD links

  /**
   * Attach an entry (typically a FOR RECORD observation, FYI or decision) to a
   * Request Log task -- recorded on both, so each shows the other -- or to a
   * change order. Linking twice is harmless.
   */
  async link(id: string, kind: 'task' | 'changeOrder', targetId: string, actor: UploadActor) {
    const task = await this.load(id);
    targetId = String(targetId || '').trim();
    if (!targetId) throw new BadRequestException('Pick what to link it to.');
    if (kind === 'task') {
      if (targetId === id) throw new BadRequestException('An entry can’t be linked to itself.');
      const other = await this.load(targetId);
      if (!cleanIds(task.linkedTaskIds).includes(targetId)) {
        task.linkedTaskIds = [...cleanIds(task.linkedTaskIds), targetId];
        task.activity = [...normalizeList<ActivityEvent>(task.activity), event('link', actor, { text: `linked task ${taskTitle(other)}` })];
      }
      if (!cleanIds(other.linkedTaskIds).includes(id)) {
        other.linkedTaskIds = [...cleanIds(other.linkedTaskIds), id];
        other.activity = [...normalizeList<ActivityEvent>(other.activity), event('link', actor, { text: `linked ${task.topicType || 'entry'} ${taskTitle(task)}` })];
        other.updatedAt = new Date().toISOString();
        await this.repo.save(other);
      }
    } else if (kind === 'changeOrder') {
      const co = this.cos ? await this.cos.findOneBy({ id: targetId }) : null;
      if (this.cos && !co) throw new NotFoundException('Change order not found');
      if (!cleanIds(task.changeOrderIds).includes(targetId)) {
        task.changeOrderIds = [...cleanIds(task.changeOrderIds), targetId];
        task.activity = [...normalizeList<ActivityEvent>(task.activity), event('link', actor, { text: `linked change order ${co ? `${co.number} · ${co.title}` : targetId}` })];
      }
    } else {
      throw new BadRequestException('Link to a task or a change order.');
    }
    task.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(task));
  }

  async unlink(id: string, kind: 'task' | 'changeOrder', targetId: string, actor: UploadActor) {
    const task = await this.load(id);
    if (kind === 'task') {
      task.linkedTaskIds = cleanIds(task.linkedTaskIds).filter((x) => x !== targetId);
      const other = await this.repo.findOneBy({ id: targetId });
      if (other && cleanIds(other.linkedTaskIds).includes(id)) {
        other.linkedTaskIds = cleanIds(other.linkedTaskIds).filter((x) => x !== id);
        await this.repo.save(other);
      }
    } else {
      task.changeOrderIds = cleanIds(task.changeOrderIds).filter((x) => x !== targetId);
    }
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('link', actor, { text: `removed a link to ${kind === 'task' ? 'task' : 'change order'} ${targetId}` })];
    task.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(task));
  }

  /**
   * A task driven by an entry: created on the same project and meeting, linked
   * both ways. Returns the new task and the entry as it now stands.
   */
  async createLinkedTask(id: string, dto: { subject?: string; description?: string; assignedTo?: string; assignedToId?: string; dueDate?: string }, actor: UploadActor) {
    const source = await this.load(id);
    const kind = source.topicType || 'entry';
    const created = await this.create({
      topicType: 'Task',
      subject: String(dto.subject || '').trim() || `Follow up: ${taskTitle(source)}`.slice(0, 300),
      description: String(dto.description || '').trim() || `From ${kind} ${source.id}: ${taskTitle(source)}`,
      assignedTo: dto.assignedTo, assignedToId: dto.assignedToId, dueDate: dto.dueDate || undefined,
      project: source.project || '', tab: source.tab || 'internal',
      meetingType: source.meetingType, meetingDate: source.meetingDate, meetingId: source.meetingId || undefined,
    }, actor);
    const entry = await this.link(id, 'task', created.id, actor);
    return { task: await this.findOne(created.id), entry };
  }

  // ---------------------------------------------------------------- comments

  async addComment(id: string, text: string, actor: UploadActor) {
    const task = await this.load(id);
    if (!text?.trim()) throw new NotFoundException('Comment text is required');
    const comment: TaskComment = {
      id: subId('c'),
      author: actor.name,
      authorId: actor.id,
      text: text.trim(),
      date: new Date().toISOString(),
    };
    task.comments = [...normalizeList<TaskComment>(task.comments), comment];
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('comment', actor, { text: comment.text })];
    const saved = await this.repo.save(task);
    // Everyone following the task hears about a comment (the assignee too), except its author.
    // @mentioned people hear they were mentioned; everyone else following hears about a comment.
    const mentioned = mentionedIds(comment.text, await this.users.find());
    const followers = [...normalizeCollaborators(saved.collaborators).map((c) => c.id), saved.assignedToId].filter((x) => x && !mentioned.includes(x)) as string[];
    if (mentioned.length) this.notifications.taskFollowUp(this.notice(saved, actor), mentioned, { kind: 'mention', comment: comment.text });
    if (followers.length) this.notifications.taskFollowUp(this.notice(saved, actor), followers, { kind: 'comment', comment: comment.text });
    return this.hydrate(saved);
  }
}

/** A clean list of ids: strings, trimmed, no blanks or repeats. */
export function cleanIds(v: unknown): string[] {
  return [...new Set(normalizeList<unknown>(v as any).map((x) => String(x ?? '').trim()).filter(Boolean))];
}

/** A request-log task's name: its subject, or (older tasks) the first line of its description. */
export function taskTitle(t: Pick<TaskEntity, 'id' | 'subject' | 'description'>): string {
  return (t.subject || '').trim() || (t.description || '').split(/\r?\n/)[0].trim().slice(0, 120) || t.id;
}
