import type { EmployeeEntity, PayComponentEntity, PayLine } from '../database/entities';

export type OtType = 'normal' | 'weekend' | 'holiday' | 'night';

export interface PayrollSettings {
  currency: string;
  /** Hours in a full working day: the threshold for a full day's wage, and the divisor for hourly rates. */
  standardDayHours: number;
  /** Least hours that still count as a half day; less than this is paid by the hour. */
  halfDayHours: number;
  /** Days a monthly salary is divided over to get a daily/hourly rate. */
  monthDays: number;
  otMultipliers: Record<OtType, number>;
  /** Days of the week (0 = Sunday) that count as the weekend for overtime. */
  weekendDays: number[];
}

/** US defaults: a monthly salary covers 21.67 working days (2,080 hours a year), Saturday-Sunday weekend, time-and-a-half overtime. */
export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  currency: 'USD',
  standardDayHours: 8,
  halfDayHours: 4,
  monthDays: 21.67,
  otMultipliers: { normal: 1.5, weekend: 1.5, holiday: 2, night: 1.1 },
  weekendDays: [0, 6],
};

/** The defaults this system shipped with before it was set up for the US -- recognised so they can be converted. */
export const LEGACY_PAYROLL_SETTINGS: PayrollSettings = {
  currency: 'PKR', standardDayHours: 8, halfDayHours: 4, monthDays: 30,
  otMultipliers: { normal: 1.5, weekend: 2, holiday: 2, night: 1.25 }, weekendDays: [0],
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type PayEmployee = Pick<EmployeeEntity, 'payType' | 'payRate' | 'overtimeRate' | 'hireDate' | 'payComponents'>;

/** monthly staff vs. wage workers (daily or hourly) -- the two payroll groups. */
export const payGroupOf = (e: Pick<EmployeeEntity, 'payType'>): 'monthly' | 'daily' =>
  e.payType === 'daily' || e.payType === 'hourly' ? 'daily' : 'monthly';

/** What one hour of this person's ordinary time is worth. */
export function hourlyBase(e: PayEmployee, s: PayrollSettings): number {
  const rate = Number(e.payRate) || 0;
  if (e.payType === 'hourly') return rate;
  if (e.payType === 'daily') return rate / s.standardDayHours;
  return rate / (s.monthDays * s.standardDayHours);
}

/** The hourly base overtime is priced from: an explicit override, else ordinary hourly pay. */
export const overtimeBase = (e: PayEmployee, s: PayrollSettings) => Number(e.overtimeRate) || hourlyBase(e, s);

export const daysInclusive = (from: string, to: string) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;

export interface WorkBasis {
  fullDays: number;
  halfDays: number;
  /** Hours on days too short to count as a half day -- paid by the hour. */
  extraHours: number;
  hoursWorked: number;
  /** Entered by hand rather than taken from approved daily logs. */
  manual: boolean;
}

/** Turn approved daily-log hours (date -> hours) into full days, half days and loose hours. */
export function workFromLogs(dayHours: Record<string, number>, s: PayrollSettings): WorkBasis {
  let fullDays = 0, halfDays = 0, extraHours = 0, hoursWorked = 0;
  for (const h of Object.values(dayHours)) {
    if (!(h > 0)) continue;
    hoursWorked += h;
    if (h >= s.standardDayHours) fullDays += 1;
    else if (h >= s.halfDayHours) halfDays += 1;
    else extraHours += h;
  }
  return { fullDays, halfDays, extraHours: round2(extraHours), hoursWorked: round2(hoursWorked), manual: false };
}

export interface DueRecovery { id: string; type: string; label: string; remaining: number; installmentAmount: number }

export interface CalcInput {
  employee: PayEmployee;
  settings: PayrollSettings;
  components: PayComponentEntity[];
  periodStart: string;
  periodEnd: string;
  work: WorkBasis;
  overtime: { id: string; hours: number; amount: number }[];
  recoveries: DueRecovery[];
  manualLines: PayLine[];
  /** Approved leave inside the period, in working days. */
  leave?: { paidDays: number; unpaidDays: number };
  /** Days worked on each shift that carries an allowance. */
  shiftAllowances?: { templateId: string; name: string; days: number; rate: number }[];
  /** Leave days cashed out and not yet paid. */
  encashments?: { id: string; days: number; amount: number }[];
}

export interface CalcResult {
  basis: Record<string, unknown>;
  lines: PayLine[];
  gross: number;
  deductions: number;
  net: number;
}

export function calculatePayslip(i: CalcInput): CalcResult {
  const s = i.settings;
  const e = i.employee;
  const group = payGroupOf(e);
  const rate = Number(e.payRate) || 0;
  const hourly = hourlyBase(e, s);
  let n = 0;
  const id = () => 'PL' + ++n;
  const earnings: PayLine[] = [];
  const deductions: PayLine[] = [];
  const basis: Record<string, unknown> = { payGroup: group, payType: e.payType || 'monthly', rate, hourlyRate: round2(hourly), ...i.work };

  // --- ordinary pay
  let basic = 0;
  if (group === 'monthly') {
    const periodDays = daysInclusive(i.periodStart, i.periodEnd);
    const from = e.hireDate && e.hireDate > i.periodStart ? e.hireDate : i.periodStart;
    const employedDays = from > i.periodEnd ? 0 : daysInclusive(from, i.periodEnd);
    basic = round2(rate * (employedDays / periodDays));
    Object.assign(basis, { periodDays, employedDays });
    earnings.push({
      id: id(), name: 'Basic salary', kind: 'earning', source: 'basic', amount: basic,
      note: employedDays < periodDays ? `Prorated: joined mid-period, ${employedDays} of ${periodDays} days` : undefined,
    });
  } else if (e.payType === 'hourly') {
    basic = round2(i.work.hoursWorked * rate);
    if (basic) earnings.push({ id: id(), name: `Hours worked — ${i.work.hoursWorked} h × ${rate}`, kind: 'earning', source: 'wages', amount: basic });
  } else {
    const full = round2(i.work.fullDays * rate);
    const half = round2(i.work.halfDays * rate / 2);
    const loose = round2(i.work.extraHours * hourly);
    if (full) earnings.push({ id: id(), name: `Daily wage — ${i.work.fullDays} full day${i.work.fullDays === 1 ? '' : 's'} × ${rate}`, kind: 'earning', source: 'wages', amount: full });
    if (half) earnings.push({ id: id(), name: `Half days — ${i.work.halfDays} × ${round2(rate / 2)}`, kind: 'earning', source: 'wages', amount: half });
    if (loose) earnings.push({ id: id(), name: `Short days — ${i.work.extraHours} h × ${round2(hourly)}`, kind: 'earning', source: 'wages', amount: loose });
    basic = round2(full + half + loose);
  }
  // Wage workers aren't paid for days they don't work -- except approved paid leave.
  const paidLeave = i.leave?.paidDays || 0;
  if (group === 'daily' && paidLeave > 0) {
    const perDay = e.payType === 'hourly' ? rate * s.standardDayHours : rate;
    const amount = round2(paidLeave * perDay);
    earnings.push({ id: id(), name: `Paid leave — ${paidLeave} day${paidLeave === 1 ? '' : 's'} × ${round2(perDay)}`, kind: 'earning', source: 'leave', amount });
    basic = round2(basic + amount);
  }
  basis.basic = basic;
  if (i.leave) Object.assign(basis, { paidLeaveDays: i.leave.paidDays, unpaidLeaveDays: i.leave.unpaidDays });

  // --- overtime (already priced when it was approved)
  if (i.overtime.length) {
    const hours = round2(i.overtime.reduce((a, o) => a + o.hours, 0));
    const amount = round2(i.overtime.reduce((a, o) => a + (o.amount || 0), 0));
    basis.otHours = hours;
    earnings.push({ id: id(), name: `Overtime — ${hours} h approved`, kind: 'earning', source: 'overtime', amount, refIds: i.overtime.map((o) => o.id) });
  }

  // --- shift / night allowances, and cashed-out leave
  for (const sh of i.shiftAllowances || []) {
    const amount = round2(sh.days * sh.rate);
    if (amount) earnings.push({ id: id(), name: `${sh.name} allowance — ${sh.days} day${sh.days === 1 ? '' : 's'} × ${sh.rate}`, kind: 'earning', source: 'shift', amount });
  }
  if (i.encashments?.length) {
    const days = round2(i.encashments.reduce((a, x) => a + x.days, 0));
    const amount = round2(i.encashments.reduce((a, x) => a + x.amount, 0));
    earnings.push({ id: id(), name: `Leave encashment — ${days} day${days === 1 ? '' : 's'}`, kind: 'earning', source: 'encashment', amount, refIds: i.encashments.map((x) => x.id) });
  }

  // --- configurable components
  const own = new Map((e.payComponents || []).map((c) => [c.componentId, Number(c.value)]));
  const applicable = i.components
    .filter((c) => c.active && (c.appliesTo === 'all' || c.appliesTo === group))
    .filter((c) => own.has(c.id) || (Number(c.defaultValue) || 0) > 0)
    .sort((a, b) => a.order - b.order);
  const valueOf = (c: PayComponentEntity) => (own.has(c.id) ? own.get(c.id)! : Number(c.defaultValue) || 0);
  const pct = (c: PayComponentEntity) => `${valueOf(c)}%`;

  for (const c of applicable.filter((x) => x.kind === 'earning')) {
    const amount = round2(c.calcType === 'fixed' ? valueOf(c) : basic * valueOf(c) / 100);
    if (amount) earnings.push({ id: id(), name: c.calcType === 'fixed' ? c.name : `${c.name} (${pct(c)} of basic)`, kind: 'earning', source: 'component', componentId: c.id, amount });
  }
  for (const m of i.manualLines.filter((l) => l.kind === 'earning')) earnings.push({ ...m, source: 'manual' });

  const gross = round2(earnings.reduce((a, l) => a + l.amount, 0));

  const unpaid = i.leave?.unpaidDays || 0;
  if (group === 'monthly' && unpaid > 0) {
    const perDay = rate / s.monthDays;
    const amount = round2(Math.min(unpaid * perDay, basic));
    if (amount) deductions.push({ id: id(), name: `Unpaid leave — ${unpaid} day${unpaid === 1 ? '' : 's'} × ${round2(perDay)}`, kind: 'deduction', source: 'leave', amount });
  }

  for (const c of applicable.filter((x) => x.kind === 'deduction')) {
    const base = c.calcType === 'percent_gross' ? gross : basic;
    const amount = round2(c.calcType === 'fixed' ? valueOf(c) : base * valueOf(c) / 100);
    if (amount) deductions.push({ id: id(), name: c.calcType === 'fixed' ? c.name : `${c.name} (${pct(c)} of ${c.calcType === 'percent_gross' ? 'gross' : 'basic'})`, kind: 'deduction', source: 'component', componentId: c.id, amount });
  }
  for (const m of i.manualLines.filter((l) => l.kind === 'deduction')) deductions.push({ ...m, source: 'manual' });

  // --- advance / loan recovery, oldest first, never pushing net pay below zero
  let available = round2(gross - deductions.reduce((a, l) => a + l.amount, 0));
  for (const r of i.recoveries) {
    const due = round2(Math.min(r.installmentAmount, r.remaining));
    const take = round2(Math.max(0, Math.min(due, available)));
    if (take <= 0) {
      if (due > 0) basis.recoveryShortfall = true;
      continue;
    }
    available = round2(available - take);
    deductions.push({
      id: id(), name: `${r.label} recovery`, kind: 'deduction', source: r.type === 'loan' ? 'loan' : 'advance', amount: take, refIds: [r.id],
      note: take < due ? `Reduced from ${due} so net pay doesn't go negative` : undefined,
    });
  }

  const totalDeductions = round2(deductions.reduce((a, l) => a + l.amount, 0));
  return { basis, lines: [...earnings, ...deductions], gross, deductions: totalDeductions, net: round2(gross - totalDeductions) };
}

export const ADVANCE_LABEL: Record<string, string> = {
  salary_advance: 'Salary advance',
  emergency_advance: 'Emergency advance',
  loan: 'Employee loan',
  travel_advance: 'Travel advance',
  project_advance: 'Project advance',
};
