import { ProjectSubsService, expiryState } from './project-subs.service';

const repo = (rows: any[]) => ({ find: async (o?: any) => rows.filter((r) => !o?.where || Object.entries(o.where).every(([k, v]) => r[k] === v)) });

function setup(money: boolean) {
  const cos = [
    { id: 'c1', projectId: 23, number: 'SC-001', type: 'subcontract', title: 'Framing', status: 'approved', contractorId: 'K1' },
    { id: 'c2', projectId: 23, number: 'PO-001', type: 'purchase_order', title: 'Lumber', status: 'draft', vendorName: 'Home Depot' },
    { id: 'c3', projectId: 23, number: 'SC-002', type: 'subcontract', title: 'Old', status: 'void', contractorId: 'K2' },
  ];
  const lines = [{ commitmentId: 'c1', projectId: 23, amount: 12000 }, { commitmentId: 'c2', projectId: 23, amount: 800 }];
  const entries = [{ commitmentId: 'c1', projectId: 23, amount: 4000, status: 'approved' }, { commitmentId: 'c1', projectId: 23, amount: 999, status: 'void' }];
  const contractors = [
    { id: 'K1', companyName: 'Ortiz Framing', contactPerson: 'Luis Ortiz', phone: '555-0101', email: 'luis@ortiz.test', tradeIds: ['T1'], licenseExpiry: '2020-01-01', insuranceExpiry: '2099-01-01', status: 'active', userId: 'u9', personId: 5 },
    { id: 'K2', companyName: 'Voided Co', status: 'active' },
  ];
  const people = [
    { id: 5, kind: 'Sub', name: 'Luis Ortiz', company: 'Ortiz Framing', projects: ["Aquino's Remodel"] },
    { id: 6, kind: 'Sub', name: 'Ana Ruiz', company: 'Ruiz Electric', role: 'Electrician', projects: ["Aquino's Remodel"] },
    { id: 7, kind: 'Client', name: 'Maria', projects: ["Aquino's Remodel"] },
  ];
  const trades = [{ id: 'T1', code: 'C-5', name: 'Framing and Rough Carpentry' }];
  const fin: any = { project: async () => ({ id: 23, name: "Aquino's Remodel" }), rights: async () => ({ viewProfitability: money, manageCosts: money }) };
  return new ProjectSubsService(repo(cos) as any, repo(lines) as any, repo(entries) as any, repo(contractors) as any, repo(people) as any, repo(trades) as any, fin);
}

const actor = { name: 'George', roleKey: 'site_super' };

describe('project subcontractors', () => {
  it('lists each company with its subcontracts, contact, trades, licence and insurance state', async () => {
    const out = await setup(true).list(23, actor);
    expect(out.rows.map((r) => r.company)).toEqual(['Home Depot', 'Ortiz Framing']);
    const ortiz = out.rows.find((r) => r.company === 'Ortiz Framing')!;
    expect(ortiz).toMatchObject({ contactPerson: 'Luis Ortiz', trades: ['C-5 Framing and Rough Carpentry'], licenseState: 'expired', insuranceState: 'ok', portal: true });
    expect(ortiz.subcontracts).toEqual([{ id: 'c1', number: 'SC-001', type: 'subcontract', title: 'Framing', status: 'approved', total: 12000, billed: 4000, remaining: 8000 }]);
  });

  it('void subcontracts drop out; People subs on the project without one are listed separately', async () => {
    const out = await setup(true).list(23, actor);
    expect(out.rows.some((r) => r.company === 'Voided Co')).toBe(false);
    expect(out.unlinked.map((p) => p.name)).toEqual(['Ana Ruiz']);
  });

  it('staff without cost rights see the subs but not the money', async () => {
    const out = await setup(false).list(23, actor);
    expect(out.canSeeMoney).toBe(false);
    expect(out.rows.find((r) => r.company === 'Ortiz Framing')!.subcontracts[0]).not.toHaveProperty('total');
  });

  it('expiry: expired, within 30 days, fine, or not on file', () => {
    expect(expiryState('2026-09-01', '2026-09-26')).toBe('expired');
    expect(expiryState('2026-10-10', '2026-09-26')).toBe('soon');
    expect(expiryState('2027-01-01', '2026-09-26')).toBe('ok');
    expect(expiryState('', '2026-09-26')).toBe('');
  });
});
