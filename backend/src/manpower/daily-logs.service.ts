import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DailyLogEntity, DailyReportTemplateEntity, LaborLogEntryEntity, UserEntity } from '../database/entities';

export interface ManpowerActor { name: string; id?: string }

@Injectable()
export class DailyLogsService {
  constructor(
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
    @InjectRepository(DailyReportTemplateEntity) private readonly templates?: Repository<DailyReportTemplateEntity>,
    @InjectRepository(UserEntity) private readonly users?: Repository<UserEntity>,
  ) {}

  /** Everything logged in a date range, optionally for one project -- used by the Timesheet rollup too. */
  async findEntries(opts: { projectId?: number; employeeId?: string; from?: string; to?: string }) {
    const qb = this.logs.createQueryBuilder('log');
    if (opts.projectId != null) qb.andWhere('log.projectId = :projectId', { projectId: opts.projectId });
    if (opts.from) qb.andWhere('log.date >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('log.date <= :to', { to: opts.to });
    // A report replaced by a later version of the same day no longer counts.
    const logs = (await qb.getMany()).filter((l) => l.status !== 'superseded');
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
    const logs = await this.logs.find({ where, order: { date: 'DESC' } });
    if (!logs.length) return logs;
    // Crew size and hours for each day, so lists (Daily Reports) needn't open every log.
    const entries = await this.entries.find({ where: { dailyLogId: In(logs.map((l) => l.id)) } });
    const sum = new Map<string, { crew: number; hours: number }>();
    for (const e of entries) {
      const v = sum.get(e.dailyLogId) || { crew: 0, hours: 0 };
      v.crew += 1; v.hours += Number(e.hours) || 0;
      sum.set(e.dailyLogId, v);
    }
    return logs.map((l) => ({ ...l, crewCount: sum.get(l.id)?.crew || 0, totalHours: Math.round((sum.get(l.id)?.hours || 0) * 100) / 100 }));
  }

  /** Every report (version) filed for a project's day, oldest first. */
  private async versionsOf(projectId: number, date: string) {
    const rows = await this.logs.find({ where: { projectId, date } });
    return rows.sort((a, b) => (Number(a.version) || 1) - (Number(b.version) || 1));
  }

  private newLog(projectId: number, date: string, actor: ManpowerActor, version = 1, versionOf: string | null = null) {
    return this.logs.create({
      id: 'DL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
      projectId, date, status: 'draft', version, versionOf: versionOf as any,
      supervisorId: actor.id, supervisorName: actor.name,
      createdAt: new Date().toISOString(),
    } as Partial<DailyLogEntity>);
  }

  /**
   * The day's report for a project -- the one asked for, or the latest version --
   * plus the list of versions. Scaffolds an empty draft if there's none yet.
   */
  async getForDay(projectId: number, date: string, id?: string) {
    const versions = await this.versionsOf(projectId, date);
    const log = (id && versions.find((v) => v.id === id)) || versions[versions.length - 1] || null;
    const entries = log ? await this.entries.find({ where: { dailyLogId: log.id } }) : [];
    return {
      log: log ?? { id: null, projectId, date, status: 'draft', notes: '', version: 1 },
      entries,
      versions: versions.map((v) => ({ id: v.id, version: Number(v.version) || 1, status: v.status, autoReason: v.autoReason || null, supervisorName: v.supervisorName, createdAt: v.createdAt })),
    };
  }

  async save(dto: {
    id?: string; projectId: number; date: string; notes?: string; entries?: any[]; newVersion?: boolean;
    sections?: Record<string, any> | null; onBehalfOf?: string; certifiedName?: string; signatureDataUrl?: string;
    dupBaseline?: Record<string, any> | null; dupFromDate?: string;
  }, actor: ManpowerActor) {
    let log: DailyLogEntity | null = null;
    if (dto.id) {
      log = await this.logs.findOneBy({ id: dto.id });
      if (!log) throw new NotFoundException('That report no longer exists.');
    } else if (!dto.newVersion) {
      const versions = await this.versionsOf(dto.projectId, dto.date);
      log = versions[versions.length - 1] || null;
    }
    if (log && log.status !== 'draft' && log.status !== 'rejected') {
      throw new BadRequestException('This day has already been submitted -- it can no longer be edited directly.');
    }
    // A new report for the day, or an updated one when the day already has a report.
    if (!log) {
      const versions = await this.versionsOf(dto.projectId, dto.date);
      log = versions.length
        ? this.newLog(dto.projectId, dto.date, actor, Math.max(...versions.map((v) => Number(v.version) || 1)) + 1, versions[0].id)
        : this.newLog(dto.projectId, dto.date, actor);
    }
    // A draft moved to another day: that day must be free, or it becomes an update of that day's report.
    if (log.date !== dto.date || Number(log.projectId) !== Number(dto.projectId)) {
      const there = (await this.versionsOf(dto.projectId, dto.date)).filter((v) => v.id !== log!.id);
      if (there.length && !dto.newVersion) throw new ConflictException(`There's already a report for ${dto.date}. Change the date, or add an updated report for that day.`);
      Object.assign(log, {
        projectId: dto.projectId, date: dto.date,
        version: there.length ? Math.max(...there.map((v) => Number(v.version) || 1)) + 1 : 1,
        versionOf: there.length ? there[0].id : null,
      });
    }
    if (log.status === 'rejected') log.status = 'draft'; // editing a rejected day starts a fresh draft cycle
    log.notes = dto.notes ?? log.notes;
    if (dto.sections !== undefined) log.sections = dto.sections && typeof dto.sections === 'object' ? dto.sections : null;
    if (dto.onBehalfOf !== undefined) log.onBehalfOf = String(dto.onBehalfOf || '').trim() || (null as any);
    if (dto.dupBaseline !== undefined) log.dupBaseline = dto.dupBaseline && typeof dto.dupBaseline === 'object' ? dto.dupBaseline : null;
    if (dto.dupFromDate !== undefined) log.dupFromDate = dto.dupFromDate || (null as any);
    // X. The signature time is taken when it's first signed and kept, even if the report is submitted days later.
    if (dto.certifiedName !== undefined || dto.signatureDataUrl !== undefined) {
      const name = String(dto.certifiedName ?? log.certifiedName ?? '').trim();
      const sig = String(dto.signatureDataUrl ?? log.signatureDataUrl ?? '');
      log.certifiedName = name || (null as any);
      log.signatureDataUrl = sig || (null as any);
      if (name && sig) log.signedAt = log.signedAt || new Date().toISOString();
      else log.signedAt = null as any;
    }
    log = await this.logs.save(log);

    const existing = await this.entries.find({ where: { dailyLogId: log.id } });
    if (existing.length) await this.entries.remove(existing);
    const rows = (dto.entries || []).map((e, i) => this.entries.create({
      id: 'LLE-' + String(Date.now()) + '-' + i,
      dailyLogId: log!.id, employeeId: e.employeeId, csiCodeId: e.csiCodeId,
      hours: e.hours, taskDetail: e.taskDetail, taskStatus: e.taskStatus, team: e.team,
    } as Partial<LaborLogEntryEntity>));
    const saved = rows.length ? await this.entries.save(rows, { chunk: 40 }) : [];
    return { log, entries: saved };
  }

  async submit(id: string, actor: ManpowerActor) {
    const log = await this.require(id);
    if (log.status !== 'draft' && log.status !== 'rejected') throw new BadRequestException(`Cannot submit a log in status "${log.status}"`);
    // A full Daily Report needs Section II answered and Section X signed.
    if (log.sections) {
      const worked = log.sections?.activity?.worked;
      if (worked !== 'yes' && worked !== 'no') throw new BadRequestException('Answer "Did work occur today?" (Section II) before submitting.');
      if (!log.certifiedName || !log.signatureDataUrl || !log.signedAt) throw new BadRequestException('Sign the certification (Section X) before submitting.');
    }
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
    const saved = await this.logs.save(log);
    // One approved report per day: an earlier approved version is replaced, so its hours don't count twice.
    const others = (await this.versionsOf(log.projectId, log.date)).filter((v) => v.id !== log.id && v.status === 'approved');
    for (const o of others) { o.status = 'superseded'; await this.logs.save(o); }
    return saved;
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

  // ------------------------------------------------------------- templates

  async listTemplates() {
    const rows = await this.templates!.find();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveTemplate(dto: { name: string; sections?: Record<string, any> | null; entries?: Record<string, any>[] }, actor: ManpowerActor) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('Give the template a name.');
    if (name.length > 120) throw new BadRequestException('Keep the name under 120 characters.');
    const existing = (await this.templates!.find()).find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing && existing.createdById && existing.createdById !== actor.id && !(await this.isAdmin(actor))) {
      throw new ConflictException(`There's already a template called "${existing.name}" -- pick another name.`);
    }
    // What was done belongs to a day; a template keeps who's on the crew with their usual hours, cost code and team.
    const entries = (Array.isArray(dto.entries) ? dto.entries : []).map((e) => ({ employeeId: e.employeeId, csiCodeId: e.csiCodeId, team: e.team, taskStatus: e.taskStatus, hours: e.hours }));
    const row = this.templates!.create({
      ...(existing || { id: 'DRT-' + Date.now().toString(36).toUpperCase(), createdById: actor.id, createdByName: actor.name }),
      name, sections: dto.sections && typeof dto.sections === 'object' ? dto.sections : null, entries,
      createdAt: existing?.createdAt || new Date().toISOString(),
    } as Partial<DailyReportTemplateEntity>);
    return this.templates!.save(row);
  }

  async removeTemplate(id: string, actor: ManpowerActor) {
    const row = await this.templates!.findOneBy({ id });
    if (!row) return { id, deleted: true };
    if (row.createdById && row.createdById !== actor.id && !(await this.isAdmin(actor))) {
      throw new ForbiddenException(`Only ${row.createdByName || 'whoever made it'} or an admin can delete this template.`);
    }
    await this.templates!.remove(row);
    return { id, deleted: true };
  }

  /** Email of the account a report was filed under -- they get a copy when someone else completed it for them. */
  async ownerEmail(log: DailyLogEntity): Promise<string | null> {
    if (!log.supervisorId || !this.users) return null;
    const u = await this.users.findOneBy({ id: log.supervisorId });
    return u?.email || null;
  }

  private async isAdmin(actor: ManpowerActor) {
    if (!actor.id || !this.users) return false;
    const u = await this.users.findOneBy({ id: actor.id });
    return u?.roleKey === 'admin';
  }

  private async require(id: string) {
    const log = await this.logs.findOneBy({ id });
    if (!log) throw new NotFoundException(`Daily log ${id} not found`);
    return log;
  }
}
