import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChangeOrderEntity, MeetingEntity, ProjectEntity, ProjectTaskEntity, RfiEntity, TaskEntity } from '../database/entities';
import { ProjectTasksService } from '../project-tasks/project-tasks.service';
import { SectionsService } from '../project-tasks/sections.service';
import { bucketStatus, event } from '../database/task.types';
import { TasksService } from '../tasks/tasks.service';
import { backfillSerials, nextSerial, serialYear } from '../database/serials';
import type { MeetingActionDto, MeetingDto } from './dto';
import { normalizeMeetingStatus, settleMeetingStatus, type CapturedAction } from './meeting-status';

type Actor = { name: string; id?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Same action, ignoring case, spacing and punctuation. */
export const sameSubject = (a: string, b: string) => {
  const n = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return !!n(a) && n(a) === n(b);
};

/** FOR RECORD entries are records, not actions: they never hold a meeting open. */
export const FOR_RECORD_TOPICS = ['FYI', 'Observation', 'Decision'];

/**
 * Meetings, and the actions raised in them. An action is an ordinary Request Log
 * entry (task, FYI, observation or decision) created through TasksService -- so
 * the assignee is emailed as usual -- carrying the meeting's id, type, date and
 * project. RFIs and change orders drafted from a meeting are listed on it.
 *
 * A reviewed meeting turns complete by itself once everything captured from it
 * is done (see meeting-status.ts); that is worked out whenever meetings are read
 * or changed, and saved.
 */
@Injectable()
export class MeetingsService implements OnApplicationBootstrap {
  private readonly log = new Logger('MeetingsService');

  constructor(
    @InjectRepository(MeetingEntity) private readonly repo: Repository<MeetingEntity>,
    @InjectRepository(TaskEntity) private readonly tasksRepo: Repository<TaskEntity>,
    private readonly tasks: TasksService,
    @Optional() @InjectRepository(RfiEntity) private readonly rfis?: Repository<RfiEntity>,
    @Optional() @InjectRepository(ChangeOrderEntity) private readonly cos?: Repository<ChangeOrderEntity>,
    // Nov 27 (Weekly Sync): meeting tasks go on the project's board.
    @Optional() private readonly board?: ProjectTasksService,
    @Optional() private readonly sections?: SectionsService,
    @Optional() @InjectRepository(ProjectTaskEntity) private readonly boardRepo?: Repository<ProjectTaskEntity>,
    @Optional() @InjectRepository(ProjectEntity) private readonly projectsRepo?: Repository<ProjectEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      const n = await this.migrateStatuses();
      if (n) this.log.log(`Moved ${n} meeting(s) onto the new statuses`);
    } catch (err) {
      this.log.error('Meeting status migration failed: ' + (err as Error).message);
    }
    try {
      const rows = await this.repo.find();
      const pairs = backfillSerials(rows, (m) => String(m.projectId ?? ''), () => 'meeting', (m) => m.createdAt);
      for (const [id, serial] of pairs) await this.repo.update({ id }, { serial });
      if (pairs.length) this.log.log(`Gave ${pairs.length} meeting(s) a serial number`);
    } catch (err) {
      this.log.error('Meeting serial numbers failed: ' + (err as Error).message);
    }
  }

  /** Older statuses ("held") onto the current set ("occurred"). Returns how many changed. */
  async migrateStatuses() {
    let n = 0;
    for (const m of await this.repo.find()) {
      const next = normalizeMeetingStatus(m.status);
      if (next === m.status) continue;
      m.status = next;
      await this.repo.save(m);
      n++;
    }
    return n;
  }

  /** Archived meetings (Nov 19) only when asked for. */
  async list(includeArchived = false) {
    const rows = (await this.repo.find({ order: { date: 'DESC', time: 'DESC' } })).filter((m) => includeArchived || !m.archivedAt);
    return this.settle(rows);
  }

  /** Nov 19: archive (or bring back) meetings -- test meetings and empty records the team wants out of the way. */
  /** Nov 20: hand a meeting's sorting to someone else (or take it over yourself). */
  async setSorter(id: string, who: { id: string; name: string } | null, actor?: Actor) {
    const m = await this.load(id);
    m.sortedById = who?.id || null;
    m.sortedBy = who?.name || null;
    m.updatedAt = new Date().toISOString();
    m.activity = [...(m.activity || []), { at: m.updatedAt, by: actor?.name || 'Someone', type: 'sorter', text: who ? `${who.name} sorts this meeting${actor?.id === who.id ? ' (took it over)' : ''}` : 'sorting back with the organiser' } as any];
    await this.repo.save(m);
    return (await this.settle([m]))[0];
  }

  async setArchived(ids: string[], on: boolean, actor?: Actor) {
    const list = (await this.repo.find({ where: { id: In(ids) } })).filter((m) => ids.includes(m.id));
    if (!list.length) throw new NotFoundException('Meeting not found');
    const now = new Date().toISOString();
    for (const m of list) {
      m.archivedAt = on ? now : null;
      m.archivedBy = on ? actor?.name || null : null;
      m.updatedAt = now;
      await this.repo.save(m);
    }
    return { updated: list.length };
  }

  /** Delete several at once; the actions raised in them stay in the Special Actions Log. */
  async removeMany(ids: string[]) {
    let removed = 0;
    const calendarEventIds: string[] = [];
    for (const id of ids) {
      const m = await this.repo.findOneBy({ id });
      if (!m) continue;
      await this.tasksRepo.update({ meetingId: id }, { meetingId: null as any });
      await this.repo.remove(m);
      if (m.calendarEventId) calendarEventIds.push(m.calendarEventId);
      removed++;
    }
    return { removed, calendarEventIds };
  }

  async get(id: string) {
    const m = await this.load(id);
    return (await this.settle([m]))[0];
  }

  private async load(id: string) {
    const m = await this.repo.findOneBy({ id });
    if (!m) throw new NotFoundException('Meeting not found');
    return m;
  }

  async create(dto: MeetingDto, actor: Actor) {
    if (!String(dto.title || '').trim()) throw new BadRequestException('Give the meeting a title.');
    if (!ISO.test(dto.date || '')) throw new BadRequestException('Pick the meeting date.');
    const now = new Date().toISOString();
    const id = 'MTG-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const projectId = (dto as any).projectId == null ? null : Number((dto as any).projectId);
    const peers = (await this.repo.find()).filter((m) => (m.projectId ?? null) === projectId);
    // The creator attends unless they said otherwise (Nov 10: their meetings vanished for them otherwise).
    const attendees = Array.isArray((dto as any).attendees) ? [...(dto as any).attendees] : [];
    if (actor.id && !attendees.some((a: any) => a?.id === actor.id)) attendees.push({ id: actor.id, name: actor.name });
    return this.repo.save(this.repo.create({
      type: 'Internal', rfiIds: [], changeOrderIds: [], ...dto, attendees, title: dto.title!.trim(), createdById: actor.id || null,
      serial: nextSerial(peers.map((m) => m.serial), 'meeting', serialYear(now)),
      status: normalizeMeetingStatus(dto.status),
      id, createdBy: actor.name, createdAt: now, updatedAt: now,
    } as Partial<MeetingEntity>));
  }

  async update(id: string, dto: MeetingDto, actor?: Actor) {
    const m = await this.load(id);
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException('The meeting needs a title.');
    if (dto.date !== undefined && !ISO.test(dto.date)) throw new BadRequestException('Pick the meeting date.');
    const patch: Partial<MeetingEntity> = { ...(dto as any) };
    delete patch.serial;
    if (dto.status !== undefined) {
      patch.status = normalizeMeetingStatus(dto.status);
      // Marking it reviewed (or complete by hand) records who went through it.
      const wasReviewed = ['reviewed', 'complete'].includes(normalizeMeetingStatus(m.status));
      if (['reviewed', 'complete'].includes(patch.status) && !wasReviewed) {
        patch.reviewedBy = actor?.name || m.reviewedBy;
        patch.reviewedAt = new Date().toISOString();
      }
    }
    for (const k of ['recordingUrl', 'transcriptUrl', 'organizer', 'organizerOrg'] as const) if (typeof patch[k] === 'string') patch[k] = patch[k]!.trim();
    if (patch.platform === '') patch.platform = null;
    Object.assign(m, patch, { updatedAt: new Date().toISOString() });
    const saved = await this.repo.save(m);
    return (await this.settle([saved]))[0];
  }

  /** Deleting a meeting keeps the actions raised in it -- they just stop pointing at it. */
  async remove(id: string) {
    const m = await this.load(id);
    await this.tasksRepo.update({ meetingId: id }, { meetingId: null as any });
    if (this.boardRepo) await this.boardRepo.update({ meetingId: id } as any, { meetingId: null } as any);
    await this.repo.remove(m);
    return { ok: true, calendarEventId: m.calendarEventId || null };
  }

  async addAction(id: string, dto: MeetingActionDto, actor: Actor) {
    let m = await this.load(id);
    // Nov 20: several people importing the same notes don't make the same task twice (log or board).
    const subject = dto.subject.trim();
    const same = (await this.tasksRepo.find({ where: { meetingId: m.id } })).find((x) => x.meetingId === m.id && sameSubject(x.subject, subject));
    if (same) return { ...same, duplicate: true };
    const sameOnBoard = this.boardRepo ? (await this.boardRepo.find({ where: { meetingId: m.id } })).find((x) => sameSubject(x.title, subject)) : null;
    if (sameOnBoard) return { ...sameOnBoard, subject: sameOnBoard.title, board: true, duplicate: true };
    // Nov 27: each item can go to its own project (or General); otherwise the meeting's.
    const own = Object.prototype.hasOwnProperty.call(dto, 'projectId') || Object.prototype.hasOwnProperty.call(dto, 'project');
    // A meeting with no project takes the one picked for its items, so they don't land under "General".
    if (!m.project && (dto.project || '').trim()) {
      Object.assign(m, { project: dto.project!.trim(), projectId: dto.projectId ?? m.projectId ?? null });
      m = await this.repo.save(m);
    }
    const sourceLabel = [m.title, [m.date?.replace(/-/g, '/'), m.time].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
    if (dto.topicType === 'Task' && this.board) {
      const project = own ? await this.projectFor(dto.projectId ?? null, dto.project || '') : await this.projectFor((m as any).projectId ?? null, m.project || '');
      const t = await this.board.create({
        projectId: project?.id ?? null, sectionId: await this.notStarted(project?.id ?? null),
        title: subject, description: dto.description || '',
        assignee: dto.assignedTo, assigneeId: dto.assignedToId, dueDate: dto.dueDate || undefined, priority: dto.priority || undefined, tags: dto.tags,
        collaborators: Array.isArray(dto.collaborators) ? dto.collaborators.filter((c) => c && c.id && c.name) : undefined,
        meetingId: m.id, sourceType: 'meeting', sourceId: m.id, sourceLabel,
      }, actor as any);
      await this.settle([m]);
      return { ...t, subject: t.title, board: true, projectName: project?.name || 'General' };
    }
    const itemProject = own ? (await this.projectFor(dto.projectId ?? null, dto.project || ''))?.name ?? (dto.project || '').trim() : m.project || '';
    const t = await this.tasks.create({
      collaborators: Array.isArray(dto.collaborators) ? dto.collaborators.filter((c) => c && c.id && c.name) : undefined,
      topicType: dto.topicType, subject, description: dto.description || '',
      assignedTo: dto.assignedTo, assignedToId: dto.assignedToId, dueDate: dto.dueDate || undefined, priority: dto.priority || undefined, tags: dto.tags,
      project: itemProject, meetingType: m.type || 'Internal', meetingDate: m.date, meetingId: m.id, tab: 'internal',
      // Where it came from, e.g. "HOM Cafe Weekly Sync - 2026/10/24 12:45" (Oct 26 review notes).
      sourceType: 'meeting', sourceId: m.id, sourceLabel,
    }, actor as any);
    await this.settle([m]); // a new open task takes a complete meeting back to reviewed
    return t;
  }

  /** A project by id, else by name; null = General. */
  private async projectFor(id: number | null | undefined, name: string): Promise<ProjectEntity | null> {
    if (!this.projectsRepo) return null;
    if (id != null && Number.isFinite(Number(id))) { const p = await this.projectsRepo.findOneBy({ id: Number(id) }); if (p) return p; }
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return (await this.projectsRepo.find({ select: { id: true, name: true } as any })).find((p) => String(p.name || '').trim().toLowerCase() === n) || null;
  }

  /** The board's "Not started" column (as conversions use). */
  private async notStarted(projectId: number | null) {
    if (!this.sections) return undefined;
    const secs = await this.sections.forProject(projectId);
    return (secs.find((x) => bucketStatus(x.name) === 'Not started') || secs[0])?.id;
  }

  /**
   * Nov 27 (Weekly Sync, preview then Apply): the open Tasks raised in meetings
   * that still sit in the Request Log, and the board each would go to. Apply
   * makes each a board task (history, comments, files, people and dates come
   * along), notes "Moved to the board → T-…" on the log entry and closes it.
   * Nothing is deleted; one already moved is skipped.
   */
  async moveToBoardPlan(apply = false, actor: Actor = { name: 'Odin' } as Actor) {
    const closedNames = (await this.tasks.statuses()).filter((s) => s.closed).map((s) => s.name);
    const rows = (await this.tasksRepo.find({ where: { topicType: 'Task' } as any }))
      .filter((t) => t.meetingId && !t.archivedAt && !t.closedAt && !closedNames.includes(t.status))
      .filter((t) => !(t.derivedRefs || []).some((r: any) => r?.kind === 'board'));
    const plan: { id: string; serial: string | null; subject: string; status: string; assignee: string | null; dueDate: string | null; meetingId: string; projectId: number | null; projectName: string }[] = [];
    for (const t of rows) {
      const p = await this.projectFor(null, t.project || '');
      plan.push({ id: t.id, serial: t.serial || null, subject: t.subject || '(no subject)', status: t.status, assignee: t.assignedTo || null, dueDate: t.dueDate || null, meetingId: t.meetingId, projectId: p?.id ?? null, projectName: p?.name || 'General' });
    }
    if (!apply) return { applied: false, count: plan.length, rows: plan };
    if (!this.board || !this.boardRepo) throw new BadRequestException('The task board is not available here.');
    const closedName = closedNames[0] || 'Closed';
    const done: { id: string; boardId: string; serial: string }[] = [];
    for (const row of plan) {
      const t = rows.find((x) => x.id === row.id)!;
      const made = await this.board.create({
        projectId: row.projectId, sectionId: await this.notStarted(row.projectId),
        title: (t.subject || '(no subject)').slice(0, 300), description: t.description || '',
        assignee: t.assignedTo, assigneeId: t.assignedToId, dueDate: t.dueDate || undefined, startDate: t.startDate || undefined, priority: t.priority || undefined, tags: t.tags || undefined,
        collaborators: t.collaborators || undefined, labels: t.labels || undefined, checklist: t.checklist || undefined,
        meetingId: t.meetingId, sourceType: 'meeting', sourceId: t.meetingId, sourceLabel: t.sourceLabel || `Request Log ${t.serial || t.id}`,
        deferNotify: true, // the people on it already know about it
      }, actor as any);
      // Its history, comments and files come along as they were.
      const b = await this.boardRepo.findOneBy({ id: made.id });
      if (b) {
        b.comments = [...(t.comments || [])];
        b.commentCount = (t.comments || []).length;
        b.attachments = [...(t.attachments || [])];
        b.activity = [...(t.activity || []), ...(b.activity || []), event('link', actor as any, { text: `moved here from the Request Log (${t.serial || t.id})` })] as any;
        b.pendingNotices = null;
        await this.boardRepo.save(b);
      }
      const at = new Date().toISOString();
      t.derivedRefs = [...(t.derivedRefs || []), { kind: 'board', id: made.id, label: made.serial || made.id, how: 'converted', projectName: row.projectName, at, by: actor.name }];
      t.activity = [...(t.activity || []), event('link', actor as any, { text: `Moved to the board → ${made.serial || made.id}` })] as any;
      t.status = closedName; t.closedAt = at; t.dateClosed = at.slice(0, 10); t.updatedAt = at;
      await this.tasksRepo.save(t);
      done.push({ id: t.id, boardId: made.id, serial: made.serial || made.id });
    }
    const meetings = await this.repo.findBy({ id: In([...new Set(plan.map((r) => r.meetingId))]) });
    await this.settle(meetings);
    return { applied: true, count: done.length, moved: done };
  }

  /** Nov 27: the board tasks raised in meetings, for the meetings' action lists. */
  async boardActions(meetingIds?: string[]) {
    if (!this.boardRepo) return [];
    const rows = await this.boardRepo.find({ where: meetingIds?.length ? { meetingId: In(meetingIds) } : { sourceType: 'meeting' } as any });
    return rows.filter((t) => t.meetingId && !t.parentId).map((t) => ({
      id: t.id, serial: t.serial, title: t.title, status: t.status, completed: !!t.completed, assignee: t.assignee, assigneeId: t.assigneeId,
      dueDate: t.dueDate, projectId: t.projectId ?? null, meetingId: t.meetingId, archivedAt: t.archivedAt || null, collaborators: t.collaborators || [], createdById: t.createdById,
    }));
  }

  /**
   * The special actions captured from each meeting -- its Request Log tasks (not
   * FOR RECORD entries), RFIs and change orders -- and, from them, whether a
   * reviewed meeting is now complete (or a complete one reopened). Any meeting
   * whose status changes is saved.
   */
  async settle(rows: MeetingEntity[]): Promise<MeetingEntity[]> {
    if (!rows.length) return rows;
    const ids = rows.map((m) => m.id);
    const rfiIds = [...new Set(rows.flatMap((m) => m.rfiIds || []))];
    const coIds = [...new Set(rows.flatMap((m) => m.changeOrderIds || []))];
    const [tasks, rfis, cos, statuses, boardTasks] = await Promise.all([
      this.tasksRepo.find({ where: { meetingId: In(ids) }, select: { id: true, meetingId: true, status: true, topicType: true } }),
      this.rfis && rfiIds.length ? this.rfis.find({ where: { id: In(rfiIds) }, select: { id: true, status: true } }) : Promise.resolve([] as RfiEntity[]),
      this.cos && coIds.length ? this.cos.find({ where: { id: In(coIds) }, select: { id: true, status: true } }) : Promise.resolve([] as ChangeOrderEntity[]),
      this.tasks.statuses(),
      this.boardRepo ? this.boardRepo.find({ where: { meetingId: In(ids) } as any, select: { id: true, meetingId: true, status: true, completed: true, archivedAt: true, closedAt: true } as any }) : Promise.resolve([] as ProjectTaskEntity[]),
    ]);
    const closed = statuses.filter((s) => s.closed).map((s) => s.name);
    const closedName = closed[0] || 'Closed';
    const rfiStatus = new Map(rfis.map((r) => [r.id, r.status]));
    const coStatus = new Map(cos.map((c) => [c.id, c.status]));
    const changed: MeetingEntity[] = [];
    for (const m of rows) {
      const actions: CapturedAction[] = [
        ...tasks.filter((t) => t.meetingId === m.id && !FOR_RECORD_TOPICS.includes(t.topicType)).map((t) => ({ kind: 'task' as const, status: t.status })),
        // Nov 27: its board tasks count too -- done, closed or archived ones as closed.
        ...boardTasks.filter((t) => t.meetingId === m.id).map((t) => ({ kind: 'task' as const, status: t.completed || t.archivedAt || t.closedAt ? closedName : 'Open' })),
        // An RFI or change order since deleted no longer counts.
        ...(m.rfiIds || []).filter((r) => rfiStatus.has(r)).map((r) => ({ kind: 'rfi' as const, status: rfiStatus.get(r) })),
        ...(m.changeOrderIds || []).filter((c) => coStatus.has(c)).map((c) => ({ kind: 'changeOrder' as const, status: coStatus.get(c) })),
      ];
      const next = settleMeetingStatus(m.status, actions, closed);
      if (next !== m.status) { m.status = next; m.updatedAt = new Date().toISOString(); changed.push(m); }
    }
    for (const m of changed) await this.repo.save(m);
    return rows;
  }
}
