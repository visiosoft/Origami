/**
 * The financial arithmetic, kept pure so every rule can be tested without a
 * database. All amounts here are integer cents.
 *
 * Four separate concepts are never collapsed into one another:
 *   physical progress (tasks done) · financial progress (the billable %, earned value)
 *   · billing (contract work invoiced) · cash (payments received).
 * And contract work is always pre-tax: tax is never contract value.
 */
import { allocate, fromCents, pctOf, roundPct, sumCents, toCents } from './money';

export type Category = 'design' | 'construction' | 'other';
export type ItemKind = 'project' | 'phase' | 'task';

export interface ItemFin {
  contractValue: number | null; reportedProgress: number; approvedProgress: number;
  retentionPctOverride?: number | null; taxPctOverride?: number | null; billingMethod?: string;
}

export interface CalcPhase { id: string; key: string; name: string; order: number; category: Category }
export interface CalcTask { id: string; title: string; phaseId: string | null; done: boolean; order: number }

/** An issued, non-void invoice line (contract work) as the SOV needs it. */
export interface IssuedLine {
  id: string; invoiceId: string; kind: string; targetType?: string | null; phaseId?: string | null; taskId?: string | null;
  amountC: number; retentionC: number; taxC: number;
}
export interface IssuedInvoice { id: string; totalC: number; dueDate?: string | null }
export interface PaymentFact { invoiceId: string; amountC: number }

// ------------------------------------------------------------------ invoice math

export interface LineMathInput {
  kind: string; amountC: number; retentionApplies: boolean; retentionPct: number; taxable: boolean; taxPct: number;
}
export interface LineMath { retentionC: number; netC: number; taxC: number }

export function lineMath(l: LineMathInput): LineMath {
  const retentionC = l.kind !== 'adjustment' && l.retentionApplies ? pctOf(l.amountC, l.retentionPct) : 0;
  const netC = l.amountC - retentionC;
  const taxC = l.taxable ? pctOf(netC, l.taxPct) : 0;
  return { retentionC, netC, taxC };
}

export interface InvoiceTotals { contractWorkC: number; retentionC: number; adjustmentC: number; taxC: number; totalC: number }

/** Contract work (non-adjustment amounts), retention held, adjustments, tax on taxable line nets, and the total. */
export function invoiceTotals(lines: LineMathInput[]): InvoiceTotals {
  const m = lines.map((l) => ({ l, ...lineMath(l) }));
  const contractWorkC = sumCents(m.filter((x) => x.l.kind !== 'adjustment').map((x) => x.l.amountC));
  const adjustmentC = sumCents(m.filter((x) => x.l.kind === 'adjustment').map((x) => x.l.amountC));
  const retentionC = sumCents(m.map((x) => x.retentionC));
  const taxC = sumCents(m.map((x) => x.taxC));
  const totalC = sumCents(m.map((x) => x.netC)) + taxC;
  return { contractWorkC, retentionC, adjustmentC, taxC, totalC };
}

/**
 * How much of an invoice's payments each line has received. Payments are first
 * split between contract work and everything else (tax, adjustments) in
 * proportion to the invoice's make-up; the contract-work share is then spread
 * over the non-adjustment lines by their net claim after retention, with any
 * remainder cent on the largest line. Deterministic, and it always sums exactly.
 */
export function allocatePayments(lines: IssuedLine[], invoiceTotalC: number, paidC: number): Map<string, number> {
  const out = new Map<string, number>();
  const work = lines.filter((l) => l.kind !== 'adjustment');
  const nets = work.map((l) => Math.max(0, l.amountC - l.retentionC));
  const workNetC = sumCents(nets);
  if (!work.length || invoiceTotalC <= 0 || paidC <= 0 || workNetC <= 0) { work.forEach((l) => out.set(l.id, 0)); return out; }
  const share = Math.min(workNetC, Math.round((paidC * workNetC) / invoiceTotalC));
  allocate(share, nets).forEach((c, i) => out.set(work[i].id, c));
  return out;
}

// ------------------------------------------------------------------ the schedule of values

export interface Figures {
  valueC: number | null; evC: number; invoicedC: number; retentionC: number; paidC: number;
  billableC: number; overBilledC: number; remainingC: number; outstandingC: number;
  reportedProgress: number; approvedProgress: number; billableProgress: number; physicalProgress: number;
  progressStatus: 'not_started' | 'in_progress' | 'complete';
  billingStatus: 'not_billable' | 'not_invoiced' | 'ready_to_invoice' | 'partially_invoiced' | 'fully_invoiced' | 'over_billed';
  paymentStatus: 'none' | 'unpaid' | 'partially_paid' | 'paid';
}

export interface SovRow extends Figures {
  kind: ItemKind; id: string; name: string; phaseId?: string | null; category?: Category;
  /** Value set on this item itself (a phase's own value is ignored while its tasks carry values). */
  ownValueC: number | null; valueFromTasks?: boolean; billedAsWhole?: boolean; deleted?: boolean;
  fin: Partial<ItemFin> & { version?: number } | null;
  children?: SovRow[];
}

export interface SovGroup { category: Category | 'unphased'; label: string; rows: SovRow[]; totals: Figures }

export interface SovInput {
  originalContractC: number; approvedChangesC: number; requireApproval: boolean;
  project: ItemFin & { version?: number };
  phases: CalcPhase[]; tasks: CalcTask[];
  phaseFin: Map<string, ItemFin & { version?: number }>; taskFin: Map<string, ItemFin & { version?: number; phaseId?: string | null }>;
  lines: IssuedLine[]; invoices: IssuedInvoice[]; payments: PaymentFact[];
  today: string;
}

export interface SovResult {
  summary: {
    originalContractC: number; approvedChangesC: number; revisedContractC: number; allocatedC: number; unallocatedC: number;
    allocation: 'under' | 'full' | 'over'; evC: number; contractWorkInvoicedC: number; invoiceTotalsC: number; paidC: number;
    arOutstandingC: number; unbilledEarnedC: number; overBilledC: number; remainingContractC: number; retentionHeldC: number;
    billableNowC: number; overdueC: number; overdueCount: number; lumpSum: boolean;
  };
  groups: SovGroup[];
  lump: SovRow | null;
}

const billable = (f: ItemFin | undefined, requireApproval: boolean) => (f ? (requireApproval ? Number(f.approvedProgress) : Number(f.reportedProgress)) || 0 : 0);
const valC = (f: ItemFin | undefined) => (f && f.contractValue != null ? toCents(f.contractValue) : null);

function figures(valueC: number | null, evC: number, invoicedC: number, retentionC: number, paidC: number, p: { reported: number; approved: number; billable: number; physical: number }): Figures {
  const billableC = Math.max(evC - invoicedC, 0);
  const overBilledC = Math.max(invoicedC - evC, 0);
  const netC = invoicedC - retentionC;
  const v = valueC ?? 0;
  const progressStatus = p.reported >= 100 ? 'complete' : p.reported > 0 ? 'in_progress' : 'not_started';
  const billingStatus: Figures['billingStatus'] = !v && !invoicedC ? 'not_billable'
    : overBilledC > 0 ? 'over_billed'
      : v > 0 && invoicedC >= v ? 'fully_invoiced'
        : billableC > 0 ? 'ready_to_invoice'
          : invoicedC > 0 ? 'partially_invoiced' : 'not_invoiced';
  const paymentStatus: Figures['paymentStatus'] = netC <= 0 ? 'none' : paidC >= netC ? 'paid' : paidC > 0 ? 'partially_paid' : 'unpaid';
  return {
    valueC, evC, invoicedC, retentionC, paidC, billableC, overBilledC, remainingC: v - invoicedC, outstandingC: Math.max(netC - paidC, 0),
    reportedProgress: roundPct(p.reported), approvedProgress: roundPct(p.approved), billableProgress: roundPct(p.billable), physicalProgress: roundPct(p.physical),
    progressStatus, billingStatus, paymentStatus,
  };
}

function addUp(rows: Figures[]): Figures {
  const s = (k: keyof Figures) => sumCents(rows.map((r) => Number(r[k]) || 0));
  const valueC = rows.some((r) => r.valueC != null) ? s('valueC') : null;
  const evC = s('evC');
  const pct = valueC ? (evC / valueC) * 100 : 0;
  return figures(valueC, evC, s('invoicedC'), s('retentionC'), s('paidC'), { reported: pct, approved: pct, billable: pct, physical: 0 });
}

export function computeSov(i: SovInput): SovResult {
  // Per-line paid, from each invoice's payments.
  const paidByInvoice = new Map<string, number>();
  for (const p of i.payments) paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) || 0) + p.amountC);
  const linePaid = new Map<string, number>();
  for (const inv of i.invoices) {
    const mine = i.lines.filter((l) => l.invoiceId === inv.id);
    for (const [id, c] of allocatePayments(mine, inv.totalC, paidByInvoice.get(inv.id) || 0)) linePaid.set(id, c);
  }
  const billed = (pred: (l: IssuedLine) => boolean) => {
    const ls = i.lines.filter((l) => l.kind !== 'adjustment' && pred(l));
    return { invoicedC: sumCents(ls.map((l) => l.amountC)), retentionC: sumCents(ls.map((l) => l.retentionC)), paidC: sumCents(ls.map((l) => linePaid.get(l.id) || 0)) };
  };

  const liveTasks = i.tasks;
  const taskIds = new Set(liveTasks.map((t) => t.id));
  const taskRow = (t: CalcTask, deleted = false): SovRow => {
    const f = i.taskFin.get(t.id);
    const valueC = valC(f);
    const bp = billable(f, i.requireApproval);
    const b = billed((l) => l.taskId === t.id);
    return {
      kind: 'task', id: t.id, name: t.title, phaseId: t.phaseId, ownValueC: valueC, deleted, fin: f || null,
      ...figures(valueC, valueC != null ? pctOf(valueC, bp) : 0, b.invoicedC, b.retentionC, b.paidC,
        { reported: Number(f?.reportedProgress) || 0, approved: Number(f?.approvedProgress) || 0, billable: bp, physical: t.done ? 100 : 0 }),
    };
  };

  const phaseRows: SovRow[] = [...i.phases].sort((a, b) => a.order - b.order).map((ph) => {
    const tasks = liveTasks.filter((t) => t.phaseId === ph.id).sort((a, b) => a.order - b.order);
    const children = tasks.map((t) => taskRow(t));
    const f = i.phaseFin.get(ph.id);
    const own = billed((l) => l.phaseId === ph.id && !l.taskId);
    const fromTasks = children.some((c) => c.ownValueC != null);
    const physical = tasks.length ? (tasks.filter((t) => t.done).length / tasks.length) * 100 : 0;
    if (fromTasks) {
      const valued = children.filter((c) => c.ownValueC != null || c.invoicedC);
      const sum = addUp(valued);
      const rowFigs = figures(sum.valueC, sum.evC, sum.invoicedC + own.invoicedC, sum.retentionC + own.retentionC, sum.paidC + own.paidC,
        { reported: sum.reportedProgress, approved: sum.approvedProgress, billable: sum.billableProgress, physical });
      return { kind: 'phase', id: ph.id, name: ph.name, category: ph.category, ownValueC: valC(f), valueFromTasks: true, fin: f || null, children, ...rowFigs };
    }
    const valueC = valC(f);
    const bp = billable(f, i.requireApproval);
    const childInv = children.reduce((a, c) => ({ inv: a.inv + c.invoicedC, ret: a.ret + c.retentionC, paid: a.paid + c.paidC }), { inv: 0, ret: 0, paid: 0 });
    return {
      kind: 'phase', id: ph.id, name: ph.name, category: ph.category, ownValueC: valueC, valueFromTasks: false, billedAsWhole: own.invoicedC > 0, fin: f || null, children,
      ...figures(valueC, valueC != null ? pctOf(valueC, bp) : 0, own.invoicedC + childInv.inv, own.retentionC + childInv.ret, own.paidC + childInv.paid,
        { reported: Number(f?.reportedProgress) || 0, approved: Number(f?.approvedProgress) || 0, billable: bp, physical }),
    };
  });

  // Unphased tasks that carry a value or were invoiced, and tasks deleted after being valued/invoiced.
  const unphased = liveTasks.filter((t) => !t.phaseId).map((t) => taskRow(t)).filter((r) => r.ownValueC != null || r.invoicedC);
  const orphanIds = new Set([...Array.from(i.taskFin.keys()), ...i.lines.map((l) => l.taskId).filter(Boolean) as string[]].filter((id) => !taskIds.has(id)));
  const orphans = Array.from(orphanIds).map((id) => taskRow({ id, title: 'Removed task', phaseId: null, done: false, order: 999 }, true)).filter((r) => r.ownValueC != null || r.invoicedC);

  const groups: SovGroup[] = [];
  const labels: Record<Category, string> = { design: 'Design', construction: 'Construction', other: 'Other milestones' };
  for (const cat of ['design', 'construction', 'other'] as Category[]) {
    const rows = phaseRows.filter((r) => r.category === cat);
    if (rows.length) groups.push({ category: cat, label: labels[cat], rows, totals: addUp(rows) });
  }
  const loose = [...unphased, ...orphans];
  if (loose.length) groups.push({ category: 'unphased', label: 'Unphased work', rows: loose, totals: addUp(loose) });

  const allItems = [...phaseRows, ...loose];
  const allocatedC = sumCents(allItems.map((r) => r.valueC ?? 0));
  const revisedContractC = i.originalContractC + i.approvedChangesC;

  // Lump sum: nothing carries a value, so the project itself is the billable item. Lump lines billed earlier stay visible.
  const lumpBilled = billed((l) => l.targetType === 'project');
  const lumpSum = allocatedC === 0;
  let lump: SovRow | null = null;
  if (lumpSum || lumpBilled.invoicedC) {
    const bp = billable(i.project, i.requireApproval);
    const valueC = lumpSum ? revisedContractC : null;
    lump = {
      kind: 'project', id: 'project', name: lumpSum ? 'Whole project (lump sum)' : 'Billed as lump sum before the breakdown', ownValueC: valueC, fin: i.project,
      ...figures(valueC, valueC != null ? pctOf(valueC, bp) : 0, lumpBilled.invoicedC, lumpBilled.retentionC, lumpBilled.paidC,
        { reported: Number(i.project.reportedProgress) || 0, approved: Number(i.project.approvedProgress) || 0, billable: bp, physical: 0 }),
    };
  }

  const evC = sumCents((lump ? [...allItems, lump] : allItems).map((r) => r.evC));
  const contractWorkInvoicedC = sumCents(i.lines.filter((l) => l.kind !== 'adjustment').map((l) => l.amountC));
  const invoiceTotalsC = sumCents(i.invoices.map((x) => x.totalC));
  const paidC = sumCents(i.payments.map((p) => p.amountC));
  const overdue = i.invoices.filter((x) => x.dueDate && x.dueDate < i.today && x.totalC - (paidByInvoice.get(x.id) || 0) > 0);
  const unallocatedC = revisedContractC - allocatedC;

  return {
    summary: {
      originalContractC: i.originalContractC, approvedChangesC: i.approvedChangesC, revisedContractC, allocatedC, unallocatedC,
      allocation: lumpSum ? 'under' : unallocatedC > 0 ? 'under' : unallocatedC === 0 ? 'full' : 'over',
      evC, contractWorkInvoicedC, invoiceTotalsC, paidC, arOutstandingC: invoiceTotalsC - paidC,
      unbilledEarnedC: evC - contractWorkInvoicedC, overBilledC: Math.max(contractWorkInvoicedC - evC, 0),
      remainingContractC: revisedContractC - contractWorkInvoicedC,
      retentionHeldC: sumCents(i.lines.map((l) => l.retentionC)),
      // What could be invoiced now: each billing item once -- a milestone's tasks when they carry the values, else the milestone.
      billableNowC: sumCents([...phaseRows.flatMap((r) => (r.valueFromTasks ? r.children || [] : [r])), ...loose, ...(lump ? [lump] : [])].map((r) => r.billableC)),
      overdueC: sumCents(overdue.map((x) => x.totalC - (paidByInvoice.get(x.id) || 0))), overdueCount: overdue.length, lumpSum,
    },
    groups, lump,
  };
}

/** Dollars for the API: every *C field becomes its dollar twin without the suffix. */
export function toDollars<T>(x: T): any {
  if (Array.isArray(x)) return x.map(toDollars);
  if (x instanceof Map) return Object.fromEntries(Array.from(x.entries()).map(([k, v]) => [k, toDollars(v)]));
  if (x && typeof x === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(x as any)) {
      if (/C$/.test(k) && (typeof v === 'number' || v === null)) out[k.slice(0, -1)] = v == null ? null : fromCents(v);
      else out[k] = toDollars(v);
    }
    return out;
  }
  return x;
}
