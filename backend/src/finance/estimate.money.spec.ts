import { computeEstimate } from './estimate.calc';
import { keepStoredMoney, moneyRightsOf, redactCompare, redactEstimate } from './estimate.money';

const v = (on: boolean) => ({ view: on, manage: on });
// From the access sheet: Internal Super (I-3) sees line amounts and line totals, not markups, GR, profit, contingency or totals.
const SUPER = {
  'fin:line_items_amount': v(true), 'fin:subcontracted_total': v(true), 'fin:subtotal': v(true), 'fin:line_item_total': v(true),
  'fin:markups': v(false), 'fin:general_requirements': v(false), 'fin:general_requirements_total': v(false), 'fin:profit': v(false),
  'fin:contingency': v(false), 'fin:total_construction': v(false),
};
const FIELD = Object.fromEntries(Object.keys(SUPER).map((k) => [k, v(false)]));

const sheet = () => {
  const scopes = [{ id: 's' }];
  const lines = [{ id: 'l', scopeId: 's', kind: 'item', cost: 1000, markupMode: 'amt', markupAmt: 300, markupPct: null, pricing: 'fc' }];
  const gr = [{ id: 'g', base: 500, qty: 1, included: true, title: 'Supervision' }];
  const estimate = { grPct: 17, profitPct: 12, contingencyPct: 5, glPct: 1, discount: 10, designCost: 0, payments: [{ id: 'p', label: 'Deposit', mode: 'pct', value: 10 }] };
  const result = computeEstimate({ settings: estimate, scopes, lines, gr, payments: estimate.payments as any });
  return { estimate, scopes, lines, gr, result };
};

describe('K7: who sees which estimate money', () => {
  it('full access, and roles that set none of the data types, see everything', () => {
    expect(moneyRightsOf('all').full).toBe(true);
    expect(moneyRightsOf({ estimating: v(true) }).full).toBe(true);
    const s = sheet();
    expect(redactEstimate(s, moneyRightsOf('all'))).toBe(s);
  });

  it('a Super sees cost and line totals but no markup, GR, profit, contingency or totals', () => {
    const m = moneyRightsOf(SUPER);
    expect(m).toMatchObject({ full: false, cost: true, price: true, subtotal: true, markup: false, grDetail: false, grTotal: false, profit: false, contingency: false, total: false });
    const r = redactEstimate(sheet(), m);
    expect(r.lines[0]).toMatchObject({ cost: 1000, markupAmt: null });
    expect(r.result.lines[0]).toMatchObject({ cost: 100000, markup: null, price: 130000 });
    expect(r.result.scopes[0]).toMatchObject({ total: 130000, markup: null });
    expect(r.gr[0].base).toBeNull();
    expect(r.result.totals).toMatchObject({ subtotal: 130000, grTotal: null, gl: null, profit: null, contingency: null, totalBuild: null, totalProject: null, split: null });
    expect(r.estimate).toMatchObject({ grPct: null, glPct: null, profitPct: null, contingencyPct: null, discount: null });
    expect(r.estimate.payments[0].value).toBeNull();
  });

  it('a field role sees no amounts at all', () => {
    const r = redactEstimate(sheet(), moneyRightsOf(FIELD));
    const money = [r.lines[0].cost, r.lines[0].markupAmt, r.result.lines[0].price, r.result.scopes[0].total, r.result.totals.subtotal, r.result.totals.totalProject];
    expect(money.every((x) => x === null)).toBe(true);
  });

  it('a save from a restricted role keeps the stored amounts; new rows start at $0', () => {
    const stored = { lines: [{ id: 'l', cost: 1000, markupMode: 'amt', markupAmt: 300, markupPct: null, pricing: 'fc' }], gr: [{ id: 'g', base: 500, qty: 2, included: true }] };
    const lines: any[] = [{ id: 'l', cost: 0, markupMode: 'amt', markupAmt: 0, markupPct: null, pricing: 'nis' }, { id: 'n', cost: 999, markupMode: 'amt', markupAmt: 50, pricing: 'fc' }];
    const gr: any[] = [{ id: 'g', base: null, qty: 1, included: false }];
    keepStoredMoney(lines, gr, stored as any, moneyRightsOf(SUPER));
    expect(lines[0]).toMatchObject({ cost: 1000, markupAmt: 300, pricing: 'fc' });
    expect(lines[1]).toMatchObject({ cost: 0, markupAmt: 0 });
    expect(gr[0]).toMatchObject({ base: 500, qty: 2, included: true });
  });

  it('compare drops the fields and totals the caller cannot see', () => {
    const c: any = { counts: {}, scopes: [{ key: 's', status: 'changed', title: 'Demo', totalA: 1, totalB: 2, lines: [{ key: 'l', fields: [{ field: 'cost', a: 1, b: 2 }, { field: 'markup', a: 1, b: 2 }, { field: 'strategy', a: 'x', b: 'y' }], priceA: 1, priceB: 2 }] }],
      totals: [{ key: 'subtotal', a: 1, b: 2 }, { key: 'profit', a: 1, b: 2 }, { key: 'totalProject', a: 1, b: 2 }] };
    const r = redactCompare(c, moneyRightsOf(SUPER));
    expect(r.scopes[0].lines[0].fields.map((f: any) => f.field)).toEqual(['cost', 'strategy']);
    expect(r.totals.map((t: any) => t.key)).toEqual(['subtotal']);
  });
});
