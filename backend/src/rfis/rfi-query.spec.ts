import { queryRfis } from './rfi-query';

describe('RFI log query', () => {
  const today = '2026-10-28';
  const rows = [
    { id: '1', number: 'RFI-001', subject: 'Header size', status: 'open', dateSent: '2026-10-20', dateDue: '2026-10-25', projectName: 'Narvaes', to: { name: 'Ana', company: 'Struct Co' } },
    { id: '2', number: 'RFI-002', subject: 'Tile spec', status: 'answered', dateSent: '2026-10-10', dateAnswered: '2026-10-12', projectName: 'Narvaes' },
    { id: '3', number: 'RFI-003', subject: 'Old one', status: 'closed', dateSent: '2026-09-01', dateClosed: '2026-09-05', projectName: 'Chelliah', costImpact: 'yes' },
    { id: '4', number: 'RFI-004', subject: 'Draft', status: 'draft', projectName: 'Chelliah', costImpact: 'yes' },
  ];
  it('pages the not-closed RFIs and counts every RFI', () => {
    const r = queryRfis(rows, { today, size: 2 });
    expect(r.total).toBe(3);
    expect(r.rows.map((x) => x.id)).toEqual(['1', '2']);
    expect(r.counts).toEqual({ open: 1, overdue: 1, answered: 1 });
    expect(r.stats).toEqual({ draft: 1, avg: 5, cost: 1, closed: 1 });
  });
  it('searches the recipient and sorts by days open', () => {
    expect(queryRfis(rows, { today, q: 'struct' }).rows.map((x) => x.id)).toEqual(['1']);
    expect(queryRfis(rows, { today, status: 'all', sort: 'days', dir: 'desc' }).rows.map((x) => x.id)).toEqual(['1', '3', '2', '4']);
  });
});
