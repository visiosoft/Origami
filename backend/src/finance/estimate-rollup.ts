/**
 * Nov 23 (Edward's notes p30, "the roll up"): several estimates of one project
 * added together -- e.g. the main house and the ADU, or the bank-financed and
 * owner-financed parts. One row per trade (CSI code, else the scope title, as
 * in compareEstimates), each estimate's low / high and the row's total; then
 * the estimate-level lines (GR, GL, profit, contingency, discount, design) and
 * the project total; and subtotals by building and by who pays. Cents.
 */
import type { CmpEstimate, CmpScope } from './estimate-compare';

export interface RollTotals { subtotal: number; grTotal: number; gl: number; profit: number; contingency: number; discount: number; designCost: number; totalProject: number; high: number }
export interface RollEstimate extends CmpEstimate {
  structureKey?: string | null; structureName?: string | null;
  fundingSourceId?: string | null; fundingName?: string | null;
  totals: RollTotals;
}
export type Pair = { low: number; high: number };

const keyOf = (s: CmpScope) => (s.csiCodeId ? `csi:${s.csiCodeId}` : `t:${s.title.trim().toLowerCase()}`);
const add = (a: Pair, b: Pair | null): Pair => (b ? { low: a.low + b.low, high: a.high + b.high } : a);

export const ROLL_LINES: { key: keyof RollTotals; label: string; sign?: -1 }[] = [
  { key: 'subtotal', label: 'Trades subtotal' },
  { key: 'grTotal', label: 'General requirements' },
  { key: 'gl', label: 'General liability' },
  { key: 'profit', label: 'Profit' },
  { key: 'contingency', label: 'Contingency' },
  { key: 'discount', label: 'Discount', sign: -1 },
  { key: 'designCost', label: 'Design / pre-construction' },
];

export function rollupEstimates(list: RollEstimate[]) {
  const order: string[] = [];
  const label = new Map<string, string>();
  for (const e of list) for (const s of e.scopes) {
    const k = keyOf(s);
    if (!label.has(k)) { order.push(k); label.set(k, s.csiLabel || s.title || 'Scope'); }
  }
  const rows = order.map((k) => {
    const cells = list.map((e) => {
      const hits = e.scopes.filter((s) => keyOf(s) === k);
      return hits.length ? hits.reduce<Pair>((a, s) => ({ low: a.low + s.low, high: a.high + s.high }), { low: 0, high: 0 }) : null;
    });
    return { key: k, label: label.get(k)!, cells, total: cells.reduce<Pair>((a, c) => add(a, c), { low: 0, high: 0 }) };
  }).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const lines = ROLL_LINES.map((l) => {
    const cells = list.map((e) => (e.totals[l.key] || 0) * (l.sign || 1));
    return { key: l.key, label: l.label, cells, total: cells.reduce((a, c) => a + c, 0) };
  }).filter((l) => l.key === 'subtotal' || l.cells.some((c) => c !== 0));
  const totals = list.map((e) => ({ low: e.totals.totalProject, high: Math.max(e.totals.high || 0, e.totals.totalProject) }));
  const total = totals.reduce<Pair>((a, t) => add(a, t), { low: 0, high: 0 });
  const group = (keyOf: (e: RollEstimate) => string, nameOf: (e: RollEstimate) => string) => {
    const m = new Map<string, { key: string; label: string; estimateIds: string[]; total: Pair }>();
    list.forEach((e, i) => {
      const k = keyOf(e);
      const g = m.get(k) || { key: k, label: nameOf(e), estimateIds: [], total: { low: 0, high: 0 } };
      g.estimateIds.push(e.id); g.total = add(g.total, totals[i]); m.set(k, g);
    });
    return [...m.values()];
  };
  const byBuilding = group((e) => e.structureKey || '', (e) => e.structureName || 'Whole project');
  const byFunding = group((e) => e.fundingSourceId || '', (e) => e.fundingName || 'Paid by: not set');
  return {
    estimates: list.map((e) => ({ id: e.id, label: e.label, date: e.date || null, structureKey: e.structureKey || null, building: e.structureName || null, fundingSourceId: e.fundingSourceId || null, paidBy: e.fundingName || null })),
    rows, lines, totals, total,
    // Only worth showing when the estimates actually differ on it.
    byBuilding: byBuilding.length > 1 ? byBuilding : [],
    byFunding: byFunding.length > 1 ? byFunding : [],
  };
}

/** Without the rights to see prices, the amounts are blanked (the trades and groups still show). */
export function redactRollup<T extends ReturnType<typeof rollupEstimates>>(r: T, canSee: boolean): T {
  if (canSee) return r;
  const blank = null as unknown as Pair;
  return {
    ...r,
    rows: r.rows.map((x) => ({ ...x, cells: x.cells.map((c) => (c ? blank : null)), total: blank })),
    lines: r.lines.map((x) => ({ ...x, cells: x.cells.map(() => null as unknown as number), total: null as unknown as number })),
    totals: r.totals.map(() => blank), total: blank,
    byBuilding: r.byBuilding.map((g) => ({ ...g, total: blank })), byFunding: r.byFunding.map((g) => ({ ...g, total: blank })),
  };
}
