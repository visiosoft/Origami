import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChangeOrderEntity, MeetingEntity, RfiEntity, TaskEntity } from '../database/entities';
import { TasksService } from '../tasks/tasks.service';
import { backfillSerials, nextSerial, serialYear } from '../database/serials';
import type { MeetingActionDto, MeetingDto } from './dto';
import { normalizeMeetingStatus, settleMeetingStatus, type CapturedAction } from './meeting-status';

type Actor = { name: string; id?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
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

  async list() {
    const rows = await this.repo.find({ order: { date: 'DESC', time: 'DESC' } });
    return this.settle(rows);
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
    return this.repo.save(this.repo.create({
      type: 'Internal', attendees: [], rfiIds: [], changeOrderIds: [], ...dto, title: dto.title!.trim(),
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
    for (const k of ['recordingUrl', 'transcriptUrl'] as const) if (typeof patch[k] === 'string') patch[k] = patch[k]!.trim();
    Object.assign(m, patch, { updatedAt: new Date().toISOString() });
    const saved = await this.repo.save(m);
    return (await this.settle([saved]))[0];
  }

  /** Deleting a meeting keeps the actions raised in it -- they just stop pointing at it. */
  async remove(id: string) {
    const m = await this.load(id);
    await this.tasksRepo.update({ meetingId: id }, { meetingId: null as any });
    await this.repo.remove(m);
    return { ok: true };
  }

  async addAction(id: string, dto: MeetingActionDto, actor: Actor) {
    const m = await this.load(id);
    const t = await this.tasks.create({
      topicType: dto.topicType, subject: dto.subject.trim(), description: dto.description || '',
      assignedTo: dto.assignedTo, assignedToId: dto.assignedToId, dueDate: dto.dueDate || undefined,
      project: m.project || '', meetingType: m.type || 'Internal', meetingDate: m.date, meetingId: m.id, tab: 'internal',
    }, actor as any);
    await this.settle([m]); // a new open task takes a complete meeting back to reviewed
    return t;
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
    const [tasks, rfis, cos, statuses] = await Promise.all([
      this.tasksRepo.find({ where: { meetingId: In(ids) }, select: { id: true, meetingId: true, status: true, topicType: true } }),
      this.rfis && rfiIds.length ? this.rfis.find({ where: { id: In(rfiIds) }, select: { id: true, status: true } }) : Promise.resolve([] as RfiEntity[]),
      this.cos && coIds.length ? this.cos.find({ where: { id: In(coIds) }, select: { id: true, status: true } }) : Promise.resolve([] as ChangeOrderEntity[]),
      this.tasks.statuses(),
    ]);
    const closed = statuses.filter((s) => s.closed).map((s) => s.name);
    const rfiStatus = new Map(rfis.map((r) => [r.id, r.status]));
    const coStatus = new Map(cos.map((c) => [c.id, c.status]));
    const changed: MeetingEntity[] = [];
    for (const m of rows) {
      const actions: CapturedAction[] = [
        ...tasks.filter((t) => t.meetingId === m.id && !FOR_RECORD_TOPICS.includes(t.topicType)).map((t) => ({ kind: 'task' as const, status: t.status })),
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
