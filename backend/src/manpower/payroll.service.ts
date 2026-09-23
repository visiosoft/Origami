import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  DailyLogEntity, EmployeeAdvanceEntity, EmployeeEntity, LaborLogEntryEntity, LeaveAdjustmentEntity, LeaveRequestEntity,
  LeaveTypeEntity, OvertimeRequestEntity, PayComponentEntity, PayrollRunEntity, PayslipEntity, PublicHolidayEntity,
  ShiftAssignmentEntity, ShiftTemplateEntity, type PayLine,
} from '../database/entities';
import { overlap, shiftOn, workingDays } from './calendar.util';
import { FINANCE_MODULE, HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
import {
  ADVANCE_LABEL, calculatePayslip, payGroupOf, round2, workFromLogs,
  type DueRecovery, type PayrollSettings, type WorkBasis,
} from './payroll.calc';
import { remainingOf } from './advances.service';
import { LEFT_STATUSES, lifecycleStatus, newId, todayISO } from './workforce.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Whether this person belongs on a run for this pay group. Contractor workers are paid by their contractor. */
export const onPayroll = (e: EmployeeEntity, group: string) =>
  !e.contractorId && (Number(e.payRate) || 0) > 0 && !LEFT_STATUSES.includes(lifecycleStatus(e))
  && (group === 'all' || payGroupOf(e) === group);

const snapshot = (e: EmployeeEntity) => ({
  name: e.name, workerId: e.workerId, designation: e.designation || e.jobTitle, department: e.department, trade: e.trade,
  employmentType: e.employmentType, payType: e.payType || 'monthly', payRate: e.payRate, overtimeRate: e.overtimeRate,
  hireDate: e.hireDate, bankName: e.bankName, bankAccount: e.bankAccount, taxNumber: e.taxNumber, payComponents: e.payComponents || [],
});

interface Sources {
  dayHours: Map<string, Record<string, number>>;
  overtime: Map<string, OvertimeRequestEntity[]>;
  recoveries: Map<string, DueRecovery[]>;
  leave?: Map<string, { paidDays: number; unpaidDays: number }>;
  shiftAllowances?: Map<string, { templateId: string; name: string; days: number; rate: number }[]>;
  encashments?: Map<string, { id: string; days: number; amount: number }[]>;
}

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(PayrollRunEntity) private readonly runs: Repository<PayrollRunEntity>,
    @InjectRepository(PayslipEntity) private readonly slips: Repository<PayslipEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
    @InjectRepository(OvertimeRequestEntity) private readonly overtime: Repository<OvertimeRequestEntity>,
    @InjectRepository(EmployeeAdvanceEntity) private readonly advances: Repository<EmployeeAdvanceEntity>,
    @InjectRepository(PayComponentEntity) private readonly components: Repository<PayComponentEntity>,
    private readonly setup: PayrollSetupService,
    private readonly access: ManpowerAccess,
    @InjectRepository(LeaveRequestEntity) private readonly leaveRequests: Repository<LeaveRequestEntity>,
    @InjectRepository(LeaveTypeEntity) private readonly leaveTypes: Repository<LeaveTypeEntity>,
    @InjectRepository(LeaveAdjustmentEntity) private readonly leaveAdjustments: Repository<LeaveAdjustmentEntity>,
    @InjectRepository(PublicHolidayEntity) private readonly holidays: Repository<PublicHolidayEntity>,
    @InjectRepository(ShiftAssignmentEntity) private readonly shiftAssignments: Repository<ShiftAssignmentEntity>,
    @InjectRepository(ShiftTemplateEntity) private readonly shiftTemplates: Repository<ShiftTemplateEntity>,
  ) {}

  // ------------------------------------------------------------------ reads

  listRuns() {
    return this.runs.find({ order: { periodStart: 'DESC' } });
  }

  async getRun(id: string) {
    const run = await this.loadRun(id);
    const slips = await this.slips.find({ where: { runId: id } });
    slips.sort((a, b) => String(a.employee?.name || '').localeCompare(String(b.employee?.name || '')));
    return { ...run, payslips: slips };
  }

  /** Every payslip an employee has, newest period first -- for their profile. */
  async employeePayslips(employeeId: string) {
    const slips = await this.slips.find({ where: { employeeId } });
    if (!slips.length) return [];
    const runs = await this.runs.find({ where: { id: In(Array.from(new Set(slips.map((s) => s.runId)))) } });
    const byId = new Map(runs.map((r) => [r.id, r]));
    return slips
      .map((s) => ({ ...s, run: byId.get(s.runId) }))
      .filter((s) => s.run && s.run.status !== 'void')
      .sort((a, b) => b.run!.periodStart.localeCompare(a.run!.periodStart));
  }

  private async loadRun(id: string) {
    const run = await this.runs.findOneBy({ id });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  // ------------------------------------------------------------------ inputs

  /** Approved daily-log hours, approved unpaid overtime, and recoveries due -- for a set of employees and a period. */
  private async sources(people: EmployeeEntity[], periodStart: string, periodEnd: string): Promise<Sources> {
    const employeeIds = people.map((e) => e.id);
    const dayHours = new Map<string, Record<string, number>>();
    const logs = await this.logs.createQueryBuilder('l')
      .where('l.status = :st', { st: 'approved' })
      .andWhere('l.date >= :a AND l.date <= :b', { a: periodStart, b: periodEnd })
      .getMany();
    const logDate = new Map(logs.map((l) => [l.id, l.date]));
    const wanted = new Set(employeeIds);
    for (let i = 0; i < logs.length; i += 1000) {
      const chunk = logs.slice(i, i + 1000).map((l) => l.id);
      for (const e of await this.entries.find({ where: { dailyLogId: In(chunk) } })) {
        if (!wanted.has(e.employeeId)) continue;
        const m = dayHours.get(e.employeeId) || {};
        const date = logDate.get(e.dailyLogId)!;
        m[date] = round2((m[date] || 0) + (Number(e.hours) || 0));
        dayHours.set(e.employeeId, m);
      }
    }

    const overtime = new Map<string, OvertimeRequestEntity[]>();
    const ots = await this.overtime.createQueryBuilder('o')
      .where('o.status = :st', { st: 'approved' })
      .andWhere('o.payrollRunId IS NULL')
      .andWhere('o.date <= :b', { b: periodEnd })
      .getMany();
    for (const o of ots) if (wanted.has(o.employeeId)) overtime.set(o.employeeId, [...(overtime.get(o.employeeId) || []), o]);

    const recoveries = new Map<string, DueRecovery[]>();
    const advs = await this.advances.createQueryBuilder('a')
      .where('a.status = :st', { st: 'disbursed' })
      .andWhere('a.deductionStart <= :b', { b: periodEnd })
      .orderBy('a.deductionStart', 'ASC')
      .getMany();
    for (const a of advs) {
      if (!wanted.has(a.employeeId) || remainingOf(a) <= 0) continue;
      recoveries.set(a.employeeId, [...(recoveries.get(a.employeeId) || []), {
        id: a.id, type: a.type, label: ADVANCE_LABEL[a.type] || 'Advance', remaining: remainingOf(a), installmentAmount: a.installmentAmount,
      }]);
    }
    // --- leave, shifts and encashment
    const s = await this.setup.settings();
    const hol = new Set((await this.holidays.find()).map((h) => h.date));
    const paidType = new Map((await this.leaveTypes.find()).map((t) => [t.id, t.paid]));
    const leave = new Map<string, { paidDays: number; unpaidDays: number }>();
    const leaveDates = new Map<string, Set<string>>();
    for (const r of await this.leaveRequests.find({ where: { status: 'approved' } })) {
      if (!wanted.has(r.employeeId)) continue;
      const span = overlap(r.startDate, r.endDate, periodStart, periodEnd);
      if (!span) continue;
      const dates = workingDays(span[0], span[1], s.weekendDays, hol);
      const n = r.halfDay ? Math.min(dates.length, 0.5) : dates.length;
      const cur = leave.get(r.employeeId) || { paidDays: 0, unpaidDays: 0 };
      if (paidType.get(r.leaveTypeId) === false) cur.unpaidDays = round2(cur.unpaidDays + n); else cur.paidDays = round2(cur.paidDays + n);
      leave.set(r.employeeId, cur);
      if (!r.halfDay) { const set = leaveDates.get(r.employeeId) || new Set<string>(); dates.forEach((d) => set.add(d)); leaveDates.set(r.employeeId, set); }
    }

    // A shift allowance is earned per day actually worked on that shift: logged days for
    // wage workers, working days not on leave for salaried staff.
    const templates = new Map((await this.shiftTemplates.find()).map((t) => [t.id, t]));
    const assigns = (await this.shiftAssignments.find()).filter((a) => wanted.has(a.employeeId) && a.startDate <= periodEnd && (!a.endDate || a.endDate >= periodStart));
    const shiftAllowances = new Map<string, { templateId: string; name: string; days: number; rate: number }[]>();
    for (const e of people) {
      const mine = assigns.filter((a) => a.employeeId === e.id);
      if (!mine.length) continue;
      const worked = payGroupOf(e) === 'daily'
        ? Object.entries(dayHours.get(e.id) || {}).filter(([, h]) => h > 0).map(([d]) => d)
        : workingDays(e.hireDate && e.hireDate > periodStart ? e.hireDate : periodStart, periodEnd, s.weekendDays, hol).filter((d) => !leaveDates.get(e.id)?.has(d));
      const tally = new Map<string, number>();
      for (const d of worked) {
        const tid = mine.map((a) => shiftOn(a, d)).find(Boolean);
        const t = tid ? templates.get(tid) : undefined;
        if (t && (t.allowancePerDay || 0) > 0) tally.set(t.id, (tally.get(t.id) || 0) + 1);
      }
      if (tally.size) shiftAllowances.set(e.id, Array.from(tally.entries()).map(([tid, days]) => ({ templateId: tid, name: templates.get(tid)!.name, days, rate: templates.get(tid)!.allowancePerDay })));
    }

    const encashments = new Map<string, { id: string; days: number; amount: number }[]>();
    for (const a of await this.leaveAdjustments.find({ where: { kind: 'encashment' } })) {
      if (!wanted.has(a.employeeId) || a.payrollRunId || !(a.amount > 0) || a.createdAt.slice(0, 10) > periodEnd) continue;
      encashments.set(a.employeeId, [...(encashments.get(a.employeeId) || []), { id: a.id, days: round2(-a.days), amount: a.amount }]);
    }
    return { dayHours, overtime, recoveries, leave, shiftAllowances, encashments };
  }

  private compute(
    e: EmployeeEntity, run: Pick<PayrollRunEntity, 'periodStart' | 'periodEnd'>, s: PayrollSettings, components: PayComponentEntity[], src: Sources,
    keep?: { work?: WorkBasis; manualLines?: PayLine[] },
  ) {
    const work = keep?.work?.manual ? keep.work : workFromLogs(src.dayHours.get(e.id) || {}, s);
    return calculatePayslip({
      employee: e, settings: s, components, periodStart: run.periodStart, periodEnd: run.periodEnd, work,
      overtime: (src.overtime.get(e.id) || []).map((o) => ({ id: o.id, hours: o.hours, amount: o.amount })),
      recoveries: src.recoveries.get(e.id) || [],
      manualLines: keep?.manualLines || [],
      leave: src.leave?.get(e.id),
      shiftAllowances: src.shiftAllowances?.get(e.id),
      encashments: src.encashments?.get(e.id),
    });
  }

  private totals(slips: PayslipEntity[]) {
    return {
      headcount: slips.length,
      gross: round2(slips.reduce((a, x) => a + x.gross, 0)),
      deductions: round2(slips.reduce((a, x) => a + x.deductions, 0)),
      net: round2(slips.reduce((a, x) => a + x.net, 0)),
      paid: round2(slips.filter((x) => x.paymentStatus === 'paid').reduce((a, x) => a + x.net, 0)),
    };
  }

  // ------------------------------------------------------------------ draft runs

  async createRun(dto: { label?: string; periodStart: string; periodEnd: string; payGroup?: string; notes?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'prepare payroll');
    if (!ISO.test(dto.periodStart || '') || !ISO.test(dto.periodEnd || '')) throw new BadRequestException('Give the pay period start and end dates.');
    if (dto.periodEnd < dto.periodStart) throw new BadRequestException('The period ends before it starts.');
    const payGroup = ['monthly', 'daily'].includes(dto.payGroup || '') ? dto.payGroup! : 'all';
    const clash = (await this.runs.find()).find((r) => r.status !== 'void'
      && r.periodStart <= dto.periodEnd && r.periodEnd >= dto.periodStart
      && (payGroup === 'all' || r.payGroup === 'all' || r.payGroup === payGroup));
    if (clash) throw new BadRequestException(`"${clash.label}" already covers part of this period for these employees.`);

    const everyone = (await this.employees.find()).filter((e) => onPayroll(e, payGroup));
    if (!everyone.length) throw new BadRequestException('Nobody to pay: no active employees with a pay rate in this group.');
    const [s, components] = await Promise.all([this.setup.settings(), this.components.find()]);
    const src = await this.sources(everyone, dto.periodStart, dto.periodEnd);
    const now = new Date().toISOString();
    const label = dto.label?.trim() || new Date(dto.periodStart + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      + (payGroup === 'all' ? '' : payGroup === 'monthly' ? ' — salaried' : ' — daily wage');

    const run = this.runs.create({
      id: newId('PR'), label, periodStart: dto.periodStart, periodEnd: dto.periodEnd, payGroup, status: 'draft',
      settingsSnapshot: s as unknown as Record<string, unknown>, notes: dto.notes, createdByName: actor.name, createdAt: now, updatedAt: now,
    });
    const slips = everyone.map((e) => {
      const r = this.compute(e, run, s, components, src);
      return this.slips.create({ id: newId('PS'), runId: run.id, employeeId: e.id, employee: snapshot(e), ...r, paymentStatus: 'unpaid', updatedAt: now });
    });
    run.totals = this.totals(slips);
    await this.runs.manager.transaction(async (m) => {
      await m.getRepository(PayrollRunEntity).save(run);
      await m.getRepository(PayslipEntity).save(slips);
    });
    return this.getRun(run.id);
  }

  private async requireDraft(runId: string) {
    const run = await this.loadRun(runId);
    if (run.status !== 'draft') throw new BadRequestException(`This run is ${run.status} -- it can no longer be changed.`);
    return run;
  }

  /**
   * Re-read everything (rates, logs, overtime, recoveries) for a draft,
   * keeping what was typed by hand: manual day counts and manual lines.
   */
  async recalculate(runId: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'prepare payroll');
    const run = await this.requireDraft(runId);
    const slips = await this.slips.find({ where: { runId } });
    const byEmp = new Map(slips.map((x) => [x.employeeId, x]));
    const everyone = (await this.employees.find()).filter((e) => onPayroll(e, run.payGroup) || byEmp.has(e.id));
    const [s, components] = await Promise.all([this.setup.settings(), this.components.find()]);
    const src = await this.sources(everyone.filter((e) => onPayroll(e, run.payGroup)), run.periodStart, run.periodEnd);
    const now = new Date().toISOString();
    const next = everyone.filter((e) => onPayroll(e, run.payGroup)).map((e) => {
      const old = byEmp.get(e.id);
      const keep = old ? { work: old.basis as unknown as WorkBasis, manualLines: old.lines.filter((l) => l.source === 'manual') } : undefined;
      const r = this.compute(e, run, s, components, src, keep);
      return this.slips.create({ ...(old || {}), id: old?.id || newId('PS'), runId, employeeId: e.id, employee: snapshot(e), ...r, paymentStatus: 'unpaid', updatedAt: now });
    });
    const dropped = slips.filter((x) => !next.some((n) => n.id === x.id));
    Object.assign(run, { totals: this.totals(next), settingsSnapshot: s, updatedAt: now });
    await this.runs.manager.transaction(async (m) => {
      if (dropped.length) await m.getRepository(PayslipEntity).remove(dropped);
      await m.getRepository(PayslipEntity).save(next);
      await m.getRepository(PayrollRunEntity).save(run);
    });
    return this.getRun(runId);
  }

  /** Hand corrections on a draft payslip: override the day counts, add a bonus or deduction, leave a note. */
  async updatePayslip(id: string, dto: { work?: Partial<WorkBasis> | null; manualLines?: { id?: string; name: string; kind: string; amount: number; note?: string }[]; notes?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'edit payslips');
    const slip = await this.slips.findOneBy({ id });
    if (!slip) throw new NotFoundException('Payslip not found');
    const run = await this.requireDraft(slip.runId);
    const emp = await this.employees.findOneBy({ id: slip.employeeId });
    if (!emp) throw new BadRequestException('The employee no longer exists -- recalculate the run.');

    let work: WorkBasis | undefined = slip.basis as unknown as WorkBasis;
    if (dto.work === null) work = undefined; // back to the daily logs
    else if (dto.work) {
      const num = (v: unknown, name: string) => {
        const n = Number(v ?? 0);
        if (!Number.isFinite(n) || n < 0) throw new BadRequestException(`${name} can't be negative.`);
        return round2(n);
      };
      const w = { ...(slip.basis as any), ...dto.work };
      const fullDays = num(w.fullDays, 'Full days');
      const halfDays = num(w.halfDays, 'Half days');
      const extraHours = num(w.extraHours, 'Hours');
      const hoursWorked = num(w.hoursWorked, 'Hours worked');
      work = { fullDays, halfDays, extraHours, hoursWorked, manual: true };
    }
    let manualLines = slip.lines.filter((l) => l.source === 'manual');
    if (dto.manualLines) {
      manualLines = dto.manualLines.map((l) => {
        const amount = round2(Number(l.amount));
        if (!l.name?.trim()) throw new BadRequestException('Name each adjustment.');
        if (!(amount > 0)) throw new BadRequestException('Adjustment amounts must be above 0 -- choose earning or deduction for the direction.');
        if (!['earning', 'deduction'].includes(l.kind)) throw new BadRequestException('An adjustment is an earning or a deduction.');
        return { id: l.id || newId('ML'), name: l.name.trim(), kind: l.kind as PayLine['kind'], source: 'manual', amount, note: l.note };
      });
    }
    const [s, components] = await Promise.all([this.setup.settings(), this.components.find()]);
    const src = await this.sources([emp], run.periodStart, run.periodEnd);
    const r = this.compute(emp, run, s, components, src, { work, manualLines });
    Object.assign(slip, r, { employee: snapshot(emp), notes: dto.notes ?? slip.notes, updatedAt: new Date().toISOString() });
    await this.slips.save(slip);
    run.totals = this.totals(await this.slips.find({ where: { runId: run.id } }));
    await this.runs.save(run);
    return slip;
  }

  async removeRun(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'delete payroll drafts');
    const run = await this.requireDraft(id);
    await this.runs.manager.transaction(async (m) => {
      await m.getRepository(PayslipEntity).delete({ runId: id });
      await m.getRepository(PayrollRunEntity).remove(run);
    });
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ sign-off

  /**
   * Freeze the run. Everything it pays for is checked to still be owed --
   * overtime not already paid elsewhere, recoveries not beyond the balance --
   * so a stale draft can't double-pay; then overtime is marked paid and
   * recoveries are booked against each advance/loan, all or nothing.
   */
  async finalize(id: string, actor: Actor) {
    await this.access.require(actor, FINANCE_MODULE, 'finalize payroll');
    const run = await this.requireDraft(id);
    const slips = await this.slips.find({ where: { runId: id } });
    if (!slips.length) throw new BadRequestException('This run has no payslips.');

    return this.runs.manager.transaction(async (m) => {
      const otRepo = m.getRepository(OvertimeRequestEntity);
      const advRepo = m.getRepository(EmployeeAdvanceEntity);
      const otIds = slips.flatMap((x) => x.lines.filter((l) => l.source === 'overtime').flatMap((l) => l.refIds || []));
      const ots = otIds.length ? await otRepo.findBy({ id: In(otIds) }) : [];
      const problems: string[] = [];
      for (const oid of otIds) {
        const o = ots.find((x) => x.id === oid);
        if (!o || o.status !== 'approved' || o.payrollRunId) problems.push('some overtime was cancelled or already paid');
      }
      const recoveryLines = slips.flatMap((x) => x.lines.filter((l) => l.source === 'advance' || l.source === 'loan').map((l) => ({ slip: x, line: l })));
      const advIds = recoveryLines.map((r) => r.line.refIds?.[0]).filter(Boolean) as string[];
      const advs = advIds.length ? await advRepo.findBy({ id: In(advIds) }) : [];
      const owed = new Map(advs.map((a) => [a.id, a.status === 'disbursed' ? remainingOf(a) : 0]));
      for (const { line } of recoveryLines) {
        const aid = line.refIds?.[0] || '';
        const left = owed.get(aid) ?? 0;
        if (line.amount > left + 0.005) problems.push('an advance or loan balance changed');
        owed.set(aid, round2(left - line.amount));
      }
      const encRepo = m.getRepository(LeaveAdjustmentEntity);
      const encIds = slips.flatMap((x) => x.lines.filter((l) => l.source === 'encashment').flatMap((l) => l.refIds || []));
      const encs = encIds.length ? await encRepo.findBy({ id: In(encIds) }) : [];
      for (const eid of encIds) {
        const a = encs.find((x) => x.id === eid);
        if (!a || a.payrollRunId) problems.push('a leave encashment was removed or already paid');
      }
      if (problems.length) throw new BadRequestException(`Figures changed since this run was calculated (${Array.from(new Set(problems)).join('; ')}). Recalculate it, check it, then finalize.`);

      if (ots.length) {
        for (const o of ots) Object.assign(o, { payrollRunId: id, updatedAt: new Date().toISOString() });
        await otRepo.save(ots);
      }
      if (encs.length) {
        for (const a of encs) a.payrollRunId = id;
        await encRepo.save(encs);
      }
      for (const a of advs) {
        const mine = recoveryLines.filter((r) => r.line.refIds?.[0] === a.id);
        const total = round2(mine.reduce((s2, r) => s2 + r.line.amount, 0));
        a.repayments = [...(a.repayments || []), ...mine.map((r) => ({
          id: newId('RP'), date: run.periodEnd, amount: r.line.amount, method: 'payroll' as const, runId: id, payslipId: r.slip.id, byName: actor.name,
        }))];
        a.recovered = round2((a.recovered || 0) + total);
        if (remainingOf(a) <= 0.005) a.status = 'settled';
        a.updatedAt = new Date().toISOString();
      }
      if (advs.length) await advRepo.save(advs);
      Object.assign(run, { status: 'finalized', finalizedByName: actor.name, finalizedAt: new Date().toISOString(), totals: this.totals(slips), updatedAt: new Date().toISOString() });
      await m.getRepository(PayrollRunEntity).save(run);
      return { ...run, payslips: slips };
    });
  }

  /** The controlled correction: undo a finalized run that nobody has been paid from yet. */
  async voidRun(id: string, reason: string | undefined, actor: Actor) {
    await this.access.require(actor, FINANCE_MODULE, 'void payroll');
    const run = await this.loadRun(id);
    if (run.status !== 'finalized') throw new BadRequestException(run.status === 'draft' ? 'Delete a draft instead of voiding it.' : 'This run is already void.');
    if (!reason?.trim()) throw new BadRequestException('Say why this run is being voided.');
    const slips = await this.slips.find({ where: { runId: id } });
    if (slips.some((x) => x.paymentStatus === 'paid')) throw new BadRequestException('Payments have been recorded against this run -- it can no longer be voided.');
    return this.runs.manager.transaction(async (m: EntityManager) => {
      const otRepo = m.getRepository(OvertimeRequestEntity);
      const ots = await otRepo.find({ where: { payrollRunId: id } });
      for (const o of ots) Object.assign(o, { payrollRunId: null as unknown as string, updatedAt: new Date().toISOString() });
      if (ots.length) await otRepo.save(ots);
      const encRepo = m.getRepository(LeaveAdjustmentEntity);
      const encs = await encRepo.find({ where: { payrollRunId: id } });
      for (const a of encs) a.payrollRunId = null as unknown as string;
      if (encs.length) await encRepo.save(encs);
      const advRepo = m.getRepository(EmployeeAdvanceEntity);
      const touched = (await advRepo.find()).filter((a) => (a.repayments || []).some((r) => r.runId === id));
      for (const a of touched) {
        const undo = round2(a.repayments.filter((r) => r.runId === id).reduce((s2, r) => s2 + r.amount, 0));
        a.repayments = a.repayments.filter((r) => r.runId !== id);
        a.recovered = round2(Math.max(0, (a.recovered || 0) - undo));
        if (a.status === 'settled' && remainingOf(a) > 0.005) a.status = 'disbursed';
        a.updatedAt = new Date().toISOString();
      }
      if (touched.length) await advRepo.save(touched);
      Object.assign(run, { status: 'void', voidedByName: actor.name, voidedAt: new Date().toISOString(), voidReason: reason.trim(), updatedAt: new Date().toISOString() });
      return m.getRepository(PayrollRunEntity).save(run);
    });
  }

  async markPaid(runId: string, payslipIds: string[] | 'all', dto: { method?: string; ref?: string; date?: string }, actor: Actor) {
    await this.access.require(actor, FINANCE_MODULE, 'record salary payments');
    const run = await this.loadRun(runId);
    if (run.status !== 'finalized') throw new BadRequestException('Finalize the run before recording payments.');
    const slips = await this.slips.find({ where: { runId } });
    const target = slips.filter((x) => x.paymentStatus !== 'paid' && (payslipIds === 'all' || payslipIds.includes(x.id)));
    if (!target.length) throw new BadRequestException('Nothing left unpaid in that selection.');
    const date = dto.date || todayISO();
    for (const x of target) Object.assign(x, { paymentStatus: 'paid', paidAt: date, paymentMethod: dto.method || 'bank_transfer', paymentRef: dto.ref, paidByName: actor.name, updatedAt: new Date().toISOString() });
    await this.slips.save(target);
    run.totals = this.totals(slips);
    run.updatedAt = new Date().toISOString();
    await this.runs.save(run);
    return this.getRun(runId);
  }
}
