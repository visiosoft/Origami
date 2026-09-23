import { calculatePayslip, DEFAULT_PAYROLL_SETTINGS, hourlyBase, workFromLogs, type CalcInput } from './payroll.calc';
import type { PayComponentEntity } from '../database/entities';

const s = DEFAULT_PAYROLL_SETTINGS;
const comp = (c: Partial<PayComponentEntity>): PayComponentEntity =>
  ({ id: 'C', name: 'X', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'other', active: true, order: 0, ...c }) as PayComponentEntity;
const noWork = { fullDays: 0, halfDays: 0, extraHours: 0, hoursWorked: 0, manual: false };

const base = (over: Partial<CalcInput>): CalcInput => ({
  employee: { payType: 'monthly', payRate: 60000, overtimeRate: null as any, hireDate: '2025-01-01', payComponents: [] },
  settings: s, components: [], periodStart: '2026-09-01', periodEnd: '2026-09-30',
  work: noWork, overtime: [], recoveries: [], manualLines: [],
  ...over,
});
const line = (r: ReturnType<typeof calculatePayslip>, name: RegExp) => r.lines.find((l) => name.test(l.name));

describe('hourlyBase', () => {
  it('derives an hourly rate from monthly, daily and hourly pay', () => {
    expect(hourlyBase({ payType: 'monthly', payRate: 60000 } as any, s)).toBe(250); // 60000 / (30 * 8)
    expect(hourlyBase({ payType: 'daily', payRate: 2000 } as any, s)).toBe(250);
    expect(hourlyBase({ payType: 'hourly', payRate: 300 } as any, s)).toBe(300);
  });
});

describe('workFromLogs', () => {
  it('counts full days, half days and loose hours from daily-log hours', () => {
    const w = workFromLogs({ '2026-09-01': 8, '2026-09-02': 10, '2026-09-03': 5, '2026-09-04': 2, '2026-09-05': 0 }, s);
    expect(w).toMatchObject({ fullDays: 2, halfDays: 1, extraHours: 2, hoursWorked: 25 });
  });
});

describe('calculatePayslip', () => {
  it('pays a full month of basic salary', () => {
    const r = calculatePayslip(base({}));
    expect(r.gross).toBe(60000);
    expect(r.net).toBe(60000);
  });

  it('prorates basic for someone who joined mid-period', () => {
    const r = calculatePayslip(base({ employee: { payType: 'monthly', payRate: 60000, hireDate: '2026-09-16', payComponents: [] } as any }));
    expect(line(r, /Basic/)!.amount).toBe(30000); // 15 of 30 days
    expect(line(r, /Basic/)!.note).toMatch(/15 of 30/);
  });

  it('pays a daily-wage worker for full days, half days and short-day hours', () => {
    const r = calculatePayslip(base({
      employee: { payType: 'daily', payRate: 2000, payComponents: [] } as any,
      work: { fullDays: 24, halfDays: 2, extraHours: 3, hoursWorked: 203, manual: false },
    }));
    expect(line(r, /Daily wage/)!.amount).toBe(48000);
    expect(line(r, /Half days/)!.amount).toBe(2000);
    expect(line(r, /Short days/)!.amount).toBe(750); // 3 h x 250
    expect(r.gross).toBe(50750);
  });

  it('matches the worked example: 24 days at 2,000, 8,000 overtime, 10,000 advance -> 46,000 net', () => {
    const r = calculatePayslip(base({
      employee: { payType: 'daily', payRate: 2000, payComponents: [] } as any,
      work: { fullDays: 24, halfDays: 0, extraHours: 0, hoursWorked: 192, manual: false },
      overtime: [{ id: 'OT1', hours: 16, amount: 8000 }],
      recoveries: [{ id: 'A1', type: 'salary_advance', label: 'Salary advance', remaining: 10000, installmentAmount: 10000 }],
    }));
    expect(r.gross).toBe(56000);
    expect(r.deductions).toBe(10000);
    expect(r.net).toBe(46000);
    expect(line(r, /Overtime/)!.refIds).toEqual(['OT1']);
  });

  it('applies fixed and percentage components, with tax on gross', () => {
    const components = [
      comp({ id: 'SITE', name: 'Site allowance', kind: 'earning', calcType: 'fixed', defaultValue: 5000, order: 1 }),
      comp({ id: 'HRA', name: 'Housing', kind: 'earning', calcType: 'percent_basic', order: 2 }),
      comp({ id: 'TAX', name: 'Income tax', kind: 'deduction', calcType: 'percent_gross', order: 3 }),
      comp({ id: 'EOBI', name: 'EOBI', kind: 'deduction', calcType: 'percent_basic', order: 4 }),
      comp({ id: 'OFF', name: 'Unused', kind: 'earning', calcType: 'fixed', defaultValue: 0, order: 5 }),
    ];
    const r = calculatePayslip(base({
      components,
      employee: { payType: 'monthly', payRate: 60000, payComponents: [{ componentId: 'HRA', value: 10 }, { componentId: 'TAX', value: 5 }, { componentId: 'EOBI', value: 1 }] } as any,
    }));
    expect(line(r, /Site allowance/)!.amount).toBe(5000);
    expect(line(r, /Housing/)!.amount).toBe(6000);
    expect(r.gross).toBe(71000);
    expect(line(r, /Income tax/)!.amount).toBe(3550); // 5% of 71,000
    expect(line(r, /EOBI/)!.amount).toBe(600);        // 1% of 60,000
    expect(line(r, /Unused/)).toBeUndefined();
    expect(r.net).toBe(66850);
  });

  it("skips components that don't apply to the employee's pay group", () => {
    const r = calculatePayslip(base({
      employee: { payType: 'daily', payRate: 2000, payComponents: [] } as any,
      work: { fullDays: 1, halfDays: 0, extraHours: 0, hoursWorked: 8, manual: false },
      components: [comp({ id: 'ACC', name: 'Accommodation', calcType: 'fixed', defaultValue: 8000, appliesTo: 'monthly' })],
    }));
    expect(r.gross).toBe(2000);
  });

  it('caps advance recovery so net pay never goes negative, oldest first', () => {
    const r = calculatePayslip(base({
      employee: { payType: 'daily', payRate: 2000, payComponents: [] } as any,
      work: { fullDays: 3, halfDays: 0, extraHours: 0, hoursWorked: 24, manual: false },
      recoveries: [
        { id: 'A1', type: 'salary_advance', label: 'Salary advance', remaining: 5000, installmentAmount: 5000 },
        { id: 'L1', type: 'loan', label: 'Employee loan', remaining: 20000, installmentAmount: 4000 },
      ],
    }));
    expect(r.gross).toBe(6000);
    expect(line(r, /Salary advance/)!.amount).toBe(5000);
    const loan = line(r, /Employee loan/)!;
    expect(loan.amount).toBe(1000);
    expect(loan.source).toBe('loan');
    expect(loan.note).toMatch(/Reduced from 4000/);
    expect(r.net).toBe(0);
  });

  it('keeps manual bonus and deduction lines', () => {
    const r = calculatePayslip(base({
      manualLines: [
        { id: 'M1', name: 'Eid bonus', kind: 'earning', source: 'manual', amount: 10000 },
        { id: 'M2', name: 'Damaged tool', kind: 'deduction', source: 'manual', amount: 1500 },
      ],
    }));
    expect(r.gross).toBe(70000);
    expect(r.net).toBe(68500);
  });
});

describe('leave, shifts and encashment in pay', () => {
  it('deducts unpaid leave from a monthly salary at salary / month days', () => {
    const r = calculatePayslip(base({ leave: { paidDays: 2, unpaidDays: 3 } }));
    expect(line(r, /Unpaid leave/)!.amount).toBe(6000); // 60,000 / 30 x 3
    expect(r.net).toBe(54000);
    expect(r.basis.paidLeaveDays).toBe(2);
  });

  it('pays a daily-wage worker for approved paid leave, but not unpaid leave', () => {
    const r = calculatePayslip(base({
      employee: { payType: 'daily', payRate: 2000, payComponents: [] } as any,
      work: { fullDays: 20, halfDays: 0, extraHours: 0, hoursWorked: 160, manual: false },
      leave: { paidDays: 2, unpaidDays: 4 },
    }));
    expect(line(r, /Paid leave/)!.amount).toBe(4000);
    expect(line(r, /Unpaid leave/)).toBeUndefined();
    expect(r.gross).toBe(44000);
  });

  it('adds shift allowances per day worked and cashed-out leave', () => {
    const r = calculatePayslip(base({
      shiftAllowances: [{ templateId: 'SH-NIGHT', name: 'Night shift', days: 10, rate: 500 }],
      encashments: [{ id: 'LA1', days: 3, amount: 6000 }],
    }));
    expect(line(r, /Night shift allowance/)!.amount).toBe(5000);
    expect(line(r, /Leave encashment/)).toMatchObject({ amount: 6000, refIds: ['LA1'] });
    expect(r.gross).toBe(71000);
  });
});
