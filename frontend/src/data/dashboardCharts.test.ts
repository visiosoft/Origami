import { describe, expect, it } from 'vitest';
import { axisTop, durationDays, projectBars, timeUsedPct } from './dashboardCharts';

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
  it('project bars: billed and paid against contract, biggest first, flags time far ahead of billing', () => {
    const bars = projectBars([
      { projectId: 1, name: 'Small', hasClientContract: true, revisedContract: 100000, contractWorkInvoiced: 50000, paid: 40000 },
      { projectId: 2, name: 'Big', hasClientContract: true, revisedContract: 500000, contractWorkInvoiced: 50000, paid: 0 },
      { projectId: 3, name: 'No contract', hasClientContract: false, revisedContract: 0 },
    ], [{ id: 2, estStart: '2026-10-10', duration: '20 days' }], new Date('2026-10-20T12:00:00'));
    expect(bars.map((b) => b.name)).toEqual(['Big', 'Small']);
    expect(bars[0]).toMatchObject({ billedPct: 10, paidPct: 0, timePct: 50, behind: true });
    expect(bars[1]).toMatchObject({ billedPct: 50, paidPct: 40, timePct: null, behind: false });
  });
  it('round axis tops', () => {
    expect(axisTop(0)).toBe(1000);
    expect(axisTop(87000)).toBe(100000);
    expect(axisTop(41000)).toBe(50000);
  });
});
