import { fundingSummary } from './funding';
import { FundingService } from './funding.service';

describe('funding summary', () => {
  it('shows each source’s approved, invoiced, paid and left, and the gap against the contract', () => {
    // The example from the meeting: $667,000 contract, $593,000 funded → $74,000 to cover.
    const s = fundingSummary(
      [{ id: 'L', kind: 'loan', name: 'Bank loan', approvedC: 50000000 }, { id: 'O', kind: 'owner_cash', name: 'Owner', approvedC: 9300000 }],
      [{ id: 'i1', fundingSourceId: 'L', totalC: 12000000, paidC: 10000000 }, { id: 'i2', fundingSourceId: 'O', totalC: 9400000, paidC: 0 }, { id: 'i3', fundingSourceId: null, totalC: 500000, paidC: 0 }, { id: 'c1', fundingSourceId: 'L', totalC: -100000, paidC: 0 }],
      [{ id: 'co1', fundingSourceId: 'O', amountC: 250000 }],
      66700000,
    );
    expect(s.approvedC).toBe(59300000);
    expect(s.gapC).toBe(7400000);
    expect(s.sources[0]).toMatchObject({ invoicedC: 11900000, paidC: 10000000, leftC: 38100000, over: false });
    expect(s.sources[1]).toMatchObject({ invoicedC: 9400000, leftC: -100000, over: true, changesC: 250000 });
    expect(s.unassignedInvoicedC).toBe(500000);
    expect(s.unassignedCount).toBe(1);
  });

  it('with no sources everything is unassigned and the whole contract is the gap', () => {
    const s = fundingSummary([], [{ id: 'i1', fundingSourceId: null, totalC: 100, paidC: 0 }], [], 1000);
    expect(s).toMatchObject({ approvedC: 0, gapC: 1000, unassignedInvoicedC: 100 });
  });
});

const match = (r: any, w: any) => !w || Object.entries(w).every(([k, v]) => r[k] === v);
const repo = (rows: any[]) => ({
  rows,
  find: async (o?: any) => rows.filter((r) => match(r, o?.where)),
  findOneBy: async (w: any) => rows.find((r) => match(r, w)) || null,
  count: async (o?: any) => rows.filter((r) => match(r, o?.where)).length,
  save: async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = { ...rows[i], ...x }; else rows.push(x); return x; },
  update: async (w: any, patch: any) => { rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, patch)); },
  delete: async (w: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], w)) rows.splice(i, 1); },
});

function setup(manage = true) {
  const sources: any[] = [];
  const invoices = [
    { id: 'I1', projectId: 23, status: 'issued', kind: 'progress', issuedNumber: 'INV-1', total: 1200, fundingSourceId: null },
    { id: 'I2', projectId: 23, status: 'draft', kind: 'progress', total: 999, fundingSourceId: null },
    { id: 'I3', projectId: 23, status: 'issued', kind: 'credit', total: 200, creditForInvoiceId: 'I1', fundingSourceId: null },
    { id: 'X', projectId: 99, status: 'issued', kind: 'progress', total: 5, fundingSourceId: null },
  ];
  const payments = [{ invoiceId: 'I1', projectId: 23, amount: 700 }, { invoiceId: 'I1', projectId: 23, amount: 100, voidedAt: 'x' }];
  const cos = [{ id: 'CO1', projectId: 23, number: 'CO-001', title: 'ADU deck', status: 'approved', amount: 300, fundingSourceId: null }];
  const fin: any = {
    need: async (_a: any, r: string) => { if (r === 'manage' && !manage) throw new Error('no manage'); return { view: true, manage }; },
    project: async () => ({ id: 23 }),
    context: async () => ({ input: {} }),
    log: async () => undefined,
  };
  const svc = new FundingService(repo(sources) as any, repo(invoices) as any, repo(payments) as any, repo(cos) as any, fin);
  return { svc, sources, invoices, cos };
}
jest.mock('./finance.calc', () => ({ computeSov: () => ({ summary: { revisedContractC: 200000 } }) }));
const actor = { name: 'Bea' } as any;

describe('FundingService', () => {
  it('adds sources, tags invoices and change orders, and counts payments and credits against the right source', async () => {
    const { svc, invoices } = setup();
    let v = await svc.save(23, { kind: 'loan', name: 'Bank loan', approvedAmount: 1500 }, actor);
    const id = v.sources[0].id;
    expect(v).toMatchObject({ approved: 1500, revisedContract: 2000, gap: 500, unassignedCount: 2 });
    expect(v.invoices.map((i) => i.id)).toEqual(['I1']); // issued, not credit, this project
    v = await svc.assign(23, { invoiceId: 'I1', fundingSourceId: id }, actor);
    v = await svc.assign(23, { changeOrderId: 'CO1', fundingSourceId: id }, actor);
    expect(v.sources[0]).toMatchObject({ invoiced: 1000, paid: 700, left: 500, changeOrders: 300 });
    expect(v.unassignedCount).toBe(0);
    await expect(svc.assign(23, { invoiceId: 'X', fundingSourceId: id }, actor)).rejects.toThrow(/not found/);
    v = await svc.remove(id, actor);
    expect(v.sources).toEqual([]);
    expect(invoices[0].fundingSourceId).toBeNull();
  });

  it('checks the input and needs the manage right', async () => {
    const { svc } = setup();
    await expect(svc.save(23, { kind: 'grant', name: 'x', approvedAmount: 1 }, actor)).rejects.toThrow(/loan, owner cash/);
    await expect(svc.save(23, { kind: 'loan', name: '', approvedAmount: 1 }, actor)).rejects.toThrow(/Name/);
    await expect(svc.save(23, { kind: 'loan', name: 'x', approvedAmount: -1 }, actor)).rejects.toThrow(/amount/);
    await expect(setup(false).svc.save(23, { kind: 'loan', name: 'x', approvedAmount: 1 }, actor)).rejects.toThrow(/manage/);
  });
});
