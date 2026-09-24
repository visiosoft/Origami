import { allocate, pctOf, toCents } from './money';
import { allocatePayments, computeSov, invoiceTotals, type IssuedLine, type SovInput } from './finance.calc';

const c = (d: number) => toCents(d);
const fin = (value: number | null, reported = 0, approved = 0) => ({ contractValue: value, reportedProgress: reported, approvedProgress: approved });

function input(over: Partial<SovInput> = {}): SovInput {
  return {
    originalContractC: c(500000), approvedChangesC: 0, requireApproval: false,
    project: { contractValue: null, reportedProgress: 0, approvedProgress: 0 },
    phases: [
      { id: 'P-DES', key: 'design', name: 'Design', order: 0, category: 'design' },
      { id: 'P-CON', key: 'gc', name: 'Construction', order: 1, category: 'construction' },
    ],
    tasks: [
      { id: 'T-1', title: 'Foundations', phaseId: 'P-CON', done: true, order: 0 },
      { id: 'T-2', title: 'Structural steel', phaseId: 'P-CON', done: false, order: 1 },
      { id: 'T-3', title: 'Schematic design', phaseId: 'P-DES', done: false, order: 0 },
    ],
    phaseFin: new Map(), taskFin: new Map(), lines: [], invoices: [], payments: [], today: '2026-09-24',
    ...over,
  };
}

describe('money', () => {
  it('converts to cents without float drift', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents('306.00')).toBe(30600);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(pctOf(c(100000), 40)).toBe(c(40000));
    expect(pctOf(c(306), 50)).toBe(c(153));
  });

  it('allocates exactly, putting leftover cents on the largest line', () => {
    const parts = allocate(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
    expect(allocate(1001, [100, 300, 100])).toEqual([200, 601, 200]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });
});

describe('invoice math', () => {
  it('holds retention on contract work, taxes the net, and treats adjustments by their own taxable flag', () => {
    const t = invoiceTotals([
      { kind: 'progress', amountC: c(100000), retentionApplies: true, retentionPct: 10, taxable: true, taxPct: 5 },
      { kind: 'adjustment', amountC: c(-1000), retentionApplies: false, retentionPct: 0, taxable: false, taxPct: 5 },
      { kind: 'adjustment', amountC: c(200), retentionApplies: false, retentionPct: 0, taxable: true, taxPct: 5 },
    ]);
    expect(t.contractWorkC).toBe(c(100000));  // tax and adjustments are not contract work
    expect(t.retentionC).toBe(c(10000));
    expect(t.adjustmentC).toBe(c(-800));
    expect(t.taxC).toBe(c(4500) + c(10));        // 5% of 90,000 net + 5% of the taxable $200
    expect(t.totalC).toBe(c(90000 - 1000 + 200) + c(4510));
  });

  it('allocates payments to contract-work lines by net claim, summing exactly to the contract-work share', () => {
    const lines: IssuedLine[] = [
      { id: 'a', invoiceId: 'I', kind: 'progress', amountC: c(125000), retentionC: c(12500), taxC: 0 },
      { id: 'b', invoiceId: 'I', kind: 'progress', amountC: c(30000), retentionC: c(3000), taxC: 0 },
      { id: 'x', invoiceId: 'I', kind: 'adjustment', amountC: c(-500), retentionC: 0, taxC: 0 },
    ];
    const total = c(125000 - 12500 + 30000 - 3000 - 500);
    const paid = allocatePayments(lines, total, total);
    expect((paid.get('a') || 0) + (paid.get('b') || 0)).toBe(c(112500 + 27000)); // fully paid -> every line's net
    expect(paid.has('x')).toBe(false);
    const part = allocatePayments(lines, total, c(50000.01));
    expect((part.get('a') || 0) + (part.get('b') || 0)).toBe(Math.round((c(50000.01) * c(139500)) / total));
  });
});

describe('schedule of values', () => {
  it('rolls task values into their milestone and ignores a milestone value while tasks carry values', () => {
    const r = computeSov(input({
      phaseFin: new Map([['P-CON', fin(999999)]]),
      taskFin: new Map([['T-1', fin(75000, 100)], ['T-2', fin(100000, 40)]]),
    }));
    const con = r.groups.find((g) => g.category === 'construction')!.rows[0];
    expect(con.valueFromTasks).toBe(true);
    expect(con.valueC).toBe(c(175000));
    expect(con.evC).toBe(c(75000 + 40000));
    expect(r.summary.allocatedC).toBe(c(175000));
    expect(r.summary.unallocatedC).toBe(c(325000));
    expect(r.summary.allocation).toBe('under');
    expect(con.physicalProgress).toBe(50); // one of two tasks done -- separate from earned progress
  });

  it('reports fully and over-allocated schedules', () => {
    const full = computeSov(input({ phaseFin: new Map([['P-DES', fin(200000)], ['P-CON', fin(300000)]]) }));
    expect(full.summary.allocation).toBe('full');
    const over = computeSov(input({ phaseFin: new Map([['P-DES', fin(250000)], ['P-CON', fin(300000)]]) }));
    expect(over.summary.allocation).toBe('over');
    expect(over.summary.unallocatedC).toBe(c(-50000));
  });

  it('uses approved progress for earned value when approval is required', () => {
    const i = input({ taskFin: new Map([['T-2', fin(100000, 70, 60)]]) });
    expect(computeSov(i).summary.evC).toBe(c(70000));
    expect(computeSov({ ...i, requireApproval: true }).summary.evC).toBe(c(60000));
  });

  it('keeps the four figures apart: $100k task, 60% approved, $40k billed, $30k paid', () => {
    const r = computeSov(input({
      requireApproval: true,
      taskFin: new Map([['T-2', fin(100000, 70, 60)]]),
      lines: [{ id: 'L1', invoiceId: 'I1', kind: 'progress', taskId: 'T-2', phaseId: 'P-CON', targetType: 'task', amountC: c(40000), retentionC: 0, taxC: c(2000) }],
      invoices: [{ id: 'I1', totalC: c(42000), dueDate: '2026-10-30' }],
      payments: [{ invoiceId: 'I1', amountC: c(31500) }],
    }));
    const t2 = r.groups.find((g) => g.category === 'construction')!.rows[0].children!.find((x) => x.id === 'T-2')!;
    expect(t2).toMatchObject({ evC: c(60000), invoicedC: c(40000), billableC: c(20000), remainingC: c(60000), billingStatus: 'ready_to_invoice', paymentStatus: 'partially_paid' });
    expect(t2.paidC).toBe(c(30000)); // the tax share of the payment is not contract work
    expect(r.summary.contractWorkInvoicedC).toBe(c(40000));
    expect(r.summary.invoiceTotalsC).toBe(c(42000));
    expect(r.summary.arOutstandingC).toBe(c(10500));
    expect(r.summary.remainingContractC).toBe(c(460000));
  });

  it('flags over-billing separately when progress falls after billing', () => {
    const r = computeSov(input({
      taskFin: new Map([['T-1', fin(75000, 20)]]),
      lines: [{ id: 'L1', invoiceId: 'I1', kind: 'progress', taskId: 'T-1', targetType: 'task', amountC: c(30000), retentionC: 0, taxC: 0 }],
      invoices: [{ id: 'I1', totalC: c(30000) }],
    }));
    const t1 = r.groups[0].rows[0].children!.find((x) => x.id === 'T-1') || r.groups.flatMap((g) => g.rows.flatMap((x) => x.children || [])).find((x) => x.id === 'T-1')!;
    expect(t1).toMatchObject({ billableC: 0, overBilledC: c(15000), billingStatus: 'over_billed' });
  });

  it('bills a general project as one lump sum until something carries a value', () => {
    const general = input({ phases: [], tasks: [], project: { contractValue: null, reportedProgress: 25, approvedProgress: 0 } });
    const r = computeSov(general);
    expect(r.summary.lumpSum).toBe(true);
    expect(r.lump).toMatchObject({ valueC: c(500000), evC: c(125000), billableC: c(125000) });
    const withMilestone = computeSov({ ...general, phases: [{ id: 'P-X', key: 'fin-x', name: 'Deposit', order: 0, category: 'other' }], phaseFin: new Map([['P-X', fin(50000, 100)]]) });
    expect(withMilestone.summary.lumpSum).toBe(false);
    expect(withMilestone.groups[0]).toMatchObject({ category: 'other' });
    expect(withMilestone.lump).toBeNull();
  });

  it('shows unphased task values and tasks deleted after being invoiced', () => {
    const r = computeSov(input({
      tasks: [...input().tasks, { id: 'T-AD', title: 'Site visit', phaseId: null, done: false, order: 0 }],
      taskFin: new Map([['T-AD', fin(5000, 100)], ['T-GONE', fin(8000, 100)]]),
      lines: [{ id: 'L1', invoiceId: 'I1', kind: 'progress', taskId: 'T-GONE', targetType: 'task', amountC: c(8000), retentionC: 0, taxC: 0 }],
      invoices: [{ id: 'I1', totalC: c(8000) }],
    }));
    const unphased = r.groups.find((g) => g.category === 'unphased')!;
    expect(unphased.rows.map((x) => x.id).sort()).toEqual(['T-AD', 'T-GONE']);
    expect(unphased.rows.find((x) => x.id === 'T-GONE')!.deleted).toBe(true);
    expect(r.summary.allocatedC).toBe(c(13000));
  });
});
