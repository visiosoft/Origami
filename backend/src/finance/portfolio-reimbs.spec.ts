import { reimbursablesApprovedC } from './finance-hub.service';

describe('reimbursablesApprovedC', () => {
  it('sums billable approved and billed reimbursables (cost + markup) per project', () => {
    const m = reimbursablesApprovedC([
      { projectId: 1, status: 'approved', billable: true, cost: 100, markupPct: 10 },
      { projectId: 1, status: 'billed', billable: true, cost: 50, markupPct: 0 },
      { projectId: 1, status: 'submitted', billable: true, cost: 999, markupPct: 0 },
      { projectId: 1, status: 'rejected', billable: true, cost: 999, markupPct: 0 },
      { projectId: 1, status: 'approved', billable: false, cost: 999, markupPct: 0 },
      { projectId: 2, status: 'approved', cost: 20, markupPct: 0 },
    ]);
    expect(m.get(1)).toBe(16000);
    expect(m.get(2)).toBe(2000);
    expect(m.get(3)).toBeUndefined();
  });
});
