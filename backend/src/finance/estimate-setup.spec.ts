import { computeEstimate } from './estimate.calc';
import { contractAfter, matchSubcontracts, setupPlan } from './estimate-setup';
import { EstimateSetupService } from './estimate-setup.service';
import { moneyRightsOf } from './estimate.money';

const csi = [{ id: 'C01', code: '01', division: 'General Requirements' }, { id: 'C02', code: '02.41', division: 'Demolition' }, { id: 'C09', code: '09.30', division: 'Tiling' }];
function data() {
  const scopes = [{ id: 's1', title: 'Demo', csiCodeId: 'C02' }, { id: 's2', title: 'Tile', csiCodeId: 'C09' }];
  const lines = [
    { id: 'l1', scopeId: 's1', kind: 'item', description: 'Demo walls', cost: 1000, markupAmt: 300, pricing: 'fc', strategy: 'sub_used', contractorId: 'K1', subName: 'Bay Demo' },
    { id: 'l2', scopeId: 's1', kind: 'item', description: 'Haul', cost: 500, markupAmt: 100, pricing: 'fc', strategy: 'self_perform' },
    { id: 'l3', scopeId: 's2', kind: 'item', description: 'Floor tile', cost: 2000, markupAmt: 500, pricing: 'fc', strategy: 'sub_used', subName: 'Tile Co' },
    { id: 'l4', scopeId: 's2', kind: 'item', description: 'Not ours', cost: 900, markupAmt: 0, pricing: 'nis', strategy: 'sub_used', subName: 'Tile Co' },
    { id: 'l5', scopeId: 's2', kind: 'inclusion', description: 'Grout' },
  ];
  const gr = [{ id: 'g', base: 1000, qty: 1, included: true }];
  const payments = [{ id: 'p1', label: 'Deposit', mode: 'pct', value: 10 }, { id: 'p2', label: 'Completion', mode: 'pct', value: 90 }];
  const settings = { grPct: 17, profitPct: 12, contingencyPct: 5, glPct: 1 };
  const result = computeEstimate({ settings, scopes, lines: lines as any, gr, payments: payments as any });
  return { scopes, lines, gr, payments, result, settings };
}

describe('K9: set up the job from an accepted estimate', () => {
  it('plans the contract, cost budget per CSI (GR + GL under 01), draft subcontracts per sub, and the payments as milestones', () => {
    const d = data();
    const p = setupPlan({ ...d, csi });
    expect(p.contract).toBe(d.result.totals.totalProject);
    expect(p.budget).toEqual([
      { csiCodeId: 'C02', label: '02.41 — Demolition', amount: 150000 },
      { csiCodeId: 'C09', label: '09.30 — Tiling', amount: 200000 },
      { csiCodeId: 'C01', label: '01 — General Requirements', amount: 100000 + d.result.totals.gl },
    ]);
    expect(p.subcontracts.map((s) => [s.vendorName, s.total, s.lines.length])).toEqual([['Bay Demo', 100000, 1], ['Tile Co', 200000, 1]]);
    expect(p.milestones.map((m) => m.name)).toEqual(['Deposit', 'Completion']);
    expect(p.milestones.reduce((a, m) => a + m.amount, 0)).toBe(d.result.totals.totalProject);
  });

  it('no payment schedule: one lump-sum milestone', () => {
    const d = data();
    expect(setupPlan({ ...d, payments: [], result: computeEstimate({ settings: d.settings, scopes: d.scopes, lines: d.lines as any, gr: d.gr }), csi }).milestones).toHaveLength(1);
  });

  function svc(status = 'accepted', money = moneyRightsOf('all')) {
    const d = data();
    const e: any = { id: 'E1', number: 'EST-001', rev: 2, status, payments: d.payments, setupRefs: null };
    const calls: string[] = [];
    const estimates: any = { raw: async () => ({ e, sheet: d, result: d.result, rights: { money } }), saveEntity: async () => e, revisionsOf: async () => [e], get: async () => ({}) };
    const fin: any = {
      settingsFor: async () => ({ row: { version: 3 }, value: { originalContractValue: 0 } }),
      saveSettings: async (_p: number, dto: any) => { calls.push(`contract ${dto.originalContractValue} v${dto.version}`); },
      addMilestone: async (_p: number, dto: any) => { calls.push(`milestone ${dto.name}`); },
      log: async () => undefined,
    };
    const costs: any = {
      saveBudgetLine: async (_p: number, dto: any) => { calls.push(`budget ${dto.csiCodeId}`); },
      saveCommitment: async (_p: number, dto: any) => { calls.push(`sub ${dto.vendorName} ${dto.lines.length}`); if (dto.vendorName === 'Tile Co' && (globalThis as any).failTile) throw new Error('vendor missing'); },
    };
    return { s: new EstimateSetupService(estimates, fin, costs, { find: async () => csi } as any), e, calls };
  }

  it('runs the ticked steps once, in order, and remembers what it made', async () => {
    const { s, e, calls } = svc();
    await s.apply(7, 'E1', { steps: ['milestones', 'contract', 'budget', 'subcontracts'] }, { name: 'Edward' });
    expect(calls[0]).toMatch(/^contract .* v3$/);
    expect(calls.filter((c) => c.startsWith('budget'))).toHaveLength(3);
    expect(calls.filter((c) => c.startsWith('sub'))).toEqual(['sub Bay Demo 1', 'sub Tile Co 1']);
    expect(calls.slice(-2)).toEqual(['milestone Deposit', 'milestone Completion']);
    expect(e.setupAt).toBeTruthy();
    expect(Object.keys(e.setupRefs)).toEqual(['contract', 'budget', 'subcontracts', 'milestones']);
    calls.length = 0;
    await s.apply(7, 'E1', { steps: ['contract', 'budget'] }, { name: 'Edward' });
    expect(calls).toEqual([]);
  });

  it('a failing step stops the run, says what was already done, and the rest can be run later', async () => {
    const { s, e } = svc();
    (globalThis as any).failTile = true;
    await expect(s.apply(7, 'E1', { steps: ['contract', 'subcontracts'] }, { name: 'Edward' })).rejects.toThrow(/Subcontracts: vendor missing \(already done: contract\)/);
    (globalThis as any).failTile = false;
    expect(e.setupAt).toBeFalsy();
    expect(e.setupRefs.contract).toBeTruthy();
  });

  it('only for an accepted estimate, and only for someone who sees all its money', async () => {
    await expect(svc('sent').s.preview(7, 'E1', { name: 'E' })).rejects.toThrow(/Only an accepted estimate/);
    await expect(svc('accepted', { ...moneyRightsOf('all'), full: false, markup: false }).s.preview(7, 'E1', { name: 'E' })).rejects.toThrow(/all of the estimate’s money/);
  });

  it('staff can record a paper acceptance on a sent estimate', async () => {
    const { s, e } = svc('sent');
    await s.markAccepted(7, 'E1', { signer: 'Kai Lono' }, { name: 'Edward' });
    expect(e).toMatchObject({ status: 'accepted', acceptedBy: 'Kai Lono' });
    await expect(s.markAccepted(7, 'E1', { signer: 'Kai' }, { name: 'Edward' })).rejects.toThrow(/Only a sent/);
  });
});

describe('Nov 23 (Edward p30): set up from several estimates', () => {
  const sub = (o: any) => ({ key: 'k1', contractorId: 'K1', vendorName: 'Bay Demo', title: 'Demolition', total: 100, lines: [], ...o });
  it('contract: the first set-up sets it, later ones add', () => {
    expect(contractAfter(500000, 0, 200000)).toEqual({ mode: 'set', value: 200000 });
    expect(contractAfter(500000, 1, 200000)).toEqual({ mode: 'add', value: 700000 });
  });
  it('subcontracts: same sub + same building joins the earlier draft; another building or an approved one gets its own', () => {
    const drafts = [
      { id: 'c1', number: 'SC-001', status: 'draft', contractorId: 'K1', vendorName: 'Bay Demo', structureKey: 'main', scope: 'From EST-001 Rev 1' },
      { id: 'c2', number: 'SC-002', status: 'approved', contractorId: null, vendorName: 'Tile Co', structureKey: 'main', scope: 'From EST-001 Rev 1' },
      { id: 'c3', number: 'SC-003', status: 'draft', contractorId: 'K1', vendorName: 'Bay Demo', structureKey: 'main', scope: 'Typed by hand' },
    ];
    const subs = [sub({}), sub({ key: 'tile co', contractorId: null, vendorName: 'Tile Co' })];
    expect(matchSubcontracts(subs, drafts, 'main').map((m) => [m.joins?.number || null, m.note])).toEqual([['SC-001', 'adds to SC-001'], [null, 'SC-002 is already approved — a new subcontract']]);
    expect(matchSubcontracts(subs, drafts, 'adu').map((m) => m.joins)).toEqual([null, null]);
  });

  function two(structure1: string | null, structure2: string | null) {
    const d = data();
    const made: any[] = []; const calls: string[] = [];
    let contract = 0; let setups = 0;
    const mk = (id: string, number: string, structureKey: string | null, fundingSourceId: string | null): any => ({ id, number, rev: 1, status: 'accepted', payments: d.payments, setupRefs: null, structureKey, fundingSourceId });
    const ests: Record<string, any> = { E1: mk('E1', 'EST-001', structure1, 'bank'), E2: mk('E2', 'EST-002', structure2, 'owner') };
    const estimates: any = {
      raw: async (_p: number, id: string) => ({ e: ests[id], sheet: d, result: d.result, rights: { money: moneyRightsOf('all') } }),
      saveEntity: async (e: any) => { if (e.setupRefs?.contract) setups = Object.values(ests).filter((x) => x.setupRefs?.contract).length; return e; },
      setupContext: async (_p: number, number: string) => ({ otherSetups: Object.values(ests).filter((x) => x.number !== number && x.setupRefs?.contract).length, structures: [{ key: 'main', name: 'Main house' }, { key: 'adu', name: 'ADU' }] }),
    };
    const fin: any = {
      settingsFor: async () => ({ row: { version: 1 }, value: { originalContractValue: contract } }),
      saveSettings: async (_p: number, dto: any) => { contract = dto.originalContractValue; },
      addMilestone: async (_p: number, dto: any) => { calls.push(`milestone ${dto.name} ${dto.fundingSourceId}`); },
      log: async () => undefined,
    };
    const costs: any = {
      saveBudgetLine: async () => undefined,
      setupDrafts: async () => made.map((c) => ({ id: c.id, version: 1, number: c.number, status: 'draft', contractorId: c.contractorId || null, vendorName: c.vendorName, structureKey: c.structureKey || null, scope: c.scope })),
      commitmentLinesOf: async (id: string) => made.find((c) => c.id === id).lines,
      saveCommitment: async (_p: number, dto: any) => {
        if (dto.id) { const c = made.find((x) => x.id === dto.id); c.lines = dto.lines; c.scope = dto.scope; return; }
        made.push({ ...dto, id: 'c' + (made.length + 1), number: `SC-00${made.length + 1}` });
      },
    };
    const s = new EstimateSetupService(estimates, fin, costs, { find: async () => csi } as any);
    return { s, made, calls, contract: () => contract, setups: () => setups };
  }

  it('Main house + ADU (scenario 1): each sub gets one subcontract per building; the contract is the sum; milestones carry who pays', async () => {
    const t = two('main', 'adu');
    await t.s.apply(7, 'E1', { steps: ['contract', 'subcontracts', 'milestones'] }, { name: 'Edward' });
    await t.s.apply(7, 'E2', { steps: ['contract', 'subcontracts', 'milestones'] }, { name: 'Edward' });
    const total = data().result.totals.totalProject;
    expect(t.contract()).toBeCloseTo((total * 2) / 100, 2);
    expect(t.made.map((c) => [c.vendorName, c.structureKey, c.title])).toEqual([
      ['Bay Demo', 'main', 'Demolition – Main house'], ['Tile Co', 'main', 'Tiling – Main house'],
      ['Bay Demo', 'adu', 'Demolition – ADU'], ['Tile Co', 'adu', 'Tiling – ADU'],
    ]);
    expect(t.calls).toContain('milestone Deposit (ADU · EST-002) owner');
    expect(t.calls).toContain('milestone Deposit (Main house · EST-001) bank');
  });

  it('bank + owner on the same building (scenario 2): one subcontract per sub holding both estimates’ lines', async () => {
    const t = two(null, null);
    await t.s.apply(7, 'E1', { steps: ['subcontracts'] }, { name: 'Edward' });
    const preview = await t.s.preview(7, 'E2', { name: 'Edward' });
    expect(preview.subcontracts.map((x: any) => x.note)).toEqual(['adds to SC-001', 'adds to SC-002']);
    await t.s.apply(7, 'E2', { steps: ['subcontracts'] }, { name: 'Edward' });
    expect(t.made).toHaveLength(2);
    expect(t.made.map((c) => [c.vendorName, c.lines.length, c.scope])).toEqual([['Bay Demo', 2, 'From EST-001 Rev 1, EST-002 Rev 1'], ['Tile Co', 2, 'From EST-001 Rev 1, EST-002 Rev 1']]);
  });
});
