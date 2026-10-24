import { billingMonths } from './billing-months';

describe('dashboard billing by month', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const inv = (o: any) => ({ status: 'issued', kind: 'progress', fxRate: 1, ...o });
  it('invoiced, collected, and what is still open (past due vs within terms), credits taking away', () => {
    const rows = billingMonths([
      inv({ id: 'A', projectId: 1, issuedNumber: 'INV-1', invoiceDate: '2026-09-05', dueDate: '2026-10-05', total: 10000, retentionAmount: 1000 }),
      inv({ id: 'B', projectId: 2, invoiceDate: '2026-10-02', dueDate: '2026-11-01', total: 5000 }),
      inv({ id: 'C', projectId: 2, invoiceDate: '2026-10-03', total: 800, kind: 'credit' }),
      inv({ id: 'D', projectId: 1, invoiceDate: '2026-10-04', total: 999, status: 'draft' }),
      inv({ id: 'E', projectId: 1, invoiceDate: '2026-10-04', total: 777, voidedAt: '2026-10-05' }),
    ], [
      { invoiceId: 'A', date: '2026-09-20', amount: 4000 },
      { invoiceId: 'A', date: '2026-10-10', amount: 1000 },
      { invoiceId: 'B', date: '2026-10-11', amount: 300, voidedAt: '2026-10-12' },
    ], { months: 2, today: '2026-10-20', projectName: (id) => `P${id}`, now });
    expect(rows.map((r) => r.month)).toEqual(['2026-09', '2026-10']);
    expect(rows[0]).toMatchObject({ invoiced: 10000, collected: 4000, pastDue: 5000, withinTerms: 0, retention: 1000 });
    expect(rows[0].open).toEqual([{ id: 'A', number: 'INV-1', projectId: 1, project: 'P1', dueDate: '2026-10-05', unpaid: 5000, pastDue: true }]);
    expect(rows[1]).toMatchObject({ invoiced: 4200, collected: 1000, pastDue: 0, withinTerms: 5000 });
  });
});
