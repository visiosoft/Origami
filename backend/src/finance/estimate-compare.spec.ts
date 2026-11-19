import { compareEstimates, redactAcross } from './estimate-compare';

describe('compare estimates across a project (Nov 19)', () => {
  const a = { id: 'A', label: 'EST-001 Rev 1', scopes: [{ csiCodeId: 'c10', csiLabel: '10 — Signage', title: 'Signage', low: 100000, high: 2500000 }, { title: 'Demo', low: 100000, high: 1500000 }], totalLow: 200000, totalHigh: 4000000 };
  const b = { id: 'B', label: 'EST-002 Rev 1', scopes: [{ csiCodeId: 'c10', csiLabel: '10 — Signage', title: 'Signs', low: 1000000, high: 2500000 }, { title: 'Exterior dining', low: 400000, high: 500000 }], totalLow: 1400000, totalHigh: 3000000 };
  it('lines trades up by CSI code (title when none), with the change between neighbours', () => {
    const c = compareEstimates([a, b]);
    expect(c.rows.map((r) => r.label)).toEqual(['10 — Signage', 'Demo', 'Exterior dining']);
    expect(c.rows[0].changes[0]).toEqual({ low: 900000, high: 0 });
    expect(c.rows[1].cells[1]).toBeNull();
    expect(c.rows[1].changes[0]).toEqual({ low: -100000, high: -1500000 });
    expect(c.totalChanges[0]).toEqual({ low: 1200000, high: -1000000 });
  });
  it('hides the money from roles that can’t see prices', () => {
    const r = redactAcross(compareEstimates([a, b]), false);
    expect(r.rows[0].cells[0]).toBeNull();
    expect(r.totals[0]).toBeNull();
    expect(r.rows.length).toBe(3);
  });
});
