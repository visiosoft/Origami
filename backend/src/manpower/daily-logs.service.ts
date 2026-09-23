import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyLogEntity, LaborLogEntryEntity } from '../database/entities';

export interface ManpowerActor { name: string; id?: string }

@Injectable()
export class DailyLogsService {
  constructor(
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
  ) {}

  /** Everything logged in a date range, optionally for one project -- used by the Timesheet rollup too. */
  async findEntries(opts: { projectId?: number; employeeId?: string; from?: string; to?: string }) {
    const qb = this.logs.createQueryBuilder('log');
    if (opts.projectId != null) qb.andWhere('log.projectId = :projectId', { projectId: opts.projectId });
    if (opts.from) qb.andWhere('log.date >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('log.date <= :to', { to: opts.to });
    const logs = await qb.getMany();
    if (!logs.length) return [];
    const entries = await this.entries.find({ where: logs.map((l) => ({ dailyLogId: l.id })) });
    const byLog = new Map(logs.map((l) => [l.id, l]));
    const filtered = opts.employeeId ? entries.filter((e) => e.employeeId === opts.employeeId) : entries;
    return filtered.map((e) => ({ ...e, dailyLog: byLog.get(e.dailyLogId) }));
  }

  async findAllLogs(opts: { status?: string; projectId?: number }) {
    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.projectId != null) where.projectId = opts.projectId;
    return this.logs.find({ where, order: { date: 'DESC' } });
  }

  /** The day's log for a project, scaffolding an empty draft if none exists yet -- not saved until entries are written. */
  async getForDay(projectId: number, date: string) {
    const log = await this.logs.findOneBy({ projectId, date });
    const entries = log ? await this.entries.find({ where: { dailyLogId: log.id } }) : [];
    return { log: log ?? { id: null, projectId, date, status: 'draft', notes: '' }, entries };
  }

  async save(dto: { projectId: number; date: string; notes?: string; entries?: any[] }, actor: ManpowerActor) {
    let log = await this.logs.findOneBy({ projectId: dto.projectId, date: dto.date });
    if (log && log.status !== 'draft' && log.status !== 'rejected') {
      throw new BadRequestException('This day has already been submitted -- it can no longer be edited directly.');
    }
    if (!log) {
      log = this.logs.create({
        id: 'DL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
        projectId: dto.projectId, date: dto.date, status: 'draft',
        supervisorId: actor.id, supervisorName: actor.name,
        createdAt: new Date().toISOString(),
      } as Partial<DailyLogEntity>);
    }
    if (log.status === 'rejected') log.status = 'draft'; // editing a rejected day starts a fresh draft cycle
    log.notes = dto.notes ?? log.notes;
    log = await this.logs.save(log);

    const existing = await this.entries.find({ where: { dailyLogId: log.id } });
    if (existing.length) await this.entries.remove(existing);
    const rows = (dto.entries || []).map((e, i) => this.entries.create({
      id: 'LLE-' + String(Date.now()) + '-' + i,
      dailyLogId: log!.id, employeeId: e.employeeId, csiCodeId: e.csiCodeId,
      hours: e.hours, taskDetail: e.taskDetail, taskStatus: e.taskStatus, team: e.team,
    } as Partial<LaborLogEntryEntity>));
    const saved = rows.length ? await this.entries.save(rows) : [];
    return { log, entries: saved };
  }

  async submit(id: string, actor: ManpowerActor) {
    const log = await this.require(id);
    if (log.status !== 'draft' && log.status !== 'rejected') throw new BadRequestException(`Cannot submit a log in status "${log.status}"`);
    log.status = 'submitted';
    log.submittedAt = new Date().toISOString();
    log.supervisorId = log.supervisorId || actor.id || '';
    log.supervisorName = log.supervisorName || actor.name;
    log.rejectionNote = null as any;
    return this.logs.save(log);
  }

  async approve(id: string, actor: ManpowerActor) {
    const log = await this.require(id);
    if (log.status !== 'submitted') throw new BadRequestException(`Cannot approve a log in status "${log.status}"`);
    if (actor.id && actor.id === log.supervisorId) throw new ForbiddenException("You can't approve your own submission.");
    log.status = 'approved';
    log.approvedById = actor.id || '';
    log.approvedByName = actor.name;
    log.approvedAt = new Date().toISOString();
    return this.logs.save(log);
  }

  async reject(id: string, note: string | undefined, actor: ManpowerActor) {
    const log = await this.require(id);
    if (log.status !== 'submitted') throw new BadRequestException(`Cannot reject a log in status "${log.status}"`);
    if (actor.id && actor.id === log.supervisorId) throw new ForbiddenException("You can't reject your own submission.");
    log.status = 'rejected';
    log.approvedById = actor.id || '';
    log.approvedByName = actor.name;
    log.approvedAt = new Date().toISOString();
    log.rejectionNote = note || '';
    return this.logs.save(log);
  }

  private async require(id: string) {
    const log = await this.logs.findOneBy({ id });
    if (!log) throw new NotFoundException(`Daily log ${id} not found`);
    return log;
  }
}
