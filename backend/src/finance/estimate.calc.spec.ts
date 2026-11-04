import { readFileSync } from 'fs';
import { join } from 'path';
import { computeEstimate, explainTotal, lineMath, FORMULAS, type EstLineIn } from './estimate.calc';

// The Catherine bathrooms example from "People access and Financials".
const L = (id: string, scopeId: string, cost: number, markupAmt: number, pricing = 'fc'): EstLineIn => ({ id, scopeId, cost, markupAmt, markupMode: 'amt', pricing });
const lines: EstLineIn[] = [
  L('1.01', 's1', 2000, 640), L('1.02', 's1', 500, 220), L('1.03', 's1', 1000, 680), L('1.04', 's1', 1000, 1040),
  L('1.05', 's1', 5000, 760), L('1.06', 's1', 1000, 1160), L('1.07', 's1', 1000, 1160, 'allowance'),
  L('2.01', 's2', 2000, 1640), L('2.02', 's2', 2000, 1220), L('2.03', 's2', 1040, 6801, 'nis'), L('2.04', 's2', 2200, 2040),
  L('2.05', 's2', 3000, 1760), L('2.06', 's2', 1160, 2160, 'ofci'),
  // Note rows share the numbering and carry no money.
  { id: '2.07', scopeId: 's2', kind: 'details' }, { id: '2.08', scopeId: 's2', kind: 'inclusion', cost: 999 },
];
const gr = [
  [750, 3], [1000, 1], [500, 3], [200, 3], [2000, 1], [1000, 3], [253.59, 1], [10, 3], [10, 3], [10, 3], [10, 3], [10, 3], [10, 3],
].map(([base, qty], i) => ({ id: `g${i}`, base, qty, included: true }));
gr.push({ id: 'utility', base: 10, qty: 3, included: false });
const settings = { grPct: 17, profitPct: 12, contingencyPct: 5, discount: 2000, designCost: 17000 };
const input = { settings, scopes: [{ id: 's1' }, { id: 's2', factor: 1.15 }], lines, gr, payments: [{ id: 'p1', mode: 'pct', value: 10 }, { id: 'p2', mode: 'amt', value: 1000 }] };

describe('estimate maths (F1-F19)', () => {
  const r = computeEstimate(input);
  const t = r.totals;

  it('line price = cost + markup, markup % = markup / cost (F1, F2)', () => {
    const l = r.lines.find((x) => x.id === '1.01')!;
    expect(l.price).toBe(264000);
    expect(l.markupPct).toBe(32);
    expect(lineMath({ id: 'x', scopeId: 's', cost: 1000, markupMode: 'pct', markupPct: 15 }).price).toBe(115000);
  });

  it('scope 1 includes line 1.07 ($17,160, the sheet showed $15,000)', () => {
    expect(r.scopes[0].total).toBe(1716000);
    expect(r.scopes[0].cost).toBe(1150000);
    expect(r.scopes[0].profitPct).toBeCloseTo(49.2174, 3);
  });

  it('Not In Scope lines count $0 but stay listed (F3)', () => {
    const nis = r.lines.find((x) => x.id === '2.03')!;
    expect(nis.price).toBe(784100);
    expect(nis.countedPrice).toBe(0);
    expect(r.scopes[1].total).toBe(2702100 - 784100);
  });

  it('note rows (Details, Inclusions ...) never add money', () => {
    expect(r.lines.find((x) => x.id === '2.08')).toBeUndefined();
  });

  it('precon higher end = price x factor, not in totals (F4)', () => {
    expect(r.scopes[1].high).toBe(Math.round(1918000 * 1.15));
    expect(t.subtotal).toBe(3634000);
  });

  it('GR counts Included lines only, and the suggestion is a guide (F9-F12)', () => {
    expect(t.grTotal).toBe(1078359);
    expect(t.grSuggested).toBe(936030);
    expect(t.grBalance).toBe(-142329);
  });

  it('total build = (subtotal + GR) / (1 - profit - contingency); parts add up exactly (F13-F15)', () => {
    expect(t.totalBuild).toBe(5677541);
    expect(t.profit).toBe(681305);
    expect(t.contingency).toBe(283877);
    expect(t.subtotal + t.grTotal + t.profit + t.contingency).toBe(t.totalBuild);
  });

  it('discount, design cost and total project cost (F16, F17)', () => {
    expect(t.revisedBuild).toBe(5477541);
    expect(t.totalProject).toBe(7177541);
  });

  it('cost split and payments add up to the total project cost (F19)', () => {
    const s = t.split;
    expect(s.soft + s.fixed + s.allowance + s.tm + s.contingency).toBe(t.totalProject);
    expect(s.allowance).toBe(216000);
    expect(r.payments.map((p) => p.amount)).toEqual([717754, 100000]);
    expect(t.unscheduled).toBe(t.totalProject - 817754);
  });

  it('profit + contingency of 100% or more is an error, not a crash', () => {
    const bad = computeEstimate({ ...input, settings: { ...settings, profitPct: 60, contingencyPct: 40 } });
    expect(bad.totals.error).toMatch(/100%/);
    expect(Number.isFinite(bad.totals.totalBuild)).toBe(true);
  });

  it('every total explains its formula with the numbers', () => {
    expect(explainTotal('F14', r, settings)).toBe('Profit = Profit % × Total build cost\n12% × $56,775.41 = $6,813.05');
    expect(explainTotal('F13', r, settings)).toContain('($36,340.00 + $10,783.59) ÷ (1 − 12% − 5%) = $56,775.41');
    expect(Object.keys(FORMULAS)).toHaveLength(19);
  });

  it('the browser copy is identical', () => {
    const a = readFileSync(join(__dirname, 'estimate.calc.ts'), 'utf8');
    const b = readFileSync(join(__dirname, '../../../frontend/src/data/estimateCalc.ts'), 'utf8');
    expect(b).toBe(a);
  });
});
