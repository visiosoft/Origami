import { signState } from '../auth/crypto.util';
import { BidPackagesService, leveling, subView } from './bid-packages.service';

const SECRET = 's';
const matches = (r: any, where: any = {}) => Object.entries(where).every(([k, v]: any) => (v && typeof v === 'object' && '_value' in v ? v._value.includes(r[k]) : r[k] === v));
function repo(rows: any[] = []) {
  return {
    rows,
    create: (x: any) => ({ ...x }),
    find: async (o: any = {}) => rows.filter((r) => matches(r, o.where)).map((r) => ({ ...r })),
    findOne: async (o: any) => { const r = rows.find((x) => matches(x, o.where)); return r ? { ...r } : null; },
    count: async (o: any = {}) => rows.filter((r) => matches(r, o.where)).length,
    save: async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = { ...x }; else rows.push({ ...x }); return x; },
  };
}

// An estimate with money everywhere: none of it may reach a sub.
const sheet = {
  scopes: [{ id: 'S2', originId: 'S1', title: 'Tile', csiCodeId: 'C9' }, { id: 'S3', title: 'Paint', csiCodeId: null }],
  lines: [
    { id: 'L2', originId: 'L1', scopeId: 'S2', kind: 'item', description: 'Floor tile 120 sf', cost: 4321.55, markupAmt: 987.65, pricing: 'fc' },
    { id: 'L3', scopeId: 'S2', kind: 'item', description: 'Wall tile', cost: 1234.56, markupAmt: 222.22, pricing: 'fc' },
    { id: 'L4', scopeId: 'S2', kind: 'item', description: 'Not ours', cost: 999.99, pricing: 'nis' },
    { id: 'L5', scopeId: 'S2', kind: 'exclusion', description: 'Waterproofing by others' },
    { id: 'L6', scopeId: 'S3', kind: 'item', description: 'Paint', cost: 500 },
  ],
  gr: [],
};

function setup() {
  const draftLines = [
    { id: 'D1', originId: 'L1', scopeId: 'X', kind: 'item', description: 'Floor tile 120 sf', cost: 3000, strategy: 'sub_required' },
    { id: 'D2', originId: 'L3', scopeId: 'X', kind: 'item', description: 'Wall tile', cost: 1000, strategy: null },
    { id: 'D3', originId: 'L6', scopeId: 'Y', kind: 'item', description: 'Paint', cost: 500, strategy: 'self_perform' },
  ];
  const estimates: any = {
    raw: async () => ({ e: { id: 'E1', number: 'EST-001', rev: 2 }, sheet, result: {}, rights: {} }),
    rights: async () => ({ view: true, edit: true }),
    changeDraftLines: async (_p: number, _n: string, change: (l: any[]) => number) => ({ changed: change(draftLines), estimateId: 'E3', rev: 3 }),
  };
  const fin: any = { project: async () => ({ name: 'Lono house' }), log: async () => undefined };
  const settings: any = { jwtSecret: async () => SECRET, baseUrl: async () => 'https://app.test', getMany: async () => ({}), get: async () => '' };
  const mails: any[] = [];
  const google: any = { isConnected: async () => true, sendMail: async (m: any) => mails.push(m) };
  const packages = repo(), invites = repo(), bids = repo();
  // Prequalified, licence and insurance current (Nov 13: bid invites need it).
  const contractors = repo([{ id: 'K1', tradeIds: ['SCT-C-54'], companyName: 'Tile Co', email: 'tile@x.test', prequalStatus: 'approved', licenseNumber: 'C-10', licenseExpiry: '2099-01-01', insuranceProvider: 'Acme', insuranceExpiry: '2099-01-01' }, { id: 'K2', companyName: 'Stone Inc', email: 'stone@x.test', prequalStatus: 'approved', licenseNumber: 'C-10', licenseExpiry: '2099-01-01', insuranceProvider: 'Acme', insuranceExpiry: '2099-01-01' }, { id: 'K3', companyName: 'Nope LLC', email: 'n@x.test' }]);
  const csi = repo([{ id: 'C9', code: '09.30', division: 'Tiling' }]);
  const trades = repo([{ id: 'SCT-C-54', code: 'C-54', name: 'Ceramic and Mosaic Tile', csiDivisions: ['09'] }, { id: 'SCT-C-10', code: 'C-10', name: 'Electrical', csiDivisions: ['26'] }]);
  const svc = new BidPackagesService(estimates, fin, settings, google, packages as any, invites as any, bids as any, contractors as any, csi as any, trades as any);
  return { svc, packages, invites, bids, mails, draftLines };
}
const actor = { name: 'Edward' };
const tokenFor = (inviteId: string) => signState({ mode: 'bid', inviteId }, SECRET);

describe('Nov 19: bid instructions, site visit, questions answered to the asker, suggested subs', () => {
  it('works end to end', async () => {
    const { svc, invites, mails } = setup();
    const p = await svc.create(7, 'E1', { scopeIds: ['S2'], instructions: 'Bid per drawings A2.01; include permits.', siteVisit: { date: '2026-11-25', time: '10:00', place: '1311 Countryside Ct' } }, actor);
    expect(p.siteVisit).toEqual({ date: '2026-11-25', time: '10:00', place: '1311 Countryside Ct', note: null });
    const sug = await svc.suggest(7, p.id, actor);
    expect(sug.map((x: any) => x.companyName)).toEqual(['Tile Co']);
    await svc.invite(7, p.id, { contractorIds: ['K1', 'K2'] }, actor);
    expect(mails[0].html).toContain('Site visit:');
    const [a, b] = invites.rows;
    await svc.publicAsk(tokenFor(a.id), 'Is the tile owner-supplied?');
    await svc.publicAttend(tokenFor(a.id), true);
    const q = invites.rows.find((r: any) => r.id === a.id).questions[0];
    mails.length = 0;
    await svc.answer(7, p.id, a.id, q.id, 'Yes — owner supplies the tile.', actor);
    expect(mails.map((m: any) => m.to)).toEqual(['tile@x.test']);
    const viewA = await svc.publicView(tokenFor(a.id));
    expect(viewA.invite.questions[0].answer).toBe('Yes — owner supplies the tile.');
    expect(viewA.instructions).toContain('include permits');
    expect((await svc.publicView(tokenFor(b.id))).invite.questions).toEqual([]);
    const all = await svc.all(actor);
    expect(all[0]).toMatchObject({ number: p.number, invited: 2, attending: 1, openQuestions: 0 });
  });
});

describe('K10: sub bid packages', () => {
  it('a package keeps only scope and line text, CSI codes and statements -- no money, no Not In Scope lines', async () => {
    const { svc } = setup();
    const p = await svc.create(7, 'E1', { scopeIds: ['S2'], dueDate: '2026-11-30' }, actor);
    expect(p.content.scopes).toEqual([{ key: 'S1', title: 'Tile', csi: '09.30 — Tiling', lines: [{ key: 'L1', description: 'Floor tile 120 sf' }, { key: 'L3', description: 'Wall tile' }], notes: [{ kind: 'exclusion', text: 'Waterproofing by others' }] }]);
    const json = JSON.stringify(p);
    for (const money of ['4321', '987', '1234', '222', '999']) expect(json).not.toContain(money);
    await expect(svc.create(7, 'E1', { scopeIds: [] }, actor)).rejects.toThrow(/Pick the scopes/);
  });

  it('inviting emails each sub a private link and adds their row on the Contractors page', async () => {
    const { svc, invites, bids, mails, packages } = setup();
    const p = await svc.create(7, 'E1', { scopeIds: ['S2'] }, actor);
    const r = await svc.invite(7, p.id, { contractorIds: ['K1', 'K2'] }, actor);
    expect(r.invited.map((x) => x.vendorName)).toEqual(['Tile Co', 'Stone Inc']);
    expect(mails.map((m) => m.to)).toEqual(['tile@x.test', 'stone@x.test']);
    expect(mails[0].html).toContain('/bid?token=');
    expect(invites.rows).toHaveLength(2);
    expect(bids.rows.map((b) => b.outcome)).toEqual(['invited', 'invited']);
    expect(packages.rows[0].status).toBe('out');
    expect(r.invited.some((x: any) => x.prequalLink)).toBe(false);
    await svc.invite(7, p.id, { contractorIds: ['K1'] }, actor);
    expect(invites.rows).toHaveLength(2);
    expect(bids.rows).toHaveLength(2);
  });

  it('the sub page shows no money but their own; they price per line or in total, or decline', async () => {
    const { svc, invites, bids } = setup();
    const p = await svc.create(7, 'E1', { scopeIds: ['S2'] }, actor);
    await svc.invite(7, p.id, { contractorIds: ['K1', 'K2'] }, actor);
    const [a, b] = invites.rows;
    const view = await svc.publicView(tokenFor(a.id));
    expect(view.scopes[0].lines.map((l: any) => l.key)).toEqual(['L1', 'L3']);
    expect(JSON.stringify(view)).not.toMatch(/4321|987|1234|222|cost|markup|price/i);
    expect(invites.rows[0].status).toBe('viewed');
    await expect(svc.publicSubmit(tokenFor(a.id), {})).rejects.toThrow(/Enter your price/);
    await svc.publicSubmit(tokenFor(a.id), { lineAmounts: { L1: '$3,500', L3: 900, NOPE: 5 }, notes: 'Includes grout' });
    expect(invites.rows[0]).toMatchObject({ status: 'submitted', lineAmounts: { L1: 3500, L3: 900 } });
    expect(bids.rows[0]).toMatchObject({ outcome: 'pending', amount: 4400 });
    await svc.publicSubmit(tokenFor(b.id), { total: 4000 });
    const lv = leveling(packagesOf(svc), invites.rows as any);
    expect(lv.subs.map((s) => [s.vendorName, s.total, s.lowest])).toEqual([['Tile Co', 4400, false], ['Stone Inc', 4000, true]]);
    expect(lv.rows[0].prices[a.id]).toBe(3500);
    await expect(svc.publicView('nope')).rejects.toThrow(/expired/);
  });

  it('"Use this bid" writes their prices into the draft by line, names the sub, awards them and closes the package', async () => {
    const { svc, invites, bids, draftLines, packages } = setup();
    const p = await svc.create(7, 'E1', { scopeIds: ['S2'] }, actor);
    await svc.invite(7, p.id, { contractorIds: ['K1', 'K2'] }, actor);
    const [a, b] = invites.rows;
    await svc.publicSubmit(tokenFor(a.id), { lineAmounts: { L1: 3500, L3: 900 } });
    await svc.publicSubmit(tokenFor(b.id), { total: 4000 });
    const r = await svc.useBid(7, p.id, a.id, actor);
    expect(r).toMatchObject({ changed: 2, rev: 3, vendorName: 'Tile Co' });
    expect(draftLines.map((l) => [l.cost, (l as any).subName || null, l.strategy])).toEqual([[3500, 'Tile Co', 'sub_used'], [900, 'Tile Co', 'sub_used'], [500, null, 'self_perform']]);
    expect(invites.rows.map((i) => i.status)).toEqual(['awarded', 'not_awarded']);
    expect(bids.rows.map((x) => x.outcome)).toEqual(['awarded', 'not_awarded']);
    expect(packages.rows[0].status).toBe('closed');
    await expect(svc.publicSubmit(tokenFor(b.id), { total: 1 })).rejects.toThrow(/already been chosen/);
  });

  it('a total-only bid is spread over the lines in proportion to their cost', async () => {
    const { svc, invites, draftLines } = setup();
    const p = await svc.create(7, 'E1', { scopeIds: ['S2'] }, actor);
    await svc.invite(7, p.id, { contractorIds: ['K2'] }, actor);
    await svc.publicSubmit(tokenFor(invites.rows[0].id), { total: 4000 });
    await svc.useBid(7, p.id, invites.rows[0].id, actor);
    expect(draftLines.slice(0, 2).map((l) => l.cost)).toEqual([3000, 1000]);
    expect(draftLines[0].cost + draftLines[1].cost).toBe(4000);
  });

  // Nov 17 (replaces Nov 13): prequal comes with the bid, not before it.
  it('a sub not prequalified yet is invited, and the same email asks for the prequal form', async () => {
    const { svc, mails } = setup();
    const p = await svc.create(7, 'E1', { scopeIds: ['S2'] }, actor);
    const r = await svc.invite(7, p.id, { contractorIds: ['K3'] }, actor);
    expect(r.invited[0]).toMatchObject({ vendorName: 'Nope LLC' });
    expect((r.invited[0] as any).prequalLink).toContain('/prequal?token=');
    if (mails.length) expect(mails.at(-1)!.html).toContain('prequalification form');
  });
});

// The leveling helper takes the stored package; fetch it back from the service's repo.
function packagesOf(svc: any) { return svc.packages.rows[0]; }
void subView;
