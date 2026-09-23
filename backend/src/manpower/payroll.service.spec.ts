import {
  EmployeeAdvanceEntity, EmployeeEntity, LeaveAdjustmentEntity, OvertimeRequestEntity, PayComponentEntity, PayrollRunEntity, PayslipEntity,
} from '../database/entities';
import { AdvancesService } from './advances.service';
import { OvertimeService } from './overtime.service';
import { PayrollService } from './payroll.service';
import { LEGACY_PAYROLL_SETTINGS as DEFAULT_PAYROLL_SETTINGS } from './payroll.calc';
import type { Actor, ManpowerAccess } from './manpower-access.service';

/** Just enough of a TypeORM repository, over an array. */
function table<T extends { id: any }>(rows: T[]) {
  const match = (row: any, where: any) => Object.entries(where || {}).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && '_value' in v && Array.isArray(v._value)) return v._value.includes(row[k]);
    return row[k] === v;
  });
  const t: any = {
    rows,
    find: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where))),
    findBy: jest.fn(async (where: any) => rows.filter((r) => match(r, where))),
    findOneBy: jest.fn(async (where: any) => rows.find((r) => match(r, where)) ?? null),
    count: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where)).length),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => {
      for (const item of Array.isArray(x) ? x : [x]) {
        const i = rows.findIndex((r) => r.id === item.id);
        if (i >= 0) rows[i] = item; else rows.push(item);
      }
      return x;
    }),
    remove: jest.fn(async (x: any) => {
      for (const item of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === item.id); if (i >= 0) rows.splice(i, 1); }
      return x;
    }),
    delete: jest.fn(async (where: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1); }),
  };
  return t;
}

/** Role -> modules it may manage, standing in for the Roles table. */
const ROLES: Record<string, string[]> = {
  admin: ['*'], site_super: ['manpower_con'], hr_officer: ['manpower_con'], accounting: ['fin_resources'],
};
const access = {
  can: jest.fn(async (a: Actor, m: string) => !!a.roleKey && (ROLES[a.roleKey]?.includes('*') || ROLES[a.roleKey]?.includes(m))),
  require: jest.fn(async (a: Actor, m: string, what: string) => {
    if (!(await access.can(a, m))) throw new Error(`Your role doesn't allow you to ${what}.`);
  }),
} as unknown as ManpowerAccess;

const clerk: Actor = { id: 'U-CLERK', name: 'Clerk', roleKey: 'site_super' };
const manager: Actor = { id: 'U-MGR', name: 'Manager', roleKey: 'site_super' };
const hr: Actor = { id: 'U-HR', name: 'HR', roleKey: 'hr_officer' };
const finance: Actor = { id: 'U-FIN', name: 'Finance', roleKey: 'accounting' };

const employee = (over: Partial<EmployeeEntity> = {}): EmployeeEntity =>
  ({ id: 'E1', name: 'Ali', status: 'active', employmentStatus: 'active', payType: 'daily', payRate: 2000, payComponents: [], ...over }) as EmployeeEntity;

// ------------------------------------------------------------------ advances

describe('AdvancesService approval chain', () => {
  const setup = () => {
    const advances = table<EmployeeAdvanceEntity>([]);
    const employees = table<EmployeeEntity>([employee(), employee({ id: 'E2', name: 'Hamza', contractorId: 'CTR-1' })]);
    return { svc: new AdvancesService(advances as any, employees as any, access), advances };
  };

  it('splits the amount into instalments and starts at the manager step', async () => {
    const { svc } = setup();
    const a = await svc.create({ employeeId: 'E1', type: 'loan', amount: 50000, installments: 6, requestDate: '2026-09-24' }, clerk);
    expect(a.status).toBe('pending_manager');
    expect(a.installmentAmount).toBe(8333.34);
    expect(a.deductionStart).toBe('2026-10-01');
    expect(a.awaiting).toBe('Manager');
  });

  it("refuses advances for a contractor's worker", async () => {
    const { svc } = setup();
    await expect(svc.create({ employeeId: 'E2', type: 'salary_advance', amount: 1000 }, clerk)).rejects.toThrow(/contractor/);
  });

  it('goes manager -> HR -> finance with a different person at each step', async () => {
    const { svc } = setup();
    const a = await svc.create({ employeeId: 'E1', type: 'salary_advance', amount: 10000 }, clerk);
    await expect(svc.decide(a.id, 'approved', undefined, clerk)).rejects.toThrow(/someone else/);
    expect((await svc.decide(a.id, 'approved', undefined, manager)).status).toBe('pending_hr');
    await expect(svc.decide(a.id, 'approved', undefined, manager)).rejects.toThrow(/earlier step/);
    expect((await svc.decide(a.id, 'approved', undefined, hr)).status).toBe('pending_finance');
    await expect(svc.decide(a.id, 'approved', undefined, { id: 'U-X', name: 'Another HR', roleKey: 'hr_officer' })).rejects.toThrow(/Finance step/);
    const done = await svc.decide(a.id, 'approved', 'ok', finance);
    expect(done.status).toBe('approved');
    expect(done.approvals.map((x) => x.stage)).toEqual(['manager', 'hr', 'finance']);
  });

  it('only finance pays out, and manual repayments settle the balance', async () => {
    const { svc, advances } = setup();
    advances.rows.push({ id: 'ADV1', employeeId: 'E1', type: 'loan', amount: 3000, installments: 3, installmentAmount: 1000, deductionStart: '2026-01-01', status: 'approved', approvals: [], repayments: [], recovered: 0, requestDate: '2026-09-01', createdAt: '' } as any);
    await expect(svc.disburse('ADV1', {}, hr)).rejects.toThrow(/pay out/);
    const paid = await svc.disburse('ADV1', { date: '2026-09-24' }, finance);
    expect(paid.status).toBe('disbursed');
    expect(paid.deductionStart).toBe('2026-10-01');
    await expect(svc.repay('ADV1', { amount: 5000 }, finance)).rejects.toThrow(/Only 3000/);
    const settled = await svc.repay('ADV1', { amount: 3000 }, finance);
    expect(settled.status).toBe('settled');
    expect(settled.remaining).toBe(0);
  });
});

// ------------------------------------------------------------------ overtime

describe('OvertimeService', () => {
  const setup = () => {
    const ot = table<OvertimeRequestEntity>([]);
    const employees = table<EmployeeEntity>([employee({ userId: 'U-ALI' })]);
    const settings = { settings: jest.fn(async () => DEFAULT_PAYROLL_SETTINGS) };
    return { svc: new OvertimeService(ot as any, employees as any, {} as any, {} as any, settings as any, access), ot };
  };

  it('prices overtime at approval from the hourly rate and type multiplier', async () => {
    const { svc } = setup();
    const o = await svc.create({ employeeId: 'E1', date: '2026-09-20', hours: 4, otType: 'weekend' }, clerk);
    const approved = await svc.approve(o.id, undefined, manager);
    expect(approved).toMatchObject({ status: 'approved', baseRate: 250, multiplier: 2, amount: 2000 });
  });

  it('stops the requester, the worker, and roles without HR rights from approving', async () => {
    const { svc } = setup();
    const o = await svc.create({ employeeId: 'E1', date: '2026-09-20', hours: 2 }, clerk);
    await expect(svc.approve(o.id, undefined, clerk)).rejects.toThrow(/you requested/);
    await expect(svc.approve(o.id, undefined, { id: 'U-ALI', name: 'Ali', roleKey: 'site_super' })).rejects.toThrow(/your own/);
    await expect(svc.approve(o.id, undefined, finance)).rejects.toThrow(/approve overtime/);
  });

  it('rejects impossible hours', async () => {
    const { svc } = setup();
    await expect(svc.create({ employeeId: 'E1', date: '2026-09-20', hours: 20 }, clerk)).rejects.toThrow(/at most 16/);
  });
});

// ------------------------------------------------------------------ payroll runs

describe('PayrollService', () => {
  const setup = () => {
    const runs = table<PayrollRunEntity>([]);
    const slips = table<PayslipEntity>([]);
    const employees = table<EmployeeEntity>([
      employee(),
      employee({ id: 'E2', name: 'Hamza', contractorId: 'CTR-1' }),
      employee({ id: 'E3', name: 'Bilal', payType: 'monthly', payRate: 60000 }),
      employee({ id: 'E4', name: 'Left', employmentStatus: 'resigned' }),
    ]);
    const overtime = table<OvertimeRequestEntity>([{ id: 'OT1', employeeId: 'E1', date: '2026-09-10', hours: 16, status: 'approved', amount: 8000 } as any]);
    const advances = table<EmployeeAdvanceEntity>([{ id: 'ADV1', employeeId: 'E1', type: 'salary_advance', amount: 10000, installments: 1, installmentAmount: 10000, deductionStart: '2026-09-01', status: 'disbursed', approvals: [], repayments: [], recovered: 0 } as any]);
    const components = table<PayComponentEntity>([]);
    const leaveAdjustments = table<LeaveAdjustmentEntity>([]);
    const byEntity = new Map<any, any>([
      [PayrollRunEntity, runs], [PayslipEntity, slips], [OvertimeRequestEntity, overtime], [EmployeeAdvanceEntity, advances],
      [LeaveAdjustmentEntity, leaveAdjustments],
    ]);
    const manager = { getRepository: (e: any) => byEntity.get(e), transaction: async (fn: any) => fn(manager) };
    runs.manager = manager;
    const setupSvc = { settings: jest.fn(async () => DEFAULT_PAYROLL_SETTINGS) };
    const svc = new PayrollService(runs as any, slips as any, employees as any, {} as any, {} as any, overtime as any, advances as any, components as any, setupSvc as any, access,
      {} as any, {} as any, leaveAdjustments as any, {} as any, {} as any, {} as any);
    // Stand in for the database reads: 24 full days logged for Ali, the approved overtime, the advance due.
    jest.spyOn(svc as any, 'sources').mockImplementation(async () => ({
      dayHours: new Map([['E1', Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`2026-09-${String(i + 1).padStart(2, '0')}`, 8]))]]),
      overtime: new Map([['E1', overtime.rows.filter((o: any) => !o.payrollRunId && o.status === 'approved')]]),
      recoveries: new Map([['E1', advances.rows.filter((a: any) => a.status === 'disbursed').map((a: any) => ({ id: a.id, type: a.type, label: 'Salary advance', remaining: a.amount - a.recovered, installmentAmount: a.installmentAmount }))]]),
    }));
    return { svc, runs, slips, overtime, advances };
  };

  it('pays active own staff only -- not contractor workers or people who left', async () => {
    const { svc } = setup();
    const run = await svc.createRun({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }, hr);
    expect(run.payslips.map((p) => p.employeeId).sort()).toEqual(['E1', 'E3']);
    const ali = run.payslips.find((p) => p.employeeId === 'E1')!;
    expect(ali.net).toBe(46000);
    expect(run.totals).toMatchObject({ headcount: 2, net: 106000 });
  });

  it('refuses an overlapping run for the same people', async () => {
    const { svc } = setup();
    await svc.createRun({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }, hr);
    await expect(svc.createRun({ periodStart: '2026-09-15', periodEnd: '2026-10-14', payGroup: 'daily' }, hr)).rejects.toThrow(/already covers/);
  });

  it('only a finance role finalizes; finalizing marks overtime paid and books the recovery', async () => {
    const { svc, overtime, advances } = setup();
    const run = await svc.createRun({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }, hr);
    await expect(svc.finalize(run.id, hr)).rejects.toThrow(/finalize payroll/);
    const done = await svc.finalize(run.id, finance);
    expect(done.status).toBe('finalized');
    expect(overtime.rows[0].payrollRunId).toBe(run.id);
    expect(advances.rows[0]).toMatchObject({ recovered: 10000, status: 'settled' });
    expect(advances.rows[0].repayments[0]).toMatchObject({ method: 'payroll', runId: run.id, amount: 10000 });
    await expect(svc.updatePayslip(done.payslips[0].id, { notes: 'x' }, hr)).rejects.toThrow(/no longer be changed/);
  });

  it('will not finalize a stale draft that would double-pay overtime', async () => {
    const { svc, overtime } = setup();
    const run = await svc.createRun({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }, hr);
    overtime.rows[0].payrollRunId = 'SOME-OTHER-RUN';
    await expect(svc.finalize(run.id, finance)).rejects.toThrow(/Recalculate/);
  });

  it('voiding reverses the overtime link and the recovery, but not once anyone is paid', async () => {
    const { svc, overtime, advances } = setup();
    const run = await svc.createRun({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }, hr);
    await svc.finalize(run.id, finance);
    await expect(svc.voidRun(run.id, '', finance)).rejects.toThrow(/Say why/);
    await svc.voidRun(run.id, 'Wrong period', finance);
    expect(overtime.rows[0].payrollRunId).toBeNull();
    expect(advances.rows[0]).toMatchObject({ recovered: 0, status: 'disbursed', repayments: [] });

    const again = await svc.createRun({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }, hr);
    await svc.finalize(again.id, finance);
    await svc.markPaid(again.id, 'all', { method: 'cash' }, finance);
    await expect(svc.voidRun(again.id, 'Oops', finance)).rejects.toThrow(/no longer be voided/);
  });

  it('manual day counts and bonuses survive a recalculation', async () => {
    const { svc } = setup();
    const run = await svc.createRun({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }, hr);
    const ali = run.payslips.find((p) => p.employeeId === 'E1')!;
    const edited = await svc.updatePayslip(ali.id, { work: { fullDays: 20, halfDays: 0, extraHours: 0 }, manualLines: [{ name: 'Eid bonus', kind: 'earning', amount: 5000 }] }, hr);
    expect(edited.net).toBe(40000 + 8000 + 5000 - 10000);
    const again = await svc.recalculate(run.id, hr);
    expect(again.payslips.find((p) => p.employeeId === 'E1')!.net).toBe(43000);
  });
});
