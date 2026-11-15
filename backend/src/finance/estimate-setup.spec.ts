import { computeEstimate } from './estimate.calc';
import { setupPlan } from './estimate-setup';
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
