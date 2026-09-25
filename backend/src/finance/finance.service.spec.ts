import { FinancialsService } from './financials.service';
import { InvoicesService } from './invoices.service';
import { ChangeOrdersService } from './change-orders.service';
import { ReimbursablesService } from './reimbursables.service';
import { RetentionService } from './retention.service';
import { FinanceHubService } from './finance-hub.service';
import { CostsService } from './costs.service';
import { ReportsService } from './reports.service';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, FinanceActivityEntity, FinanceSequenceEntity, FinancialApprovalEntity, PhaseFinancialEntity,
  ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ProjectPhaseEntity, ProjectSectionEntity,
  ProjectTaskEntity, ReimbursableEntity, RetentionReleaseEntity, TaskFinancialEntity, CommitmentEntity, CommitmentLineEntity,
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
const clerk: Actor = { id: 'U-C', name: 'Cal (Clerk)', roleKey: 'clerk' };
const site: Actor = { id: 'U-S', name: 'Sam (Site)', roleKey: 'site' };
const PERMS: Record<string, Record<string, string[]>> = {
  finance: { fin_project: ['view', 'manage'] }, pm: { pm: ['view', 'manage'], fin_project: ['view'] }, viewer: { fin_project: ['view'] }, staff: {},
  // Prepares invoices but a granular setting takes issuing away.
  clerk: { fin_project: ['view', 'manage'], finx_issue_invoice: [] },
  // Change orders and reimbursables only -- no project financials.
  site: { changeorders: ['view', 'manage'], reimbursement: ['view', 'manage'] },
};
const access = {
  actor: jest.fn(),
  can: jest.fn(async (a: Actor, m: string, action = 'manage') => !!PERMS[a.roleKey || '']?.[m]?.includes(action)),
  permissionsOf: jest.fn(async (a: Actor) => (a.roleKey ? Object.fromEntries(Object.entries(PERMS[a.roleKey] || {}).map(([k, acts]) => [k, { view: acts.includes('view'), manage: acts.includes('manage') }])) : null)),
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
    cos: table([], true), coItems: table(), approvals: table(), reimbs: table([], true), releases: table([], true), sections: table([{ id: 'S-7-0', projectId: 7, name: 'To do', order: 0 }]),
    budget: table([], true), commitments: table([], true), commitmentLines: table(), entries: table([], true), forecasts: table([], true),
    timesheets: table([]), timesheetLines: table([]), dailyLogs: table([]), laborEntries: table([]),
    employees: table([{ id: 'E1', name: 'Robert Johnson', payType: 'hourly', payRate: 50 }]),
    codes: table([{ id: 'C03', code: '03', division: 'Concrete', active: true, order: 1 }, { id: 'C09', code: '09', division: 'Finishes', active: true, order: 2 }]),
    contractors: table([{ id: 'K1', companyName: 'Bay Concrete Inc.', status: 'active' }]),
  };
  const byEntity = new Map<any, any>([
    [ProjectInvoiceEntity, t.invoices], [ProjectInvoiceLineEntity, t.lines], [ProjectPaymentEntity, t.payments], [FinanceSequenceEntity, t.seq],
    [ProjectFinancialEntity, t.pfin], [PhaseFinancialEntity, t.phfin], [TaskFinancialEntity, t.tfin], [FinanceActivityEntity, t.activity],
    [ChangeOrderEntity, t.cos], [ChangeOrderItemEntity, t.coItems], [FinancialApprovalEntity, t.approvals], [ReimbursableEntity, t.reimbs],
    [RetentionReleaseEntity, t.releases], [ProjectPhaseEntity, t.phases], [ProjectTaskEntity, t.tasks], [ProjectSectionEntity, t.sections],
    [CommitmentEntity, t.commitments], [CommitmentLineEntity, t.commitmentLines],
  ]);
  const manager = { getRepository: (e: any) => byEntity.get(e), transaction: async (fn: any) => fn(manager) };
  t.invoices.manager = manager;
  t.cos.manager = manager;
  t.commitments.manager = manager;
  const settings = { get: jest.fn(async (k: string) => (k === 'programme.templates' ? LIB : null)) };
  const fin = new FinancialsService(t.projects, t.leads, t.phases, t.tasks, t.pfin, t.phfin, t.tfin, t.progress, t.invoices, t.lines, t.payments, t.activity, settings as any, access, t.cos, t.coItems, t.approvals);
  const inv = new InvoicesService(t.invoices, t.lines, t.payments, t.pfin, fin, t.reimbs, t.releases);
  const cos = new ChangeOrdersService(t.cos, t.coItems, t.phases, t.tasks, t.projects, fin);
  const reimb = new ReimbursablesService(t.reimbs, t.projects, fin);
  const ret = new RetentionService(t.releases, fin, inv);
  const hub = new FinanceHubService(fin, t.projects, t.pfin, t.cos, t.coItems, t.reimbs, t.releases, t.invoices, t.phfin, t.tfin, t.phases, t.tasks, t.activity, t.lines);
  const costs = new CostsService(fin, settings as any, t.budget, t.commitments, t.commitmentLines, t.entries, t.forecasts, t.cos, t.coItems, t.reimbs,
    t.timesheets, t.timesheetLines, t.dailyLogs, t.laborEntries, t.employees, t.codes, t.contractors);
  const reports = new ReportsService(fin, costs, cos, t.projects, t.pfin, t.invoices, t.payments, t.releases, t.entries);
  return { fin, inv, cos, reimb, ret, hub, costs, reports, t };
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

describe('phase 2: permissions and invoice approval', () => {
  it('granular actions: a role can prepare invoices without issuing them; unset keys fall back to financials -> manage', async () => {
    const s = setup();
    expect(await s.fin.rights(finance)).toMatchObject({ prepareInvoice: true, issueInvoice: true, approveChangeOrders: true, releaseRetention: true });
    expect(await s.fin.rights(clerk)).toMatchObject({ prepareInvoice: true, issueInvoice: false, recordPayment: true });
    expect(await s.fin.rights(site)).toMatchObject({ view: false, viewChangeOrders: true, editChangeOrders: true, approveChangeOrders: false, submitReimbursables: true, approveReimbursables: false });
  });

  it('a preparer sends a draft for approval; the approver returns it or issues it, and every decision is recorded', async () => {
    const s = await readyProject();
    await s.fin.reportProgress('task', 'T-1', { pct: 100, version: v(s.t.tfin.rows, (r) => r.taskId === 'T-1') }, pm);
    let d = await s.inv.createDraft(7, { billReady: true }, clerk);
    await expect(s.inv.issue(d.id, { version: d.version }, clerk)).rejects.toThrow(/doesn't allow issuing/);
    d = await s.inv.requestApproval(d.id, { version: d.version, comment: 'Ready for September' }, clerk);
    expect(d.approvalRequestedBy).toBe('Cal (Clerk)');
    const inbox = await s.hub.pending(finance);
    expect(inbox.find((x: any) => x.type === 'invoice')).toMatchObject({ id: d.id, canAct: true });
    await expect(s.inv.returnDraft(d.id, { version: d.version }, finance)).rejects.toThrow(/what needs changing/);
    d = await s.inv.returnDraft(d.id, { version: d.version, comment: 'Add the PO' }, finance);
    d = await s.inv.requestApproval(d.id, { version: d.version }, clerk);
    const issued = await s.inv.issue(d.id, { version: d.version }, finance);
    expect(issued.approvals.map((a: any) => a.decision)).toEqual(['submitted', 'returned', 'submitted', 'approved']);
  });
});

describe('phase 2: change orders', () => {
  const item = (x: any) => ({ description: 'Change', ...x });

  it('flow: draft -> internal review -> client -> approved; the contract, item values and new items follow', async () => {
    const s = await readyProject();
    let co = await s.cos.create(7, {
      title: 'Owner upgrades', reason: 'client_request', items: [
        item({ targetType: 'task', taskId: 'T-2', amount: 20000 }),
        item({ targetType: 'new_phase', newName: 'Landscaping', amount: 30000 }),
        item({ targetType: 'new_task', phaseId: 'PH-D2', newName: 'Lighting study', amount: 5000 }),
        item({ targetType: 'none', amount: 10000 }),
      ],
    }, site);
    expect(co).toMatchObject({ number: 'CO-001', status: 'draft', total: 65000 });
    await expect(s.cos.act(co.id, 'approve_internal', { version: co.version }, site)).rejects.toThrow(/doesn't allow approving change orders/);
    co = await s.cos.act(co.id, 'submit', { version: co.version }, site);
    expect((await s.fin.overview(7, finance)).sov.summary).toMatchObject({ approvedChanges: 0, pendingChanges: 65000, revisedContract: 500000 });
    co = await s.cos.act(co.id, 'approve_internal', { version: co.version }, finance);
    expect(co.status).toBe('submitted');
    await expect(s.cos.act(co.id, 'client_approve', { version: co.version }, finance)).rejects.toThrow(/who approved it for the client/);
    co = await s.cos.act(co.id, 'client_approve', { version: co.version, signer: 'Pat Owner', date: '2026-09-20', reference: 'Email 9/20' }, finance);
    expect(co).toMatchObject({ status: 'approved', amount: 65000, clientSigner: 'Pat Owner' });
    const o = await s.fin.overview(7, finance);
    expect(o.sov.summary).toMatchObject({ originalContract: 500000, approvedChanges: 65000, revisedContract: 565000, allocated: 280000, unallocated: 285000, pendingChanges: 0 });
    const rows = flat(o);
    expect(rows.find((r: any) => r.id === 'T-2')).toMatchObject({ value: 120000, ownValue: 100000, changeOrders: 20000 });
    const land = rows.find((r: any) => r.name === 'Landscaping');
    expect(land).toMatchObject({ kind: 'phase', value: 30000, category: 'other' });
    // The new task lives on the Phase Board too, under its milestone, valued by the change order.
    expect(s.t.tasks.rows.find((t: any) => t.title === 'Lighting study')).toMatchObject({ phaseId: 'PH-D2', sectionId: 'S-7-0' });
    expect(rows.find((r: any) => r.name === 'Lighting study')).toMatchObject({ value: 5000, changeOrders: 5000 });
    expect(co.approvals.map((a: any) => a.decision)).toEqual(['submitted', 'internal_approved', 'client_approved']);
    await expect(s.cos.update(co.id, { version: co.version, title: 'x' }, site)).rejects.toThrow(/Only a draft/);
  });

  it('refuses changes that break the schedule: below invoiced, on a milestone valued by its tasks, under a milestone with its own value', async () => {
    const s = await readyProject();
    await s.fin.reportProgress('task', 'T-1', { pct: 100, version: v(s.t.tfin.rows, (r) => r.taskId === 'T-1') }, pm);
    const d = await s.inv.createDraft(7, { items: [{ kind: 'task', id: 'T-1' }] }, finance);
    await s.inv.issue(d.id, { version: d.version }, finance);
    const deduct = await s.cos.create(7, { title: 'Scope cut', items: [item({ targetType: 'task', taskId: 'T-1', amount: -10000 })] }, finance);
    expect(await s.cos.impact(deduct.id, finance)).toMatchObject({ ok: false, problem: expect.stringMatching(/already invoiced/) });
    const onPhase = await s.cos.create(7, { title: 'Steel', items: [item({ targetType: 'phase', phaseId: 'PH-C1', amount: 1000 })] }, finance);
    expect((await s.cos.impact(onPhase.id, finance)).problem).toMatch(/comes from its tasks/);
    const s2 = await readyProject();
    // PH-D1 carries its own value; its (new) task can't take a change separately.
    const under = await s2.cos.create(7, { title: 'Extra', items: [item({ targetType: 'new_task', phaseId: 'PH-D1', newName: 'Extra survey', amount: 1000 })] }, finance);
    expect((await s2.cos.impact(under.id, finance)).problem).toMatch(/carries its own value/);
    // A deduction that leaves things consistent is fine and lowers the contract.
    const ok = await s2.cos.create(7, { title: 'Credit', reason: 'scope_reduction', items: [item({ targetType: 'phase', phaseId: 'PH-D1', amount: -5000 })] }, finance);
    const done = await s2.cos.act(ok.id, 'client_approve', { version: ok.version, signer: 'Pat Owner' }, finance);
    expect(done.status).toBe('approved');
    expect((await s2.fin.overview(7, finance)).sov.summary).toMatchObject({ revisedContract: 495000, approvedChanges: -5000 });
  });

  it('return, reject, reopen and cancel are recorded; only never-submitted drafts can be deleted', async () => {
    const s = await readyProject();
    let co = await s.cos.create(7, { title: 'A', items: [item({ amount: 100 })] }, finance);
    co = await s.cos.act(co.id, 'submit', { version: co.version }, finance);
    co = await s.cos.act(co.id, 'return', { version: co.version, comment: 'Price it properly' }, finance);
    expect(co.status).toBe('draft');
    await expect(s.cos.remove(co.id, finance)).rejects.toThrow(/cancel it instead/);
    co = await s.cos.act(co.id, 'submit', { version: co.version }, finance);
    co = await s.cos.act(co.id, 'reject', { version: co.version, comment: 'Client declined' }, finance);
    co = await s.cos.act(co.id, 'reopen', { version: co.version }, finance);
    co = await s.cos.act(co.id, 'cancel', { version: co.version, comment: 'Dropped' }, finance);
    expect(co.status).toBe('cancelled');
    const b = await s.cos.create(7, { title: 'B' }, finance);
    expect(b.number).toBe('CO-002');
    expect(await s.cos.remove(b.id, finance)).toMatchObject({ deleted: true });
  });
});

describe('phase 2: reimbursables, retention release and credit notes', () => {
  async function billedWork() {
    const s = await readyProject({ retention: 10, tax: 5 });
    const ver = (id: string) => v(s.t.tfin.rows, (r) => r.taskId === id);
    await s.fin.reportProgress('task', 'T-1', { pct: 100, version: ver('T-1') }, pm);
    await s.fin.reportProgress('task', 'T-2', { pct: 40, version: ver('T-2') }, pm);
    const d = await s.inv.createDraft(7, { billReady: true }, finance);
    const i = await s.inv.issue(d.id, { version: d.version }, finance); // 115,000 work, 11,500 retention, 5,175 tax, 108,675
    return { ...s, i };
  }

  it('reimbursables: submitted, approved, billed at cost plus markup outside the contract; voiding frees them', async () => {
    const s = await readyProject({ retention: 10, tax: 5 });
    await s.fin.saveSettings(7, { reimbursableMarkupPct: 10, version: v(s.t.pfin.rows, () => true) }, finance);
    let r = await s.reimb.create(7, { description: 'Blueprint printing', category: 'printing', cost: 1000, vendor: 'FedEx Office' }, site);
    expect(r).toMatchObject({ number: 'RE-001', status: 'submitted', markupPct: 10, billAmount: 1100 });
    await expect(s.reimb.decide(r.id, { decision: 'approve', version: r.version }, site)).rejects.toThrow(/doesn't allow approving reimbursables/);
    await expect(s.inv.createDraft(7, { billReady: true }, finance)).rejects.toThrow(/Nothing is ready/);
    r = await s.reimb.decide(r.id, { decision: 'approve', version: r.version }, finance);
    const d = await s.inv.createDraft(7, { billReady: true }, finance);
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]).toMatchObject({ kind: 'reimbursable', amount: 1100, retentionAmount: 0, taxable: false });
    expect(d).toMatchObject({ contractWork: 0, reimbursable: 1100, total: 1100 });
    const i = await s.inv.issue(d.id, { version: d.version }, finance);
    expect(s.t.reimbs.rows[0]).toMatchObject({ status: 'billed', invoiceId: i.id });
    expect((await s.fin.overview(7, finance)).sov.summary).toMatchObject({ contractWorkInvoiced: 0, reimbursablesBilled: 1100 });
    await expect(s.inv.createDraft(7, { reimbursableIds: [r.id] }, finance)).rejects.toThrow(/Nothing is ready/);
    await s.inv.void(i.id, { reason: 'Wrong client', version: i.version }, finance);
    expect(s.t.reimbs.rows[0]).toMatchObject({ status: 'approved', invoiceId: null });
  });

  it('retention: request, approve, bill back to the items that held it, and pay', async () => {
    const s = await billedWork();
    let o = await s.ret.overview(7, finance);
    expect(o).toMatchObject({ accrued: 11500, held: 11500, released: 0, available: 11500 });
    await expect(s.ret.request(7, { scope: 'task', targetId: 'T-2', amount: 5000 }, finance)).rejects.toThrow(/Only \$4,000.00/);
    o = await s.ret.request(7, { scope: 'project', amount: 5750, reason: 'substantial_completion' }, finance);
    const rel = o.releases[0];
    expect(rel).toMatchObject({ number: 'RR-001', status: 'requested' });
    await expect(s.ret.request(7, { scope: 'project', amount: 6000 }, finance)).rejects.toThrow(/Only \$5,750.00/);
    await s.ret.decide(rel.id, { decision: 'approve', version: rel.version }, finance);
    const d = await s.ret.bill(rel.id, finance);
    // 5,750 split over T-1 (7,500 held) and T-2 (4,000 held) in proportion.
    expect(d.kind).toBe('retention');
    expect(d.lines.map((l: any) => [l.taskId, l.amount])).toEqual([['T-1', 3750], ['T-2', 2000]]);
    expect(d).toMatchObject({ contractWork: 0, retentionRelease: 5750, tax: 287.5, total: 6037.5 });
    const issued = await s.inv.issue(d.id, { version: d.version }, finance);
    expect(s.t.releases.rows[0]).toMatchObject({ status: 'billed', invoiceId: issued.id });
    const ov = await s.fin.overview(7, finance);
    expect(ov.sov.summary).toMatchObject({ retentionHeld: 5750, retentionReleased: 5750, contractWorkInvoiced: 115000 });
    expect(flat(ov).find((r: any) => r.id === 'T-1')).toMatchObject({ retention: 3750, retentionReleased: 3750 });
    // Paying both invoices in full settles T-1 completely.
    await s.inv.recordPayment(s.i.id, { amount: 108675 }, finance);
    await s.inv.recordPayment(issued.id, { amount: 6037.5 }, finance);
    const t1 = flat(await s.fin.overview(7, finance)).find((r: any) => r.id === 'T-1');
    expect(t1).toMatchObject({ invoiced: 75000, retention: 3750, paid: 71250, outstanding: 0, paymentStatus: 'paid' });
  });

  it('credit notes reverse billed work line by line; write-offs clear a balance without un-billing work', async () => {
    const s = await billedWork();
    const steel = s.i.lines.find((l: any) => l.taskId === 'T-2');
    await expect(s.inv.createCredit(s.i.id, { reason: 'x', lines: [{ lineId: steel.id, amount: 40000.01 }] }, finance)).rejects.toThrow(/Only \$40,000.00/);
    await expect(s.inv.createCredit(s.i.id, { lines: [{ lineId: steel.id, amount: 1 }] }, finance)).rejects.toThrow(/why the credit/);
    const cn = await s.inv.createCredit(s.i.id, { reason: 'Steel over-claimed', lines: [{ lineId: steel.id, amount: 10000 }] }, finance);
    expect(cn).toMatchObject({ kind: 'credit', status: 'draft', contractWork: -10000, retention: -1000, tax: -450, total: -9450 });
    const issued = await s.inv.issue(cn.id, { version: cn.version }, finance);
    expect(issued).toMatchObject({ issuedNumber: 'CN-2026-0001', paymentStatus: 'credit' });
    let orig = await s.inv.get(s.i.id, finance);
    expect(orig).toMatchObject({ total: 108675, credited: -9450, outstanding: 99225 });
    const t2 = flat(await s.fin.overview(7, finance)).find((r: any) => r.id === 'T-2');
    expect(t2).toMatchObject({ invoiced: 30000, retention: 3000, billable: 10000, billingStatus: 'ready_to_invoice' });
    await expect(s.inv.void(s.i.id, { reason: 'x', version: orig.version }, finance)).rejects.toThrow(/Credit note CN-2026-0001/);
    // A second credit can only take what's left on the line.
    await expect(s.inv.createCredit(s.i.id, { reason: 'again', lines: [{ lineId: steel.id, amount: 30000.01 }] }, finance)).rejects.toThrow(/Only \$30,000.00/);
    // Write off the unpaid rest after a part payment: paid in full, contract work unchanged.
    await s.inv.recordPayment(s.i.id, { amount: 90000 }, finance);
    await expect(s.inv.createCredit(s.i.id, { creditType: 'write_off', reason: 'Settled', amount: 9225.01 }, finance)).rejects.toThrow(/Only \$9,225.00 is owed/);
    const wo = await s.inv.createCredit(s.i.id, { creditType: 'write_off', reason: 'Settlement agreed' }, finance);
    await s.inv.issue(wo.id, { version: wo.version }, finance);
    orig = await s.inv.get(s.i.id, finance);
    expect(orig).toMatchObject({ outstanding: 0, paymentStatus: 'paid' });
    expect((await s.fin.overview(7, finance)).sov.summary).toMatchObject({ contractWorkInvoiced: 105000, arOutstanding: 0, credits: -18675 });
  });

  it('the approvals inbox shows each open item to those who can see it, flagged where they can decide', async () => {
    const s = await readyProject();
    const co = await s.cos.create(7, { title: 'Upgrade', items: [{ description: 'Tile', amount: 500 }] }, site);
    await s.cos.act(co.id, 'submit', { version: co.version }, site);
    await s.reimb.create(7, { description: 'Mileage', cost: 80 }, site);
    const forSite = await s.hub.pending(site);
    expect(forSite.map((x: any) => [x.type, x.canAct])).toEqual([['change_order', false], ['reimbursable', false]]);
    const forFinance = await s.hub.pending(finance);
    expect(forFinance.every((x: any) => x.canAct)).toBe(true);
    const portfolio = await s.hub.portfolio(finance);
    expect(portfolio[0]).toMatchObject({ projectId: 7, name: 'Marina Tower', pendingChanges: 500 });
    const audit = await s.hub.audit(finance, { projectId: '7', entityType: 'change_order' });
    expect(audit.map((a: any) => a.action)).toEqual(expect.arrayContaining(['co_created', 'co_submitted']));
  });
});

describe('phase 3: job cost, profitability and reports', () => {
  async function costed() {
    const s = await readyProject({ retention: 10, tax: 0 });
    await s.fin.saveSettings(7, { laborBurdenPct: 30, version: v(s.t.pfin.rows, () => true) }, finance);
    let o = await s.costs.saveBudgetLine(7, { csiCodeId: 'C03', description: 'Foundations and slab', amount: 60000 }, finance);
    o = await s.costs.saveBudgetLine(7, { csiCodeId: 'C09', description: 'Finishes', amount: 90000 }, finance);
    return { ...s, o };
  }

  it('job cost is kept from anyone without profitability access; the granular right falls back to financials -> manage', async () => {
    const s = await costed();
    await expect(s.costs.overview(7, viewer)).rejects.toThrow(/doesn't include job cost/);
    expect(await s.fin.rights(finance)).toMatchObject({ manageCosts: true, approveCosts: true, viewProfitability: true });
    expect(s.o.totals).toMatchObject({ budget: 150000, actual: 0, eac: 150000 });
  });

  it('commitments: drafted, approved, billed against -- over-billing needs a reason, voiding needs nothing billed', async () => {
    const s = await costed();
    let o = await s.costs.saveCommitment(7, { type: 'subcontract', contractorId: 'K1', title: 'Foundations', lines: [{ description: 'Footings and slab', csiCodeId: 'C03', amount: 48000 }] }, finance);
    let sc = o.commitments[0];
    expect(sc).toMatchObject({ number: 'SC-001', vendorName: 'Bay Concrete Inc.', status: 'draft', total: 48000 });
    expect(o.totals.committed).toBe(0); // drafts don't commit anything
    await expect(s.costs.saveEntry(7, { commitmentId: sc.id, description: 'Pay app 1', amount: 1000, csiCodeId: 'C03' }, finance)).rejects.toThrow(/is draft/);
    o = await s.costs.commitmentStep(sc.id, 'approve', { version: sc.version }, finance);
    sc = o.commitments[0];
    o = await s.costs.saveEntry(7, { commitmentId: sc.id, type: 'subcontract_invoice', reference: 'PA-1', description: 'Pay app 1', amount: 20000, csiCodeId: 'C03', date: '2026-08-10' }, finance);
    const c03 = o.rows.find((r: any) => r.csiCodeId === 'C03');
    expect(c03).toMatchObject({ budget: 60000, committed: 48000, commitmentBilled: 20000, open: 28000, actual: 20000, eac: 60000, code: '03', division: 'Concrete' });
    expect(o.commitments[0]).toMatchObject({ billed: 20000, remaining: 28000 });
    expect(o.entries[0]).toMatchObject({ vendorName: 'Bay Concrete Inc.', dueDate: '2026-09-09', status: 'recorded' });
    await expect(s.costs.saveEntry(7, { commitmentId: sc.id, description: 'Pay app 2', amount: 30000, csiCodeId: 'C03' }, finance)).rejects.toThrow(/Revise the commitment, or give a reason/);
    o = await s.costs.saveEntry(7, { commitmentId: sc.id, description: 'Pay app 2 incl. extra rebar', amount: 30000, csiCodeId: 'C03', overrideReason: 'Rebar extra agreed on site; CO to follow' }, finance);
    expect(o.rows.find((r: any) => r.csiCodeId === 'C03')).toMatchObject({ actual: 50000, open: 0, eac: 60000 });
    await expect(s.costs.commitmentStep(sc.id, 'void', { version: o.commitments[0].version, reason: 'x' }, finance)).rejects.toThrow(/close it instead/);
    o = await s.costs.commitmentStep(sc.id, 'close', { version: o.commitments[0].version }, finance);
    expect(o.commitments[0].status).toBe('closed');
    // Revising an approved commitment needs approve rights and a reason; never below billed.
    const e = o.entries.find((x: any) => x.reference === 'PA-1');
    o = await s.costs.entryStep(e.id, 'approve', { version: e.version }, finance);
    o = await s.costs.entryStep(e.id, 'pay', { version: o.entries.find((x: any) => x.id === e.id).version, paidDate: '2026-09-01', paymentRef: 'CHK 1044' }, finance);
    expect(o.entries.find((x: any) => x.id === e.id)).toMatchObject({ status: 'paid', paymentRef: 'CHK 1044' });
  });

  it('labor from approved timesheets (with burden), reimbursable costs and change-order costs all land on their codes', async () => {
    const s = await costed();
    s.t.timesheets.rows.push({ id: 'TS1', employeeId: 'E1', weekStart: '2026-08-31', status: 'approved' }, { id: 'TS2', employeeId: 'E1', weekStart: '2026-09-07', status: 'draft' });
    s.t.timesheetLines.rows.push(
      { id: 'L1', timesheetId: 'TS1', employeeId: 'E1', kind: 'project', projectId: 7, csiCodeId: 'C03', days: { '2026-09-01': { hours: 8 }, '2026-09-02': { hours: 10 } }, order: 0 },
      { id: 'L2', timesheetId: 'TS2', employeeId: 'E1', kind: 'project', projectId: 7, csiCodeId: 'C03', days: { '2026-09-08': { hours: 8 } }, order: 0 },
    );
    // 18 h: 16 ordinary + 2 overtime at 1.5 -> 16x50 + 2x75 = 950, +30% burden = 1,235.
    let o = await s.costs.overview(7, finance);
    expect(o.rows.find((r: any) => r.csiCodeId === 'C03')).toMatchObject({ labor: 1235, laborHours: 18, actual: 1235 });
    expect(o.labor).toMatchObject({ hours: 18, wage: 950, cost: 1235 });
    expect(o.labor.people[0]).toMatchObject({ name: 'Robert Johnson', hours: 18, otHours: 2 });
    const r = await s.reimb.create(7, { description: 'Tile samples', cost: 300, csiCodeId: 'C09' }, finance);
    await s.reimb.decide(r.id, { decision: 'approve', version: r.version }, finance);
    const co = await s.cos.create(7, { title: 'Upgraded tile', items: [{ description: 'Porcelain upgrade', targetType: 'phase', phaseId: 'PH-D1', amount: 8000, cost: 6000, csiCodeId: 'C09' }] }, finance);
    await s.cos.act(co.id, 'client_approve', { version: co.version, signer: 'Pat Owner' }, finance);
    o = await s.costs.overview(7, finance);
    expect(o.rows.find((r: any) => r.csiCodeId === 'C09')).toMatchObject({ budgetOriginal: 90000, budgetChanges: 6000, budget: 96000, reimbursable: 300, actual: 300 });
    // Contract 508,000; forecast cost = budget 156,000 (reimbursable cost kept apart) -> margin 352,000.
    expect(o.profitability).toMatchObject({ contract: 508000, projectedCost: 155700, projectedMargin: 352300, costToDate: 1235 });
    o = await s.costs.setForecast(7, { csiCodeId: 'C03', eac: 70000, note: 'Soils report: deeper footings' }, finance);
    expect(o.rows.find((r: any) => r.csiCodeId === 'C03')).toMatchObject({ eac: 70000, eacOverridden: true, variance: -10000 });
  });

  it('reports: WIP, AR aging, contract vs invoiced and the cash forecast agree with the project', async () => {
    const s = await costed();
    await s.fin.reportProgress('task', 'T-1', { pct: 100, version: v(s.t.tfin.rows, (r) => r.taskId === 'T-1') }, pm);
    const d = await s.inv.createDraft(7, { billReady: true }, finance);
    const i = await s.inv.issue(d.id, { version: d.version }, finance); // 75,000 - 7,500 = 67,500
    // Issued long ago -- pinned, so the report "as of 2026-09-24" includes it whatever today's date is.
    Object.assign(s.t.invoices.rows.find((x: any) => x.id === i.id), { invoiceDate: '2026-06-01', dueDate: '2026-07-01' });
    await s.inv.recordPayment(i.id, { amount: 7500, date: '2026-07-15' }, finance);
    await s.costs.saveEntry(7, { description: 'Concrete supply', amount: 12000, csiCodeId: 'C03', date: '2026-09-20', dueDate: '2026-10-20' }, finance);
    const aging = await s.reports.arAging(finance, '2026-09-24');
    expect(aging.invoices[0]).toMatchObject({ number: 'INV-2026-0001', bucket: 'd61_90', daysPastDue: 85, outstanding: 60000 });
    expect(aging.totals).toMatchObject({ d61_90: 60000, total: 60000 });
    const wip = await s.reports.wip(finance);
    expect(wip.rows[0]).toMatchObject({ contract: 500000, costToDate: 12000, projectedCost: 150000, billed: 75000, earnedRevenue: 40000, overUnderBilling: 35000 });
    expect(wip.withoutCosts).toEqual([]);
    const cvi = await s.reports.contractVsInvoiced(finance);
    expect(cvi.rows[0]).toMatchObject({ revised: 500000, invoiced: 75000, billedPct: 15, paid: 7500, outstanding: 60000 });
    const cash = await s.reports.cashForecast(finance, 3);
    expect(cash.months[0]).toMatchObject({ in: 60000 }); // overdue lands in this month
    expect(cash.months.reduce((a: number, m: any) => a + m.out, 0)).toBe(12000);
    await expect(s.reports.wip(viewer)).rejects.toThrow(/job cost/);
    const forViewer = await s.reports.cashForecast(viewer, 3);
    expect(forViewer.showCosts).toBe(false);
  });
});

// ------------------------------------------------------------------ subcontractor portal

describe('subcontractor portal', () => {
  const { PortalService } = require('./portal.service');
  const { RolesGuard } = require('../auth/guards/roles.guard');
  const { ProjectAccessService } = require('../auth/project-access.service');
  const { PORTAL_KEY } = require('../auth/guards/roles.decorator');
  const sub = { sub: 'U-VK1', roleKey: 'vendor_portal', tier: 'consultant', name: 'Maria (Bay Concrete)', email: 'ap@bayconcrete.example' } as any;

  function portalSetup() {
    const s = setup();
    s.t.contractors.rows.push({ id: 'K2', companyName: 'Other Drywall', status: 'active' });
    Object.assign(s.t.contractors.rows[0], { userId: 'U-VK1', email: 'ap@bayconcrete.example', contactPerson: 'Maria Lopez' });
    s.t.commitments.rows.push(
      { id: 'CM-1', projectId: 7, number: 'SC-001', type: 'subcontract', contractorId: 'K1', vendorName: 'Bay Concrete Inc.', title: 'Concrete', status: 'approved', version: 1,
        sharedAttachments: [{ id: 'att-1', name: 'Drawings.pdf', kind: 'drive', driveFileId: 'd1' }], attachments: [{ id: 'att-int', name: 'Internal.xlsx', kind: 'drive' }] },
      { id: 'CM-2', projectId: 7, number: 'SC-002', type: 'subcontract', contractorId: 'K2', vendorName: 'Other Drywall', title: 'Drywall', status: 'approved', version: 1 },
      { id: 'CM-3', projectId: 7, number: 'SC-003', type: 'subcontract', contractorId: 'K1', vendorName: 'Bay Concrete Inc.', title: 'Not yet approved', status: 'draft', version: 1 },
    );
    s.t.commitmentLines.rows.push(
      { id: 'CL-1', commitmentId: 'CM-1', lineOrder: 0, description: 'Construction phase', phaseId: 'PH-C1', amount: 10000 },
      { id: 'CL-2', commitmentId: 'CM-1', lineOrder: 1, description: 'Programming support', phaseId: 'PH-D1', amount: 5000 },
      { id: 'CL-3', commitmentId: 'CM-2', lineOrder: 0, description: 'Drywall', phaseId: 'PH-C1', amount: 8000 },
    );
    const users = table([
      { id: 'U-VK1', name: 'Maria Lopez', email: 'ap@bayconcrete.example', tier: 'consultant', roleKey: 'vendor_portal', status: 'active', passwordHash: 'x' },
      { id: 'U-STAFF', name: 'Stan', email: 'stan@origami.example', tier: 'internal', roleKey: 'pm', status: 'active' },
    ]);
    const auth = { sendInvite: jest.fn(async (u: any) => ({ sent: true, to: u.email, url: 'https://app.example/set-password?token=t' })) };
    const settings = { getMany: jest.fn(async () => ({})), baseUrl: jest.fn(async () => 'https://app.example') };
    const google = { sendMail: jest.fn(async (_m: any) => ({})) };
    const portal = new PortalService(s.t.contractors, s.t.commitments, s.t.commitmentLines, s.t.entries, s.t.projects, s.t.phases, s.t.tasks, users, s.fin, auth, settings, google, undefined);
    const hub = new FinanceHubService(s.fin, s.t.projects, s.t.pfin, s.t.cos, s.t.coItems, s.t.reimbs, s.t.releases, s.t.invoices, s.t.phfin, s.t.tfin, s.t.phases, s.t.tasks, s.t.activity, s.t.lines, undefined, s.t.entries);
    return { ...s, portal, users, auth, google, hub };
  }

  it('shows a subcontractor only their own approved subcontracts, with milestone task progress and shared files', async () => {
    const s = portalSetup();
    const ov = await s.portal.overview(sub);
    expect(ov.vendor.name).toBe('Bay Concrete Inc.');
    expect(ov.subcontracts.map((x: any) => x.number)).toEqual(['SC-001']);
    expect(ov.totals.committed).toBe(15000);
    const d = await s.portal.subcontract(sub, 'CM-1');
    const m = d.milestones.find((x: any) => x.id === 'CL-1');
    expect(m.progress).toEqual({ done: 1, total: 2 }); // the sub-task isn't counted
    expect(d.files.map((f: any) => f.name)).toEqual(['Drawings.pdf']); // internal documents stay internal
    await expect(s.portal.subcontract(sub, 'CM-2')).rejects.toThrow(/not found/i);
    await expect(s.portal.subcontract(sub, 'CM-3')).rejects.toThrow(/not found/i);
    await expect(s.portal.file(sub, { subcontractId: 'CM-1' }, 'att-int')).rejects.toThrow(/not found/i);
    await expect(s.portal.file(sub, { subcontractId: 'CM-2' }, 'att-1')).rejects.toThrow(/not found/i);
  });

  it('refuses staff, unlinked and removed accounts', async () => {
    const s = portalSetup();
    await expect(s.portal.overview({ ...sub, roleKey: 'pm', tier: 'internal' })).rejects.toThrow(/subcontractor portal/);
    await expect(s.portal.overview({ ...sub, sub: 'U-OTHER' })).rejects.toThrow(/linked/);
    s.users.rows[0].status = 'suspended';
    await expect(s.portal.overview(sub)).rejects.toThrow(/removed/);
  });

  it('takes an invoice against milestones, never past what is left, and puts it in the approvals inbox', async () => {
    const s = portalSetup();
    await expect(s.portal.submit(sub, { subcontractId: 'CM-1', reference: 'INV-9', lines: [{ milestoneId: 'CL-1', amount: 10000.01 }] })).rejects.toThrow(/left to invoice/);
    await expect(s.portal.submit(sub, { subcontractId: 'CM-2', reference: 'INV-9', lines: [{ milestoneId: 'CL-3', amount: 10 }] })).rejects.toThrow(/your subcontracts/);
    await expect(s.portal.submit(sub, { subcontractId: 'CM-1', reference: '', lines: [{ milestoneId: 'CL-1', amount: 10 }] })).rejects.toThrow(/invoice number/);
    const r = await s.portal.submit(sub, { subcontractId: 'CM-1', reference: 'INV-9', date: '2026-09-20', lines: [{ milestoneId: 'CL-1', amount: 4000 }, { milestoneId: 'CL-2', amount: 1000 }] });
    const rows = s.t.entries.rows.filter((e: any) => e.batchId === r.batchId);
    expect(rows).toHaveLength(2);
    expect(rows.every((e: any) => e.source === 'portal' && e.status === 'recorded' && e.contractorId === 'K1' && e.commitmentId === 'CM-1')).toBe(true);
    expect(rows.find((e: any) => e.phaseId === 'PH-C1').amount).toBe(4000);
    expect(r.invoices[0]).toMatchObject({ reference: 'INV-9', total: 5000, status: 'submitted' });
    await expect(s.portal.submit(sub, { subcontractId: 'CM-1', reference: 'inv-9', lines: [{ milestoneId: 'CL-1', amount: 1 }] })).rejects.toThrow(/already been sent/);
    await expect(s.portal.submit(sub, { subcontractId: 'CM-1', reference: 'INV-10', lines: [{ milestoneId: 'CL-1', amount: 6000.01 }] })).rejects.toThrow(/left to invoice/);
    const inbox = await s.hub.pending(finance);
    expect(inbox.find((p: any) => p.type === 'vendor_bill')).toMatchObject({ id: r.batchId, amount: 5000, canAct: true });
    // Staff can't delete it out from under them -- only return it with a reason.
    await expect(s.costs.entryStep(rows[0].id, 'delete', { version: rows[0].version }, finance)).rejects.toThrow(/portal/);
  });

  it('shows approval, payment and returns, and emails once per invoice', async () => {
    const s = portalSetup();
    const r = await s.portal.submit(sub, { subcontractId: 'CM-1', reference: 'INV-9', lines: [{ milestoneId: 'CL-1', amount: 4000 }, { milestoneId: 'CL-2', amount: 1000 }] });
    const [a, b] = s.t.entries.rows.filter((e: any) => e.batchId === r.batchId);
    await s.costs.entryStep(a.id, 'approve', { version: a.version }, finance);
    await s.portal.notifyStatus(s.t.entries.rows.find((e: any) => e.id === a.id));
    expect(s.google.sendMail).not.toHaveBeenCalled(); // half the invoice is still waiting
    await s.costs.entryStep(b.id, 'approve', { version: b.version }, finance);
    await s.portal.notifyStatus(s.t.entries.rows.find((e: any) => e.id === b.id));
    expect(s.google.sendMail).toHaveBeenCalledTimes(1);
    expect(s.google.sendMail.mock.calls[0][0]).toMatchObject({ to: 'ap@bayconcrete.example', subject: 'Approved: INV-9' });
    expect((await s.portal.invoices(sub))[0].status).toBe('approved');
    for (const e of s.t.entries.rows.filter((x: any) => x.batchId === r.batchId)) await s.costs.entryStep(e.id, 'pay', { version: e.version, paidDate: '2026-09-24', paymentRef: 'ACH-77' }, finance);
    const paid = (await s.portal.invoices(sub))[0];
    expect(paid).toMatchObject({ status: 'paid', paidDate: '2026-09-24', paymentRef: 'ACH-77' });
    expect((await s.portal.overview(sub)).totals.paid).toBe(5000);
    // A returned invoice frees the milestone to be billed again.
    const r2 = await s.portal.submit(sub, { subcontractId: 'CM-1', reference: 'INV-10', lines: [{ milestoneId: 'CL-1', amount: 6000 }] });
    const c = s.t.entries.rows.find((e: any) => e.batchId === r2.batchId);
    await s.costs.entryStep(c.id, 'void', { version: c.version, reason: 'Wrong retention' }, finance);
    const back = (await s.portal.invoices(sub)).find((i: any) => i.reference === 'INV-10');
    expect(back).toMatchObject({ status: 'returned', returnedReason: 'Wrong retention' });
    await s.portal.submit(sub, { subcontractId: 'CM-1', reference: 'INV-10', lines: [{ milestoneId: 'CL-1', amount: 6000 }] });
  });

  it('invites a contractor to the portal, and refuses an email that belongs to staff', async () => {
    const s = portalSetup();
    await expect(s.portal.invite('K2', { email: 'stan@origami.example' }, finance)).rejects.toThrow(/already has an account/);
    await expect(s.portal.invite('K2', { email: 'ap@bayconcrete.example' }, finance)).rejects.toThrow(/Bay Concrete/);
    const res = await s.portal.invite('K2', { email: 'Office@Drywall.example', name: 'Omar' }, finance);
    const k2 = s.t.contractors.rows.find((k: any) => k.id === 'K2');
    const u = s.users.rows.find((x: any) => x.id === k2.userId);
    expect(u).toMatchObject({ email: 'office@drywall.example', roleKey: 'vendor_portal', tier: 'consultant', status: 'pending' });
    expect(res.status).toBe('invited');
    expect(s.auth.sendInvite).toHaveBeenCalledWith(expect.objectContaining({ id: u.id }), 'invite');
    await expect(s.portal.invite('K2', {}, viewer)).rejects.toThrow();
    expect((await s.portal.revoke('K2', finance)).status).toBe('removed');
  });

  it('keeps portal accounts inside the portal', () => {
    let portalRoute = false;
    const guard = new RolesGuard({ getAllAndOverride: (key: string) => (key === PORTAL_KEY ? portalRoute : undefined) } as any);
    const ctx = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ claims: sub, method: 'GET', originalUrl: '/api/projects' }) }) } as any;
    expect(() => guard.canActivate(ctx)).toThrow(/does not have access/);
    portalRoute = true;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('limits outside accounts to the projects they are linked to', async () => {
    const people = { createQueryBuilder: () => ({ where: (_: string, p: any) => ({ getMany: async () => (p.email === 'client@owner.example' ? [{ projects: ['Marina Tower'] }] : []) }) }) };
    const projects = table([{ id: 7, name: 'Marina Tower' }, { id: 8, name: 'Hillside' }]);
    const pa = new ProjectAccessService(people as any, projects);
    expect(await pa.allowedIds({ sub: 'U-A', roleKey: 'pm', tier: 'internal' } as any)).toBe('all');
    expect([...(await pa.allowedIds({ sub: 'U-C', roleKey: 'client', tier: 'client', email: 'Client@Owner.example' } as any) as Set<number>)]).toEqual([7]);
    expect((await pa.allowedIds(sub) as Set<number>).size).toBe(0);
    await expect(pa.assert({ sub: 'U-C', roleKey: 'client', tier: 'client', email: 'client@owner.example' } as any, 8)).rejects.toThrow(/access/);
  });
});
