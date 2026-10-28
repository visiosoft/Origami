import { FinanceHubService } from './finance-hub.service';

describe('FinanceHubService.collections', () => {
  const month = (offset: number) => {
    const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 15));
    return x.toISOString().slice(0, 10);
  };
  const payments = [
    { date: month(0), amount: 1000, fxRate: 1 },
    { date: month(0), amount: 250.5, fxRate: 1 },
    { date: month(-1), amount: 100, fxRate: 1.1 },
    { date: month(-2), amount: 999, fxRate: 1, voidedAt: '2026-01-01' },
    { date: month(-12), amount: 5000, fxRate: 1 },
  ];
  const hub = new (FinanceHubService as any)(
    { need: async () => ({}) }, ...Array(15).fill(undefined), { find: async () => payments },
  ) as FinanceHubService;

  it('sums received money per month, oldest first, skipping voids and old months', async () => {
    const rows = await hub.collections({ id: 'U1', name: 'A' } as any, 3);
    expect(rows.map((r) => r.amount)).toEqual([0, 110, 1250.5]);
    expect(rows[2].month).toBe(month(0).slice(0, 7));
  });
});
