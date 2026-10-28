import { BadRequestException, Injectable, OnApplicationBootstrap, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { backfillCommentCounts, backfillCreatedBy, slimSelect, slimTask } from '../database/slim-tasks';
import { NotifyHub } from '../notifications/notify-hub.service';
import { mentionedIds } from '../tasks/mentions';
import { cleanCompletionNote, startDue, NEEDS_COMPLETION_NOTE, NEEDS_HOLD_REASON, NO_ASSIGNEE_IN_PROGRESS, holdReasonMissing } from '../tasks/task-rules';
import { ChecklistTemplateEntity, LeadEntity, ProjectEntity, ProjectTaskEntity, TaskEntity, UserEntity } from '../database/entities';
import { resolveLead } from '../tasks/lead-link';
import { holdNotices, overdue, stillTrue, type PendingNotice } from '../notifications/pending-notices';
import { withAutoChecklists } from './auto-checklist';
import { DEFAULT_TASKS } from '../seed-data/project-tasks';
import { SectionsService } from './sections.service';
import {
  diffEvents, event, normalizeAttachments, normalizeList, subId,
  type ActivityEvent, type TaskAttachment, type TaskComment,
  normalizeCollaborators, collaboratorChanges, normalizeTaskStatus, bucketStatus, isDoneStatus,
} from '../database/task.types';
import { backfillAssignees, resolveAssignee } from '../database/assignee.util';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { backfillSerials, newTaskId, nextSerial, serialYear } from '../database/serials';

/** Days a Confirmed task stays on the board before it's archived. */
export const ARCHIVE_AFTER_DAYS = 7;

@Injectable()
export class ProjectTasksService implements OnApplicationBootstrap {
  private readonly log = new Logger('ProjectTasksService');

  constructor(
    @InjectRepository(ProjectTaskEntity) private readonly repo: Repository<ProjectTaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly sections: SectionsService,
    private readonly attachments: AttachmentsService,
    private readonly notifications: NotificationsService,
    @Optional() @InjectRepository(ChecklistTemplateEntity) private readonly checklistTemplates?: Repository<ChecklistTemplateEntity>,
    @Optional() @InjectRepository(LeadEntity) private readonly leads?: Repository<LeadEntity>,
    @Optional() private readonly hub?: NotifyHub,
    @Optional() @InjectRepository(TaskEntity) private readonly logTasks?: Repository<TaskEntity>,
    @Optional() @InjectRepository(ProjectEntity) private readonly projects?: Repository<ProjectEntity>,
  ) {}

  /**
   * A lead became a project: its board tasks with no project move onto that
   * project's board, each into the column matching its status (else the first).
   */
  async adoptLead(leadId: string, projectId: number) {
    const rows = (await this.repo.findBy({ leadId })).filter((t) => t.projectId == null);
    if (!rows.length) return 0;
    const sections = await this.sections.forProject(projectId);
    for (const t of rows) {
      const home = sections.find((s) => bucketStatus(s.name) === normalizeTaskStatus(t.status)) || sections[0];
      await this.repo.update({ id: t.id }, { projectId, ...(t.parentId ? {} : { sectionId: home?.id ?? t.sectionId }) });
    }
    return rows.length;
  }

  async onApplicationBootstrap() {
    const tick = setInterval(() => { this.flushOverdue().catch((e) => this.log.warn('Held task emails: ' + (e as Error).message)); }, 60_000);
    tick.unref?.();
    // Start dates that arrive start their tasks (checked at boot and every 30 minutes).
    const starts = setInterval(() => { this.startDueTasks().catch((e) => this.log.warn('Task start dates: ' + (e as Error).message)); }, 30 * 60_000);
    starts.unref?.();
    this.startDueTasks().catch(() => undefined);
    backfillCommentCounts(this.repo, this.log).catch((e) => this.log.warn('Comment counts: ' + (e as Error).message));
    backfillCreatedBy(this.repo, this.log).catch((e) => this.log.warn('Task creators: ' + (e as Error).message));
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_TASKS as unknown as ProjectTaskEntity[]);
        this.log.log(`Seeded ${DEFAULT_TASKS.length} project tasks`);
      }
      await backfillAssignees(this.repo, this.users, 'assigneeId', 'assignee', this.log);
      await this.renameLegacyTitles();
      const fixed = await this.fixCompleted();
      if (fixed) this.log.log(`Put ${fixed} completed task(s) in Done`);
      // "Blocked" became "On hold" -- carry saved tasks across once.
      const blocked = await this.repo.findBy({ status: 'Blocked' });
      if (blocked.length) {
        for (const t of blocked) t.status = 'On hold';
        await this.repo.save(blocked);
        this.log.log(`Renamed ${blocked.length} task status(es) Blocked -> On hold`);
      }
    } catch (err) {
      this.log.error('Task seed failed: ' + (err as Error).message);
    }
    try {
      const rows = await this.repo.find();
      const pairs = backfillSerials(rows, (t) => String(t.projectId ?? ''), () => 'task', (t) => t.createdAt);
      for (const [id, serial] of pairs) await this.repo.update({ id }, { serial });
      if (pairs.length) this.log.log(`Gave ${pairs.length} board task(s) a serial number`);
    } catch (err) {
      this.log.error('Board task serial numbers failed: ' + (err as Error).message);
    }
  }

  /**
   * Rename tasks whose titles have changed since they were seeded.
   *
   * Renaming the seed only affects fresh databases; rows already saved keep the
   * old wording forever otherwise. Idempotent — it only matches the old title.
   */
  private async renameLegacyTitles() {
    const RENAMES: [string, string][] = [
      ['Press Release & Project Info', 'Project Info'],
    ];
    for (const [from, to] of RENAMES) {
      const rows = await this.repo.findBy({ title: from });
      if (!rows.length) continue;
      for (const row of rows) row.title = to;
      await this.repo.save(rows);
      this.log.log(`Renamed ${rows.length} task(s): "${from}" -> "${to}"`);
    }
  }

  /** Fill in the json columns so the client never has to null-check them. */
  private hydrate(task: ProjectTaskEntity): ProjectTaskEntity {
    return {
      ...task,
      attachments: normalizeAttachments(task.attachments),
      comments: normalizeList<TaskComment>(task.comments),
      activity: normalizeList<ActivityEvent>(task.activity),
      checklist: normalizeList(task.checklist),
      labels: normalizeList<string>(task.labels),
      dependsOn: normalizeList<string>(task.dependsOn),
      status: task.status || (task.completed ? 'Done' : 'Not started'),
    } as ProjectTaskEntity;
  }

  /** Confirmed tasks are archived 7 days later -- checked by the half-hourly timer, not on every read. */
  async archiveConfirmed() {
    const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * 86400000;
    const rows = await this.repo.find({ where: { status: 'Confirmed', archivedAt: IsNull() }, select: { id: true, status: true, archivedAt: true, confirmedAt: true, updatedAt: true } });
    // A week after it's confirmed -- unless it was moved or changed since.
    const due = rows.filter((t) => t.confirmedAt && Date.parse(t.confirmedAt) <= cutoff && (!t.updatedAt || Date.parse(t.updatedAt) <= cutoff));
    if (due.length) await this.repo.update({ id: In(due.map((t) => t.id)) }, { archivedAt: new Date().toISOString() });
    return due.length;
  }

  /**
   * `undefined` = every task across every project + General Tasks (used by
   * My Tasks, Notifications, the dashboard's attention strip -- callers that
   * genuinely want everything). `null` = only the General Tasks board (not
   * tied to any client project). A number = that project only.
   */
  async findAll(projectId?: number | null, opts: { slim?: boolean } = {}): Promise<any[]> {
    // One board's tasks are read from the database on their own, not picked out of every task.
    const where = projectId === undefined ? undefined : { projectId: projectId === null ? IsNull() : projectId };
    const rows = await this.repo.find({ where, order: { order: 'ASC' }, ...(opts.slim ? { select: slimSelect(this.repo) } : {}) });
    return rows.map((t) => (opts.slim ? slimTask(this.hydrate(t), t.comments) : this.hydrate(t)));
  }

  // { sections, tasks } for one project (or, projectId === null, the
  // General Tasks board) — the board payload.
  async board(projectId: number | null, opts: { slim?: boolean } = {}) {
    const sections = await this.sections.forProject(projectId);
    const tasks = await this.findAll(projectId, opts);
    return { sections, tasks };
  }

  /** One task, for access checks. */
  async get(id: string) {
    return this.load(id);
  }

  /** One task in full (comments, history), for its drawer. */
  async findOne(id: string) {
    return this.hydrate(await this.load(id));
  }

  private async load(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  /**
   * `status` and the older `completed` boolean describe the same thing, and both
   * are read in different places, so keep them consistent whichever one changed.
   */
  /**
   * A column named like a bucket (To Do, Assigned, In Progress, On Hold, Done /
   * Complete, Confirmed) and the task's status are one thing: dragging a card into
   * it sets the status, and setting the status files the card there. Columns with
   * other names ("In Review") leave the status alone.
   */
  private async syncBucketSection(task: Partial<ProjectTaskEntity>, patch: Record<string, any>) {
    const projectId = patch.projectId !== undefined ? patch.projectId : task.projectId;
    if (projectId === undefined) return;
    const sections = await this.sections.forProject(projectId == null ? null : Number(projectId));
    const bucketOf = (id?: string | null) => bucketStatus(sections.find((x) => x.id === id)?.name);
    const movingSection = 'sectionId' in patch && patch.sectionId !== task.sectionId;
    const changingStatus = 'status' in patch && patch.status !== task.status;
    if (movingSection && !changingStatus) {
      const into = bucketOf(patch.sectionId);
      if (into) patch.status = into;
      // A finished card moved into a column that isn't a status ("In Review"): it's back in work.
      else if (isDoneStatus(task.status)) patch.status = 'In progress';
      // Out of the hold column into one that isn't a bucket: no longer on hold.
      else if (task.status === 'On hold' && bucketOf(task.sectionId) === 'On hold') patch.status = 'In progress';
    } else if (changingStatus && !movingSection) {
      if (bucketOf(task.sectionId) === patch.status) return;
      // Complete may live in a "Done" column and Confirmed alongside it when there's no Confirmed column.
      const target = sections.find((x) => bucketStatus(x.name) === patch.status)
        || (patch.status === 'Confirmed' ? sections.find((x) => bucketStatus(x.name) === 'Done') : undefined)
        || (patch.status === 'Assigned' ? sections.find((x) => bucketStatus(x.name) === 'Not started') : undefined);
      if (target && target.id !== task.sectionId) patch.sectionId = target.id;
      else if (!target && bucketOf(task.sectionId) && bucketOf(task.sectionId) !== patch.status) {
        // Leaving a bucket column for a status with no column of its own: In Progress is the usual home.
        const fallback = sections.find((x) => bucketStatus(x.name) === 'In progress');
        if (fallback && patch.status !== 'Assigned' && patch.status !== 'Not started') patch.sectionId = fallback.id;
      }
    }
  }

  /**
   * Keep `status` and the older `completed` flag together, and apply the bucket
   * rules: To Do becomes Assigned once someone is assigned (and back if they're
   * removed); a task's start date is set the first time it goes In Progress;
   * Confirmed is the originator's call, and stamps the 7-day archive clock.
   */
  private async syncStatus(task: ProjectTaskEntity, patch: Record<string, any>, actor: UploadActor) {
    if ('status' in patch) {
      patch.completed = isDoneStatus(patch.status);
    } else if ('completed' in patch) {
      if (patch.completed) { if (!isDoneStatus(task.status)) patch.status = 'Done'; }
      else if (isDoneStatus(task.status) || !task.status) patch.status = 'In progress';
    }
    const assigned = 'assigneeId' in patch || 'assignee' in patch
      ? !!(patch.assigneeId || (patch.assignee || '').trim())
      : !!(task.assigneeId || (task.assignee || '').trim());
    const status = patch.status ?? task.status ?? 'Not started';
    if (status === 'Not started' && assigned) patch.status = 'Assigned';
    if (status === 'Assigned' && !assigned) patch.status = 'Not started';

    // Board tasks (a phase's dates are its plan): a start date that has arrived starts the work.
    const board = !(patch.phaseId ?? task.phaseId);
    const pending = (s?: string | null) => !s || s === 'Not started' || s === 'Assigned';
    if (board && 'startDate' in patch && patch.startDate !== task.startDate && pending(patch.status ?? task.status) && startDue(patch.startDate, assigned)) {
      patch.status = 'In progress';
    }
    let next = patch.status ?? task.status;
    // Nothing is in progress without someone doing it (a finished card reopened unassigned goes back to To Do).
    if (board && next === 'In progress' && task.status !== 'In progress' && !assigned) {
      if (!isDoneStatus(task.status)) throw new BadRequestException(NO_ASSIGNEE_IN_PROGRESS);
      patch.status = next = 'Not started';
    }
    if (next === 'In progress' && task.status !== 'In progress' && !task.startDate && !patch.startDate) {
      patch.startDate = new Date().toISOString().slice(0, 10);
    }
    if (next === 'Confirmed' && task.status !== 'Confirmed') {
      const originator = task.createdById || this.createdByIdOf(task);
      if (originator && actor.id !== originator && !(await this.isAdmin(actor))) {
        throw new BadRequestException(`Only ${task.createdByName || 'whoever created it'} (or an admin) can confirm this task.`);
      }
      patch.confirmedAt = new Date().toISOString();
      patch.completed = true;
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

  private createdByIdOf(task: ProjectTaskEntity): string | undefined {
    const ev = normalizeList<ActivityEvent>(task.activity).find((e) => e.type === 'created');
    return (ev as any)?.actorId || (ev as any)?.byId || undefined;
  }

  private async isAdmin(actor: UploadActor) {
    if (!actor.id) return false;
    const u = await this.users.findOneBy({ id: actor.id });
    return u?.roleKey === 'admin';
  }

  /** A subtask must say who does it and by when -- that's what makes it trackable. */
  private assertSubtaskFields(t: { assignee?: string | null; assigneeId?: string | null; dueDate?: string | null }) {
    const missing = [!(t.assigneeId || (t.assignee || '').trim()) && 'an assignee', !(t.dueDate || '').trim() && 'a due date'].filter(Boolean);
    if (missing.length) throw new BadRequestException(`A subtask needs ${missing.join(' and ')}.`);
  }

  /** A parent can't be finished while any of its subtasks is still open. */
  private async assertSubtasksDone(parentId: string) {
    const open = (await this.repo.find({ where: { parentId } })).filter((s) => !s.completed && !isDoneStatus(s.status));
    if (open.length) throw new BadRequestException(`Finish its ${open.length} open subtask${open.length === 1 ? '' : 's'} first.`);
  }

  async create(dto: any, actor: UploadActor = { name: 'Unknown' }) {
    if (dto.parentId) this.assertSubtaskFields(dto);
    // A subtask's emails wait until its parent is saved (as do any the editor asks to hold).
    const defer = !!dto.parentId || !!dto.deferNotify;
    dto = { ...dto }; delete dto.deferNotify; delete dto.pendingNotices;
    // Ids are made here (never by the client) and are unique even in the same millisecond -- the old
    // 'T-' + Date.now() could repeat, and saving a repeat overwrote the other task.
    const id = newTaskId();
    delete dto.id;
    if (dto.status) {
      dto = { ...dto, status: normalizeTaskStatus(dto.status) };
      const p: Record<string, any> = { status: dto.status };
      await this.syncBucketSection({ projectId: dto.projectId == null ? null : Number(dto.projectId), sectionId: dto.sectionId, status: '' }, p);
      if (p.sectionId) dto.sectionId = p.sectionId;
    } else if (dto.sectionId) {
      // Added straight into a bucket column (e.g. "+ Add task" under In Progress): that's its status.
      const sections = await this.sections.forProject(dto.projectId == null ? null : Number(dto.projectId));
      const b = bucketStatus(sections.find((x) => x.id === dto.sectionId)?.name);
      if (b) dto = { ...dto, status: b };
    }
    const assignee = await resolveAssignee(this.users, { id: dto.assigneeId, name: dto.assignee });
    if (dto.leadId !== undefined) dto = { ...dto, ...(await resolveLead(this.leads, dto.leadId)) };
    // Checklist templates marked "add automatically to" tasks (not subtasks).
    const templates = !dto.parentId && this.checklistTemplates ? await this.checklistTemplates.find().catch(() => []) : [];
    const checklist = withAutoChecklists(templates, { kind: 'task', labels: normalizeList<string>(dto.labels) }, normalizeList(dto.checklist));
    const requester = dto.requestedById || dto.requestedBy ? await resolveAssignee(this.users, { id: dto.requestedById, name: dto.requestedBy }) : null;
    let status: string = dto.status || (dto.completed ? 'Done' : 'Not started');
    if (status === 'Not started' && assignee.name) status = 'Assigned';
    const board = !dto.phaseId;
    if (board && (status === 'Not started' || status === 'Assigned') && startDue(dto.startDate, !!assignee.name)) status = 'In progress';
    if (board && status === 'In progress' && !assignee.name) throw new BadRequestException(NO_ASSIGNEE_IN_PROGRESS);
    const task = {
      order: 0, parentId: null, attachments: [], comments: [], commentCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      ...dto,
      assignee: assignee.name,
      assigneeId: assignee.id ?? undefined,
      ...(requester ? { requestedBy: requester.name, requestedById: requester.id ?? undefined } : {}),
      status,
      completed: isDoneStatus(status) || !!dto.completed,
      startDate: dto.startDate || (status === 'In progress' ? new Date().toISOString().slice(0, 10) : undefined),
      createdById: actor.id, createdByName: actor.name,
      checklist,
      labels: normalizeList<string>(dto.labels),
      collaborators: normalizeCollaborators(dto.collaborators, assignee.id),
      activity: [event('created', actor, { text: 'created this task' })],
      updatedAt: new Date().toISOString(),
      projectId: dto.projectId == null ? null : Number(dto.projectId),
      id,
    };
    const peers = (await this.repo.find()).filter((t) => (t.projectId ?? null) === (task.projectId ?? null));
    // One counter per project for the board and the Request Log, so a number never appears twice in a project.
    const projectName = task.projectId != null && this.projects ? (await this.projects.findOneBy({ id: task.projectId }))?.name : null;
    const logPeers = projectName && this.logTasks ? await this.logTasks.find({ where: { project: projectName }, select: { id: true, serial: true } }) : [];
    task.serial = nextSerial([...peers.map((t) => t.serial), ...logPeers.map((t) => t.serial)], 'task', serialYear());
    const at = new Date().toISOString();
    const who = { id: actor.id, name: actor.name };
    const followers = normalizeCollaborators(task.collaborators);
    const notices: PendingNotice[] = [
      ...(assignee.id ? [{ kind: 'assigned' as const, ids: [String(assignee.id)], actor: who, at }] : []),
      ...(followers.length ? [{ kind: 'added' as const, ids: followers.map((c) => c.id), actor: who, at }] : []),
    ];
    if (defer) (task as any).pendingNotices = holdNotices(null, notices);
    const saved = await this.repo.save(this.repo.create(task as Partial<ProjectTaskEntity>));
    if (!defer) this.sendNotices(saved, notices);
    return this.hydrate(saved);
  }

  /** The task card an email carries. */
  private notice(t: ProjectTaskEntity, actor: UploadActor) {
    return { surface: 'board' as const, taskId: t.id, title: t.title, description: t.description, projectId: t.projectId, dueDate: t.dueDate, priority: t.priority, status: t.status, actor };
  }

  async update(id: string, dto: any, actor: UploadActor = { name: 'Unknown' }) {
    let task = await this.repo.findOneBy({ id });
    if (!task) task = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<ProjectTaskEntity>);

    const patch: Record<string, any> = { ...dto };
    delete patch.id; delete patch.serial; delete patch.pendingNotices;
    // From the task editor (autosave): emails wait for its Save button.
    const defer = !!patch.deferNotify; delete patch.deferNotify;
    // "Close task": complete and archived at once (reopened by changing its status).
    const closing = !!patch.close; delete patch.close; delete patch.closedAt; delete patch.archivedAt;
    if (closing && !isDoneStatus(task.status)) patch.status = 'Done';
    if ('leadId' in patch) Object.assign(patch, await resolveLead(this.leads, patch.leadId));

    if ('assignee' in patch || 'assigneeId' in patch) {
      const assignee = await resolveAssignee(this.users, { id: patch.assigneeId, name: patch.assignee });
      patch.assignee = assignee.name;
      patch.assigneeId = assignee.id ?? null;
    }
    if ('requestedBy' in patch || 'requestedById' in patch) {
      const src = await resolveAssignee(this.users, { id: patch.requestedById, name: patch.requestedBy });
      patch.requestedBy = src.name;
      patch.requestedById = src.id ?? null;
    }
    const note = cleanCompletionNote(patch.completionNote); delete patch.completionNote;
    if ('status' in patch) patch.status = normalizeTaskStatus(patch.status);
    await this.syncBucketSection(task, patch);
    await this.syncStatus(task, patch, actor);
    // The rules above may have changed the status (e.g. To Do -> Assigned): file the card to match.
    await this.syncBucketSection(task, patch);
    // Older subtasks may lack these; only stop someone clearing one that is set.
    if (task.parentId) {
      if ('dueDate' in patch && task.dueDate && !(patch.dueDate || '').trim()) throw new BadRequestException('A subtask needs a due date.');
      if (('assignee' in patch || 'assigneeId' in patch) && (task.assigneeId || task.assignee) && !(patch.assigneeId || (patch.assignee || '').trim())) throw new BadRequestException('A subtask needs an assignee.');
    }
    if (isDoneStatus(patch.status) && !isDoneStatus(task.status) && !task.parentId) await this.assertSubtasksDone(id);

    // Collaborators: a clean list, recorded in the activity, and newcomers told.
    let joined: { id: string; name: string }[] = [];
    const collabEvents: ActivityEvent[] = [];
    if ('collaborators' in patch) {
      patch.collaborators = normalizeCollaborators(patch.collaborators, patch.assigneeId ?? task.assigneeId);
      const { added, removed } = collaboratorChanges(task.collaborators, patch.collaborators);
      joined = added;
      if (added.length) collabEvents.push(event('collaborators', actor, { text: `added ${added.map((c) => c.name).join(', ')} as collaborator${added.length === 1 ? '' : 's'}` }));
      if (removed.length) collabEvents.push(event('collaborators', actor, { text: `removed ${removed.map((c) => c.name).join(', ')} from collaborators` }));
    }
    const finished = isDoneStatus(patch.status) && !isDoneStatus(task.status);
    // Marking it complete says what was done (closing it is the assigner's call and needs none).
    const noteEvents: ActivityEvent[] = [];
    if (finished && !closing && !(patch.phaseId ?? task.phaseId)) {
      if (!note) throw new BadRequestException(NEEDS_COMPLETION_NOTE);
    }
    if (finished && note) {
      patch.completionNote = note;
      noteEvents.push(event('comment', actor, { text: `Completion note: ${note}` }));
    }

    if (closing) { const at = new Date().toISOString(); patch.archivedAt = at; patch.closedAt = at; patch.completed = true; }
    const events = [...diffEvents(task, patch, actor), ...collabEvents, ...noteEvents, ...(closing ? [event('status', actor, { text: 'closed this task (archived)' })] : [])];
    const reassignedTo = 'assigneeId' in patch && patch.assigneeId && patch.assigneeId !== task.assigneeId
      ? String(patch.assigneeId)
      : null;

    if (holdReasonMissing(task, patch)) throw new BadRequestException(NEEDS_HOLD_REASON);
    // Off hold: the reason goes with it (it stays in the history).
    const nextStatus = patch.status ?? task.status;
    if (nextStatus !== 'On hold' && task.holdReason) patch.holdReason = null;

    const at = new Date().toISOString();
    const who = { id: actor.id, name: actor.name };
    // Any other status move tells everyone on the task (Oct 20: "All tasks status").
    // (To Do <-> Assigned just follows the assignee, who hears about that already.)
    const moved = !finished && !closing && 'status' in patch && patch.status !== task.status && !(patch.phaseId ?? task.phaseId)
      && !(['Assigned', 'Not started'].includes(patch.status) && ('assigneeId' in patch || 'assignee' in patch));
    const notices: PendingNotice[] = [
      ...(reassignedTo ? [{ kind: 'assigned' as const, ids: [reassignedTo], actor: who, at }] : []),
      ...(joined.length ? [{ kind: 'added' as const, ids: joined.map((c) => c.id), actor: who, at }] : []),
      ...(finished ? [{ kind: 'done' as const, ids: [], actor: who, at }] : []),
      ...(moved ? [{ kind: 'status' as const, ids: [], actor: who, at, status: patch.status }] : []),
    ];
    Object.assign(task, patch, { id });
    task.activity = [...normalizeList<ActivityEvent>(task.activity), ...events];
    task.updatedAt = new Date().toISOString();
    if (defer && notices.length) task.pendingNotices = holdNotices(task.pendingNotices, notices);
    const saved = await this.repo.save(task);
    // Its subtasks (all finished -- checked above) go into the archive with it.
    if (closing) for (const s of await this.repo.findBy({ parentId: id })) if (!s.archivedAt) await this.repo.update({ id: s.id }, { archivedAt: saved.archivedAt } as any);
    if (!defer) this.sendNotices(saved, notices);
    // High Viz work: everyone who follows High Viz hears when it moves.
    if (moved || finished) {
      void this.hub?.highVizTask({ labels: normalizeList<string>(saved.labels), projectId: saved.projectId },
        { title: `${saved.title} — ${saved.status}`, path: `/tasks?task=${encodeURIComponent(saved.id)}${saved.projectId != null ? `&project=${saved.projectId}` : ''}`, actorId: actor.id }).catch(() => undefined);
    }
    return this.hydrate(saved);
  }

  /** Everyone on a task: assignee, collaborators, its assigner and its source. */
  private involved(t: ProjectTaskEntity) {
    return [t.assigneeId, ...normalizeCollaborators(t.collaborators).map((c) => c.id), t.createdById || this.createdByIdOf(t), t.requestedById].filter(Boolean) as string[];
  }

  /**
   * Completed means Done (Oct 2026): rows marked completed with another status
   * become Done, and finished top-level cards sitting in a column that isn't
   * Done / Confirmed move to their board's Done column. Returns how many changed.
   */
  async fixCompleted() {
    const rows = await this.repo.find();
    const boards = new Map<string, { id: string; name: string }[]>();
    const sectionsOf = async (pid: number | null) => {
      const k = String(pid ?? 'general');
      if (!boards.has(k)) boards.set(k, await this.sections.forProject(pid));
      return boards.get(k)!;
    };
    let n = 0;
    for (const t of rows) {
      const patch: Record<string, any> = {};
      if (t.completed && !isDoneStatus(t.status)) patch.status = 'Done';
      const status = patch.status ?? t.status;
      if (isDoneStatus(status) && !t.parentId && t.sectionId) {
        const sections = await sectionsOf(t.projectId == null ? null : Number(t.projectId));
        const here = bucketStatus(sections.find((s) => s.id === t.sectionId)?.name);
        if (!isDoneStatus(here || '')) {
          const done = sections.find((s) => bucketStatus(s.name) === (status === 'Confirmed' ? 'Confirmed' : 'Done')) || sections.find((s) => bucketStatus(s.name) === 'Done');
          if (done) patch.sectionId = done.id;
        }
      }
      if (Object.keys(patch).length) { await this.repo.update({ id: t.id }, patch); n++; }
    }
    return n;
  }

  /** Send task emails now. */
  private sendNotices(t: ProjectTaskEntity, notices: PendingNotice[]) {
    for (const n of notices) {
      const notice = this.notice(t, n.actor);
      if (n.kind === 'assigned') this.notifications.taskAssigned({ ...notice, assigneeId: n.ids[0] });
      else if (n.kind === 'added') this.notifications.taskFollowUp(notice, n.ids, { kind: 'added' });
      else if (n.kind === 'status') this.notifications.taskFollowUp({ ...notice, status: n.status || t.status }, this.involved(t), { kind: 'status' });
      else this.notifications.taskFollowUp(notice, this.involved(t), { kind: 'done' });
    }
  }

  /**
   * Save pressed: send the emails held on this task and its subtasks -- the
   * ones still true (an assignment since undone isn't sent). Returns how many.
   */
  async flushNotices(id: string, withSubtasks = true) {
    const rows = [await this.repo.findOneBy({ id }), ...(withSubtasks ? await this.repo.findBy({ parentId: id }) : [])].filter(Boolean) as ProjectTaskEntity[];
    let sent = 0;
    for (const t of rows.filter((x) => x.pendingNotices?.length)) {
      const live = stillTrue(t.pendingNotices, { assigneeId: t.assigneeId, collaboratorIds: normalizeCollaborators(t.collaborators).map((c) => c.id), done: isDoneStatus(t.status), status: t.status });
      await this.repo.update({ id: t.id }, { pendingNotices: null } as any);
      this.sendNotices(t, live);
      sent += live.length;
    }
    return { sent };
  }

  /** Assigned board tasks whose start date has arrived go In Progress (and week-old Confirmed ones are archived). Returns how many moved. */
  async startDueTasks() {
    await this.archiveConfirmed().catch((e) => this.log.warn('Archiving confirmed tasks: ' + (e as Error).message));
    const rows = (await this.repo.find()).filter((t) => !t.phaseId && !t.archivedAt && (!t.status || t.status === 'Not started' || t.status === 'Assigned')
      && startDue(t.startDate, !!(t.assigneeId || (t.assignee || '').trim())));
    for (const t of rows) {
      try { await this.update(t.id, { status: 'In progress' }, { name: 'System' }); }
      catch (e) { this.log.warn(`Start ${t.id}: ${(e as Error).message}`); }
    }
    return rows.length;
  }

  /** Emails held more than 15 minutes (the page was closed without Save) go out anyway. */
  async flushOverdue() {
    // Only the tasks holding emails, and only the column that says so -- this runs every minute.
    const held = await this.repo.find({ where: { pendingNotices: Not(IsNull()) }, select: { id: true, pendingNotices: true } });
    for (const t of held.filter((x) => overdue(x.pendingNotices))) await this.flushNotices(t.id, false);
  }

  /** Persist a manual card order within one section (drag-to-reorder). */
  async reorder(sectionId: string, ids: string[]) {
    const rows = await this.repo.find({ where: { sectionId } });
    const byId = new Map(rows.map((t) => [t.id, t]));
    let position = 0;
    for (const id of ids) {
      const task = byId.get(id);
      if (!task) continue;
      task.order = position++;
      await this.repo.save(task);
    }
    return { sectionId, ordered: position };
  }

  // Move all tasks from one section to another (used when a section is deleted).
  async reparentTasks(fromSectionId: string, toSectionId: string) {
    await this.repo.update({ sectionId: fromSectionId }, { sectionId: toSectionId });
  }

  async deleteTasksInSection(sectionId: string) {
    await this.repo.delete({ sectionId });
  }

  async remove(id: string) {
    // Also remove subtasks of this task, and any files they own.
    const task = await this.repo.findOneBy({ id });
    if (task) {
      await this.attachments.discardAll(normalizeAttachments(task.attachments));
      await this.repo.remove(task);
    }
    const subs = await this.repo.find({ where: { parentId: id } });
    for (const sub of subs) await this.attachments.discardAll(normalizeAttachments(sub.attachments));
    if (subs.length) await this.repo.remove(subs);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------- attachments

  private scopeFor(task: ProjectTaskEntity) {
    return task.projectId == null ? 'General Tasks' : `Project ${task.projectId}`;
  }

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const task = await this.load(id);
    const added = await this.attachments.upload(files, this.scopeFor(task), actor);
    task.attachments = [...normalizeAttachments(task.attachments), ...added];
    task.activity = [
      ...normalizeList<ActivityEvent>(task.activity),
      ...added.map((a) => event('attachment', actor, { text: `attached ${a.name}` })),
    ];
    task.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(task));
  }

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
    task.commentCount = task.comments.length;
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('comment', actor, { text: comment.text })];
    const saved = await this.repo.save(task);
    // Everyone following the task hears about a comment (the assignee too), except its author.
    // @mentioned people hear they were mentioned; everyone else following hears about a comment.
    const mentioned = mentionedIds(comment.text, await this.users.find());
    const followers = [...normalizeCollaborators(saved.collaborators).map((c) => c.id), saved.assigneeId].filter((x) => x && !mentioned.includes(x)) as string[];
    if (mentioned.length) this.notifications.taskFollowUp(this.notice(saved, actor), mentioned, { kind: 'mention', comment: comment.text });
    if (followers.length) this.notifications.taskFollowUp(this.notice(saved, actor), followers, { kind: 'comment', comment: comment.text });
    return this.hydrate(saved);
  }
}
