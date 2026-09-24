import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EmployeeEntity, LeaveAdjustmentEntity, LeaveRequestEntity, LeaveTypeEntity, PublicHolidayEntity,
} from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
import { overlap, workingDays, yearOf } from './calendar.util';
import { hourlyBase, round2 } from './payroll.calc';
import { LEFT_STATUSES, lifecycleStatus, newId, todayISO } from './workforce.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** US leave: vacation/PTO that can roll over and be paid out, personal days, and sick leave (California's minimum is 5 days). */
export const DEFAULT_LEAVE_TYPES: Omit<LeaveTypeEntity, 'order'>[] = [
  { id: 'LT-ANNUAL', name: 'Vacation (PTO)', paid: true, trackBalance: true, annualDays: 10, carryForwardMax: 5, encashable: true, color: '#2F7D4A', active: true },
  { id: 'LT-CASUAL', name: 'Personal', paid: true, trackBalance: true, annualDays: 3, carryForwardMax: 0, encashable: false, color: '#3C5C8A', active: true },
  { id: 'LT-SICK', name: 'Sick', paid: true, trackBalance: true, annualDays: 5, carryForwardMax: 0, encashable: false, color: '#B4532A', active: true },
  { id: 'LT-EMERGENCY', name: 'Emergency', paid: true, trackBalance: true, annualDays: 3, carryForwardMax: 0, encashable: false, color: '#8A6D12', active: true },
  { id: 'LT-MATERNITY', name: 'Maternity', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#7A4FA0', active: true },
  { id: 'LT-PATERNITY', name: 'Paternity', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#5B6CB0', active: true },
  { id: 'LT-BEREAVEMENT', name: 'Bereavement', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#5C6B65', active: true },
  { id: 'LT-UNPAID', name: 'Unpaid', paid: false, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#9AA39D', active: true },
  { id: 'LT-FMLA', name: 'FMLA', paid: false, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#6B4FA0', active: true },
  { id: 'LT-JURY', name: 'Jury duty', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#1F8A72', active: true },
];

/** Leave types as first shipped -> the US version, applied only while a type is still exactly as shipped. */
const LEGACY_LEAVE: Record<string, { name: string; annualDays: number; carryForwardMax: number }> = {
  'LT-ANNUAL': { name: 'Annual', annualDays: 14, carryForwardMax: 7 },
  'LT-CASUAL': { name: 'Casual', annualDays: 10, carryForwardMax: 0 },
  'LT-SICK': { name: 'Sick', annualDays: 8, carryForwardMax: 0 },
};

/** The nth weekday (0 = Sunday) of a month, or the last one when n is -1. */
function nthWeekday(year: number, month: number, dow: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return new Date(Date.UTC(year, month, 1 + ((dow - first + 7) % 7) + (n - 1) * 7)).toISOString().slice(0, 10);
  }
  const last = new Date(Date.UTC(year, month + 1, 0));
  return new Date(Date.UTC(year, month, last.getUTCDate() - ((last.getUTCDay() - dow + 7) % 7))).toISOString().slice(0, 10);
}

/** A fixed-date holiday on a weekend is observed on the Friday before or Monday after. */
function observed(date: string) {
  const d = new Date(date + 'T00:00:00Z');
  const shift = d.getUTCDay() === 6 ? -1 : d.getUTCDay() === 0 ? 1 : 0;
  return new Date(d.getTime() + shift * 86400000).toISOString().slice(0, 10);
}

/** The 11 US federal holidays for a year, on their observed dates. */
export function usFederalHolidays(year: number): { date: string; name: string }[] {
  return [
    { date: observed(`${year}-01-01`), name: "New Year's Day" },
    { date: nthWeekday(year, 0, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: nthWeekday(year, 1, 1, 3), name: "Washington's Birthday (Presidents' Day)" },
    { date: nthWeekday(year, 4, 1, -1), name: 'Memorial Day' },
    { date: observed(`${year}-06-19`), name: 'Juneteenth' },
    { date: observed(`${year}-07-04`), name: 'Independence Day' },
    { date: nthWeekday(year, 8, 1, 1), name: 'Labor Day' },
    { date: nthWeekday(year, 9, 1, 2), name: 'Columbus Day' },
    { date: observed(`${year}-11-11`), name: 'Veterans Day' },
    { date: nthWeekday(year, 10, 4, 4), name: 'Thanksgiving Day' },
    { date: observed(`${year}-12-25`), name: 'Christmas Day' },
  ];
}

/** Leave rows from before leave types existed carried a free-text type. */
const LEGACY_TYPE: Record<string, string> = { PTO: 'LT-ANNUAL', Sick: 'LT-SICK', Unpaid: 'LT-UNPAID', Other: 'LT-CASUAL' };

type Req = Pick<LeaveRequestEntity, 'startDate' | 'endDate' | 'halfDay' | 'status' | 'leaveTypeId'>;

/** Working days a request takes inside one calendar year (a request can straddle New Year). */
export function requestDaysInYear(r: Req, year: number, weekendDays: number[], holidays: Set<string>): number {
  const span = overlap(r.startDate, r.endDate, `${year}-01-01`, `${year}-12-31`);
  if (!span) return 0;
  const n = workingDays(span[0], span[1], weekendDays, holidays).length;
  return r.halfDay ? Math.min(n, 0.5) : n;
}

/** A yearly allowance, prorated to the half day for someone who joined during that year. */
export function entitlementFor(type: Pick<LeaveTypeEntity, 'annualDays' | 'trackBalance'>, hireDate: string | undefined, year: number): number {
  if (!type.trackBalance) return 0;
  if (!hireDate || yearOf(hireDate) < year) return type.annualDays;
  if (yearOf(hireDate) > year) return 0;
  const monthsLeft = 12 - Number(hireDate.slice(5, 7)) + 1;
  return Math.round((type.annualDays * monthsLeft) / 12 * 2) / 2;
}

export interface Balance {
  leaveTypeId: string; name: string; trackBalance: boolean; paid: boolean; encashable: boolean;
  entitlement: number; carriedForward: number; adjusted: number; encashed: number;
  used: number; pending: number; available: number;
}

export function computeBalance(
  type: LeaveTypeEntity, hireDate: string | undefined, year: number,
  requests: Req[], adjustments: Pick<LeaveAdjustmentEntity, 'leaveTypeId' | 'year' | 'kind' | 'days'>[],
  weekendDays: number[], holidays: Set<string>,
): Balance {
  const mine = requests.filter((r) => r.leaveTypeId === type.id);
  const adj = adjustments.filter((a) => a.leaveTypeId === type.id && a.year === year);
  const sum = (kind: string) => round2(adj.filter((a) => a.kind === kind).reduce((s, a) => s + a.days, 0));
  const days = (status: string) => round2(mine.filter((r) => r.status === status).reduce((s, r) => s + requestDaysInYear(r, year, weekendDays, holidays), 0));
  const entitlement = entitlementFor(type, hireDate, year);
  const carriedForward = sum('carry_forward');
  const adjusted = sum('manual');
  const encashed = round2(-sum('encashment'));
  const used = days('approved');
  const pending = days('pending');
  return {
    leaveTypeId: type.id, name: type.name, trackBalance: type.trackBalance, paid: type.paid, encashable: type.encashable,
    entitlement, carriedForward, adjusted, encashed, used, pending,
    available: round2(entitlement + carriedForward + adjusted - encashed - used),
  };
}

@Injectable()
export class LeaveService implements OnApplicationBootstrap {
  private readonly log = new Logger('LeaveService');

  constructor(
    @InjectRepository(LeaveTypeEntity) private readonly types: Repository<LeaveTypeEntity>,
    @InjectRepository(LeaveRequestEntity) private readonly requests: Repository<LeaveRequestEntity>,
    @InjectRepository(LeaveAdjustmentEntity) private readonly adjustments: Repository<LeaveAdjustmentEntity>,
    @InjectRepository(PublicHolidayEntity) private readonly holidays: Repository<PublicHolidayEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    private readonly setup: PayrollSetupService,
    private readonly access: ManpowerAccess,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.types.count()) === 0) {
        await this.types.save(DEFAULT_LEAVE_TYPES.map((t, i) => ({ ...t, order: i })) as LeaveTypeEntity[]);
        this.log.log(`Seeded ${DEFAULT_LEAVE_TYPES.length} leave types`);
      } else {
        await this.convertToUs();
      }
      // Requests from before leave types existed: give them a type and a day count.
      const legacy = (await this.requests.find()).filter((r) => !r.leaveTypeId);
      if (legacy.length) {
        const { weekendDays } = await this.setup.settings();
        const hol = await this.holidaySet();
        for (const r of legacy) {
          r.leaveTypeId = LEGACY_TYPE[r.type] || 'LT-CASUAL';
          if (r.status === 'denied') r.status = 'rejected';
          r.days = workingDays(r.startDate, r.endDate, weekendDays, hol).length;
        }
        await this.requests.save(legacy);
        this.log.log(`Upgraded ${legacy.length} older leave request(s) to leave types`);
      }
    } catch (err) {
      this.log.error('Leave bootstrap failed: ' + (err as Error).message);
    }
  }

  /** Types still exactly as first shipped become their US version; US-only types are added; Site rotation retires if unused. */
  async convertToUs() {
    const rows = await this.types.find();
    const changed: LeaveTypeEntity[] = [];
    for (const r of rows) {
      const old = LEGACY_LEAVE[r.id];
      if (old && r.name === old.name && r.annualDays === old.annualDays && r.carryForwardMax === old.carryForwardMax) {
        const us = DEFAULT_LEAVE_TYPES.find((t) => t.id === r.id)!;
        Object.assign(r, { name: us.name, annualDays: us.annualDays, carryForwardMax: us.carryForwardMax });
        changed.push(r);
      }
      if (r.id === 'LT-ROTATION' && r.name === 'Site rotation' && r.active && !(await this.requests.count({ where: { leaveTypeId: r.id } }))) {
        r.active = false;
        changed.push(r);
      }
    }
    let order = rows.length;
    for (const t of DEFAULT_LEAVE_TYPES) if (!rows.some((r) => r.id === t.id)) changed.push(this.types.create({ ...t, order: order++ }));
    if (changed.length) {
      await this.types.save(changed);
      this.log.log(`Leave types set up for the US (${changed.length} changed)`);
    }
  }

  // ------------------------------------------------------------------ setup

  listTypes() {
    return this.types.find({ order: { order: 'ASC' } });
  }

  private checkType(t: Partial<LeaveTypeEntity>) {
    for (const k of ['annualDays', 'carryForwardMax'] as const) {
      if (t[k] != null && (!Number.isFinite(Number(t[k])) || Number(t[k]) < 0 || Number(t[k]) > 366)) throw new BadRequestException('Days must be between 0 and 366.');
    }
  }

  async createType(dto: Partial<LeaveTypeEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change leave types');
    if (!dto.name?.trim()) throw new BadRequestException('Name the leave type.');
    this.checkType(dto);
    const row = { paid: true, trackBalance: true, annualDays: 0, carryForwardMax: 0, encashable: false, active: true, order: await this.types.count(), ...dto, name: dto.name.trim(), id: newId('LT') };
    return this.types.save(this.types.create(row));
  }

  async updateType(id: string, dto: Partial<LeaveTypeEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change leave types');
    const t = await this.types.findOneBy({ id });
    if (!t) throw new NotFoundException('Leave type not found');
    this.checkType(dto);
    Object.assign(t, dto, { id });
    return this.types.save(t);
  }

  async removeType(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change leave types');
    if (await this.requests.count({ where: { leaveTypeId: id } })) throw new BadRequestException('This type has leave on record -- make it inactive instead.');
    const t = await this.types.findOneBy({ id });
    if (t) await this.types.remove(t);
    return { id, deleted: true };
  }

  listHolidays(year?: number) {
    return this.holidays.find({ order: { date: 'ASC' } }).then((all) => (year ? all.filter((h) => yearOf(h.date) === year) : all));
  }

  async holidaySet() {
    return new Set((await this.holidays.find()).map((h) => h.date));
  }

  async addHoliday(dto: { date: string; name: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change public holidays');
    if (!ISO.test(dto.date || '') || !dto.name?.trim()) throw new BadRequestException('Give the holiday a date and a name.');
    if (await this.holidays.findOneBy({ date: dto.date })) throw new BadRequestException('There is already a holiday on that date.');
    return this.holidays.save(this.holidays.create({ id: newId('PH'), date: dto.date, name: dto.name.trim() }));
  }

  /** Adds the US federal holidays for a year, skipping dates already on the calendar. */
  async addUsFederalHolidays(year: number, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change public holidays');
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new BadRequestException('Which year?');
    const taken = new Set((await this.holidays.find()).map((h) => h.date));
    const rows = usFederalHolidays(y).filter((h) => !taken.has(h.date)).map((h) => this.holidays.create({ id: newId('PH'), ...h }));
    if (rows.length) await this.holidays.save(rows);
    return { year: y, added: rows.length };
  }

  async removeHoliday(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change public holidays');
    const h = await this.holidays.findOneBy({ id });
    if (h) await this.holidays.remove(h);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ balances

  private async context() {
    const [types, s, hol] = await Promise.all([this.types.find({ order: { order: 'ASC' } }), this.setup.settings(), this.holidaySet()]);
    return { types, weekendDays: s.weekendDays, hol };
  }

  async balances(employeeId: string, year: number) {
    const emp = await this.employees.findOneBy({ id: employeeId });
    if (!emp) throw new NotFoundException('Employee not found');
    const { types, weekendDays, hol } = await this.context();
    const [reqs, adjs] = await Promise.all([
      this.requests.find({ where: { employeeId } }),
      this.adjustments.find({ where: { employeeId } }),
    ]);
    return types.filter((t) => t.active || reqs.some((r) => r.leaveTypeId === t.id))
      .map((t) => computeBalance(t, emp.hireDate, year, reqs, adjs, weekendDays, hol));
  }

  /** Available days of every tracked type for everyone on staff -- the HR overview. */
  async allBalances(year: number) {
    const { types, weekendDays, hol } = await this.context();
    const tracked = types.filter((t) => t.active && t.trackBalance);
    const [emps, reqs, adjs] = await Promise.all([this.employees.find(), this.requests.find(), this.adjustments.find()]);
    return emps.filter((e) => !e.contractorId && !LEFT_STATUSES.includes(lifecycleStatus(e))).map((e) => ({
      employeeId: e.id,
      balances: tracked.map((t) => computeBalance(t, e.hireDate, year, reqs.filter((r) => r.employeeId === e.id), adjs.filter((a) => a.employeeId === e.id), weekendDays, hol)),
    }));
  }

  async adjust(dto: { employeeId: string; leaveTypeId: string; year: number; days: number; note?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'adjust leave balances');
    const days = round2(Number(dto.days));
    if (!days || Math.abs(days) > 366) throw new BadRequestException('Give a number of days to add (+) or take away (-).');
    if (!dto.note?.trim()) throw new BadRequestException('Say why the balance is being adjusted.');
    await this.requireTrackedType(dto.leaveTypeId);
    if (!(await this.employees.findOneBy({ id: dto.employeeId }))) throw new BadRequestException('Employee not found.');
    return this.adjustments.save(this.adjustments.create({
      id: newId('LA'), employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: Number(dto.year), kind: 'manual', days,
      note: dto.note.trim(), createdByName: actor.name, createdAt: new Date().toISOString(),
    }));
  }

  private async requireTrackedType(id: string) {
    const t = await this.types.findOneBy({ id });
    if (!t) throw new BadRequestException('Unknown leave type.');
    if (!t.trackBalance) throw new BadRequestException(`${t.name} leave has no balance to adjust.`);
    return t;
  }

  /** Turn unused days into money, paid in the next payroll run. */
  async encash(dto: { employeeId: string; leaveTypeId: string; year: number; days: number }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'encash leave');
    const t = await this.requireTrackedType(dto.leaveTypeId);
    if (!t.encashable) throw new BadRequestException(`${t.name} leave can't be encashed.`);
    const emp = await this.employees.findOneBy({ id: dto.employeeId });
    if (!emp) throw new BadRequestException('Employee not found.');
    const days = round2(Number(dto.days));
    if (!(days > 0)) throw new BadRequestException('Encash at least half a day.');
    const bal = (await this.balances(emp.id, Number(dto.year))).find((b) => b.leaveTypeId === t.id)!;
    if (days > bal.available - bal.pending + 0.001) throw new BadRequestException(`Only ${round2(bal.available - bal.pending)} day(s) can be encashed.`);
    const s = await this.setup.settings();
    const dayRate = hourlyBase(emp, s) * s.standardDayHours;
    if (!(dayRate > 0)) throw new BadRequestException(`${emp.name} has no pay rate to value the days at.`);
    return this.adjustments.save(this.adjustments.create({
      id: newId('LA'), employeeId: emp.id, leaveTypeId: t.id, year: Number(dto.year), kind: 'encashment', days: -days,
      amount: round2(days * dayRate), note: `${days} day(s) of ${t.name} at ${round2(dayRate)}/day`,
      createdByName: actor.name, createdAt: new Date().toISOString(),
    }));
  }

  /** Move unused days (up to each type's cap) into the next year. Safe to run twice -- it replaces its own earlier result. */
  async carryForward(fromYear: number, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'carry leave forward');
    const year = Number(fromYear);
    if (!Number.isInteger(year)) throw new BadRequestException('Which year is closing?');
    const { types, weekendDays, hol } = await this.context();
    const carrying = types.filter((t) => t.trackBalance && t.carryForwardMax > 0);
    if (!carrying.length) throw new BadRequestException('No leave type allows carry-forward. Set a carry-forward limit first.');
    const [emps, reqs, adjs] = await Promise.all([this.employees.find(), this.requests.find(), this.adjustments.find()]);
    const stale = adjs.filter((a) => a.kind === 'carry_forward' && a.year === year + 1);
    if (stale.length) await this.adjustments.remove(stale);
    const fresh = adjs.filter((a) => !stale.includes(a));
    const rows: LeaveAdjustmentEntity[] = [];
    for (const e of emps.filter((x) => !x.contractorId && !LEFT_STATUSES.includes(lifecycleStatus(x)))) {
      for (const t of carrying) {
        const bal = computeBalance(t, e.hireDate, year, reqs.filter((r) => r.employeeId === e.id), fresh.filter((a) => a.employeeId === e.id), weekendDays, hol);
        const carry = round2(Math.min(Math.max(bal.available, 0), t.carryForwardMax));
        if (carry > 0) rows.push(this.adjustments.create({
          id: newId('LA'), employeeId: e.id, leaveTypeId: t.id, year: year + 1, kind: 'carry_forward', days: carry,
          note: `Carried forward from ${year}`, createdByName: actor.name, createdAt: new Date().toISOString(),
        }));
      }
    }
    if (rows.length) await this.adjustments.save(rows, { chunk: 40 });
    return { year: year + 1, carried: rows.length, days: round2(rows.reduce((s, r) => s + r.days, 0)) };
  }

  listAdjustments(employeeId: string) {
    return this.adjustments.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
  }

  // ------------------------------------------------------------------ requests

  async findRequests(opts: { employeeId?: string; status?: string; from?: string; to?: string }) {
    const where: any = {};
    if (opts.employeeId) where.employeeId = opts.employeeId;
    if (opts.status) where.status = opts.status;
    const rows = await this.requests.find({ where, order: { startDate: 'DESC' } });
    return rows.filter((r) => (!opts.from || r.endDate >= opts.from) && (!opts.to || r.startDate <= opts.to));
  }

  /** What a request would take, and what's left -- for the request form, before anything is saved. */
  async preview(dto: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; halfDay?: boolean }) {
    const { days, type, emp } = await this.measure(dto);
    const years = Array.from(new Set([yearOf(dto.startDate), yearOf(dto.endDate)]));
    const balances = type.trackBalance
      ? await Promise.all(years.map(async (y) => ({ year: y, ...(await this.balances(emp.id, y)).find((b) => b.leaveTypeId === type.id)! })))
      : [];
    return { days, balances };
  }

  private async measure(dto: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; halfDay?: boolean }) {
    if (!ISO.test(dto.startDate || '') || !ISO.test(dto.endDate || '')) throw new BadRequestException('Give the first and last day of leave.');
    if (dto.endDate < dto.startDate) throw new BadRequestException('The leave ends before it starts.');
    if (dto.halfDay && dto.startDate !== dto.endDate) throw new BadRequestException('A half day has to be a single day.');
    const emp = await this.employees.findOneBy({ id: dto.employeeId });
    if (!emp) throw new BadRequestException('Employee not found.');
    const type = await this.types.findOneBy({ id: dto.leaveTypeId });
    if (!type || !type.active) throw new BadRequestException('Pick a leave type.');
    const { weekendDays } = await this.setup.settings();
    const n = workingDays(dto.startDate, dto.endDate, weekendDays, await this.holidaySet()).length;
    return { days: dto.halfDay ? Math.min(n, 0.5) : n, type, emp, weekendDays };
  }

  /** The request fits: no overlap with other leave, and enough balance for tracked types (pending requests count against it). */
  private async assertFits(r: { id?: string; employeeId: string; leaveTypeId: string; startDate: string; endDate: string; halfDay?: boolean }, type: LeaveTypeEntity) {
    const others = (await this.requests.find({ where: { employeeId: r.employeeId } }))
      .filter((x) => x.id !== r.id && ['pending', 'approved'].includes(x.status));
    const clash = others.find((x) => overlap(x.startDate, x.endDate, r.startDate, r.endDate));
    if (clash) throw new BadRequestException(`This overlaps leave already booked from ${clash.startDate} to ${clash.endDate}.`);
    if (!type.trackBalance) return;
    const { weekendDays, hol } = await this.context();
    for (const y of Array.from(new Set([yearOf(r.startDate), yearOf(r.endDate)]))) {
      const want = requestDaysInYear({ ...r, status: 'pending', halfDay: !!r.halfDay }, y, weekendDays, hol);
      const bal = (await this.balances(r.employeeId, y)).find((b) => b.leaveTypeId === type.id)!;
      const pendingElsewhere = round2(others.filter((x) => x.status === 'pending' && x.leaveTypeId === type.id).reduce((s, x) => s + requestDaysInYear(x, y, weekendDays, hol), 0));
      const free = round2(bal.available - pendingElsewhere);
      if (want > free + 0.001) throw new BadRequestException(`Not enough ${type.name} leave for ${y}: ${want} day(s) asked, ${Math.max(free, 0)} available.`);
    }
  }

  async createRequest(dto: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; halfDay?: boolean; reason?: string }, actor: Actor) {
    const { days, type, emp } = await this.measure(dto);
    if (emp.contractorId) throw new BadRequestException(`${emp.name} is a contractor's worker -- their leave is managed by the contractor.`);
    if (LEFT_STATUSES.includes(lifecycleStatus(emp))) throw new BadRequestException(`${emp.name} is no longer employed.`);
    if (!(days > 0)) throw new BadRequestException('Those dates are all weekends or public holidays -- no working days to take.');
    await this.assertFits(dto, type);
    const now = new Date().toISOString();
    return this.requests.save(this.requests.create({
      id: newId('LR'), employeeId: emp.id, leaveTypeId: type.id, type: type.name, startDate: dto.startDate, endDate: dto.endDate,
      halfDay: !!dto.halfDay, days, reason: dto.reason, status: 'pending',
      requestedBy: actor.name, requestedById: actor.id, requestedAt: now,
    }));
  }

  private async load(id: string) {
    const r = await this.requests.findOneBy({ id });
    if (!r) throw new NotFoundException('Leave request not found');
    return r;
  }

  async decide(id: string, decision: 'approved' | 'rejected', note: string | undefined, actor: Actor) {
    const r = await this.load(id);
    if (r.status !== 'pending') throw new BadRequestException(`This request is already ${r.status}.`);
    await this.access.require(actor, HR_MODULE, `${decision === 'approved' ? 'approve' : 'reject'} leave`);
    if (actor.id && actor.id === r.requestedById) throw new ForbiddenException('You raised this request -- someone else has to decide it.');
    const emp = await this.employees.findOneBy({ id: r.employeeId });
    if (actor.id && emp?.userId && emp.userId === actor.id) throw new ForbiddenException("You can't decide your own leave.");
    if (decision === 'approved') {
      const type = await this.types.findOneBy({ id: r.leaveTypeId });
      if (type) await this.assertFits(r, type);
    }
    Object.assign(r, { status: decision, decidedBy: actor.name, decidedById: actor.id, decidedAt: new Date().toISOString(), note: note || '' });
    return this.requests.save(r);
  }

  /** Withdraw pending leave, or approved leave that hasn't started yet. */
  async cancel(id: string, actor: Actor) {
    const r = await this.load(id);
    const future = r.startDate > todayISO();
    if (!(r.status === 'pending' || (r.status === 'approved' && future))) throw new BadRequestException('Only pending leave, or approved leave that has not started, can be cancelled.');
    const own = !!actor.id && actor.id === r.requestedById;
    if (!own && !(await this.access.can(actor, HR_MODULE))) throw new ForbiddenException('Only the requester or HR can cancel this.');
    Object.assign(r, { status: 'cancelled', decidedBy: actor.name, decidedById: actor.id, decidedAt: new Date().toISOString() });
    return this.requests.save(r);
  }

  /** Approved and pending leave overlapping a window, plus holidays in it -- the calendar. */
  async calendar(from: string, to: string) {
    if (!ISO.test(from || '') || !ISO.test(to || '')) throw new BadRequestException('Give a date range.');
    const reqs = (await this.requests.find()).filter((r) => ['approved', 'pending'].includes(r.status) && r.endDate >= from && r.startDate <= to);
    const hols = (await this.holidays.find()).filter((h) => h.date >= from && h.date <= to);
    return { requests: reqs, holidays: hols };
  }
}
