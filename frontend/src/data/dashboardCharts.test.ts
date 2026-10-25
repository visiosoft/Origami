import { describe, expect, it } from 'vitest';
import { axisTicks, axisTop, barFill, deliveryCode, durationDays, projectBars, timeUsedPct } from './dashboardCharts';

describe('dashboard charts', () => {
  it('reads durations as people type them', () => {
    expect(durationDays('8 months')).toBe(244);
    expect(durationDays('12 wks')).toBe(84);
    expect(durationDays('90 days')).toBe(90);
    expect(durationDays('1 year')).toBe(365);
    expect(durationDays('TBD')).toBeNull();
  });
  it('time used from the start date and duration', () => {
    const today = new Date('2026-10-20T12:00:00');
    expect(timeUsedPct('2026-10-10', '20 days', today)).toBe(50);
    expect(timeUsedPct('2027-01-01', '20 days', today)).toBe(0);
    expect(timeUsedPct('2025-01-01', '20 days', today)).toBe(100);
    expect(timeUsedPct('', '20 days', today)).toBeNull();
  });
  it('delivery codes from contract types old and new', () => {
    expect(deliveryCode('Design Build (DB)')).toBe('DB');
    expect(deliveryCode('Design + Build')).toBe('DB');
    expect(deliveryCode('Build Only (BO)')).toBe('BO');
    expect(deliveryCode('Build')).toBe('BO');
    expect(deliveryCode('Design Only (DO)')).toBe('DO');
    expect(deliveryCode('Progressive Design Build (PDB)')).toBe('PDB');
    expect(deliveryCode('Progressive design-build')).toBe('PDB');
    expect(deliveryCode('PDB')).toBe('PDB');
    expect(deliveryCode('T&M')).toBe('');
    expect(deliveryCode('')).toBe('');
  });
  it('project bars: contract + change orders + reimbursables, billed and spent, biggest first, hot like the Classic chart', () => {
    const bars = projectBars([
      { projectId: 1, name: 'Small', contractType: 'Build', pricing: 'LS', labor: 'PW', hasClientContract: true, originalContract: 90000, revisedContract: 100000, contractWorkInvoiced: 95000, reimbursablesApproved: 0, paid: 40000, costToDate: 20000 },
      { projectId: 2, name: 'Big', contractType: 'Design + Build', hasClientContract: true, originalContract: 400000, revisedContract: 450000, reimbursablesApproved: 50000, reimbursablesBilled: 25000, contractWorkInvoiced: 50000, paid: 0 },
      { projectId: 3, name: 'No contract', hasClientContract: false, revisedContract: 0 },
    ], [{ id: 2, estStart: '2026-10-10', duration: '20 days' }], new Date('2026-10-20T12:00:00'));
    expect(bars.map((b) => b.name)).toEqual(['Big', 'Small']);
    expect(bars[0]).toMatchObject({ base: 400000, co: 50000, reimb: 50000, total: 500000, dollarPct: 15, timePct: 50, hot: true, spentPct: null, delivery: 'DB', pricing: '', labor: '' });
    expect(bars[1]).toMatchObject({ base: 90000, co: 10000, reimb: 0, dollarPct: 95, spentPct: 20, timePct: null, hot: true, spentHot: false, delivery: 'BO', pricing: 'LS', labor: 'PW' });
  });
  it('bar fill splits billed work across contract then change orders', () => {
    const f = barFill({ base: 80, co: 10, reimb: 10, total: 100, billed: 85, reimbBilled: 5 });
    expect(f).toMatchObject({ base: 80, co: 10, reimb: 10, baseFill: 80, coFill: 5, reimbFill: 5 });
    expect(barFill({ base: 80, co: 0, reimb: 20, total: 100, billed: 200, reimbBilled: 50 })).toMatchObject({ baseFill: 80, coFill: 0, reimbFill: 20 });
  });
  it('axis ticks: 4 even round steps up to the biggest bar', () => {
    expect(axisTicks(400).map((t) => t.value)).toEqual([0, 100, 200, 300, 400]);
    expect(axisTicks(1150000).map((t) => t.value)).toEqual([0, 300000, 600000, 900000, 1200000]);
    expect(axisTicks(1010000)[4].value).toBe(1200000);
  });
  it('round axis tops', () => {
    expect(axisTop(0)).toBe(1000);
    expect(axisTop(87000)).toBe(100000);
    expect(axisTop(41000)).toBe(50000);
  });
});
