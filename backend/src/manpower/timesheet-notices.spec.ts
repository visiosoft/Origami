import { WeeklyTimesheetsService } from './weekly-timesheets.service';

/** Who hears that a timesheet was submitted. */
describe('WeeklyTimesheetsService.pendingNotices', () => {
  const sheets = [
    { id: 'S1', employeeId: 'E1', weekStart: '2026-10-05', status: 'submitted', totalHours: 21, submittedAt: '2026-10-06T10:00:00Z', submittedById: 'U-george' },
    { id: 'S2', employeeId: 'E2', weekStart: '2026-10-05', status: 'submitted', totalHours: 40, submittedAt: '2026-10-06T12:00:00Z', submittedById: 'U-pita' },
  ];
  const employees = [
    { id: 'E1', name: 'George Finau', userId: 'U-george', supervisorId: 'E9' },
    { id: 'E2', name: 'Pita Ahki', userId: 'U-pita', supervisorId: null },
    { id: 'E9', name: 'Site Boss', userId: 'U-boss', supervisorId: null },
  ];
  const make = (canHr: boolean) => {
    const repo = (rows: any[]) => ({
      find: async (o?: any) => (o?.where?.status ? rows.filter((r) => r.status === o.where.status) : o?.where?.id ? rows.filter((r) => o.where.id._value.includes(r.id)) : rows),
      findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null,
    });
    const access = { can: async () => canHr };
    const none = {} as any;
    return new WeeklyTimesheetsService(repo(sheets) as any, none, repo(employees) as any, none, none, none, none, none, none, none, none, none, access as any);
  };

  it('tells administrators, project coordinators and HR about every submitted timesheet, newest first', async () => {
    for (const roleKey of ['admin', 'project_coordinator', 'hr_manager']) {
      const out = await make(false).pendingNotices({ name: 'X', id: 'U-x', roleKey });
      expect(out.map((n) => n.id)).toEqual(['S2', 'S1']);
    }
    const viaPermission = await make(true).pendingNotices({ name: 'X', id: 'U-x', roleKey: 'accounting' });
    expect(viaPermission.map((n) => n.employeeName)).toEqual(['Pita Ahki', 'George Finau']);
  });

  it("tells a supervisor about their own people only, and nobody about their own timesheet", async () => {
    const boss = await make(false).pendingNotices({ name: 'Boss', id: 'U-boss', roleKey: 'site_super' });
    expect(boss.map((n) => n.id)).toEqual(['S1']);
    const george = await make(true).pendingNotices({ name: 'George', id: 'U-george', roleKey: 'hr_manager' });
    expect(george.map((n) => n.id)).toEqual(['S2']);
    const stranger = await make(false).pendingNotices({ name: 'Other', id: 'U-other', roleKey: 'designer' });
    expect(stranger).toEqual([]);
  });
});
