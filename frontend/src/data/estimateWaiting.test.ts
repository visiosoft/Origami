import { describe, expect, it } from 'vitest';
import { estimateWaiting } from './estimateWaiting';

describe('estimate waiting timer (Nov 17)', () => {
  it('counts days since it was sent, amber after a week', () => {
    expect(estimateWaiting({ status: 'sent', sentAt: '2026-11-17T09:00:00Z' }, '2026-11-17')).toEqual({ label: 'Shared today', days: 0, late: false });
    expect(estimateWaiting({ status: 'sent', sentAt: '2026-11-10T09:00:00Z' }, '2026-11-17')).toEqual({ label: 'Shared · waiting 7 days', days: 7, late: false });
    expect(estimateWaiting({ status: 'sent', sentAt: '2026-11-08' }, '2026-11-17').late).toBe(true);
  });
  it('names the other states', () => {
    expect(estimateWaiting({ status: 'draft' }).label).toBe('Draft');
    expect(estimateWaiting({ status: 'accepted', sentAt: '2026-11-01' }).label).toBe('Accepted');
  });
});
