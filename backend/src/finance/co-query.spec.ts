import { queryChangeOrders } from './co-query';

describe('change order log query', () => {
  const rows = [
    { id: 'a', number: 'CO-001', title: 'Kitchen upgrade', status: 'draft', total: 1200, projectName: 'Narvaes', reason: 'client_request' },
    { id: 'b', number: 'CO-002', title: 'Footing', status: 'approved', total: 5000.5, projectName: 'Narvaes', reason: 'unforeseen' },
    { id: 'c', number: 'CO-003', title: 'Tile', status: 'submitted', total: 800, projectName: 'Chelliah', reason: 'allowance' },
    { id: 'd', number: 'CO-004', title: 'Dropped', status: 'cancelled', total: 100, projectName: 'Chelliah', reason: 'other' },
  ];
  it('filters, sorts and pages, with summary cards for everything', () => {
    const r = queryChangeOrders(rows, { status: 'all', sort: 'amount', dir: 'desc', size: '2' });
    expect(r.rows.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r.pages).toBe(2);
    expect(r.summary).toEqual({ pending: { total: 1200, count: 1 }, submitted: { total: 800, count: 1 }, approved: { total: 5000.5, count: 1 }, closed: { total: 100, count: 1 } });
    expect(queryChangeOrders(rows, { status: 'pending' }).rows.map((x) => x.id)).toEqual(['a']);
    expect(queryChangeOrders(rows, { q: 'chelliah' }).total).toBe(2);
    expect(queryChangeOrders(rows, { sort: 'reason' }).rows.map((x) => x.id)).toEqual(['c', 'a', 'd', 'b']);
  });
});
