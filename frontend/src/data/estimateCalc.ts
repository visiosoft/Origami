/**
 * Estimate / prime contract maths (financial tab, Nov 4). Pure, no imports, so
 * the very same file runs in the browser for live totals:
 * frontend/src/data/estimateCalc.ts must stay an exact copy (a test checks).
 *
 * Money is integer cents throughout; percentages are plain numbers (12 = 12%).
 * Every figure has a formula id (F1..F19) and a plain-words description,
 * shown behind the (i) next to each total.
 */

export const PRICING_TYPES = ['fc', 'tm', 'nte', 'allowance', 'ofci', 'nis'] as const;
export type PricingType = (typeof PRICING_TYPES)[number];
export const PRICING_LABEL: Record<PricingType, string> = {
  fc: 'Fixed Cost (FC)', tm: 'Time & Materials (T&M)', nte: 'Not to Exceed (NTE)',
  allowance: 'Allowance', ofci: 'Owner Furnished Contractor Installed (OFCI)', nis: 'Not In Scope (NIS)',
};

/** Performing strategy (Edward's list, Nov 13). */
export const STRATEGIES = [
  'sub_used', 'sub_required', 'self_perform', 'ofci', 'sub_procures', 'prime_procures', 'designer_procures', 'not_in_scope',
] as const;
export type Strategy = (typeof STRATEGIES)[number];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  sub_used: 'Subcontract used', sub_required: 'Subcontract required', self_perform: 'Self perform',
  ofci: 'OFCI', sub_procures: 'Subcontractor procures', prime_procures: 'Prime procures',
  designer_procures: 'Designer procures', not_in_scope: 'Not In Scope',
};
/** The list before Nov 13; still read until the one-off mapping has run. */
export const OLD_STRATEGIES = ['subcontract', 'owner', 'contract_required', 'other'] as const;

/** Where an old strategy goes: a named sub makes a subcontract "used"; Owner is OFCI; Other is cleared. */
export function mapOldStrategy(strategy: string | null | undefined, hasSub: boolean): string | null {
  if (strategy === 'subcontract' || strategy === 'contract_required') return hasSub ? 'sub_used' : 'sub_required';
  if (strategy === 'owner') return 'ofci';
  if (strategy === 'other') return null;
  return strategy || null;
}

/**
 * The strategy that follows on its own from a line's sub and pricing:
 * OFCI pricing gives OFCI; naming a sub gives "Subcontract used", clearing it "Subcontract required".
 * A strategy picked by hand (self perform, procures, not in scope) is kept.
 */
export function autoStrategy(line: { strategy?: string | null; pricing?: string | null; subPricing?: string | null; subName?: string | null; contractorId?: string | null }): string | null {
  const s = mapOldStrategy(line.strategy, !!(line.subName?.trim() || line.contractorId));
  if (line.pricing === 'ofci' || line.subPricing === 'ofci') return 'ofci';
  const hasSub = !!(line.subName?.trim() || line.contractorId);
  if (!s || s === 'sub_used' || s === 'sub_required') return hasSub ? 'sub_used' : s ? 'sub_required' : null;
  return s;
}

export const NOTE_KINDS = ['details', 'inclusion', 'exclusion', 'assumption'] as const;
export const NOTE_LABEL: Record<(typeof NOTE_KINDS)[number], string> = {
  details: 'Details', inclusion: 'Inclusions', exclusion: 'Exclusions', assumption: 'Assumptions & Clarifications (A&C)',
};

export const COST_TYPES = ['Rough Labor', 'Rough Materials', 'Finish Labor', 'Finish Materials', 'Equipment'] as const;

/** How the figures are worked out, in words (formula id -> description). */
export const FORMULAS = {
  F1: { label: 'Line markup %', text: 'Markup $ ÷ Sub cost' },
  F2: { label: 'Line price', text: 'Sub cost + Markup $ (with markup entered as %: Sub cost × (1 + Markup %))' },
  F3: { label: 'Counted line price', text: 'Not In Scope lines count $0; every other line counts its price (OFCI lines count only what is entered on them)' },
  F4: { label: 'Precon higher end', text: 'Line price × Factor — shown for ranges, never added to totals' },
  F5: { label: 'Scope total', text: 'Sum of the counted line prices in the scope' },
  F6: { label: 'Scope profit %', text: 'Scope markup $ ÷ Scope sub cost' },
  F7: { label: 'Subcontracted total', text: 'Sum of sub cost on counted lines, before markup' },
  F8: { label: 'Subtotal', text: 'Sum of the scope totals (= Subcontracted total + all markups)' },
  F9: { label: 'GR line', text: 'Base amount × Quantity; only lines marked Included count' },
  F10: { label: 'General Requirements total', text: 'Sum of the Included GR lines' },
  F11: { label: 'Suggested GR max', text: 'GR % × Subtotal ÷ (1 − GR % − Profit % − Contingency %) — a guide only' },
  F12: { label: 'GR balance left', text: 'Suggested GR max − GR total (negative = over the suggestion)' },
  F13: { label: 'Total build cost', text: '(Subtotal + GR total) ÷ (1 − Profit % − Contingency %)' },
  F14: { label: 'Profit', text: 'Profit % × Total build cost' },
  F15: { label: 'Contractor contingency', text: 'Contingency % × Total build cost (takes the rounding cent, so the parts add up exactly)' },
  F16: { label: 'Total build cost (revised)', text: 'Total build cost − Discounts & credits' },
  F17: { label: 'Total project cost', text: 'Total build cost (revised) + Total design cost' },
  F18: { label: 'Effective GR %', text: 'GR total ÷ Total build cost' },
  F19: { label: 'Payment', text: '% × Total project cost, or the fixed amount' },
} as const;
export type FormulaId = keyof typeof FORMULAS;

export interface EstSettings {
  grPct: number;
  profitPct: number;
  contingencyPct: number;
  /** Dollars. */
  discount?: number | null;
  /** Dollars. */
  designCost?: number | null;
}
export interface EstScopeIn { id: string; factor?: number | null }
export interface EstLineIn {
  id: string;
  scopeId: string;
  /** item (default) or a note row (details / inclusion / exclusion / assumption), which carries no money. */
  kind?: string | null;
  pricing?: string | null;
  /** Dollars. */
  cost?: number | null;
  /** 'amt' (markup typed in dollars) or 'pct'. */
  markupMode?: string | null;
  markupAmt?: number | null;
  markupPct?: number | null;
}
export interface EstGrIn { id: string; included?: boolean | null; base?: number | null; qty?: number | null }
export interface EstPaymentIn { id: string; label?: string; mode?: string | null; value?: number | null }

export interface LineOut { id: string; scopeId: string; cost: number; markup: number; markupPct: number | null; price: number; counted: boolean; countedPrice: number; high: number }
export interface ScopeOut { id: string; cost: number; markup: number; total: number; profitPct: number | null; high: number; factor: number }
export interface GrOut { id: string; amount: number; included: boolean }
export interface PaymentOut { id: string; amount: number }
export interface EstimateTotals {
  subcontracted: number; markup: number; subtotal: number; high: number;
  grTotal: number; grSuggested: number; grBalance: number; effectiveGrPct: number | null;
  totalBuild: number; profit: number; contingency: number;
  discount: number; revisedBuild: number; designCost: number; totalProject: number;
  /** The letter's cost split; parts add up to the total project cost. */
  split: { soft: number; fixed: number; allowance: number; tm: number; contingency: number };
  scheduled: number; unscheduled: number;
  /** Set when the percentages leave nothing to divide by (Profit % + Contingency % ≥ 100). */
  error: string | null;
}
export interface EstimateResult { lines: LineOut[]; scopes: ScopeOut[]; gr: GrOut[]; payments: PaymentOut[]; totals: EstimateTotals }

const cents = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round((n + Math.sign(n) * Number.EPSILON) * 100) : 0;
};
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
/** Round half away from zero. */
const rnd = (x: number) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
const pctOf = (c: number, p: number) => rnd((c * p) / 100);
const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 1e6) / 1e4 : null);

export const isPricing = (p: unknown): p is PricingType => (PRICING_TYPES as readonly string[]).includes(String(p));

/** F1-F4 for one line. */
export function lineMath(l: EstLineIn, factor = 1): LineOut {
  const cost = cents(l.cost);
  const markup = l.markupMode === 'pct' ? pctOf(cost, num(l.markupPct)) : cents(l.markupAmt);
  const price = cost + markup;
  const counted = l.pricing !== 'nis';
  return {
    id: l.id, scopeId: l.scopeId, cost, markup,
    markupPct: l.markupMode === 'pct' ? num(l.markupPct) : ratio(markup, cost),
    price, counted, countedPrice: counted ? price : 0,
    high: rnd(price * (num(factor, 1) || 1)),
  };
}

export function computeEstimate(input: { settings: EstSettings; scopes: EstScopeIn[]; lines: EstLineIn[]; gr: EstGrIn[]; payments?: EstPaymentIn[] }): EstimateResult {
  const s = input.settings;
  const factorOf = new Map(input.scopes.map((sc) => [sc.id, num(sc.factor, 1) || 1]));
  const lines = input.lines.filter((l) => !l.kind || l.kind === 'item').map((l) => lineMath(l, factorOf.get(l.scopeId) ?? 1));

  const scopes: ScopeOut[] = input.scopes.map((sc) => {
    const mine = lines.filter((l) => l.scopeId === sc.id && l.counted);
    const cost = mine.reduce((a, l) => a + l.cost, 0);
    const markup = mine.reduce((a, l) => a + l.markup, 0);
    const total = mine.reduce((a, l) => a + l.countedPrice, 0);
    return { id: sc.id, cost, markup, total, profitPct: ratio(markup, cost), high: mine.reduce((a, l) => a + l.high, 0), factor: factorOf.get(sc.id) ?? 1 };
  });
  const known = new Set(input.scopes.map((sc) => sc.id));
  const counted = lines.filter((l) => l.counted && known.has(l.scopeId));
  const subcontracted = counted.reduce((a, l) => a + l.cost, 0);
  const markup = counted.reduce((a, l) => a + l.markup, 0);
  const subtotal = scopes.reduce((a, sc) => a + sc.total, 0);
  const high = scopes.reduce((a, sc) => a + sc.high, 0);

  const gr = input.gr.map((g) => ({ id: g.id, included: g.included !== false, amount: rnd(cents(g.base) * num(g.qty, 1)) }));
  const grTotal = gr.filter((g) => g.included).reduce((a, g) => a + g.amount, 0);

  const grPct = num(s.grPct), profitPct = num(s.profitPct), contPct = num(s.contingencyPct);
  const denom = 1 - (profitPct + contPct) / 100;
  const denomAll = 1 - (grPct + profitPct + contPct) / 100;
  const error = denom <= 0 ? 'Profit % and Contingency % add up to 100% or more, so there is no total build cost.' : null;

  const grSuggested = denomAll > 0 ? rnd(((grPct / 100) * subtotal) / denomAll) : 0;
  const totalBuild = error ? subtotal + grTotal : rnd((subtotal + grTotal) / denom);
  const profit = error ? 0 : pctOf(totalBuild, profitPct);
  const contingency = error ? 0 : totalBuild - subtotal - grTotal - profit;
  const discount = cents(s.discount);
  const revisedBuild = totalBuild - discount;
  const designCost = cents(s.designCost);
  const totalProject = revisedBuild + designCost;

  // Cost split for the letter: lines by pricing type; GR, profit and discounts sit with Fixed.
  const pricingOf = new Map(input.lines.map((l) => [l.id, l.pricing ?? 'fc']));
  const sumBy = (t: string[]) => counted.filter((l) => t.includes(String(pricingOf.get(l.id)))).reduce((a, l) => a + l.price, 0);
  const allowance = sumBy(['allowance']);
  const tm = sumBy(['tm']);
  const split = { soft: designCost, allowance, tm, contingency, fixed: totalProject - designCost - allowance - tm - contingency };

  const payments = (input.payments || []).map((p) => ({ id: p.id, amount: p.mode === 'amt' ? cents(p.value) : pctOf(totalProject, num(p.value)) }));
  const scheduled = payments.reduce((a, p) => a + p.amount, 0);

  return {
    lines, scopes, gr, payments,
    totals: {
      subcontracted, markup, subtotal, high, grTotal, grSuggested, grBalance: grSuggested - grTotal,
      effectiveGrPct: ratio(grTotal, totalBuild), totalBuild, profit, contingency, discount, revisedBuild, designCost, totalProject,
      split, scheduled, unscheduled: totalProject - scheduled, error,
    },
  };
}

/** $1,234.56 from cents. */
export const money = (c: number) => `${c < 0 ? '−' : ''}$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (p: number) => `${Math.round(p * 100) / 100}%`;

/**
 * The (i) text for a total: the formula in words, then the same formula with
 * this estimate's numbers ("Profit = 12% × $56,775.41 = $6,813.05").
 */
export function explainTotal(id: FormulaId, r: EstimateResult, s: EstSettings): string {
  const t = r.totals;
  const f = FORMULAS[id];
  const worked: Partial<Record<FormulaId, string>> = {
    F7: money(t.subcontracted),
    F8: `${money(t.subcontracted)} + ${money(t.markup)} markup = ${money(t.subtotal)}`,
    F10: money(t.grTotal),
    F11: `${pct(s.grPct)} × ${money(t.subtotal)} ÷ (1 − ${pct(s.grPct)} − ${pct(s.profitPct)} − ${pct(s.contingencyPct)}) = ${money(t.grSuggested)}`,
    F12: `${money(t.grSuggested)} − ${money(t.grTotal)} = ${money(t.grBalance)}`,
    F13: `(${money(t.subtotal)} + ${money(t.grTotal)}) ÷ (1 − ${pct(s.profitPct)} − ${pct(s.contingencyPct)}) = ${money(t.totalBuild)}`,
    F14: `${pct(s.profitPct)} × ${money(t.totalBuild)} = ${money(t.profit)}`,
    F15: `${pct(s.contingencyPct)} × ${money(t.totalBuild)} = ${money(t.contingency)}`,
    F16: `${money(t.totalBuild)} − ${money(t.discount)} = ${money(t.revisedBuild)}`,
    F17: `${money(t.revisedBuild)} + ${money(t.designCost)} = ${money(t.totalProject)}`,
    F18: t.effectiveGrPct == null ? '—' : `${money(t.grTotal)} ÷ ${money(t.totalBuild)} = ${pct(t.effectiveGrPct)}`,
  };
  return `${f.label} = ${f.text}${worked[id] ? `\n${worked[id]}` : ''}`;
}
