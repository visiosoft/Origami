import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, MeetingEntity, ProjectEntity, ProjectTaskEntity, RfiEntity, TaskEntity,
} from '../database/entities';
import { bucketStatus, event, normalizeList, type ActionKind, type ActivityEvent, type ChecklistItem, type DerivedRef } from '../database/task.types';
import type { Actor } from '../manpower/manpower-access.service';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { TasksService } from '../tasks/tasks.service';
import { ProjectTasksService } from '../project-tasks/project-tasks.service';
import { SectionsService } from '../project-tasks/sections.service';
import { MeetingsService } from '../meetings/meetings.service';
import { RfisService } from '../rfis/rfis.service';
import { ChangeOrdersService } from '../finance/change-orders.service';
import { FinancialsService } from '../finance/financials.service';

export const ACTION_KINDS: ActionKind[] = ['log', 'board', 'meeting', 'rfi', 'co'];
/** Request Log entries can be a task or a FOR RECORD item. */
const LOG_TOPICS = ['Task', 'FYI', 'Observation', 'Decision'];
const KIND_NAME: Record<ActionKind, string> = { log: 'task', board: 'task', meeting: 'meeting', rfi: 'RFI', co: 'change order' };

const today = () => new Date().toISOString().slice(0, 10);
const trunc = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const firstLine = (s?: string | null) => String(s || '').split('\n')[0].trim();

/** One special action, read into the fields every kind shares. */
export interface Source {
  kind: ActionKind; id: string; label: string;
  title: string; body: string;
  projectId: number | null; projectName: string;
  assignee?: string; assigneeId?: string; dueDate?: string; topicType?: string;
  row: any;
}

export interface Made { kind: ActionKind; id: string; label: string; projectId: number | null; projectName: string }

/**
 * Duplicate a special action (to one or several projects) and convert one kind
 * into another. Each new record is made by its own service, so numbering,
 * permissions and notifications work as usual; this records where it came
 * from on the new record and what was made on the original, in each one's own
 * history (task / meeting activity, RFI history, the change order audit log).
 */
@Injectable()
export class SpecialActionsService {
  constructor(
    @InjectRepository(TaskEntity) private readonly logRepo: Repository<TaskEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly boardRepo: Repository<ProjectTaskEntity>,
    @InjectRepository(MeetingEntity) private readonly meetingRepo: Repository<MeetingEntity>,
    @InjectRepository(RfiEntity) private readonly rfiRepo: Repository<RfiEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly coRepo: Repository<ChangeOrderEntity>,
    @InjectRepository(ChangeOrderItemEntity) private readonly coItems: Repository<ChangeOrderItemEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly access: ManpowerAccess,
    private readonly tasks: TasksService,
    private readonly board: ProjectTasksService,
    private readonly sections: SectionsService,
    private readonly meetings: MeetingsService,
    private readonly rfis: RfisService,
    private readonly cos: ChangeOrdersService,
    private readonly fin: FinancialsService,
  ) {}

  // ------------------------------------------------------------------ reading

  private async projectByName(name?: string | null) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    const all = await this.projects.find();
    return all.find((p) => p.name.trim().toLowerCase() === n) || all.find((p) => p.leadId === name) || null;
  }

  private async projectById(id?: number | null) {
    return id != null && Number.isFinite(Number(id)) ? this.projects.findOneBy({ id: Number(id) }) : null;
  }

  async source(kind: ActionKind, id: string): Promise<Source> {
    if (!ACTION_KINDS.includes(kind)) throw new BadRequestException('Unknown kind.');
    if (kind === 'log') {
      const t = await this.logRepo.findOneBy({ id });
      if (!t) throw new NotFoundException('Task not found');
      const p = await this.projectByName(t.project);
      const topic = t.topicType || 'Task';
      return {
        kind, id, label: `${topic === 'Task' ? 'Task' : topic} #${t.id}`, title: firstLine(t.subject) || trunc(firstLine(t.description), 120) || `Task ${t.id}`,
        body: t.description || '', projectId: p?.id ?? null, projectName: p?.name || t.project || '', assignee: t.assignedTo, assigneeId: t.assignedToId,
        dueDate: t.dueDate, topicType: topic, row: t,
      };
    }
    if (kind === 'board') {
      const t = await this.boardRepo.findOneBy({ id });
      if (!t) throw new NotFoundException('Task not found');
      const p = await this.projectById(t.projectId);
      return {
        kind, id, label: `Task “${trunc(t.title)}”`, title: t.title, body: t.description || '', projectId: t.projectId ?? null, projectName: p?.name || '',
        assignee: t.assignee, assigneeId: t.assigneeId, dueDate: t.dueDate, row: t,
      };
    }
    if (kind === 'meeting') {
      const m = await this.meetingRepo.findOneBy({ id });
      if (!m) throw new NotFoundException('Meeting not found');
      const p = (await this.projectById(m.projectId)) || (await this.projectByName(m.project));
      return { kind, id, label: `Meeting “${trunc(m.title)}”`, title: m.title, body: m.minutes || m.agenda || '', projectId: p?.id ?? null, projectName: p?.name || m.project || '', dueDate: m.date, row: m };
    }
    if (kind === 'rfi') {
      const r = await this.rfiRepo.findOneBy({ id });
      if (!r) throw new NotFoundException('RFI not found');
      const p = await this.projectById(r.projectId);
      return {
        kind, id, label: r.number, title: r.subject, body: [r.question, r.answer ? `Answer: ${r.answer}` : ''].filter(Boolean).join('\n\n'),
        projectId: r.projectId, projectName: p?.name || '', assigneeId: r.ownerId, assignee: r.ownerName, dueDate: r.dateDue, row: r,
      };
    }
    const c = await this.coRepo.findOneBy({ id });
    if (!c) throw new NotFoundException('Change order not found');
    const p = await this.projectById(c.projectId);
    return { kind, id, label: c.number, title: c.title, body: c.description || '', projectId: c.projectId, projectName: p?.name || '', row: c };
  }

  // ------------------------------------------------------------------ rights

  private async mayCreate(kind: ActionKind, actor: Actor, topicType?: string) {
    const any = async (...keys: string[]) => { for (const k of keys) if (await this.access.can(actor, k, 'manage')) return true; return false; };
    // RFIs and change orders check their own rights when they're created.
    if (kind === 'rfi' || kind === 'co') return;
    const ok = kind === 'meeting' ? await any('meetings', 'tasks')
      : kind === 'log' && topicType && topicType !== 'Task' ? await any('observations', 'tasks')
      : await any('tasks', 'projects');
    if (!ok) throw new ForbiddenException(`Your role can’t add ${kind === 'meeting' ? 'meetings' : topicType && topicType !== 'Task' ? 'FOR RECORD items' : 'tasks'}.`);
  }

  // ------------------------------------------------------------------ making

  /** Make a new record of `kind` from `src` on `project`. `copy` carries the kind's own fields (duplicates). */
  private async make(kind: ActionKind, src: Source, project: ProjectEntity | null, actor: Actor, opts: { how: 'converted' | 'duplicated'; topicType?: string; copy?: boolean }): Promise<Made> {
    const stamp = { sourceType: src.kind, sourceId: src.id, sourceLabel: src.label };
    const row = src.row;
    const same = opts.copy && src.kind === kind;
    const freshList = (xs: unknown) => normalizeList<ChecklistItem>(xs).map((c) => ({ ...c, done: false }));
    if ((kind === 'rfi' || kind === 'co') && !project) throw new BadRequestException(`Pick the project for the ${KIND_NAME[kind]}.`);

    if (kind === 'log') {
      const topicType = opts.topicType || (same ? row.topicType : 'Task') || 'Task';
      if (!LOG_TOPICS.includes(topicType)) throw new BadRequestException('Unknown Request Log type.');
      await this.mayCreate('log', actor, topicType);
      const t = await this.tasks.create({
        topicType, subject: src.title, description: src.body, project: project?.name || '',
        assignedTo: src.assignee, assignedToId: src.assigneeId, dueDate: src.dueDate || undefined,
        tab: same ? row.tab || 'internal' : 'internal',
        ...(same ? { meetingType: row.meetingType, labels: row.labels, checklist: freshList(row.checklist) } : {}),
        ...(src.kind === 'meeting' ? { meetingId: src.id, meetingType: row.type || 'Internal', meetingDate: row.date } : {}),
        ...stamp,
      }, actor);
      return { kind, id: t.id, label: `${topicType === 'Task' ? 'Task' : topicType} #${t.id}`, projectId: project?.id ?? null, projectName: project?.name || '' };
    }

    if (kind === 'board') {
      await this.mayCreate('board', actor);
      const pid = project?.id ?? null;
      const secs = await this.sections.forProject(pid);
      const sectionId = (secs.find((x) => bucketStatus(x.name) === 'Not started') || secs[0])?.id;
      const t = await this.board.create({
        // Several copies can be made within one millisecond.
        id: `T-${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        projectId: pid, sectionId, title: src.title, description: src.body,
        assignee: src.assignee, assigneeId: src.assigneeId, dueDate: src.dueDate || undefined,
        ...(same ? { priority: row.priority, labels: row.labels, checklist: freshList(row.checklist), team: row.team } : {}),
        ...stamp,
      }, actor);
      return { kind, id: t.id, label: `Task “${trunc(t.title)}”`, projectId: pid, projectName: project?.name || '' };
    }

    if (kind === 'meeting') {
      await this.mayCreate('meeting', actor);
      const m = await this.meetings.create({
        title: src.title, date: same ? row.date : today(), projectId: project?.id ?? null, project: project?.name || '', status: 'scheduled',
        agenda: same ? row.agenda || '' : src.body,
        ...(same ? { time: row.time, type: row.type, location: row.location, locationType: row.locationType, attendees: row.attendees || [] } : {}),
        ...stamp, activity: [event('created', actor, { text: 'created this meeting' })],
      } as any, actor);
      return { kind, id: m.id, label: `Meeting “${trunc(m.title)}”`, projectId: project?.id ?? null, projectName: project?.name || '' };
    }

    if (kind === 'rfi') {
      const r = await this.rfis.create({
        projectId: project!.id, subject: src.title, question: src.body, dateDue: src.dueDate || undefined, ownerId: src.kind === 'rfi' ? row.ownerId : undefined,
        ...(same ? { suggestion: row.suggestion, discipline: row.discipline, specSection: row.specSection, drawingRef: row.drawingRef, drawings: row.drawings, to: row.to, cc: row.cc, priority: row.priority } : {}),
        // The RFI's own "came from a task" fields, kept for the existing views.
        ...(src.kind === 'log' || src.kind === 'board' ? { sourceTaskId: src.id, sourceTaskType: src.kind } : {}),
      }, actor);
      await this.rfiRepo.update({ id: r.id }, stamp);
      return { kind, id: r.id, label: r.number, projectId: project!.id, projectName: project!.name };
    }

    const items = same ? await this.coItems.find({ where: { changeOrderId: src.id } }) : [];
    const fromRfi = src.kind === 'rfi';
    const co = await this.cos.create(project!.id, {
      title: fromRfi ? `${row.number}: ${row.subject}` : src.title, description: src.body,
      reason: same ? row.reason : fromRfi ? 'design_change' : 'client_request',
      requestedBy: same ? row.requestedBy : fromRfi ? row.answeredBy || row.to?.name || actor.name : actor.name,
      scheduleImpactDays: same ? row.scheduleImpactDays : fromRfi ? row.scheduleDays || 0 : 0,
      // Lines are copied without their milestone / task: those belong to the original project.
      items: items.sort((a, b) => a.lineOrder - b.lineOrder).map((i) => ({ description: i.description, amount: i.amount, cost: i.cost, quantity: i.quantity, unit: (i as any).unit, rate: (i as any).rate, csiCodeId: (i as any).csiCodeId, targetType: 'none' })),
    }, actor);
    await this.coRepo.update({ id: co.id }, stamp);
    return { kind, id: co.id, label: co.number, projectId: project!.id, projectName: project!.name };
  }

  // ------------------------------------------------------------------ the trail

  private async note(kind: ActionKind, id: string, text: string, actor: Actor, extra: Record<string, unknown> = {}) {
    const at = new Date().toISOString();
    if (kind === 'log' || kind === 'board' || kind === 'meeting') {
      const repo: Repository<any> = kind === 'log' ? this.logRepo : kind === 'board' ? this.boardRepo : this.meetingRepo;
      const row = await repo.findOneBy({ id });
      if (!row) return;
      row.activity = [...normalizeList<ActivityEvent>(row.activity), event('link', actor, { text })];
      if (extra.derived) row.derivedRefs = [...normalizeList<DerivedRef>(row.derivedRefs), extra.derived];
      row.updatedAt = at;
      await repo.save(row);
    } else if (kind === 'rfi') {
      const r = await this.rfiRepo.findOneBy({ id });
      if (!r) return;
      r.history = [...(r.history || []), { at, by: actor.name, action: text }];
      if (extra.derived) r.derivedRefs = [...normalizeList<DerivedRef>(r.derivedRefs), extra.derived as DerivedRef];
      await this.rfiRepo.save(r);
    } else {
      const c = await this.coRepo.findOneBy({ id });
      if (!c) return;
      if (extra.derived) { c.derivedRefs = [...normalizeList<DerivedRef>(c.derivedRefs), extra.derived as DerivedRef]; await this.coRepo.save(c); }
      await this.fin.log(null, { projectId: c.projectId, entityType: 'change_order', entityId: id, action: String(extra.action || 'co_linked'), reason: text }, actor);
    }
  }

  /** "Converted from …" on the new record, "Converted to …" (and a link back) on the original, plus the kinds' own links. */
  private async record(src: Source, made: Made, how: 'converted' | 'duplicated', actor: Actor) {
    const verb = how === 'converted' ? 'Converted' : 'Duplicated';
    const where = made.projectName && made.projectName !== src.projectName ? ` on ${made.projectName}` : '';
    await this.note(made.kind, made.id, `${verb} from ${src.label}${src.projectName && where ? ` (${src.projectName})` : ''}`, actor, { action: how === 'converted' ? 'co_converted_from' : 'co_duplicated_from' });
    const derived: DerivedRef = { kind: made.kind, id: made.id, label: made.label, how, projectName: made.projectName || undefined, by: actor.name, at: new Date().toISOString() };
    await this.note(src.kind, src.id, `${verb} to ${made.label}${where}`, actor, { derived, action: how === 'converted' ? 'co_converted_to' : 'co_duplicated_to' });

    if (how !== 'converted') return;
    // The links each kind already shows.
    if (src.kind === 'log' && made.kind === 'log') await this.tasks.link(src.id, 'task', made.id, actor);
    if (src.kind === 'log' && made.kind === 'co') await this.tasks.link(src.id, 'changeOrder', made.id, actor);
    if (src.kind === 'rfi' && made.kind === 'co') await this.rfiRepo.update({ id: src.id }, { changeOrderId: made.id, changeOrderNumber: made.label });
    if (src.kind === 'meeting' && (made.kind === 'rfi' || made.kind === 'co')) {
      const m = await this.meetingRepo.findOneBy({ id: src.id });
      if (m) {
        if (made.kind === 'rfi') m.rfiIds = [...new Set([...(m.rfiIds || []), made.id])];
        else m.changeOrderIds = [...new Set([...(m.changeOrderIds || []), made.id])];
        await this.meetingRepo.save(m);
      }
    }
  }

  // ------------------------------------------------------------------ the two actions

  /**
   * Copies of a special action, one per project. A project that refuses (no
   * financials for a change order, say) is reported and the rest still go ahead.
   * `null` in projectIds means "no project" (tasks and meetings only).
   */
  async duplicate(dto: { kind?: ActionKind; id?: string; projectIds?: (number | null)[] }, actor: Actor) {
    const kind = dto.kind as ActionKind;
    const src = await this.source(kind, String(dto.id || ''));
    const ids = Array.isArray(dto.projectIds) && dto.projectIds.length ? dto.projectIds : [src.projectId];
    if (ids.length > 50) throw new BadRequestException('Duplicate to at most 50 projects at a time.');
    const created: Made[] = [];
    const failed: { projectId: number | null; projectName: string; reason: string }[] = [];
    for (const raw of [...new Set(ids)]) {
      const project = raw == null ? null : await this.projectById(raw);
      if (raw != null && !project) { failed.push({ projectId: raw, projectName: `Project ${raw}`, reason: 'Project not found' }); continue; }
      try {
        const made = await this.make(kind, src, project, actor, { how: 'duplicated', copy: true });
        await this.record(src, made, 'duplicated', actor);
        created.push(made);
      } catch (e) {
        failed.push({ projectId: project?.id ?? null, projectName: project?.name || 'No project', reason: (e as Error).message || 'Could not be created' });
      }
    }
    if (!created.length && failed.length === 1) throw new BadRequestException(failed[0].reason);
    return { created, failed };
  }

  /** A new special action of another kind, made from this one. The original stays as it is. */
  async convert(dto: { from?: { kind?: ActionKind; id?: string }; to?: ActionKind; topicType?: string; projectId?: number | null; title?: string; body?: string }, actor: Actor) {
    const src = await this.source(dto.from?.kind as ActionKind, String(dto.from?.id || ''));
    // A title typed for the new record ("Change order title"), instead of the original's.
    const title = String(dto.title || '').trim().slice(0, 300);
    if (title) src.title = title;
    if (typeof dto.body === 'string' && dto.body.trim()) src.body = dto.body.trim();
    const to = dto.to as ActionKind;
    if (!ACTION_KINDS.includes(to)) throw new BadRequestException('Convert it to what?');
    if (to === src.kind && !(to === 'log' && dto.topicType && dto.topicType !== src.topicType)) throw new BadRequestException(`It’s already a ${KIND_NAME[to]} — use Duplicate to copy it.`);
    const project = dto.projectId !== undefined ? await this.projectById(dto.projectId) : src.projectId != null ? await this.projectById(src.projectId) : null;
    const made = await this.make(to, src, project, actor, { how: 'converted', topicType: dto.topicType });
    await this.record(src, made, 'converted', actor);
    return made;
  }

  /**
   * One project's special actions at a glance (Oct 26 review notes): how many of
   * each are open, and when each kind last changed -- the project's Special
   * Actions buttons blink when something changed since the viewer last looked.
   */
  async projectSummary(projectId: number) {
    const project = await this.projects.findOne({ where: { id: projectId }, select: { id: true, name: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const RECORD = ['FYI', 'Observation', 'Decision'];
    const max = async (q: Promise<{ m: string | null } | undefined>) => (await q)?.m || null;
    const [tasksAt, rfisAt, meetingsAt, cosAt] = await Promise.all([
      max(this.boardRepo.createQueryBuilder('t').select('MAX(COALESCE(t.updatedAt, t.createdAt))', 'm').where('t.projectId = :id', { id: projectId }).getRawOne()),
      max(this.rfiRepo.createQueryBuilder('r').select('MAX(COALESCE(r.updatedAt, r.createdAt))', 'm').where('r.projectId = :id', { id: projectId }).getRawOne()),
      max(this.meetingRepo.createQueryBuilder('m').select('MAX(COALESCE(m.updatedAt, m.createdAt))', 'm').where('m.projectId = :id', { id: projectId }).getRawOne()),
      max(this.coRepo.createQueryBuilder('c').select('MAX(COALESCE(c.updatedAt, c.createdAt))', 'm').where('c.projectId = :id', { id: projectId }).getRawOne()),
    ]);
    const log = await this.logRepo.find({ where: { project: project.name }, select: { id: true, topicType: true, status: true, updatedAt: true } });
    const record = log.filter((t) => RECORD.includes(t.topicType));
    const logTasks = log.filter((t) => !RECORD.includes(t.topicType) && t.topicType !== 'RFI');
    const latest = (rows: { updatedAt?: string }[]) => rows.reduce<string | null>((m, r) => (r.updatedAt && (!m || r.updatedAt > m) ? r.updatedAt : m), null);
    const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
    const [meetings, cos, openRfis] = await Promise.all([
      this.meetingRepo.find({ where: { projectId }, select: { id: true, date: true, status: true } as any }),
      this.coRepo.find({ where: { projectId }, select: { id: true, status: true } as any }),
      this.rfiRepo.count({ where: { projectId, status: 'open' } as any }).catch(() => 0),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return {
      latest: {
        tasks: later(tasksAt, latest(logTasks)),
        rfis: rfisAt,
        meetings: meetingsAt,
        forRecord: latest(record),
        changeOrders: cosAt,
      },
      counts: {
        meetingsUpcoming: meetings.filter((m: any) => String(m.date || '') >= today && m.status !== 'cancelled').length,
        meetings: meetings.length,
        forRecord: record.length,
        changeOrdersOpen: cos.filter((c: any) => !['approved', 'rejected', 'cancelled', 'void'].includes(String(c.status))).length,
        changeOrders: cos.length,
        rfisOpen: openRfis,
      },
    };
  }
}
