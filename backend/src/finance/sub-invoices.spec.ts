import { In } from 'typeorm';
import { invoiceFigures, payBlock, retentionBlock, unconditionalWaiting } from './sub-invoices';
import { SubInvoicesService } from './sub-invoices.service';

/** In-memory repo: where with plain values or In([...]). */
const match = (r: any, where: any) => !where || Object.entries(where).every(([k, v]: [string, any]) => (v && typeof v === 'object' && Array.isArray(v._value) ? v._value.includes(r[k]) : r[k] === v));
const repo = (rows: any[]) => ({
  rows,
  find: async (o?: any) => rows.filter((r) => match(r, o?.where)),
  findOne: async (o?: any) => rows.find((r) => match(r, o?.where)) || null,
  findOneBy: async (w: any) => rows.find((r) => match(r, w)) || null,
  save: async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = { ...rows[i], ...x }; else rows.push(x); return x; },
});

function setup(rightsOn = true) {
  const cms = [{ id: 'c1', projectId: 23, number: 'SC-001', contractorId: 'K1', status: 'approved', retentionPct: null, retentionPaidDate: null, retentionPaymentRef: null }];
  const entries = [
    { id: 'e1', projectId: 23, commitmentId: 'c1', contractorId: 'K1', batchId: 'B1', source: 'portal', amount: 6000, status: 'approved', date: '2026-11-01' },
    { id: 'e2', projectId: 23, commitmentId: 'c1', contractorId: 'K1', batchId: 'B1', source: 'portal', amount: 4000.5, status: 'approved', date: '2026-11-01' },
    { id: 'e3', projectId: 23, commitmentId: 'c1', contractorId: 'K1', batchId: 'B2', source: 'portal', amount: 2000, status: 'void', date: '2026-11-05' },
  ];
  const releases: any[] = [];
  const invoices = repo([]);
  const logs: any[] = [];
  const fin: any = {
    rights: async () => ({ viewProfitability: rightsOn, manageCosts: rightsOn, approveCosts: rightsOn }),
    need: async (_a: any, right: string) => { if (!rightsOn) throw new Error(`no ${right}`); },
    log: async (_m: any, x: any) => { logs.push(x); },
  };
  const attachments: any = { upload: async (files: any[]) => files.map((f) => ({ id: 'F-' + f.originalname, name: f.originalname })) };
  const svc = new SubInvoicesService(invoices as any, repo(releases) as any, repo(cms) as any, repo(entries) as any, repo([{ id: 'K1', companyName: 'Ortiz Framing' }, { id: 'K2', companyName: 'Other' }]) as any, fin, attachments);
  return { svc, releases, cms, logs };
}
const actor = { name: 'Bea', roleKey: 'bookkeeper' } as any;
const file = (n: string) => ({ originalname: n, buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 });

describe('sub invoices: the maths and rules', () => {
  it('holds retention per invoice: 10% by default, in cents', () => {
    expect(invoiceFigures([600000, 400050], null)).toEqual({ grossC: 1000050, retentionC: 100005, netC: 900045, pct: 10 });
    expect(invoiceFigures([10001], 5)).toEqual({ grossC: 10001, retentionC: 500, netC: 9501, pct: 5 });
  });

  it('pay waits for a checked conditional release', () => {
    expect(payBlock([])).toMatch(/conditional lien release/);
    expect(payBlock([{ kind: null, checkedAt: null }])).toMatch(/mark its type/);
    expect(payBlock([{ kind: 'unconditional_progress', checkedAt: 'x' }])).toMatch(/conditional/);
    expect(payBlock([{ kind: 'conditional_progress', checkedAt: 'x' }])).toBeNull();
    expect(unconditionalWaiting(true, [{ kind: 'conditional_progress', checkedAt: 'x' }])).toBe(true);
    expect(unconditionalWaiting(true, [{ kind: 'unconditional_progress', checkedAt: 'x' }])).toBe(false);
  });

  it('retention is paid out only against a checked conditional final release, once', () => {
    expect(retentionBlock(0, [], false)).toMatch(/No retention/);
    expect(retentionBlock(500, [{ kind: 'conditional_progress', checkedAt: 'x' }], false)).toMatch(/final/);
    expect(retentionBlock(500, [{ kind: 'conditional_final', checkedAt: 'x' }], false)).toBeNull();
    expect(retentionBlock(500, [{ kind: 'conditional_final', checkedAt: 'x' }], true)).toMatch(/already/);
  });
});

describe('SubInvoicesService', () => {
  it('builds each invoice with gross, retention and net; a fully void one shows as returned', async () => {
    const { svc, cms } = setup();
    const out = await svc.forCommitments(cms as any);
    const b1 = out.invoices.find((i) => i.id === 'B1')!;
    expect(b1).toMatchObject({ gross: 10000.5, retentionPct: 10, retention: 1000.05, net: 9000.45, status: 'approved' });
    expect(b1.payBlock).toMatch(/conditional/);
    expect(out.invoices.find((i) => i.id === 'B2')!.status).toBe('returned');
    expect(out.retention[0]).toMatchObject({ held: 1000.05 });
  });

  it('pay is blocked until the bookkeeper marks the uploaded release as conditional', async () => {
    const { svc, releases } = setup();
    const e = { batchId: 'B1', source: 'portal' } as any;
    await expect(svc.assertPayable(e)).rejects.toThrow(/conditional/);
    await svc.uploadRelease({ id: 'K1' } as any, { invoiceId: 'B1' }, [file('cond.pdf')], 'nonsense', { name: 'Ortiz (portal)' } as any);
    expect(releases[0]).toMatchObject({ invoiceId: 'B1', kind: null, file: { name: 'cond.pdf' } });
    await expect(svc.assertPayable(e)).rejects.toThrow(/mark its type/);
    await svc.markRelease(releases[0].id, { kind: 'conditional_progress', amount: 9000.45, throughDate: '2026-11-01' }, actor);
    await expect(svc.assertPayable(e)).resolves.toBeUndefined();
    // Staff-entered (non-portal) costs are not held up.
    await expect(svc.assertPayable({ batchId: null, source: 'manual' } as any)).resolves.toBeUndefined();
  });

  it('a sub cannot attach a release to another sub’s invoice or subcontract', async () => {
    const { svc } = setup();
    await expect(svc.uploadRelease({ id: 'K2' } as any, { invoiceId: 'B1' }, [file('x.pdf')], undefined, { name: 'x' } as any)).rejects.toThrow(/not found/);
    await expect(svc.uploadRelease({ id: 'K2' } as any, { commitmentId: 'c1' }, [file('x.pdf')], undefined, { name: 'x' } as any)).rejects.toThrow(/not found/);
  });

  it('retention release needs a checked conditional final, then records the payment once', async () => {
    const { svc, releases, cms, logs } = setup();
    await expect(svc.releaseRetention('c1', {}, actor)).rejects.toThrow(/conditional final/);
    await svc.uploadRelease({ id: 'K1' } as any, { commitmentId: 'c1' }, [file('final.pdf')], 'conditional_final', { name: 'Ortiz (portal)' } as any);
    await expect(svc.releaseRetention('c1', {}, actor)).rejects.toThrow(/conditional final/); // not checked yet
    await svc.markRelease(releases[0].id, { kind: 'conditional_final' }, actor);
    const r = await svc.releaseRetention('c1', { paidDate: '2026-11-20', paymentRef: 'CHK 1042' }, actor);
    expect(r.held).toBe(1000.05);
    expect(cms[0]).toMatchObject({ retentionPaidDate: '2026-11-20', retentionPaymentRef: 'CHK 1042' });
    expect(logs.some((l) => l.action === 'retention_paid')).toBe(true);
    await expect(svc.releaseRetention('c1', {}, actor)).rejects.toThrow(/already/);
  });

  it('marking a release and changing retention need the approve-costs right', async () => {
    const { svc } = setup(false);
    await expect(svc.setRetention('B1', 5, actor)).rejects.toThrow(/approveCosts/);
    const ok = setup(true);
    await expect(ok.svc.setRetention('B1', 80, actor)).rejects.toThrow(/0 to 50/);
    expect((await ok.svc.setRetention('B1', 5, actor)).retentionPct).toBe(5);
  });

  it('In() is what the service uses to scope by subcontract', () => {
    expect(In(['c1'])).toHaveProperty('_value', ['c1']);
  });
});
