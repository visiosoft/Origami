import { invoiceTotals, isContractWork } from './finance.calc';

/** Nov 17: pre-construction fees billed before the contract sit outside the contract value. */
describe('precon invoice lines', () => {
  it('are not contract work: no retention, and they don’t use up or lock the contract', () => {
    expect(isContractWork('precon')).toBe(false);
    const t = invoiceTotals([
      { kind: 'precon', amountC: 1_500_00, retentionApplies: true, retentionPct: 10, taxable: false, taxPct: 8 },
      { kind: 'precon', amountC: 500_00, retentionApplies: false, retentionPct: 10, taxable: true, taxPct: 10 },
    ]);
    expect(t.contractWorkC).toBe(0);
    expect(t.retentionC).toBe(0);
    expect(t.taxC).toBe(50_00);
    expect(t.totalC).toBe(2_050_00);
  });
});
