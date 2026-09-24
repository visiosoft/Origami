import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DailyLogEntity, EmployeeEntity, LaborLogEntryEntity, OvertimeRequestEntity, PublicHolidayEntity, TimesheetEntity, TimesheetLineEntity } from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
import { approvedTimesheetHours } from './weekly-timesheets.service';
import { overtimeBase, round2, type OtType } from './payroll.calc';
import { newId } from './workforce.util';

const OT_TYPES: OtType[] = ['normal', 'weekend', 'holiday', 'night'];

export interface OvertimeInput { employeeId: string; projectId?: number; date: string; hours: number; otType?: string; rate?: number; reason?: string; source?: string }

@Injectable()
export class OvertimeService {
  constructor(
    @InjectRepository(OvertimeRequestEntity) private readonly repo: Repository<OvertimeRequestEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
    private readonly setup: PayrollSetupService,
    private readonly access: ManpowerAccess,
    @InjectRepository(PublicHolidayEntity) private readonly holidays?: Repository<PublicHolidayEntity>,
    @InjectRepository(TimesheetEntity) private readonly timesheets?: Repository<TimesheetEntity>,
    @InjectRepository(TimesheetLineEntity) private readonly timesheetLines?: Repository<TimesheetLineEntity>,
  ) {}

  async findAll(opts: { employeeId?: string; status?: string; from?: string; to?: string }) {
    const qb = this.repo.createQueryBuilder('o');
    if (opts.employeeId) qb.andWhere('o.employeeId = :employeeId', { employeeId: opts.employeeId });
    if (opts.status) qb.andWhere('o.status = :status', { status: opts.status });
    if (opts.from) qb.andWhere('o.date >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('o.date <= :to', { to: opts.to });
    return qb.orderBy('o.date', 'DESC').getMany();
  }

  private validate(dto: OvertimeInput) {
    if (!dto.employeeId) throw new BadRequestException('Pick the employee.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date || '')) throw new BadRequestException('Give the date the overtime was worked.');
    const hours = Number(dto.hours);
    if (!(hours > 0) || hours > 16) throw new BadRequestException('Overtime hours must be more than 0 and at most 16 in a day.');
    if (dto.otType && !OT_TYPES.includes(dto.otType as OtType)) throw new BadRequestException('Unknown overtime type.');
    if (dto.rate != null && !(Number(dto.rate) > 0)) throw new BadRequestException('An override rate must be above 0.');
  }

  private async build(dto: OvertimeInput, actor: Actor) {
    this.validate(dto);
    const emp = await this.employees.findOneBy({ id: dto.employeeId });
    if (!emp) throw new BadRequestException('That employee does not exist.');
    const now = new Date().toISOString();
    return this.repo.create({
      id: newId('OT'), employeeId: dto.employeeId, projectId: dto.projectId ?? undefined, date: dto.date, hours: round2(Number(dto.hours)),
      otType: dto.otType || 'normal', rate: dto.rate != null ? Number(dto.rate) : undefined, reason: dto.reason,
      source: dto.source === 'daily_log' ? 'daily_log' : 'manual', status: 'pending',
      requestedById: actor.id, requestedByName: actor.name, createdAt: now, updatedAt: now,
    });
  }

  async create(dto: OvertimeInput, actor: Actor) {
    return this.repo.save(await this.build(dto, actor));
  }

  async bulkCreate(items: OvertimeInput[], actor: Actor) {
    if (!items?.length) throw new BadRequestException('Nothing to create.');
    const rows = [];
    for (const item of items) rows.push(await this.build(item, actor));
    return this.repo.save(rows, { chunk: 40 });
  }

  private async load(id: string) {
    const o = await this.repo.findOneBy({ id });
    if (!o) throw new NotFoundException('Overtime request not found');
    return o;
  }

  /** Neither the person who asked nor the worker themselves can sign off their own overtime. */
  private async assertIndependent(o: OvertimeRequestEntity, actor: Actor, verb: string) {
    if (actor.id && actor.id === o.requestedById) throw new ForbiddenException(`You can't ${verb} overtime you requested.`);
    const emp = await this.employees.findOneBy({ id: o.employeeId });
    if (actor.id && emp?.userId && emp.userId === actor.id) throw new ForbiddenException(`You can't ${verb} your own overtime.`);
    return emp;
  }

  /** Approval prices the overtime -- the rate and multiplier are fixed from this point. */
  async approve(id: string, note: string | undefined, actor: Actor) {
    const o = await this.load(id);
    if (o.status !== 'pending') throw new BadRequestException(`This request is already ${o.status}.`);
    await this.access.require(actor, HR_MODULE, 'approve overtime');
    const emp = await this.assertIndependent(o, actor, 'approve');
    if (!emp) throw new BadRequestException('The employee no longer exists.');
    const s = await this.setup.settings();
    const baseRate = round2(o.rate || overtimeBase(emp, s));
    if (!(baseRate > 0)) throw new BadRequestException(`${emp.name} has no pay rate set -- add one (or an overtime rate) before approving.`);
    const multiplier = s.otMultipliers[(o.otType as OtType) || 'normal'] ?? s.otMultipliers.normal;
    Object.assign(o, {
      status: 'approved', baseRate, multiplier, amount: round2(o.hours * baseRate * multiplier),
      decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '', updatedAt: new Date().toISOString(),
    });
    return this.repo.save(o);
  }

  async reject(id: string, note: string | undefined, actor: Actor) {
    const o = await this.load(id);
    if (o.status !== 'pending') throw new BadRequestException(`This request is already ${o.status}.`);
    await this.access.require(actor, HR_MODULE, 'reject overtime');
    await this.assertIndependent(o, actor, 'reject');
    Object.assign(o, { status: 'rejected', decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '', updatedAt: new Date().toISOString() });
    return this.repo.save(o);
  }

  async cancel(id: string, actor: Actor) {
    const o = await this.load(id);
    if (o.payrollRunId) throw new BadRequestException('This overtime is already in a payroll run.');
    if (!['pending', 'approved'].includes(o.status)) throw new BadRequestException(`A ${o.status} request can't be cancelled.`);
    Object.assign(o, { status: 'cancelled', decidedByName: actor.name, decidedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return this.repo.save(o);
  }

  /**
   * Hours beyond a standard day in approved daily logs that nobody has raised
   * overtime for yet -- the Daily Log is where the extra time shows up first.
   */
  async suggestions(from: string, to: string) {
    const s = await this.setup.settings();
    const logs = await this.logs.createQueryBuilder('l')
      .where('l.status = :st', { st: 'approved' })
      .andWhere('l.date >= :from AND l.date <= :to', { from, to })
      .getMany();
    const byLog = new Map(logs.map((l) => [l.id, l]));
    const entries = logs.length ? await this.entries.find({ where: { dailyLogId: In(logs.map((l) => l.id)) } }) : [];
    const perDay = new Map<string, { employeeId: string; date: string; hours: number; projectIds: Set<number> }>();
    for (const e of entries) {
      const log = byLog.get(e.dailyLogId)!;
      const key = `${e.employeeId}|${log.date}`;
      const cur = perDay.get(key) || { employeeId: e.employeeId, date: log.date, hours: 0, projectIds: new Set<number>() };
      cur.hours += Number(e.hours) || 0;
      cur.projectIds.add(log.projectId);
      perDay.set(key, cur);
    }
    // Approved timesheet hours replace daily-log hours for that person and day.
    if (this.timesheets && this.timesheetLines) {
      for (const [employeeId, days] of await approvedTimesheetHours(this.timesheets, this.timesheetLines, from, to)) {
        for (const [date, d] of days) perDay.set(`${employeeId}|${date}`, { employeeId, date, hours: d.hours, projectIds: d.projectIds });
      }
    }
    if (!perDay.size) return [];
    const existing = await this.repo.createQueryBuilder('o')
      .where('o.date >= :from AND o.date <= :to', { from, to })
      .andWhere('o.status IN (:...st)', { st: ['pending', 'approved'] })
      .getMany();
    const taken = new Set(existing.map((o) => `${o.employeeId}|${o.date}`));
    const hol = new Set(((await this.holidays?.find()) || []).map((h) => h.date));
    return Array.from(perDay.entries())
      .filter(([key, d]) => d.hours > s.standardDayHours && !taken.has(key))
      .map(([, d]) => ({
        employeeId: d.employeeId, date: d.date, loggedHours: round2(d.hours), overtimeHours: round2(d.hours - s.standardDayHours),
        projectId: d.projectIds.size === 1 ? Array.from(d.projectIds)[0] : undefined,
        otType: hol.has(d.date) ? 'holiday' : s.weekendDays.includes(new Date(d.date + 'T00:00:00Z').getUTCDay()) ? 'weekend' : 'normal',
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
