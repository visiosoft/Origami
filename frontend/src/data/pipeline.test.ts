import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliveryCode, slaState, stageBlockedFor } from './pipeline';

describe('deliveryCode', () => {
  it('reads the code in brackets at the end', () => {
    expect(deliveryCode('Build Only (BO)')).toBe('BO');
    expect(deliveryCode('Design + Build (DB) ')).toBe('DB');
    expect(deliveryCode('Design + Build')).toBe('');
    expect(deliveryCode(undefined)).toBe('');
  });
  it('a contract with no code is never blocked', () => {
    expect(stageBlockedFor(undefined, 'site_visit')).toBe(false);
  });
});

describe('slaState', () => {
  const NOW = Date.parse('2026-10-05T12:00:00Z');
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });
  const sla = { new_lead: 1, proposal: 7 };

  it('counts down hours on the last day', () => {
    const s = slaState({ stage: 'new_lead', stageEnteredAt: new Date(NOW - 20 * 3600000).toISOString() }, sla)!;
    expect(s.overdue).toBe(false);
    expect(s.label).toBe('4h left');
    expect(s.dueSoon).toBe(true);
  });
  it('shows days over once the target has passed', () => {
    const s = slaState({ stage: 'proposal', stageEnteredAt: new Date(NOW - 10 * 86400000).toISOString() }, sla)!;
    expect(s.overdue).toBe(true);
    expect(s.label).toBe('3d over');
  });
  it('falls back to daysInStage when the stage clock is missing', () => {
    expect(slaState({ stage: 'proposal', daysInStage: 2 }, sla)!.label).toBe('5d left');
  });
  it('has no target for held/closed stages, unknown stages or bad dates', () => {
    expect(slaState({ stage: 'proposal', daysInStage: 1 }, sla, { isHold: true } as never)).toBeNull();
    expect(slaState({ stage: 'zoning', daysInStage: 1 }, sla)).toBeNull();
    expect(slaState({ stage: 'proposal', stageEnteredAt: 'not a date' }, sla)).toBeNull();
  });
});
