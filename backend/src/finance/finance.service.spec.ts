import { FinancialsService } from './financials.service';
import { InvoicesService } from './invoices.service';
import {
  FinanceActivityEntity, FinanceSequenceEntity, PhaseFinancialEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity,
  ProjectPaymentEntity, TaskFinancialEntity,
} from '../database/entities';
import { DEFAULT_PROGRAMME } from '../seed-data/programme-template';
import type { Actor, ManpowerAccess } from '../manpower/manpower-access.service';

/** In-memory repository; `versioned` tables bump `version` on every save like @VersionColumn. */
function table(rows: any[] = [], versioned = false) {
  const test = (v: any, want: any) => (want && typeof want === 'object' && want._type === 'in' ? want._value.includes(v) : v === want);
  const match = (r: any, where: any) => Object.entries(where || {}).every(([k, v]) => test(r[k], v));
  const t: any = {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).map((r) => ({ ...r }))),
    findBy: jest.fn(async (w: any) => rows.filter((r) => match(r, w)).map((r) => ({ ...r }))),
    findOneBy: jest.fn(async (w: any) => { const r = rows.find((x) => match(x, w)); return r ? { ...r } : null; }),
    findOne: jest.fn(async (o: any) => { const r = rows.find((x) => match(x, o?.where)); return r ? { ...r } : null; }),
    count: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).length),
    create: jest.fn((x: any) => ({ ...x })),
    insert: jest.fn(async (x: any) => { if (rows.some((r) => r.id === x.id)) throw new Error('duplicate'); rows.push({ ...x }); }),
    update: jest.fn(async (w: any, patch: any) => { rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, patch)); }),
    save: jest.fn(async (x: any) => {
      for (const it of Array.isArray(x) ? x : [x]) {
        const key = ['id', 'taskId', 'phaseId', 'projectId'].find((k) => it[k] !== undefined)!;
        const i = rows.findIndex((r) => r[key] === it[key]);
        if (versioned) it.version = (i >= 0 ? rows[i].version || 0 : 0) + 1;
        if (i >= 0) rows[i] = { ...it }; else rows.push({ ...it });
      }
      return x;
    }),
    remove: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows.splice(i, 1); } return x; }),
    delete: jest.fn(async (w: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], w)) rows.splice(i, 1); }),
  };
  return t;
}

const finance: Actor = { id: 'U-FIN', name: 'Fiona (Finance)', roleKey: 'finance' };
const pm: Actor = { id: 'U-PM', name: 'Pat (PM)', roleKey: 'pm' };
const viewer: Actor = { id: 'U-V', name: 'Val', roleKey: 'viewer' };
const nobody: Actor = { id: 'U-N', name: 'Ned', roleKey: 'staff' };
const PERMS: Record<string, Record<string, string[]>> = {
  finance: { fin_project: ['view', 'manage'] }, pm: { pm: ['view', 'manage'], fin_project: ['view'] }, viewer: { fin_project: ['view'] }, staff: {},
};
const access = {
  actor: jest.fn(),
  can: jest.fn(async (a: Actor, m: string, action = 'manage') => !!PERMS[a.roleKey || '']?.[m]?.includes(action)),
} as unknown as ManpowerAccess;

// Two design phases, two construction phases (from a construction template), one milestone added in finance.
const LIB = JSON.stringify([
  { key: 'default', name: 'Default', category: 'design', phases: DEFAULT_PROGRAMME.slice(0, 2) },
  { key: 'build', name: 'Build', category: 'construction', phases: DEFAULT_PROGRAMME.slice(-2) },
]);
const [D1, D2] = DEFAULT_PROGRAMME.slice(0, 2).map((p) => p.key);
const [C1] = DEFAULT_PROGRAMME.slice(-2).map((p) => p.key);

function setup(opts: { contract?: string; phases?: any[]; tasks?: any[] } = {}) {
  const t = {
    projects: table([{ id: 7, name: 'Marina Tower', contractAmt: opts.contract ?? '$500,000', stage: 'Construction', leadId: 'L1' }]),
    leads: table([{ id: 'L1', leadName: 'Pat Owner', businessName: 'Owner LLC', email: 'ap@owner.example', addresses: { billing: { street: '1 Main St', city: 'Sacramento', state: 'CA', zip: '95814' } } }]),
    phases: table(opts.phases ?? [
      { id: 'PH-D1', projectId: 7, key: D1, name: 'Programming', order: 0 },
      { id: 'PH-D2', projectId: 7, key: D2, name: 'Schematic', order: 1 },
      { id: 'PH-C1', projectId: 7, key: C1, name: 'Construction', order: 2 },
    ]),
    tasks: table(opts.tasks ?? [
      { id: 'T-1', projectId: 7, phaseId: 'PH-C1', title: 'Foundations', order: 0, status: 'Done', completed: true },
      { id: 'T-2', projectId: 7, phaseId: 'PH-C1', title: 'Structural steel', order: 1, status: 'In progress', completed: false },
      { id: 'T-S', projectId: 7, phaseId: 'PH-C1', parentId: 'T-2', title: 'Subtask', order: 0 },
    ]),
    pfin: table([], true), phfin: table([], true), tfin: table([], true), progress: table(),
    invoices: table([], true), lines: table(), payments: table([], true), activity: table(), seq: table(),
  };
  const byEntity = new Map<any, any>([
    [ProjectInvoiceEntity, t.invoices], [ProjectInvoiceLineEntity, t.lines], [ProjectPaymentEntity, t.payments], [FinanceSequenceEntity, t.seq],
    [ProjectFinancialEntity, t.pfin], [PhaseFinancialEntity, t.phfin], [TaskFinancialEntity, t.tfin], [FinanceActivityEntity, t.activity],
  ]);
  const manager = { getRepository: (e: any) => byEntity.get(e), transaction: async (fn: any) => fn(manager) };
  t.invoices.manager = manager;
  const settings = { get: jest.fn(async (k: string) => (k === 'programme.templates' ? LIB : null)) };
  const fin = new FinancialsService(t.projects, t.leads, t.phases, t.tasks, t.pfin, t.phfin, t.tfin, t.progress, t.invoices, t.lines, t.payments, t.activity, settings as any, access);
  const inv = new InvoicesService(t.invoices, t.lines, t.payments, t.pfin, fin);
  return { fin, inv, t };
}

const v = (rows: any[], pred: (r: any) => boolean) => rows.find(pred)?.version;
const flat = (o: any) => o.sov.groups.flatMap((g: any) => g.rows.flatMap((r: any) => [r, ...(r.children || [])]));

async function readyProject(opts: { retention?: number; tax?: number } = {}) {
  const s = setup();
  await s.fin.saveSettings(7, { originalContractValue: 500000, retentionPct: opts.retention ?? 10, taxPct: opts.tax ?? 0, billToName: 'Owner LLC' }, finance);
  await s.fin.updateItem('task', 'T-1', { contractValue: 75000 }, finance);
  await s.fin.updateItem('task', 'T-2', { contractValue: 100000 }, finance);
  await s.fin.updateItem('phase', 'PH-D1', { contractValue: 50000 }, finance);
  return s;
}

describe('project financials', () => {
  it('only roles with financial access see or change them', async () => {
    const { fin } = setup();
    await expect(fin.overview(7, nobody)).rejects.toThrow(/doesn't include project financials/);
    await expect(fin.saveSettings(7, { originalContractValue: 1 }, viewer)).rejects.toThrow(/doesn't allow/);
    expect((await fin.overview(7, viewer)).rights).toMatchObject({ view: true, manage: false, reportProgress: false });
    expect((await fin.rights(pm))).toMatchObject({ view: true, reportProgress: true, approveProgress: false });
  });

  it('sets up from the project: suggested contract, bill-to from the lead, categories for every phase', async () => {
    const { fin, t } = setup({ contract: '$1,150,000' });
    const o = await fin.overview(7, finance);
    expect(o.suggestedContract).toBe(1150000);
    expect(o.billToDefaults).toMatchObject({ name: 'Owner LLC', email: 'ap@owner.example', address: '1 Main St\nSacramento, CA\n95814' });
    expect(o.sov.groups.map((g: any) => g.category)).toEqual(['design', 'construction']);
    await fin.saveSettings(7, { originalContractValue: 1150000 }, finance);
    expect(t.projects.rows[0].contractAmt).toBe('$1,150,000');
    expect(t.activity.rows.some((a: any) => a.action === 'financials_set_up')).toBe(true);
  });

  it('works for a general project with no phases: lump sum, then milestones added from the Financial tab', async () => {
    const { fin } = setup({ phases: [], tasks: [] });
    await fin.saveSettings(7, { originalContractValue: 20000 }, finance);
    let o = await fin.overview(7, finance);
    expect(o.sov.summary.lumpSum).toBe(true);
    expect(o.sov.lump).toMatchObject({ value: 20000 });
    o = await fin.addMilestone(7, { name: 'Deposit', contractValue: 5000 }, finance);
    expect(o.sov.groups[0]).toMatchObject({ category: 'other', label: 'Other milestones' });
    expect(o.sov.summary.lumpSum).toBe(false);
  });

  it('refuses over-allocation, values below what is invoiced, and milestone values that clash with task values', async () => {
    const s = await readyProject();
    await expect(s.fin.updateItem('phase', 'PH-D2', { contractValue: 300000 }, finance)).rejects.toThrow(/Only \$275,000 is unallocated/);
    await expect(s.fin.updateItem('phase', 'PH-C1', { contractValue: 1, version: undefined }, finance)).rejects.toThrow(/comes from its tasks/);
    await expect(s.fin.updateItem('task', 'T-S', { contractValue: 5 }, finance)).rejects.toThrow(/not subtasks/);
    await expect(s.fin.saveSettings(7, { originalContractValue: 200000, version: v(s.t.pfin.rows, () => true) }, finance)).rejects.toThrow(/\$225,000 is already allocated/);
  });

  it('progress: 0-100, reductions need a reason, approved never above reported, every change recorded', async () => {
    const s = await readyProject();
    const ver = () => v(s.t.tfin.rows, (r) => r.taskId === 'T-2');
    await expect(s.fin.reportProgress('task', 'T-2', { pct: 120, version: ver() }, pm)).rejects.toThrow(/between 0 and 100/);
    await s.fin.reportProgress('task', 'T-2', { pct: 60, version: ver() }, pm);
    await expect(s.fin.reportProgress('task', 'T-2', { pct: 50, version: ver() }, pm)).rejects.toThrow(/why progress is going down/);
    await expect(s.fin.approveProgress('task', 'T-2', { pct: 70, version: ver() }, finance)).rejects.toThrow(/can't be above the reported 60%/);
    await expect(s.fin.approveProgress('task', 'T-2', { pct: 50, version: ver() }, pm)).rejects.toThrow(/doesn't allow/);
    await s.fin.approveProgress('task', 'T-2', { pct: 50, version: ver() }, finance);
    await s.fin.reportProgress('task', 'T-2', { pct: 40, reason: 'Steel re-inspection', version: ver() }, pm);
    const row = s.t.tfin.rows.find((r: any) => r.taskId === 'T-2');
    expect(row).toMatchObject({ reportedProgress: 40, approvedProgress: 40 }); // approved follows reported down
    expect(s.t.progress.rows.map((p: any) => `${p.kind}:${p.fromPct}->${p.toPct}`)).toEqual(['reported:0->60', 'approved:0->50', 'reported:60->40', 'approved:50->40']);
    await expect(s.fin.reportProgress('phase', 'PH-C1', { pct: 50 }, pm)).rejects.toThrow(/comes from its tasks/);
  });

  it('rejects a stale write with a conflict', async () => {
    const s = await readyProject();
    const stale = v(s.t.tfin.rows, (r) => r.taskId === 'T-2');
    await s.fin.reportProgress('task', 'T-2', { pct: 30, version: stale }, pm);
    await expect(s.fin.reportProgress('task', 'T-2', { pct: 35, version: stale }, pm)).rejects.toThrow(/changed by Pat \(PM\) since you opened it/);
  });
});

describe('invoices and payments', () => {
  async function billed() {
    const s = await readyProject({ retention: 10, tax: 5 });
    const ver = (id: string) => v(s.t.tfin.rows, (r) => r.taskId === id) ?? v(s.t.phfin.rows, (r) => r.phaseId === id);
    await s.fin.reportProgress('task', 'T-1', { pct: 100, version: ver('T-1') }, pm);
    await s.fin.reportProgress('task', 'T-2', { pct: 40, version: ver('T-2') }, pm);
    return s;
  }

  it('drafts from ready work, issues with the next number, and freezes the figures', async () => {
    const s = await billed();
    const d = await s.inv.createDraft(7, { billReady: true }, finance);
    expect(d.issuedNumber).toBeFalsy();
    expect(d.lines.map((l: any) => [l.description, l.amount, l.prevProgressPct, l.currentProgressPct])).toEqual([['Foundations', 75000, 0, 100], ['Structural steel', 40000, 0, 40]]);
    expect(d).toMatchObject({ contractWork: 115000, retention: 11500, tax: 5175, total: 108675 });
    const issued = await s.inv.issue(d.id, { version: d.version }, finance);
    expect(issued).toMatchObject({ status: 'issued', issuedNumber: 'INV-2026-0001', contractWork: 115000, total: 108675, paymentStatus: 'unpaid' });
    expect(s.t.pfin.rows[0].contractLockedAt).toBeTruthy();
    // Later changes to progress or rates never touch an issued invoice.
    await s.fin.saveSettings(7, { retentionPct: 5, version: v(s.t.pfin.rows, () => true) }, finance);
    await s.fin.reportProgress('task', 'T-2', { pct: 80, version: v(s.t.tfin.rows, (r) => r.taskId === 'T-2') }, pm);
    const again = await s.inv.get(d.id, finance);
    expect(again).toMatchObject({ total: 108675, retention: 11500 });
    expect(again.lines[1]).toMatchObject({ amount: 40000, retentionPct: 10, currentProgressPct: 40 });
    await expect(s.fin.saveSettings(7, { originalContractValue: 600000, version: v(s.t.pfin.rows, () => true) }, finance)).rejects.toThrow(/locked/);
    // The second invoice bills only what's newly earned, and continues the numbering.
    const d2 = await s.inv.createDraft(7, { billReady: true }, finance);
    expect(d2.lines.map((l: any) => [l.description, l.amount, l.prevProgressPct, l.currentProgressPct])).toEqual([['Structural steel', 40000, 40, 80]]);
    expect((await s.inv.issue(d2.id, { version: d2.version }, finance)).issuedNumber).toBe('INV-2026-0002');
  });

  it('never double-bills: a second draft for the same work fails when issued', async () => {
    const s = await billed();
    const a = await s.inv.createDraft(7, { items: [{ kind: 'task', id: 'T-1' }] }, finance);
    const b = await s.inv.createDraft(7, { items: [{ kind: 'task', id: 'T-1' }] }, finance);
    await s.inv.issue(a.id, { version: a.version }, finance);
    await expect(s.inv.issue(b.id, { version: b.version }, finance)).rejects.toThrow(/only \$0.00 is left to invoice/);
    const draft = await s.inv.createDraft(7, { kind: 'standard' }, finance);
    await expect(s.inv.updateDraft(draft.id, { version: draft.version, lines: [{ kind: 'progress', targetType: 'task', taskId: 'T-2', phaseId: 'PH-C1', amount: 100001 }] }, finance)).rejects.toThrow(/only \$100,000.00 is left/);
  });

  it('drafts are editable with a version check; manual and taxable/non-taxable adjustment lines', async () => {
    const s = await billed();
    const d = await s.inv.createDraft(7, { kind: 'standard' }, finance);
    const u = await s.inv.updateDraft(d.id, {
      version: d.version, taxPct: 5, lines: [
        { kind: 'manual', description: 'Permit expediting', quantity: 3, rate: 150 },
        { kind: 'adjustment', description: 'Loyalty discount', amount: -100, taxable: false },
      ],
    }, finance);
    expect(u).toMatchObject({ contractWork: 450, retention: 45, adjustment: -100, tax: 20.25, total: 325.25 });
    await expect(s.inv.updateDraft(d.id, { version: d.version, notes: 'x' }, finance)).rejects.toThrow(/since you opened it/);
  });

  it('payments: never more than outstanding, partial then paid, and void rules', async () => {
    const s = await billed();
    const d = await s.inv.createDraft(7, { items: [{ kind: 'task', id: 'T-1' }] }, finance);
    const i = await s.inv.issue(d.id, { version: d.version }, finance); // 75,000 - 7,500 + 5% tax = 70,875
    expect(i.total).toBe(70875);
    await expect(s.inv.recordPayment(i.id, { amount: 70875.01 }, finance)).rejects.toThrow(/Only \$70,875.00 is outstanding/);
    let p = await s.inv.recordPayment(i.id, { amount: 30000, method: 'ach', bankRef: 'ACH-1' }, finance);
    expect(p).toMatchObject({ paid: 30000, outstanding: 40875, paymentStatus: 'partially_paid' });
    await expect(s.inv.void(i.id, { reason: 'wrong', version: p.version }, finance)).rejects.toThrow(/void them first/);
    p = await s.inv.recordPayment(i.id, { amount: 40875 }, finance);
    expect(p.paymentStatus).toBe('paid');
    const o = await s.fin.overview(7, finance);
    const t1 = flat(o).find((r: any) => r.id === 'T-1');
    expect(t1).toMatchObject({ invoiced: 75000, retention: 7500, paid: 67500, paymentStatus: 'paid', billingStatus: 'fully_invoiced' });
    expect(o.sov.summary).toMatchObject({ contractWorkInvoiced: 75000, invoiceTotals: 70875, paid: 70875, arOutstanding: 0, retentionHeld: 7500 });
    // void the payments, then the invoice
    for (const pay of s.t.payments.rows.slice()) await s.inv.voidPayment(pay.id, { reason: 'Bounced', version: pay.version }, finance);
    const cur = await s.inv.get(i.id, finance);
    const voided = await s.inv.void(i.id, { reason: 'Billed to the wrong entity', version: cur.version }, finance);
    expect(voided.status).toBe('void');
    expect((await s.fin.overview(7, finance)).sov.summary.contractWorkInvoiced).toBe(0);
    expect(s.t.activity.rows.map((a: any) => a.action)).toEqual(expect.arrayContaining(['invoice_issued', 'payment_recorded', 'payment_voided', 'invoice_voided']));
  });

  it('lump-sum projects bill against the whole contract', async () => {
    const s = setup({ phases: [], tasks: [] });
    await s.fin.saveSettings(7, { originalContractValue: 20000, retentionPct: 0 }, finance);
    await s.fin.reportProgress('project', '7', { pct: 25, version: v(s.t.pfin.rows, () => true) }, pm);
    const d = await s.inv.createDraft(7, { billReady: true }, finance);
    expect(d.lines[0]).toMatchObject({ targetType: 'project', amount: 5000, currentProgressPct: 25 });
    const i = await s.inv.issue(d.id, { version: d.version }, finance);
    expect(i.total).toBe(5000);
    const items = await s.fin.itemInvoices('project', '7', finance);
    expect(items.map((x: any) => x.number)).toEqual(['INV-2026-0001']);
  });
});
