import { computeBalance, entitlementFor, LeaveService, requestDaysInYear, DEFAULT_LEAVE_TYPES } from './leave.service';
import { DEFAULT_PAYROLL_SETTINGS } from './payroll.calc';
import type { EmployeeEntity, LeaveTypeEntity } from '../database/entities';
import type { Actor, ManpowerAccess } from './manpower-access.service';

function table<T extends { id: any }>(rows: T[]) {
  const match = (row: any, where: any) => Object.entries(where || {}).every(([k, v]) => row[k] === v);
  return {
    rows,
    find: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where))),
    findBy: jest.fn(async (where: any) => rows.filter((r) => match(r, where))),
    findOneBy: jest.fn(async (where: any) => rows.find((r) => match(r, where)) ?? null),
    count: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where)).length),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push(it); } return x; }),
    remove: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows.splice(i, 1); } return x; }),
  } as any;
}

const TYPES = DEFAULT_LEAVE_TYPES.map((t, i) => ({ ...t, order: i })) as LeaveTypeEntity[];
const annual = TYPES.find((t) => t.id === 'LT-ANNUAL')!;
const noHol = new Set<string>();
const SUNDAY_ONLY = [0];

describe('leave maths', () => {
  it('counts only working days: Sundays and public holidays are free', () => {
    // Mon 21 Sep - Sun 27 Sep 2026, with Wed 23 Sep a holiday: Mon Tue Thu Fri Sat = 5
    const r = { startDate: '2026-09-21', endDate: '2026-09-27', halfDay: false, status: 'approved', leaveTypeId: 'LT-ANNUAL' };
    expect(requestDaysInYear(r, 2026, SUNDAY_ONLY, new Set(['2026-09-23']))).toBe(5);
  });

  it('splits a request across New Year', () => {
    const r = { startDate: '2026-12-30', endDate: '2027-01-02', halfDay: false, status: 'approved', leaveTypeId: 'LT-ANNUAL' };
    expect(requestDaysInYear(r, 2026, SUNDAY_ONLY, noHol)).toBe(2);
    expect(requestDaysInYear(r, 2027, SUNDAY_ONLY, noHol)).toBe(2);
  });

  it('prorates the allowance for someone who joined during the year, to the half day', () => {
    expect(entitlementFor(annual, '2020-03-01', 2026)).toBe(10);
    expect(entitlementFor(annual, '2026-07-15', 2026)).toBe(5);   // 6 of 12 months
    expect(entitlementFor(annual, '2026-10-01', 2026)).toBe(2.5); // 3 of 12
    expect(entitlementFor(annual, '2027-01-01', 2026)).toBe(0);
  });

  it('balance = allowance + carried + adjustments - encashed - taken; pending shown separately', () => {
    const reqs = [
      { startDate: '2026-03-02', endDate: '2026-03-04', halfDay: false, status: 'approved', leaveTypeId: 'LT-ANNUAL' }, // 3
      { startDate: '2026-11-02', endDate: '2026-11-02', halfDay: true, status: 'pending', leaveTypeId: 'LT-ANNUAL' },   // 0.5
      { startDate: '2026-04-06', endDate: '2026-04-06', halfDay: false, status: 'rejected', leaveTypeId: 'LT-ANNUAL' },
    ];
    const adjs = [
      { leaveTypeId: 'LT-ANNUAL', year: 2026, kind: 'carry_forward', days: 4 },
      { leaveTypeId: 'LT-ANNUAL', year: 2026, kind: 'manual', days: -1 },
      { leaveTypeId: 'LT-ANNUAL', year: 2026, kind: 'encashment', days: -2 },
      { leaveTypeId: 'LT-ANNUAL', year: 2025, kind: 'manual', days: 10 },
    ];
    const b = computeBalance(annual, '2020-01-01', 2026, reqs, adjs, SUNDAY_ONLY, noHol);
    expect(b).toMatchObject({ entitlement: 10, carriedForward: 4, adjusted: -1, encashed: 2, used: 3, pending: 0.5, available: 8 });
  });
});

describe('LeaveService', () => {
  const hr: Actor = { id: 'U-HR', name: 'HR', roleKey: 'hr' };
  const clerk: Actor = { id: 'U-CLERK', name: 'Clerk', roleKey: 'hr' };
  const access = {
    can: jest.fn(async (a: Actor) => a.roleKey === 'hr'),
    require: jest.fn(async (a: Actor, _m: string, what: string) => { if (a.roleKey !== 'hr') throw new Error(`not allowed to ${what}`); }),
  } as unknown as ManpowerAccess;

  const setup = (hire = '2020-01-01') => {
    const types = table(TYPES.map((t) => ({ ...t })));
    const requests = table<any>([]);
    const adjustments = table<any>([]);
    const holidays = table<any>([{ id: 'PH1', date: '2026-12-25', name: 'Quaid Day' }]);
    const employees = table<EmployeeEntity>([
      { id: 'E1', name: 'Ali', status: 'active', employmentStatus: 'active', hireDate: hire, payType: 'monthly', payRate: 60000, userId: 'U-ALI' } as EmployeeEntity,
      { id: 'E2', name: 'Hamza', status: 'active', employmentStatus: 'active', contractorId: 'CTR-1' } as EmployeeEntity,
    ]);
    const setupSvc = { settings: jest.fn(async () => ({ ...DEFAULT_PAYROLL_SETTINGS, monthDays: 30, weekendDays: SUNDAY_ONLY })) };
    const svc = new LeaveService(types, requests, adjustments, holidays, employees, setupSvc as any, access);
    return { svc, requests, adjustments };
  };
  const ask = (over: any = {}) => ({ employeeId: 'E1', leaveTypeId: 'LT-ANNUAL', startDate: '2026-10-05', endDate: '2026-10-07', ...over });

  it('books leave, counting working days', async () => {
    const { svc } = setup();
    const r = await svc.createRequest(ask(), clerk);
    expect(r).toMatchObject({ status: 'pending', days: 3, type: 'Vacation (PTO)' });
  });

  it('refuses overlapping leave, all-holiday dates, and more days than are left', async () => {
    const { svc } = setup();
    await svc.createRequest(ask(), clerk);
    await expect(svc.createRequest(ask({ startDate: '2026-10-07', endDate: '2026-10-08', leaveTypeId: 'LT-CASUAL' }), clerk)).rejects.toThrow(/overlaps/);
    await expect(svc.createRequest(ask({ startDate: '2026-12-25', endDate: '2026-12-25' }), clerk)).rejects.toThrow(/weekends or public holidays/);
    // 10 allowance, 3 already pending: 8 more working days is one too many
    await expect(svc.createRequest(ask({ startDate: '2026-11-02', endDate: '2026-11-10' }), clerk)).rejects.toThrow(/Not enough Vacation \(PTO\) leave for 2026: 8 day\(s\) asked, 7 available/);
  });

  it("doesn't cap untracked types like unpaid leave, and refuses contractors' workers", async () => {
    const { svc } = setup();
    const r = await svc.createRequest(ask({ leaveTypeId: 'LT-UNPAID', startDate: '2026-11-02', endDate: '2026-11-28' }), clerk);
    expect(r.days).toBe(24);
    await expect(svc.createRequest(ask({ employeeId: 'E2' }), clerk)).rejects.toThrow(/contractor/);
  });

  it('approval: not by the requester, not by the employee, and only with HR rights', async () => {
    const { svc } = setup();
    const r = await svc.createRequest(ask(), clerk);
    await expect(svc.decide(r.id, 'approved', undefined, clerk)).rejects.toThrow(/someone else/);
    await expect(svc.decide(r.id, 'approved', undefined, { id: 'U-ALI', name: 'Ali', roleKey: 'hr' })).rejects.toThrow(/your own/);
    await expect(svc.decide(r.id, 'approved', undefined, { id: 'U-X', name: 'X', roleKey: 'site' })).rejects.toThrow(/not allowed/);
    expect((await svc.decide(r.id, 'approved', 'enjoy', hr)).status).toBe('approved');
  });

  it('carries forward unused days up to the cap, and can be re-run without doubling', async () => {
    const { svc, requests, adjustments } = setup();
    requests.rows.push({ id: 'LR1', employeeId: 'E1', leaveTypeId: 'LT-ANNUAL', startDate: '2026-03-02', endDate: '2026-03-06', halfDay: false, status: 'approved' }); // 5 used -> 5 left
    const first = await svc.carryForward(2026, hr);
    expect(first).toMatchObject({ year: 2027, carried: 1, days: 5 }); // 5 left, cap 5
    await svc.carryForward(2026, hr);
    expect(adjustments.rows.filter((a: any) => a.kind === 'carry_forward')).toHaveLength(1);
  });

  it('encashes only encashable types, within the balance, at the daily rate', async () => {
    const { svc } = setup();
    await expect(svc.encash({ employeeId: 'E1', leaveTypeId: 'LT-CASUAL', year: 2026, days: 2 }, hr)).rejects.toThrow(/can't be encashed/);
    await expect(svc.encash({ employeeId: 'E1', leaveTypeId: 'LT-ANNUAL', year: 2026, days: 20 }, hr)).rejects.toThrow(/Only 10/);
    const e = await svc.encash({ employeeId: 'E1', leaveTypeId: 'LT-ANNUAL', year: 2026, days: 3 }, hr);
    expect(e).toMatchObject({ kind: 'encashment', days: -3, amount: 6000 }); // 60,000 / 30 = 2,000 a day
  });
});
