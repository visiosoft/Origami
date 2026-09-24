import { agingBucket, burdened, computeJobCost, hourlyRate, laborLines, profitability } from './costs.calc';

const S = { standardDayHours: 8, monthDays: 21.67, otMultiplier: 1.5 };
const people = new Map([
  ['E1', { id: 'E1', name: 'Robert', payType: 'hourly', payRate: 50 }],
  ['E2', { id: 'E2', name: 'Sarah', payType: 'monthly', payRate: 8668 }], // 8668 / 21.67 / 8 = 50.00/h
  ['E3', { id: 'E3', name: 'Carlos', payType: 'hourly', payRate: 40, overtimeRate: 50 }],
]);

describe('labor cost', () => {
  it('prices an hour the way payroll does', () => {
    expect(hourlyRate(people.get('E1')!, S)).toBe(50);
    expect(Math.round(hourlyRate(people.get('E2')!, S) * 100) / 100).toBe(50);
    expect(hourlyRate({ id: 'x', name: 'x', payType: 'daily', payRate: 320 }, S)).toBe(40);
  });

  it('never counts the same hours twice: timesheet vs daily log, the larger wins per person, project and day', () => {
    const lines = laborLines([
      { employeeId: 'E1', projectId: 7, date: '2026-09-01', csiCodeId: 'C03', hours: 6, source: 'timesheet' },
      { employeeId: 'E1', projectId: 7, date: '2026-09-01', csiCodeId: 'C03', hours: 4, source: 'daily_log' },
      { employeeId: 'E1', projectId: 7, date: '2026-09-01', csiCodeId: 'C05', hours: 3, source: 'daily_log' },
    ], people, S);
    // daily log total 7 > timesheet 6: both daily-log lines, split by code.
    expect(lines.map((l) => [l.source, l.csiCodeId, l.hours, l.wageC])).toEqual([['daily_log', 'C03', 4, 20000], ['daily_log', 'C05', 3, 15000]]);
  });

  it('overtime is hours past a standard day across all projects, shared over the day, at the overtime rate', () => {
    const lines = laborLines([
      { employeeId: 'E3', projectId: 7, date: '2026-09-02', csiCodeId: null, hours: 6, source: 'timesheet' },
      { employeeId: 'E3', projectId: 8, date: '2026-09-02', csiCodeId: null, hours: 4, source: 'timesheet' },
    ], people, S);
    // 10 h: 2 h overtime, 1.2 h on project 7 and 0.8 h on project 8, at 50 x 1.5.
    const p7 = lines.find((l) => l.projectId === 7)!;
    expect(p7).toMatchObject({ otHours: 1.2, wageC: Math.round((4.8 * 40 + 1.2 * 75) * 100) });
    expect(lines.reduce((a, l) => a + l.wageC, 0)).toBe(Math.round((8 * 40 + 2 * 75) * 100));
    expect(burdened(10000, 30)).toBe(13000);
  });
});

describe('job cost by cost code', () => {
  const base = {
    budgetLines: [{ csiCodeId: 'C03', amountC: 10_000_00 }, { csiCodeId: 'C09', amountC: 5_000_00 }],
    coCosts: [{ csiCodeId: 'C09', amountC: 1_000_00 }],
    commitments: [
      { id: 'SC1', status: 'approved', lines: [{ csiCodeId: 'C03', amountC: 8_000_00 }] },
      { id: 'SC2', status: 'draft', lines: [{ csiCodeId: 'C09', amountC: 9_999_00 }] },
    ],
    costEntries: [{ commitmentId: 'SC1', csiCodeId: 'C03', amountC: 3_000_00, status: 'approved' }, { commitmentId: null, csiCodeId: null, amountC: 200_00, status: 'recorded' }],
    labor: [{ csiCodeId: 'C03', costC: 1_500_00, hours: 30 }],
    reimbursables: [{ csiCodeId: 'C09', costC: 400_00 }],
    forecasts: new Map<string, number>(),
  };

  it('budget with change orders, committed, actual, open and EAC per code', () => {
    const { rows, totals } = computeJobCost(base);
    const c03 = rows.find((r) => r.key === 'C03')!;
    // actual 3,000 + 1,500 labor = 4,500; open 8,000 - 3,000 = 5,000; EAC = max(10,000, 9,500).
    expect(c03).toMatchObject({ budgetC: 10_000_00, committedC: 8_000_00, commitmentBilledC: 3_000_00, openC: 5_000_00, actualC: 4_500_00, eacC: 10_000_00, varianceC: 0, laborHours: 30 });
    const c09 = rows.find((r) => r.key === 'C09')!;
    expect(c09).toMatchObject({ budgetOriginalC: 5_000_00, budgetChangesC: 1_000_00, budgetC: 6_000_00, committedC: 0, actualC: 400_00 }); // draft commitments don't count
    const none = rows.find((r) => r.key === 'none')!;
    expect(none).toMatchObject({ budgetC: 0, actualC: 200_00, eacC: 200_00, varianceC: -200_00 });
    expect(totals).toMatchObject({ budgetC: 16_000_00, actualC: 5_100_00, eacC: 16_200_00 });
  });

  it('a forecast overrides budget-or-spend; spend past the budget pushes EAC up; closed commitments stop counting as open', () => {
    const f = computeJobCost({ ...base, forecasts: new Map([['C03', 12_500_00]]) });
    expect(f.rows.find((r) => r.key === 'C03')).toMatchObject({ eacC: 12_500_00, eacOverridden: true, varianceC: -2_500_00, costToCompleteC: 8_000_00 });
    const over = computeJobCost({ ...base, costEntries: [...base.costEntries, { commitmentId: 'SC1', csiCodeId: 'C03', amountC: 6_000_00, status: 'recorded' }] });
    expect(over.rows.find((r) => r.key === 'C03')).toMatchObject({ actualC: 10_500_00, openC: 0, eacC: 10_500_00, varianceC: -500_00 });
    const closed = computeJobCost({ ...base, commitments: [{ ...base.commitments[0], status: 'closed' }] });
    expect(closed.rows.find((r) => r.key === 'C03')).toMatchObject({ committedC: 8_000_00, openC: 0 });
  });
});

describe('profitability and WIP', () => {
  it('margin now and at completion; cost-to-cost earned revenue and over/under billing', () => {
    const p = profitability({ contractC: 100_000_00, evC: 45_000_00, contractWorkInvoicedC: 50_000_00, actualC: 32_000_00, eacC: 80_000_00, reimbursablesBilledC: 1_100_00, reimbursableCostC: 1_000_00 });
    // contract cost: actual 31,000, EAC 79,000 -> 39.24% complete -> earned 39,240.51; billed 50,000 -> over-billed.
    expect(p).toMatchObject({ projectedCostC: 79_000_00, projectedMarginC: 21_000_00, projectedMarginPct: 21, costToDateC: 31_000_00, marginToDateC: 14_000_00, reimbursableMarginC: 100_00, loss: false });
    expect(p.earnedRevenueC).toBe(Math.round(100_000_00 * (31_000_00 / 79_000_00)));
    expect(p.overUnderBillingC).toBe(50_000_00 - p.earnedRevenueC);
    expect(profitability({ contractC: 100_00, evC: 0, contractWorkInvoicedC: 0, actualC: 0, eacC: 150_00, reimbursablesBilledC: 0, reimbursableCostC: 0 }).loss).toBe(true);
  });

  it('ages by days past due', () => {
    expect(agingBucket('2026-09-30', '2026-09-24')).toEqual({ bucket: 'current', daysPastDue: 0 });
    expect(agingBucket('2026-09-01', '2026-09-24')).toEqual({ bucket: 'd1_30', daysPastDue: 23 });
    expect(agingBucket('2026-06-01', '2026-09-24').bucket).toBe('d90_plus');
  });
});
