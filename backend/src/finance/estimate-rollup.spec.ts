import { redactRollup, rollupEstimates, type RollEstimate } from './estimate-rollup';

const T = (o: Partial<RollEstimate['totals']>) => ({ subtotal: 0, grTotal: 0, gl: 0, profit: 0, contingency: 0, discount: 0, designCost: 0, totalProject: 0, high: 0, ...o });
const main: RollEstimate = {
  id: 'e1', label: 'EST-001 Rev 2 · Main house', structureKey: 'main', structureName: 'Main house', fundingSourceId: 'bank', fundingName: 'Bank loan',
  scopes: [{ csiCodeId: 'c03', csiLabel: '03 — Concrete', title: 'Foundation', low: 100000, high: 120000 }, { csiCodeId: 'c26', csiLabel: '26 — Electrical', title: 'Electrical', low: 50000, high: 50000 }],
  totalLow: 200000, totalHigh: 230000, totals: T({ subtotal: 150000, grTotal: 20000, profit: 30000, totalProject: 200000, high: 230000 }),
};
const adu: RollEstimate = {
  id: 'e2', label: 'EST-002 Rev 1 · ADU', structureKey: 'adu', structureName: 'ADU', fundingSourceId: 'owner', fundingName: 'Owner cash',
  scopes: [{ csiCodeId: 'c26', csiLabel: '26 — Electrical', title: 'Electrical', low: 20000, high: 25000 }, { csiCodeId: null, title: 'Landscaping', low: 5000, high: 5000 }],
  totalLow: 40000, totalHigh: 45000, totals: T({ subtotal: 25000, grTotal: 5000, profit: 10000, discount: 0, totalProject: 40000, high: 45000 }),
};

describe('estimate roll-up (Edward p30)', () => {
  it('adds the estimates up trade by trade, with the estimate-level lines and the project total', () => {
    const r = rollupEstimates([main, adu]);
    expect(r.rows.map((x) => [x.label, x.cells.map((c) => c?.low ?? null), x.total.low])).toEqual([
      ['03 — Concrete', [100000, null], 100000],
      ['26 — Electrical', [50000, 20000], 70000],
      ['Landscaping', [null, 5000], 5000],
    ]);
    expect(r.rows.find((x) => x.label === '26 — Electrical')!.total.high).toBe(75000);
    expect(r.lines.map((l) => [l.key, l.total])).toEqual([['subtotal', 175000], ['grTotal', 25000], ['profit', 40000]]);
    expect(r.total).toEqual({ low: 240000, high: 275000 });
  });

  it('subtotals by building and by who pays, only when they differ', () => {
    const r = rollupEstimates([main, adu]);
    expect(r.byBuilding.map((g) => [g.label, g.total.low])).toEqual([['Main house', 200000], ['ADU', 40000]]);
    expect(r.byFunding.map((g) => [g.label, g.total.low])).toEqual([['Bank loan', 200000], ['Owner cash', 40000]]);
    const sameBuilding = rollupEstimates([main, { ...adu, structureKey: 'main', structureName: 'Main house' }]);
    expect(sameBuilding.byBuilding).toEqual([]);
    expect(sameBuilding.byFunding).toHaveLength(2);
  });

  it('blanks the money without price rights, keeping the trades and groups', () => {
    const r = redactRollup(rollupEstimates([main, adu]), false);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0].cells).toEqual([null, null]);
    expect(r.total).toBeNull();
    expect(r.byBuilding.map((g) => [g.label, g.total])).toEqual([['Main house', null], ['ADU', null]]);
  });
});
