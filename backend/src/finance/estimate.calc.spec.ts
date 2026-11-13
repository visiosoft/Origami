import { readFileSync } from 'fs';
import { join } from 'path';
import { autoStrategy, compareSheets, computeEstimate, explainTotal, lineMath, mapOldStrategy, FORMULAS, type EstLineIn } from './estimate.calc';

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
    expect(Object.keys(FORMULAS)).toHaveLength(20);
  });

  it('the browser copy is identical', () => {
    const a = readFileSync(join(__dirname, 'estimate.calc.ts'), 'utf8');
    const b = readFileSync(join(__dirname, '../../../frontend/src/data/estimateCalc.ts'), 'utf8');
    expect(b).toBe(a);
  });
});

describe('General Liability (F20, Nov 13)', () => {
  const base = { scopes: [{ id: 's' }], lines: [{ id: 'l', scopeId: 's', cost: 10000, markupAmt: 2000 }], gr: [{ id: 'g', base: 3000, qty: 1 }] };
  it('is the GL rate × (subtotal + GR) and is counted in the total build cost; parts still add up', () => {
    const r = computeEstimate({ ...base, settings: { grPct: 17, profitPct: 12, contingencyPct: 5, glPct: 1.5 } });
    expect(r.totals.gl).toBe(22500); // 1.5% × $15,000
    expect(r.totals.totalBuild).toBe(Math.round((1500000 + 22500) / 0.83));
    const t = r.totals;
    expect(t.subtotal + t.grTotal + t.gl + t.profit + t.contingency).toBe(t.totalBuild);
  });
  it('off (null) changes nothing', () => {
    const off = computeEstimate({ ...base, settings: { grPct: 17, profitPct: 12, contingencyPct: 5, glPct: null } });
    const none = computeEstimate({ ...base, settings: { grPct: 17, profitPct: 12, contingencyPct: 5 } });
    expect(off.totals.gl).toBe(0);
    expect(off.totals.totalBuild).toBe(none.totals.totalBuild);
    expect(off.totals.totalBuild).toBe(Math.round(1500000 / 0.83));
  });
});

describe('compare two revisions (Nov 13)', () => {
  const settings = { grPct: 17, profitPct: 12, contingencyPct: 5 };
  const side = (scopes: any[], lines: any[]) => ({ scopes, lines, result: computeEstimate({ settings, scopes, lines, gr: [] }) });
  it('matches rows by where they were copied from: added, removed, changed with old and new values, totals', () => {
    const a = side([{ id: 's1', title: 'Demo' }], [
      { id: 'a1', scopeId: 's1', description: 'Walls', cost: 1000, markupAmt: 300 },
      { id: 'a2', scopeId: 's1', description: 'Haul', cost: 500, markupAmt: 100 },
    ]);
    const b = side([{ id: 't1', originId: 's1', title: 'Demo' }, { id: 't2', title: 'Tile' }], [
      { id: 'b1', originId: 'a1', scopeId: 't1', description: 'Walls', cost: 1200, markupAmt: 300, subName: 'Bay' },
      { id: 'b3', scopeId: 't2', description: 'Floor tile', cost: 2000, markupAmt: 500 },
    ]);
    const r = compareSheets(a, b);
    expect(r.scopes.map((s) => [s.title, s.status])).toEqual([['Demo', 'changed'], ['Tile', 'added']]);
    const demo = r.scopes[0].lines;
    expect(demo.map((l) => [l.description, l.status])).toEqual([['Walls', 'changed'], ['Haul', 'removed']]);
    expect(demo[0].fields.map((f) => [f.field, f.a, f.b])).toEqual([['cost', 100000, 120000], ['price', 130000, 150000], ['subName', '', 'Bay']]);
    expect(r.counts).toEqual({ added: 1, removed: 1, changed: 1, same: 0 });
    const sub = r.totals.find((t) => t.key === 'subtotal')!;
    expect([sub.a, sub.b]).toEqual([190000, 400000]);
  });
  it('rows from before copies were tracked match by scope and line text', () => {
    const a = side([{ id: 's1', csiCodeId: 'C1', title: 'Demo' }], [{ id: 'a1', scopeId: 's1', description: 'Walls', cost: 1000 }, { id: 'a2', scopeId: 's1', description: 'Walls', cost: 50 }]);
    const b = side([{ id: 't1', csiCodeId: 'C1', title: 'demo ' }], [{ id: 'b1', scopeId: 't1', description: 'Walls', cost: 1000 }, { id: 'b2', scopeId: 't1', description: 'walls', cost: 60 }]);
    const r = compareSheets(a, b);
    expect(r.scopes).toHaveLength(1);
    expect(r.scopes[0].lines.map((l) => l.status)).toEqual(['same', 'changed']);
  });
});

describe('performing strategy (Edward\'s list, Nov 13)', () => {
  it('maps the old list: subcontract by whether a sub is named, Owner to OFCI, Other cleared', () => {
    expect(mapOldStrategy('subcontract', true)).toBe('sub_used');
    expect(mapOldStrategy('subcontract', false)).toBe('sub_required');
    expect(mapOldStrategy('contract_required', true)).toBe('sub_used');
    expect(mapOldStrategy('contract_required', false)).toBe('sub_required');
    expect(mapOldStrategy('owner', false)).toBe('ofci');
    expect(mapOldStrategy('other', true)).toBeNull();
    expect(mapOldStrategy('self_perform', true)).toBe('self_perform');
    expect(mapOldStrategy('not_in_scope', false)).toBe('not_in_scope');
    expect(mapOldStrategy(null, false)).toBeNull();
  });

  it('naming a sub, clearing it and OFCI pricing set the strategy; a hand-picked one stays', () => {
    expect(autoStrategy({ strategy: null, subName: 'Bay Concrete' })).toBe('sub_used');
    expect(autoStrategy({ strategy: 'sub_required', contractorId: 'K1' })).toBe('sub_used');
    expect(autoStrategy({ strategy: 'sub_used', subName: '  ' })).toBe('sub_required');
    expect(autoStrategy({ strategy: null })).toBeNull();
    expect(autoStrategy({ strategy: 'self_perform', pricing: 'ofci' })).toBe('ofci');
    expect(autoStrategy({ strategy: null, subPricing: 'ofci', subName: 'X' })).toBe('ofci');
    expect(autoStrategy({ strategy: 'prime_procures', subName: 'Bay Concrete' })).toBe('prime_procures');
    expect(autoStrategy({ strategy: 'not_in_scope', subName: 'Bay Concrete' })).toBe('not_in_scope');
  });
});
