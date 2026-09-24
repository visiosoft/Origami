import { SampleDataService } from './sample-data.service';
import { PayrollService } from './payroll.service';
import { US_COMPONENTS } from './payroll-setup.service';
import { DEFAULT_LEAVE_TYPES } from './leave.service';
import { DEFAULT_SUBCONTRACTOR_TRADES } from '../seed-data/subcontractor-trades';
import { DEFAULT_PAYROLL_SETTINGS } from './payroll.calc';
import {
  EmployeeAdvanceEntity, LeaveAdjustmentEntity, OvertimeRequestEntity, PayrollRunEntity, PayslipEntity,
} from '../database/entities';
import type { Actor, ManpowerAccess } from './manpower-access.service';

/** In-memory repository: understands Like('X%'), In([...]) and the few query-builder filters payroll uses. */
function table(rows: any[] = []) {
  const test = (v: any, want: any) => {
    if (want && typeof want === 'object' && want._type === 'like') return typeof v === 'string' && v.startsWith(String(want._value).replace(/%$/, ''));
    if (want && typeof want === 'object' && want._type === 'in') return want._value.includes(v);
    return v === want;
  };
  const match = (r: any, where: any) => Object.entries(where || {}).every(([k, v]) => test(r[k], v));
  const qb = () => {
    const clauses: string[] = [];
    let params: Record<string, any> = {};
    const b: any = {
      where: (c: string, p?: any) => { clauses.push(c); params = { ...params, ...p }; return b; },
      andWhere: (c: string, p?: any) => b.where(c, p),
      orderBy: () => b,
      getMany: async () => rows.filter((r) => clauses.flatMap((c) => c.split(' AND ')).every((c) => {
        const [, col, op, key] = /\w+\.(\w+)\s*(=|>=|<=|IS NULL)\s*:?(\w+)?/.exec(c.trim())!;
        if (op === 'IS NULL') return r[col] == null;
        const v = params[key];
        return op === '=' ? r[col] === v : op === '>=' ? r[col] >= v : r[col] <= v;
      })),
    };
    return b;
  };
  const t: any = {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where))),
    findBy: jest.fn(async (w: any) => rows.filter((r) => match(r, w))),
    findOneBy: jest.fn(async (w: any) => rows.find((r) => match(r, w)) ?? null),
    count: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).length),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push(it); } return x; }),
    remove: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows.splice(i, 1); } return x; }),
    delete: jest.fn(async (where: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1); }),
    update: jest.fn(async (where: any, patch: any) => { rows.filter((r) => match(r, where)).forEach((r) => Object.assign(r, patch)); }),
    createQueryBuilder: () => qb(),
  };
  return t;
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
      csi: table([{ id: 'CSI-03', code: '03' }, { id: 'CSI-04', code: '04' }, { id: 'CSI-26_10', code: '26.10' }]),
      records: table(), assignments: table(), requests: table(), logs: table(),
      entries: table([{ id: 'LE-REAL', dailyLogId: 'DL-REAL', employeeId: 'E-REAL' }]),
      leave: table([{ id: 'LR-REAL', employeeId: 'E-REAL' }]), leaveAdj: table(), overtime: table(), advances: table(), shifts: table(),
      assets: table([{ id: 'AS-REAL', assetTag: 'AST-0003' }]), assetIssues: table(), units: table(), beds: table(), complaints: table(),
      routes: table(), riders: table(), payslips: table(), runs: table(),
      components: table(US_COMPONENTS.map((c, i) => ({ ...c, id: i === 4 ? 'PC-FED' : i === 7 ? 'PC-ST' : `PC-${i}`, order: i }))),
      leaveTypes: table(DEFAULT_LEAVE_TYPES.map((x, i) => ({ ...x, order: i }))),
      tsSheets: table(), tsLines: table(),
    };
    const byEntity = new Map<any, any>([
      [PayrollRunEntity, t.runs], [PayslipEntity, t.payslips], [OvertimeRequestEntity, t.overtime], [EmployeeAdvanceEntity, t.advances], [LeaveAdjustmentEntity, t.leaveAdj],
    ]);
    const manager = { getRepository: (e: any) => byEntity.get(e), transaction: async (fn: any) => fn(manager) };
    t.runs.manager = manager;
    const setupSvc = { settings: async () => DEFAULT_PAYROLL_SETTINGS, listComponents: async () => t.components.rows };
    // The real payroll engine, over the same tables.
    const payroll = new PayrollService(t.runs, t.payslips, t.employees, t.logs, t.entries, t.overtime, t.advances, t.components, setupSvc as any, access,
      t.leave, t.leaveTypes, t.leaveAdj, table(), t.shifts, table());
    const svc = new (SampleDataService as any)(
      t.employees, t.contractors, t.subTrades, t.projects, t.csi, t.records, t.assignments, t.requests, t.logs, t.entries,
      t.leave, t.leaveAdj, t.overtime, t.advances, t.shifts, t.assets, t.assetIssues, t.units, t.beds, t.complaints, t.routes, t.riders,
      t.payslips, t.runs, setupSvc, access, payroll, t.tsSheets, t.tsLines,
    ) as SampleDataService;
    return { svc, t };
  };

  it('loads a full crew once, tagged, on the existing projects and trades', async () => {
    const { svc, t } = setup();
    const r = await svc.load(admin);
    expect(r).toMatchObject({ loaded: true, employees: 17, contractors: 2, payrollRuns: 2, projectsUsed: 2 });
    await expect(svc.load(admin)).rejects.toThrow(/already loaded/);
    expect(t.contractors.rows.find((c: any) => c.id === 'DEMO-CTR1').tradeIds).toEqual(['SCT-C-10', 'SCT-C-7']);
    expect(t.employees.rows.find((e: any) => e.id === 'DEMO-E06').tradeId).toBe('SCT-C-29'); // Mason -> Masonry
    expect(t.employees.rows.find((e: any) => e.id === 'DEMO-E12')).toMatchObject({ trade: 'Driver', tradeId: undefined }); // not a licensed trade
    expect(t.employees.rows.find((e: any) => e.id === 'DEMO-E01')).toMatchObject({ name: 'Michael Thompson', taxState: 'CA' });
    expect(t.employees.rows.find((e: any) => e.id === 'DEMO-E01').payComponents.slice(0, 2)).toEqual([{ componentId: 'PC-FED', value: 12 }, { componentId: 'PC-ST', value: 6 }]);
    expect(t.employees.rows.every((e: any) => !e.nationalId || e.nationalId.startsWith('666-'))).toBe(true); // never-issued SSN range
    expect(t.assets.rows.find((a: any) => a.id === 'DEMO-AS1').assetTag).toBe('AST-0004'); // after the real AST-0003
    expect(t.logs.rows.length).toBeGreaterThan(20); // back to the start of last month
    // Office staff timesheets: past weeks approved, one sent back, one awaiting review, one draft.
    const byStatus = (st: string) => t.tsSheets.rows.filter((x: any) => x.status === st).length;
    expect([byStatus('approved'), byStatus('rejected'), byStatus('submitted'), byStatus('draft')]).toEqual([11, 1, 1, 1]);
    expect(t.tsLines.rows.every((l: any) => t.tsSheets.rows.some((x: any) => x.id === l.timesheetId))).toBe(true);
    expect(t.assignments.rows.every((a: any) => [7, 8].includes(a.projectId))).toBe(true);
    for (const tbl of Object.values(t) as any[]) for (const row of tbl.rows) if (String(row.id).startsWith('DEMO-')) expect(row.id).toMatch(/^DEMO-/);
  });

  it('runs payroll for the sample crew: last month finalized and paid, this month a draft', async () => {
    const { svc, t } = setup();
    await svc.load(admin);
    const [prev, cur] = ['DEMO-PR1', 'DEMO-PR2'].map((id) => t.runs.rows.find((r: any) => r.id === id));
    expect(prev).toMatchObject({ status: 'finalized' });
    expect(cur).toMatchObject({ status: 'draft' });
    expect(prev.periodStart < cur.periodStart).toBe(true);
    const slips = (run: string) => t.payslips.rows.filter((p: any) => p.runId === run);
    // Own staff only: not the subcontractors' workers, not the one who resigned.
    expect(slips('DEMO-PR1').map((p: any) => p.employeeId).sort()).toEqual(Array.from({ length: 13 }, (_, i) => `DEMO-E${String(i + 1).padStart(2, '0')}`));
    expect(slips('DEMO-PR1').every((p: any) => p.paymentStatus === 'paid' && p.paymentMethod === 'bank_transfer')).toBe(true);
    expect(prev.totals.paid).toBe(prev.totals.net);
    expect(prev.totals.net).toBeGreaterThan(0);
    // An hourly mason is paid for his logged hours, with FICA taken out.
    const mason = slips('DEMO-PR1').find((p: any) => p.employeeId === 'DEMO-E06');
    expect(mason.lines.find((l: any) => l.source === 'wages').amount).toBeGreaterThan(38.5 * 8 * 15);
    expect(mason.lines.some((l: any) => l.name.startsWith('Social Security'))).toBe(true);
    expect(mason.lines.some((l: any) => l.name.startsWith('Medicare'))).toBe(true);
    // Last month's overtime went on last month's slip and is now marked paid; the advance is recovering.
    expect(slips('DEMO-PR1').find((p: any) => p.employeeId === 'DEMO-E13').lines.some((l: any) => l.source === 'overtime')).toBe(true);
    expect(t.overtime.rows.find((o: any) => o.id === 'DEMO-OT4').payrollRunId).toBe('DEMO-PR1');
    expect(t.advances.rows.find((a: any) => a.id === 'DEMO-ADV1').recovered).toBe(500);
    expect(slips('DEMO-PR2').find((p: any) => p.employeeId === 'DEMO-E06').lines.some((l: any) => l.source === 'advance')).toBe(true);
    // Nobody is logged on a day they were on approved leave.
    const logDate = new Map(t.logs.rows.map((l: any) => [l.id, l.date]));
    for (const lr of t.leave.rows.filter((x: any) => x.status === 'approved')) {
      expect(t.entries.rows.some((e: any) => e.employeeId === lr.employeeId && (logDate.get(e.dailyLogId) as string) >= lr.startDate && (logDate.get(e.dailyLogId) as string) <= lr.endDate)).toBe(false);
    }
    await expect(svc.loadPayroll(admin)).rejects.toThrow(/already loaded/);
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

  it("won't remove sample employees that are in real finalized payroll -- the sample's own runs go with it", async () => {
    const { svc, t } = setup();
    await svc.load(admin);
    t.payslips.rows.push({ id: 'PS-1', runId: 'PR-1', employeeId: 'DEMO-E06', gross: 1, deductions: 0, net: 1 });
    t.runs.rows.push({ id: 'PR-1', label: 'August 2026 (real)', status: 'finalized' });
    await expect(svc.remove(admin)).rejects.toThrow(/August 2026 \(real\).*void it first/);
    expect(t.employees.rows.length).toBe(18);
    t.runs.rows.find((r: any) => r.id === 'PR-1').status = 'void';
    await svc.remove(admin);
    expect(t.runs.rows.map((r: any) => r.id)).toEqual(['PR-1']);
  });
});
