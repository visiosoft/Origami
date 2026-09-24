/**
 * Job cost: pure functions, integer cents throughout.
 *
 * Costs are tracked by cost code. For each code:
 *   budget     = budget lines + the cost side of approved change orders
 *   committed  = lines of approved (or closed) subcontracts and purchase orders
 *   actual     = vendor bills and other cost entries + labor + reimbursable expenses
 *   open       = what approved commitments still have to bill (0 once closed)
 *   EAC        = the team's forecast when set, else max(budget, actual + open)
 *   variance   = budget - EAC  (negative = forecast over budget)
 */
import { pctOf, roundPct, sumCents } from './money';

export const NO_CODE = 'none';
const keyOf = (csiCodeId?: string | null) => csiCodeId || NO_CODE;

// ------------------------------------------------------------------ labor

/** Hours someone worked on a project on a day, from an approved timesheet or an approved daily labor log. */
export interface LaborFact { employeeId: string; projectId: number; date: string; csiCodeId: string | null; hours: number; source: 'timesheet' | 'daily_log' }
export interface LaborPerson { id: string; name: string; payType?: string; payRate?: number | null; overtimeRate?: number | null }
export interface LaborSettings { standardDayHours: number; monthDays: number; otMultiplier: number }
export interface LaborLine {
  employeeId: string; name: string; projectId: number; date: string; csiCodeId: string | null; hours: number; otHours: number; wageC: number; source: LaborFact['source'];
  /** Hourly base used, for the detail view. */
  rate: number;
}

/** What one ordinary hour costs, by the payroll's rules (hourly; daily / standard day; monthly / month days / standard day). */
export function hourlyRate(p: LaborPerson, s: LaborSettings) {
  const rate = Number(p.payRate) || 0;
  if (p.payType === 'hourly') return rate;
  if (p.payType === 'daily') return rate / s.standardDayHours;
  return rate / (s.monthDays * s.standardDayHours);
}

/**
 * Labor cost, line by line. The same hours are often in both a timesheet and a
 * supervisor's daily log: per person, project and day the larger of the two is
 * used (never both). Hours past a standard day -- across all projects that day --
 * are overtime, shared across that day's lines, at the overtime rate.
 */
export function laborLines(facts: LaborFact[], people: Map<string, LaborPerson>, s: LaborSettings): LaborLine[] {
  // 1. Per person/project/day, keep the source with more hours.
  const groups = new Map<string, LaborFact[]>();
  for (const f of facts) {
    if (!(f.hours > 0)) continue;
    const k = `${f.employeeId}|${f.projectId}|${f.date}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(f);
  }
  const chosen: LaborFact[] = [];
  for (const g of groups.values()) {
    const ts = g.filter((f) => f.source === 'timesheet');
    const dl = g.filter((f) => f.source === 'daily_log');
    const sum = (xs: LaborFact[]) => xs.reduce((a, f) => a + f.hours, 0);
    chosen.push(...(sum(dl) > sum(ts) ? dl : ts));
  }
  // 2. Overtime is decided per person per day, across projects.
  const dayTotal = new Map<string, number>();
  for (const f of chosen) dayTotal.set(`${f.employeeId}|${f.date}`, (dayTotal.get(`${f.employeeId}|${f.date}`) || 0) + f.hours);
  return chosen.map((f) => {
    const p = people.get(f.employeeId) || { id: f.employeeId, name: 'Unknown worker' };
    const total = dayTotal.get(`${f.employeeId}|${f.date}`) || f.hours;
    const otShare = total > s.standardDayHours ? (total - s.standardDayHours) / total : 0;
    const otHours = f.hours * otShare;
    const base = hourlyRate(p, s);
    const otBase = Number(p.overtimeRate) || base;
    const wage = (f.hours - otHours) * base + otHours * otBase * s.otMultiplier;
    return {
      employeeId: f.employeeId, name: p.name, projectId: f.projectId, date: f.date, csiCodeId: f.csiCodeId, hours: f.hours,
      otHours: Math.round(otHours * 100) / 100, wageC: Math.round(wage * 100), source: f.source, rate: Math.round(base * 100) / 100,
    };
  });
}

/** Wages plus burden (payroll taxes, benefits, insurance). */
export const burdened = (wageC: number, burdenPct: number) => wageC + pctOf(wageC, burdenPct || 0);

// ------------------------------------------------------------------ cost by code

export interface JobCostInput {
  budgetLines: { csiCodeId?: string | null; amountC: number }[];
  /** Cost side of approved change-order items. */
  coCosts: { csiCodeId?: string | null; amountC: number }[];
  commitments: { id: string; status: string; lines: { csiCodeId?: string | null; amountC: number }[] }[];
  /** Non-void cost entries. */
  costEntries: { commitmentId?: string | null; csiCodeId?: string | null; amountC: number; status: string }[];
  labor: { csiCodeId?: string | null; costC: number; hours: number }[];
  /** Approved or billed reimbursable expenses, at cost. */
  reimbursables: { csiCodeId?: string | null; costC: number }[];
  forecasts: Map<string, number>;
}

export interface CostRow {
  key: string; csiCodeId: string | null;
  budgetOriginalC: number; budgetChangesC: number; budgetC: number;
  committedC: number; commitmentBilledC: number; openC: number;
  billsC: number; laborC: number; laborHours: number; reimbursableC: number; actualC: number;
  eacC: number; eacOverridden: boolean; costToCompleteC: number; varianceC: number; spentPct: number;
}

export function computeJobCost(i: JobCostInput) {
  const rows = new Map<string, CostRow>();
  const row = (csiCodeId?: string | null) => {
    const key = keyOf(csiCodeId);
    if (!rows.has(key)) rows.set(key, {
      key, csiCodeId: csiCodeId || null, budgetOriginalC: 0, budgetChangesC: 0, budgetC: 0, committedC: 0, commitmentBilledC: 0, openC: 0,
      billsC: 0, laborC: 0, laborHours: 0, reimbursableC: 0, actualC: 0, eacC: 0, eacOverridden: false, costToCompleteC: 0, varianceC: 0, spentPct: 0,
    });
    return rows.get(key)!;
  };
  for (const b of i.budgetLines) row(b.csiCodeId).budgetOriginalC += b.amountC;
  for (const c of i.coCosts) row(c.csiCodeId).budgetChangesC += c.amountC;
  for (const e of i.costEntries) row(e.csiCodeId).billsC += e.amountC;
  for (const l of i.labor) { const r = row(l.csiCodeId); r.laborC += l.costC; r.laborHours += l.hours; }
  for (const x of i.reimbursables) row(x.csiCodeId).reimbursableC += x.costC;
  // Commitments: committed by code, and what each still has to bill on that code.
  for (const c of i.commitments) {
    if (c.status !== 'approved' && c.status !== 'closed') continue;
    const byCode = new Map<string, number>();
    for (const l of c.lines) { row(l.csiCodeId).committedC += l.amountC; byCode.set(keyOf(l.csiCodeId), (byCode.get(keyOf(l.csiCodeId)) || 0) + l.amountC); }
    const billedByCode = new Map<string, number>();
    for (const e of i.costEntries.filter((x) => x.commitmentId === c.id)) billedByCode.set(keyOf(e.csiCodeId), (billedByCode.get(keyOf(e.csiCodeId)) || 0) + e.amountC);
    for (const [k, amt] of byCode) {
      const r = rows.get(k)!;
      const billed = billedByCode.get(k) || 0;
      r.commitmentBilledC += billed;
      if (c.status === 'approved') r.openC += Math.max(amt - billed, 0);
    }
  }
  for (const [k] of i.forecasts) row(k === NO_CODE ? null : k);
  for (const r of rows.values()) {
    r.budgetC = r.budgetOriginalC + r.budgetChangesC;
    r.actualC = r.billsC + r.laborC + r.reimbursableC;
    const override = i.forecasts.get(r.key);
    r.eacOverridden = override != null;
    r.eacC = override != null ? override : Math.max(r.budgetC, r.actualC + r.openC);
    r.costToCompleteC = r.eacC - r.actualC;
    r.varianceC = r.budgetC - r.eacC;
    r.spentPct = r.budgetC > 0 ? roundPct((r.actualC / r.budgetC) * 100) : 0;
    r.laborHours = Math.round(r.laborHours * 100) / 100;
  }
  const list = Array.from(rows.values());
  const s = (k: keyof CostRow) => sumCents(list.map((r) => Number(r[k]) || 0));
  const totals = {
    budgetOriginalC: s('budgetOriginalC'), budgetChangesC: s('budgetChangesC'), budgetC: s('budgetC'), committedC: s('committedC'),
    commitmentBilledC: s('commitmentBilledC'), openC: s('openC'), billsC: s('billsC'), laborC: s('laborC'), laborHours: Math.round(list.reduce((a, r) => a + r.laborHours, 0) * 100) / 100,
    reimbursableC: s('reimbursableC'), actualC: s('actualC'), eacC: s('eacC'), costToCompleteC: s('costToCompleteC'), varianceC: s('varianceC'),
  };
  return { rows: list, totals };
}

// ------------------------------------------------------------------ profitability and WIP

/**
 * Margin now and at completion, and the WIP position (cost-to-cost). Contract
 * revenue and cost exclude reimbursables, which are shown on their own.
 */
export function profitability(p: {
  contractC: number; evC: number; contractWorkInvoicedC: number; actualC: number; eacC: number; reimbursablesBilledC: number; reimbursableCostC: number;
}) {
  const contractCostActualC = p.actualC - p.reimbursableCostC;
  const contractCostEacC = p.eacC - p.reimbursableCostC;
  const projectedMarginC = p.contractC - contractCostEacC;
  const pctComplete = contractCostEacC > 0 ? Math.min(contractCostActualC / contractCostEacC, 1) : 0;
  const earnedRevenueC = Math.round(p.contractC * pctComplete);
  return {
    contractC: p.contractC, projectedCostC: contractCostEacC, projectedMarginC,
    projectedMarginPct: p.contractC ? roundPct((projectedMarginC / p.contractC) * 100) : 0,
    costToDateC: contractCostActualC, evC: p.evC, marginToDateC: p.evC - contractCostActualC,
    marginToDatePct: p.evC ? roundPct(((p.evC - contractCostActualC) / p.evC) * 100) : 0,
    costCompletePct: roundPct(pctComplete * 100), earnedRevenueC, billedC: p.contractWorkInvoicedC,
    /** Positive: billed ahead of the work (over-billed, a liability); negative: work not yet billed (under-billed, an asset). */
    overUnderBillingC: p.contractWorkInvoicedC - earnedRevenueC,
    reimbursablesBilledC: p.reimbursablesBilledC, reimbursableCostC: p.reimbursableCostC, reimbursableMarginC: p.reimbursablesBilledC - p.reimbursableCostC,
    loss: projectedMarginC < 0,
  };
}

// ------------------------------------------------------------------ AR aging

export const AGING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;
export type AgingBucket = typeof AGING_BUCKETS[number];
export function agingBucket(dueDate: string | null | undefined, asOf: string): { bucket: AgingBucket; daysPastDue: number } {
  if (!dueDate) return { bucket: 'current', daysPastDue: 0 };
  const days = Math.floor((Date.parse(asOf + 'T00:00:00Z') - Date.parse(dueDate + 'T00:00:00Z')) / 86400000);
  const bucket: AgingBucket = days <= 0 ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90_plus';
  return { bucket, daysPastDue: Math.max(days, 0) };
}
