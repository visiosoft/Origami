import { payrollReport } from './payroll-report';

const comps: any[] = [
  { id: 'C-FIT', name: 'Federal income tax withholding', kind: 'deduction', category: 'tax' },
  { id: 'C-SS', name: 'Social Security', kind: 'deduction', category: 'social_security' },
  { id: 'C-MED', name: 'Medicare', kind: 'deduction', category: 'social_security' },
  { id: 'C-HLTH', name: 'Health insurance', kind: 'deduction', category: 'insurance' },
];
const runs: any[] = [
  { id: 'R1', label: 'Sep 1–15', periodStart: '2026-09-01', periodEnd: '2026-09-15', status: 'finalized' },
  { id: 'R2', label: 'Sep 16–30', periodStart: '2026-09-16', periodEnd: '2026-09-30', status: 'draft' },
  { id: 'R0', label: 'Aug 16–31', periodStart: '2026-08-16', periodEnd: '2026-08-31', status: 'void' },
];
const slip = (id: string, runId: string, employeeId: string, name: string, basic: number, ot: number, paid = true): any => {
  const gross = basic + ot;
  const fit = Math.round(gross * 0.1 * 100) / 100, ss = Math.round(gross * 0.062 * 100) / 100, med = Math.round(gross * 0.0145 * 100) / 100;
  const lines = [
    { id: 'l1', name: 'Basic', kind: 'earning', source: 'wages', amount: basic },
    ...(ot ? [{ id: 'l2', name: 'Overtime', kind: 'earning', source: 'overtime', amount: ot }] : []),
    { id: 'l3', name: 'Federal income tax withholding', kind: 'deduction', source: 'component', componentId: 'C-FIT', amount: fit },
    { id: 'l4', name: 'Social Security', kind: 'deduction', source: 'component', componentId: 'C-SS', amount: ss },
    { id: 'l5', name: 'Medicare', kind: 'deduction', source: 'component', componentId: 'C-MED', amount: med },
    { id: 'l6', name: 'Health insurance', kind: 'deduction', source: 'component', componentId: 'C-HLTH', amount: 50 },
    { id: 'l7', name: 'Advance', kind: 'deduction', source: 'advance', amount: 100 },
  ];
  const deductions = fit + ss + med + 150;
  return { id, runId, employeeId, employee: { name, workerId: 'W-2026-00' + employeeId.slice(-1), department: 'Construction / Field' }, lines, gross, deductions, net: Math.round((gross - deductions) * 100) / 100, paymentStatus: paid ? 'paid' : 'unpaid' };
};
const slips = [
  slip('S1', 'R1', 'E1', 'George Finau', 2000, 300),
  slip('S2', 'R1', 'E2', 'Luis Ortega', 1600, 0, false),
  slip('S3', 'R2', 'E1', 'George Finau', 2000, 0),
  slip('S0', 'R0', 'E1', 'George Finau', 9999, 0),
];

describe('payroll reports', () => {
  it('only finalized runs whose pay period ends in the range; voided never', () => {
    const r = payrollReport(runs, slips, comps, { from: '2026-08-01', to: '2026-09-30' });
    expect(r.runs.map((x) => x.id)).toEqual(['R1']);
    expect(r.totals.payslips).toBe(2);
    expect(r.totals.gross).toBe(3900);
  });

  it('splits taxes (withholding, Social Security, Medicare) from other deductions, by employee', () => {
    const r = payrollReport(runs, slips, comps, { from: '2026-09-01', to: '2026-09-30' });
    expect(r.columns.taxes).toEqual(['Federal income tax withholding', 'Social Security', 'Medicare']);
    expect(r.columns.deductions).toEqual(['Advance repayment', 'Health insurance']);
    expect(r.columns.earnings).toEqual(['Regular pay', 'Overtime']);
    const george = r.byEmployee.find((e) => e.label === 'George Finau')!;
    expect(george).toMatchObject({ gross: 2300, earnings: { 'Regular pay': 2000, Overtime: 300 }, taxes: { 'Federal income tax withholding': 230, 'Social Security': 142.6, Medicare: 33.35 }, taxTotal: 405.95, deductionTotal: 150 });
    expect(george.net).toBe(Math.round((2300 - 405.95 - 150) * 100) / 100);
    const luis = r.byEmployee.find((e) => e.label === 'Luis Ortega')!;
    expect(luis.unpaid).toBe(luis.net);
    expect(luis.paid).toBe(0);
  });

  it('by pay run, with drafts only when asked for; one employee on their own', () => {
    const r = payrollReport(runs, slips, comps, { from: '2026-09-01', to: '2026-09-30', includeDrafts: true, employeeId: 'E1' });
    expect(r.byRun.map((x) => [x.key, x.payslips, x.gross])).toEqual([['R1', 1, 2300], ['R2', 1, 2000]]);
    expect(r.byRun[1].sub).toContain('(draft)');
    expect(r.byEmployee.map((e) => e.label)).toEqual(['George Finau']);
  });

  it('totals add up across employees', () => {
    const r = payrollReport(runs, slips, comps, { from: '2026-09-01', to: '2026-09-30' });
    const sum = (k: 'taxTotal' | 'deductionTotal' | 'net') => Math.round(r.byEmployee.reduce((a, e) => a + e[k], 0) * 100) / 100;
    expect(r.totals.taxTotal).toBe(sum('taxTotal'));
    expect(r.totals.deductionTotal).toBe(sum('deductionTotal'));
    expect(r.totals.net).toBe(sum('net'));
  });
});
