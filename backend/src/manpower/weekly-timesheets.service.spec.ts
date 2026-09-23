import { WeeklyTimesheetsService, approvedTimesheetHours, mondayOf } from './weekly-timesheets.service';
import { LeaveService, DEFAULT_LEAVE_TYPES } from './leave.service';
import { DEFAULT_PAYROLL_SETTINGS } from './payroll.calc';
import { LeaveRequestEntity, TimesheetEntity, TimesheetLineEntity } from '../database/entities';
import type { Actor, ManpowerAccess } from './manpower-access.service';

function table(rows: any[] = []) {
  const test = (v: any, want: any) => (want && typeof want === 'object' && want._type === 'in' ? want._value.includes(v) : v === want);
  const match = (r: any, where: any) => Object.entries(where || {}).every(([k, v]) => test(r[k], v));
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where))),
    findBy: jest.fn(async (w: any) => rows.filter((r) => match(r, w))),
    findOneBy: jest.fn(async (w: any) => rows.find((r) => match(r, w)) ?? null),
    count: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).length),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push(it); } return x; }),
    remove: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows.splice(i, 1); } return x; }),
    delete: jest.fn(async (w: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], w)) rows.splice(i, 1); }),
  } as any;
}

const WEEK = '2026-10-05'; // a Monday
const hr: Actor = { id: 'U-HR', name: 'Jennifer (HR)', roleKey: 'hr' };
const sarah: Actor = { id: 'U-SARAH', name: 'Sarah', roleKey: 'staff' };
const david: Actor = { id: 'U-DAVID', name: 'David', roleKey: 'staff' }; // Sarah's manager
const other: Actor = { id: 'U-X', name: 'Someone', roleKey: 'staff' };
const access = {
  can: jest.fn(async (a: Actor) => a.roleKey === 'hr'),
  require: jest.fn(async (a: Actor, _m: string, what: string) => { if (a.roleKey !== 'hr') throw new Error(`not allowed to ${what}`); }),
} as unknown as ManpowerAccess;

function setup() {
  const t = {
    sheets: table(), lines: table(),
    employees: table([
      { id: 'E-SARAH', name: 'Sarah Chen', userId: undefined, email: 'sarah.chen@example.com', supervisorId: 'E-DAVID', status: 'active', employmentStatus: 'active', hireDate: '2020-01-01', payType: 'hourly', payRate: 40 },
      { id: 'E-DAVID', name: 'David Williams', userId: 'U-DAVID', status: 'active', employmentStatus: 'active' },
    ]),
    projects: table([{ id: 1, name: 'Tower' }, { id: 2, name: 'Villas' }]),
    leaveRequests: table(), leaveTypes: table(DEFAULT_LEAVE_TYPES.map((x, i) => ({ ...x, order: i }))), leaveAdj: table(), holidays: table(),
    runs: table(), payslips: table(), users: table([{ id: 'U-SARAH', email: 'Sarah.Chen@example.com' }]),
  };
  const manager = { getRepository: (e: any) => (e === TimesheetEntity ? t.sheets : e === TimesheetLineEntity ? t.lines : e === LeaveRequestEntity ? t.leaveRequests : null), transaction: async (fn: any) => fn(manager) };
  t.sheets.manager = manager;
  const setupSvc = { settings: async () => DEFAULT_PAYROLL_SETTINGS };
  const leave = new LeaveService(t.leaveTypes, t.leaveRequests, t.leaveAdj, t.holidays, t.employees, setupSvc as any, access);
  const logged = { forEmployee: async () => ({ rows: [], totalHours: 0 }) };
  const svc = new WeeklyTimesheetsService(t.sheets, t.lines, t.employees, t.projects, t.leaveRequests, t.holidays, t.runs, t.payslips, t.users,
    leave, logged as any, setupSvc as any, access);
  return { svc, t };
}
const day = (i: number) => `2026-10-${String(5 + i).padStart(2, '0')}`;
const week = (over: any = {}) => ({
  employeeId: 'E-SARAH', weekStart: WEEK,
  lines: [
    { kind: 'project', projectId: 1, description: 'Takeoffs for the tower bid', days: { [day(0)]: { hours: 6 }, [day(1)]: { hours: 8, note: 'Site walk' }, [day(2)]: { hours: 5.2 } } },
    { kind: 'internal', category: 'meetings', days: { [day(0)]: { hours: 2 } } },
  ],
  ...over,
});

describe('weekly timesheets', () => {
  it('links a login to its employee record by email, once', async () => {
    const { svc, t } = setup();
    expect((await svc.me(sarah))!.id).toBe('E-SARAH');
    expect(t.employees.rows[0].userId).toBe('U-SARAH');
    expect(await svc.me(other)).toBeNull();
  });

  it('the employee fills in their own week; others cannot', async () => {
    const { svc } = setup();
    await svc.me(sarah);
    const w = await svc.save(week(), sarah);
    expect(w.sheet).toMatchObject({ status: 'draft', totalHours: 21.25, weekStart: WEEK }); // 5.2 -> 5.25, quarter hours
    expect(w.lines[0].days[day(1)]).toEqual({ hours: 8, note: 'Site walk' });
    expect(w.canEdit).toBe(true);
    await expect(svc.save(week(), other)).rejects.toThrow(/own timesheet/);
    await expect(svc.save(week({ lines: [{ kind: 'project', days: {} }] }), sarah)).rejects.toThrow(/pick the project/);
    await expect(svc.save(week({ lines: [{ kind: 'internal', category: 'office', days: { [day(0)]: { hours: 20 } } }, { kind: 'internal', category: 'other', days: { [day(0)]: { hours: 6 } } }] }), sarah)).rejects.toThrow(/a day has 24/);
    expect(mondayOf('2026-10-08')).toBe(WEEK);
  });

  it('submit -> manager approves; the person and the submitter cannot', async () => {
    const { svc } = setup();
    await svc.me(sarah);
    const w = await svc.save(week(), sarah);
    await svc.submit(w.sheet!.id, sarah);
    await expect(svc.save(week(), sarah)).rejects.toThrow(/submitted/);
    await expect(svc.approve(w.sheet!.id, undefined, sarah)).rejects.toThrow(/own timesheet/);
    await expect(svc.approve(w.sheet!.id, undefined, other)).rejects.toThrow(/HR or their reporting manager/);
    const ok = await svc.approve(w.sheet!.id, 'Looks right', david);
    expect(ok).toMatchObject({ status: 'approved', decidedByName: 'David' });
  });

  it('leave rows become leave requests on submit, approved with the sheet by HR', async () => {
    const { svc, t } = setup();
    await svc.me(sarah);
    const w = await svc.save(week({ lines: [...week().lines, { kind: 'leave', leaveTypeId: 'LT-ANNUAL', description: 'Dentist', days: { [day(3)]: { hours: 8 }, [day(4)]: { hours: 8 } } }] }), sarah);
    await svc.submit(w.sheet!.id, sarah);
    expect(t.leaveRequests.rows).toHaveLength(1);
    expect(t.leaveRequests.rows[0]).toMatchObject({ startDate: day(3), endDate: day(4), days: 2, status: 'pending', reason: 'Dentist' });
    await expect(svc.approve(w.sheet!.id, undefined, david)).rejects.toThrow(/HR has to approve/);
    await svc.approve(w.sheet!.id, undefined, hr);
    expect(t.leaveRequests.rows[0].status).toBe('approved');
  });

  it('a rejected sheet goes back with a reason, its leave withdrawn, and can be fixed and resubmitted', async () => {
    const { svc, t } = setup();
    await svc.me(sarah);
    const w = await svc.save(week({ lines: [{ kind: 'leave', leaveTypeId: 'LT-SICK', days: { [day(2)]: { hours: 4 } } }] }), sarah);
    await svc.submit(w.sheet!.id, sarah);
    expect(t.leaveRequests.rows[0]).toMatchObject({ halfDay: true, days: 0.5 });
    await expect(svc.reject(w.sheet!.id, '', hr)).rejects.toThrow(/what needs fixing/);
    const back = await svc.reject(w.sheet!.id, 'Add the project hours for Wednesday', hr);
    expect(back).toMatchObject({ status: 'rejected', decisionNote: 'Add the project hours for Wednesday' });
    expect(t.leaveRequests.rows[0].status).toBe('cancelled');
    const again = await svc.save(week({ lines: [{ id: w.lines[0].id, kind: 'leave', leaveTypeId: 'LT-SICK', days: { [day(2)]: { hours: 4 } } }, week().lines[0]] }), sarah);
    expect(again.sheet!.status).toBe('draft');
    await svc.submit(w.sheet!.id, sarah);
    expect(t.leaveRequests.rows.filter((r: any) => r.status === 'pending')).toHaveLength(1);
  });

  it("HR can reopen an approved week, but not once it's been paid in finalized payroll", async () => {
    const { svc, t } = setup();
    await svc.me(sarah);
    const w = await svc.save(week(), sarah);
    await svc.submit(w.sheet!.id, sarah);
    await svc.approve(w.sheet!.id, undefined, hr);
    t.runs.rows.push({ id: 'PR1', label: 'October 2026', status: 'finalized', periodStart: '2026-10-01', periodEnd: '2026-10-31' });
    t.payslips.rows.push({ id: 'PS1', runId: 'PR1', employeeId: 'E-SARAH' });
    await expect(svc.reopen(w.sheet!.id, 'typo', hr)).rejects.toThrow(/paid in "October 2026"/);
    t.runs.rows[0].status = 'void';
    await expect(svc.reopen(w.sheet!.id, 'typo', david)).rejects.toThrow(/not allowed/);
    expect((await svc.reopen(w.sheet!.id, 'typo', hr)).status).toBe('draft');
  });

  it('approved project and internal hours are what payroll and overtime read -- leave is not work time', async () => {
    const { svc, t } = setup();
    await svc.me(sarah);
    const w = await svc.save(week({ lines: [...week().lines, { kind: 'leave', leaveTypeId: 'LT-UNPAID', days: { [day(4)]: { hours: 8 } } }] }), sarah);
    expect((await approvedTimesheetHours(t.sheets, t.lines, WEEK, day(6))).size).toBe(0); // not approved yet
    await svc.submit(w.sheet!.id, sarah);
    await svc.approve(w.sheet!.id, undefined, hr);
    const hours = (await approvedTimesheetHours(t.sheets, t.lines, WEEK, day(6))).get('E-SARAH')!;
    expect(hours.get(day(0))).toMatchObject({ hours: 8 }); // 6 project + 2 meetings
    expect(Array.from(hours.get(day(0))!.projectIds)).toEqual([1]);
    expect(hours.has(day(4))).toBe(false);
  });
});
