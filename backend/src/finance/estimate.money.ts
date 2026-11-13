/**
 * K7 (Nov 13): who sees which money on an estimate. The access sheet's
 * financial data types (Admin -> User Access & Roles) decide it per role:
 * a role sees a figure only if it may view one of the data types behind it.
 * Roles that set none of these data types (and full access) see everything,
 * as before. Applied on the server: hidden figures are sent as null, and a
 * save never overwrites what the caller couldn't see.
 */
import type { CmpOut, EstimateResult } from './estimate.calc';

export const MONEY_TYPES = {
  /** Sub cost per line, scope cost, subcontracted total. */
  cost: ['fin:line_items_amount', 'fin:subcontracted_total'],
  /** Markup $ and %. */
  markup: ['fin:markups'],
  /** Line item total (cost + markup), scope totals. */
  price: ['fin:line_item_total', 'fin:subtotal'],
  subtotal: ['fin:subtotal'],
  /** The GR lines and their amounts. */
  grDetail: ['fin:general_requirements', 'fin:general_requirements_subline_item_estimate_scope_specific_li'],
  /** GR total, GR %, General Liability. */
  grTotal: ['fin:general_requirements', 'fin:general_requirements_total'],
  profit: ['fin:profit'],
  contingency: ['fin:contingency'],
  /** Total build / project cost, discounts, design cost, payments. */
  total: ['fin:total_construction', 'fin:total_mbbl'],
} as const;
export type MoneyKey = keyof typeof MONEY_TYPES;
export type MoneyRights = Record<MoneyKey, boolean> & { full: boolean };

const ALL_KEYS = [...new Set(Object.values(MONEY_TYPES).flat())];

export function moneyRightsOf(perms: 'all' | Record<string, { view?: boolean; manage?: boolean } | undefined> | null | undefined): MoneyRights {
  const all = Object.fromEntries(Object.keys(MONEY_TYPES).map((k) => [k, true])) as Record<MoneyKey, boolean>;
  if (perms === 'all') return { ...all, full: true };
  const p = perms || {};
  // A role that sets none of the data types keeps seeing everything (custom roles made before the sheet).
  if (!ALL_KEYS.some((k) => p[k] !== undefined)) return { ...all, full: true };
  const out = Object.fromEntries(Object.entries(MONEY_TYPES).map(([k, keys]) => [k, keys.some((d) => !!(p[d]?.view || p[d]?.manage))])) as Record<MoneyKey, boolean>;
  return { ...out, full: Object.values(out).every(Boolean) };
}

const nul = <T extends object>(o: T, keys: string[]) => { for (const k of keys) if (k in o) (o as any)[k] = null; return o; };

/** The estimate as the caller may see it (a copy; the stored rows are untouched). */
export function redactEstimate<R extends { estimate: any; lines: any[]; gr: any[]; result: EstimateResult }>(r: R, m: MoneyRights): R {
  if (m.full) return r;
  const e = { ...r.estimate };
  if (!m.grTotal) nul(e, ['grPct', 'glPct']);
  if (!m.profit) nul(e, ['profitPct']);
  if (!m.contingency) nul(e, ['contingencyPct']);
  if (!m.total) { nul(e, ['discount', 'designCost']); e.payments = (e.payments || []).map((p: any) => ({ ...p, value: null })); }
  const lines = r.lines.map((l) => {
    const x = { ...l };
    if (!m.cost) nul(x, ['cost']);
    if (!m.markup) nul(x, ['markupAmt', 'markupPct']);
    return x;
  });
  const gr = r.gr.map((g) => (m.grDetail ? g : nul({ ...g }, ['base'])));
  const res = r.result;
  const result: EstimateResult = {
    lines: res.lines.map((l) => {
      const x: any = { ...l };
      if (!m.cost) nul(x, ['cost']);
      if (!m.markup) nul(x, ['markup', 'markupPct']);
      if (!m.price) nul(x, ['price', 'countedPrice', 'high']);
      return x;
    }),
    scopes: res.scopes.map((s) => {
      const x: any = { ...s };
      if (!m.cost) nul(x, ['cost']);
      if (!m.markup) nul(x, ['markup', 'profitPct']);
      if (!m.price) nul(x, ['total', 'high']);
      return x;
    }),
    gr: res.gr.map((g) => (m.grDetail ? g : ({ ...g, amount: null } as any))),
    payments: res.payments.map((p) => (m.total ? p : ({ ...p, amount: null } as any))),
    totals: (() => {
      const t: any = { ...res.totals, split: { ...res.totals.split } };
      if (!m.cost) nul(t, ['subcontracted']);
      if (!m.markup) nul(t, ['markup']);
      if (!m.subtotal) nul(t, ['subtotal', 'high']);
      if (!m.grTotal) nul(t, ['grTotal', 'grSuggested', 'grBalance', 'effectiveGrPct', 'gl']);
      if (!m.profit) nul(t, ['profit']);
      if (!m.contingency) nul(t, ['contingency']);
      if (!m.total) { nul(t, ['totalBuild', 'discount', 'revisedBuild', 'designCost', 'totalProject', 'scheduled', 'unscheduled']); t.split = null; }
      return t;
    })(),
  };
  return { ...r, estimate: e, lines, gr, result };
}

/** Compare, with the figures the caller can't see taken out. */
export function redactCompare<C extends CmpOut>(c: C, m: MoneyRights): C {
  if (m.full) return c;
  const hideField = (f: string) => (f === 'cost' && !m.cost) || (f === 'markup' && !m.markup) || (f === 'price' && !m.price);
  const TOTAL: Record<string, MoneyKey> = { subtotal: 'subtotal', grTotal: 'grTotal', gl: 'grTotal', profit: 'profit', contingency: 'contingency', totalBuild: 'total', discount: 'total', designCost: 'total', totalProject: 'total' };
  return {
    ...c,
    scopes: c.scopes.map((s) => ({
      ...s, totalA: m.price ? s.totalA : null, totalB: m.price ? s.totalB : null,
      lines: s.lines.map((l) => ({ ...l, priceA: m.price ? l.priceA : null, priceB: m.price ? l.priceB : null, fields: l.fields.filter((f) => !hideField(f.field)) })),
    })),
    totals: c.totals.filter((t) => m[TOTAL[t.key] || 'total']),
  };
}

/**
 * A save from someone who can't see all the money: amounts on rows that
 * already exist stay as stored, new rows start at $0, so nothing hidden is
 * overwritten. (Their money cells are read-only in the sheet.)
 */
export function keepStoredMoney<L extends { id: string; cost?: any; markupMode?: any; markupAmt?: any; markupPct?: any; pricing?: any }, G extends { id: string; base?: any; qty?: any; included?: any }>(
  lines: L[], gr: G[], stored: { lines: L[]; gr: G[] }, m: MoneyRights,
) {
  if (m.full) return;
  const sl = new Map(stored.lines.map((l) => [l.id, l]));
  for (const l of lines) {
    const s = sl.get(l.id);
    l.cost = s ? s.cost : 0; l.markupMode = s ? s.markupMode : 'amt'; l.markupAmt = s ? s.markupAmt : 0; l.markupPct = s ? s.markupPct : null;
    if (s) l.pricing = s.pricing;
  }
  if (!m.grDetail || !m.grTotal) {
    const sg = new Map(stored.gr.map((g) => [g.id, g]));
    for (const g of gr) { const s = sg.get(g.id); g.base = s ? s.base : 0; g.qty = s ? s.qty : 1; g.included = s ? s.included : true; }
  }
}

/** Settings that are money: refused unless the caller may see that money. */
export const SETTING_MONEY: Record<string, MoneyKey> = {
  grPct: 'grTotal', glPct: 'grTotal', profitPct: 'profit', contingencyPct: 'contingency', discount: 'total', designCost: 'total', payments: 'total',
};
