import { usFederalHolidays, LeaveService } from './leave.service';
import { PayrollSetupService, US_COMPONENTS } from './payroll-setup.service';
import { DEFAULT_PAYROLL_SETTINGS } from './payroll.calc';

function table(rows: any[] = []) {
  const match = (r: any, where: any) => Object.entries(where || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where))),
    count: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).length),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push(it); } return x; }),
  } as any;
}

describe('US federal holidays', () => {
  it('lists the 11 holidays on their observed dates', () => {
    expect(usFederalHolidays(2026).map((h) => h.date)).toEqual([
      '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19',
      '2026-07-03', // July 4th is a Saturday -> observed Friday
      '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25',
    ]);
    expect(usFederalHolidays(2027).find((h) => h.name === 'Christmas Day')!.date).toBe('2027-12-24'); // Saturday -> Friday
    expect(usFederalHolidays(2028).find((h) => h.name === 'Independence Day')!.date).toBe('2028-07-04');
  });
});

describe('switching an existing setup to the US', () => {
  const store = (initial: Record<string, string>) => {
    const m = new Map(Object.entries(initial));
    return { get: jest.fn(async (k: string) => m.get(k) ?? null), set: jest.fn(async (k: string, v: string) => { m.set(k, v); }), m };
  };

  it('converts untouched payroll defaults and components once, keeping what someone changed', async () => {
    const s = store({ 'payroll.settings': JSON.stringify({ currency: 'PKR', standardDayHours: 9, halfDayHours: 4, monthDays: 30, weekendDays: [0], otMultipliers: { normal: 1.5, weekend: 2, holiday: 2, night: 1.25 } }) });
    const comps = table([
      { id: 'PC-05', name: 'Income tax', kind: 'deduction', calcType: 'percent_gross', defaultValue: 0, appliesTo: 'monthly', active: true, order: 4 },
      { id: 'PC-06', name: 'Social security (EOBI)', kind: 'deduction', calcType: 'percent_basic', defaultValue: 0, appliesTo: 'all', active: true, order: 5 },
      { id: 'PC-04', name: 'Accommodation allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'monthly', active: true, order: 3 },
      { id: 'PC-07', name: 'Staff insurance', kind: 'deduction', calcType: 'fixed', defaultValue: 50, appliesTo: 'all', active: true, order: 6 }, // renamed by the user
    ]);
    const svc = new PayrollSetupService(comps, s as any);
    await svc.convertToUs();

    const saved = JSON.parse(s.m.get('payroll.settings')!);
    expect(saved).toMatchObject({ currency: 'USD', monthDays: 21.67, weekendDays: [0, 6], standardDayHours: 9, otMultipliers: DEFAULT_PAYROLL_SETTINGS.otMultipliers });
    const byName = (n: string) => comps.rows.find((c: any) => c.name === n);
    expect(byName('Federal income tax withholding')).toMatchObject({ id: 'PC-05', appliesTo: 'all' });
    expect(byName('Social Security (OASDI)')).toMatchObject({ id: 'PC-06', calcType: 'percent_gross', defaultValue: 6.2 });
    expect(byName('Medicare')).toMatchObject({ defaultValue: 1.45 });
    expect(byName('Accommodation allowance').active).toBe(false);
    expect(byName('Staff insurance')).toMatchObject({ defaultValue: 50 });
    expect(comps.rows.filter((c: any) => US_COMPONENTS.some((u) => u.name === c.name))).toHaveLength(US_COMPONENTS.length);

    const count = comps.rows.length;
    await svc.convertToUs();
    expect(comps.rows.length).toBe(count);
  });

  it('renames leave types still at their original values, adds FMLA and jury duty, and retires unused site rotation', async () => {
    const types = table([
      { id: 'LT-ANNUAL', name: 'Annual', annualDays: 14, carryForwardMax: 7, active: true },
      { id: 'LT-SICK', name: 'Sick', annualDays: 12, carryForwardMax: 0, active: true }, // edited: left alone
      { id: 'LT-ROTATION', name: 'Site rotation', annualDays: 0, carryForwardMax: 0, active: true },
    ]);
    const svc = new LeaveService(types, table(), table(), table(), table(), {} as any, {} as any);
    await svc.convertToUs();
    const t = (id: string) => types.rows.find((r: any) => r.id === id);
    expect(t('LT-ANNUAL')).toMatchObject({ name: 'Vacation (PTO)', annualDays: 10, carryForwardMax: 5 });
    expect(t('LT-SICK')).toMatchObject({ name: 'Sick', annualDays: 12 });
    expect(t('LT-ROTATION').active).toBe(false);
    expect(t('LT-FMLA')).toMatchObject({ paid: false, trackBalance: false });
    expect(t('LT-JURY')).toMatchObject({ paid: true });
  });
});
