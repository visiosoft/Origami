import { SampleDataService } from './sample-data.service';
import { DEFAULT_SUBCONTRACTOR_TRADES } from '../seed-data/subcontractor-trades';
import { DEFAULT_PAYROLL_SETTINGS } from './payroll.calc';
import type { Actor, ManpowerAccess } from './manpower-access.service';

/** In-memory repository that understands Like('X%') the way the sample loader/remover uses it. */
function table(rows: any[] = []) {
  const test = (v: any, want: any) => {
    if (want && typeof want === 'object' && want._type === 'like') return typeof v === 'string' && v.startsWith(String(want._value).replace(/%$/, ''));
    return v === want;
  };
  const match = (r: any, where: any) => Object.entries(where || {}).every(([k, v]) => test(r[k], v));
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where))),
    count: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).length),
    save: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push({ ...it }); } return x; }),
    delete: jest.fn(async (where: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1); }),
    update: jest.fn(async (where: any, patch: any) => { rows.filter((r) => match(r, where)).forEach((r) => Object.assign(r, patch)); }),
  } as any;
}

describe('SampleDataService', () => {
  const admin: Actor = { id: 'U-1', name: 'Admin', roleKey: 'admin' };
  const access = { require: jest.fn(async () => undefined) } as unknown as ManpowerAccess;

  const setup = () => {
    const t = {
      employees: table([{ id: 'E-REAL', name: 'Real Person', supervisorId: 'DEMO-E04' }]),
      contractors: table([{ id: 'CTR-REAL', companyName: 'Real Co' }]),
      subTrades: table(DEFAULT_SUBCONTRACTOR_TRADES.map((x) => ({ ...x }))),
      projects: table([{ id: 7, name: 'Tower', stage: 'Construction' }, { id: 8, name: 'Villas', stage: 'Construction' }]),
      csi: table([{ id: 'CSI-1', code: '03 00 00' }, { id: 'CSI-2', code: '04 00 00' }]),
      records: table(), assignments: table(), requests: table(), logs: table(),
      entries: table([{ id: 'LE-REAL', dailyLogId: 'DL-REAL', employeeId: 'E-REAL' }]),
      leave: table([{ id: 'LR-REAL', employeeId: 'E-REAL' }]), leaveAdj: table(), overtime: table(), advances: table(), shifts: table(),
      assets: table([{ id: 'AS-REAL', assetTag: 'AST-0003' }]), assetIssues: table(), units: table(), beds: table(), complaints: table(),
      routes: table(), riders: table(), payslips: table(), runs: table(),
    };
    const svc = new (SampleDataService as any)(
      t.employees, t.contractors, t.subTrades, t.projects, t.csi, t.records, t.assignments, t.requests, t.logs, t.entries,
      t.leave, t.leaveAdj, t.overtime, t.advances, t.shifts, t.assets, t.assetIssues, t.units, t.beds, t.complaints, t.routes, t.riders,
      t.payslips, t.runs, { settings: async () => DEFAULT_PAYROLL_SETTINGS }, access,
    ) as SampleDataService;
    return { svc, t };
  };

  it('loads a full crew once, tagged, on the existing projects and trades', async () => {
    const { svc, t } = setup();
    const r = await svc.load(admin);
    expect(r).toMatchObject({ loaded: true, employees: 17, contractors: 2, projectsUsed: 2 });
    await expect(svc.load(admin)).rejects.toThrow(/already loaded/);
    expect(t.contractors.rows.find((c: any) => c.id === 'DEMO-CTR1').tradeIds).toEqual(['SCT-C-10', 'SCT-C-7']);
    expect(t.employees.rows.find((e: any) => e.id === 'DEMO-E06').tradeId).toBe('SCT-C-29'); // Mason -> Masonry
    expect(t.employees.rows.find((e: any) => e.id === 'DEMO-E12')).toMatchObject({ trade: 'Driver', tradeId: undefined }); // not a licensed trade
    expect(t.assets.rows.find((a: any) => a.id === 'DEMO-AS1').assetTag).toBe('AST-0004'); // after the real AST-0003
    expect(t.logs.rows.length).toBe(6);
    expect(t.assignments.rows.every((a: any) => [7, 8].includes(a.projectId))).toBe(true);
    for (const tbl of Object.values(t) as any[]) for (const row of tbl.rows) if (String(row.id).startsWith('DEMO-')) expect(row.id).toMatch(/^DEMO-/);
  });

  it('removes every sample row and nothing real, unlinking real rows that pointed at a sample employee', async () => {
    const { svc, t } = setup();
    await svc.load(admin);
    // Something a real user did against sample data after loading it.
    t.leave.rows.push({ id: 'LR-X', employeeId: 'DEMO-E07' });
    t.payslips.rows.push({ id: 'PS-1', runId: 'PR-1', employeeId: 'DEMO-E06', gross: 60000, deductions: 0, net: 60000, paymentStatus: 'unpaid' });
    t.payslips.rows.push({ id: 'PS-2', runId: 'PR-1', employeeId: 'E-REAL', gross: 50000, deductions: 5000, net: 45000, paymentStatus: 'unpaid' });
    t.runs.rows.push({ id: 'PR-1', label: 'Sept', status: 'draft', totals: { headcount: 2 } });

    const r = await svc.remove(admin);
    expect(r).toMatchObject({ loaded: false, employees: 0, contractors: 0 });
    for (const [name, tbl] of Object.entries(t) as [string, any][]) {
      const left = tbl.rows.filter((x: any) => Object.values(x).some((v) => typeof v === 'string' && v.startsWith('DEMO-')));
      expect([name, left]).toEqual([name, []]);
    }
    expect(t.employees.rows).toEqual([{ id: 'E-REAL', name: 'Real Person', supervisorId: null }]);
    expect(t.contractors.rows.map((c: any) => c.id)).toEqual(['CTR-REAL']);
    expect(t.leave.rows.map((x: any) => x.id)).toEqual(['LR-REAL']);
    expect(t.entries.rows.map((x: any) => x.id)).toEqual(['LE-REAL']);
    expect(t.assets.rows.map((x: any) => x.id)).toEqual(['AS-REAL']);
    expect(t.runs.rows[0].totals).toMatchObject({ headcount: 1, gross: 50000, net: 45000 });
  });

  it("won't remove sample employees that are in finalized payroll", async () => {
    const { svc, t } = setup();
    await svc.load(admin);
    t.payslips.rows.push({ id: 'PS-1', runId: 'PR-1', employeeId: 'DEMO-E06', gross: 1, deductions: 0, net: 1 });
    t.runs.rows.push({ id: 'PR-1', label: 'August 2026', status: 'finalized' });
    await expect(svc.remove(admin)).rejects.toThrow(/August 2026.*void it first/);
    expect(t.employees.rows.length).toBe(18);
  });
});
