import { describe, expect, it } from 'vitest';
import { dueReasonNeeded, dueReasonText } from './dueReason';

describe('due date reason (Nov 17)', () => {
  it('asks only for an open, overdue task whose date changes', () => {
    expect(dueReasonNeeded('2026-11-10', '2026-11-24', true, '2026-11-17')).toBe(true);
    expect(dueReasonNeeded('2026-11-10', '', true, '2026-11-17')).toBe(true);
    expect(dueReasonNeeded('2026-11-20', '2026-11-24', true, '2026-11-17')).toBe(false);
    expect(dueReasonNeeded('2026-11-10', '2026-11-10', true, '2026-11-17')).toBe(false);
    expect(dueReasonNeeded('2026-11-10', '2026-11-24', false, '2026-11-17')).toBe(false);
  });
  it('words the reason', () => {
    expect(dueReasonText({ choice: 'Client hold', note: '' })).toBe('Client hold');
    expect(dueReasonText({ choice: 'Client hold', note: 'tile pick' })).toBe('Client hold — tile pick');
    expect(dueReasonText({ choice: 'Other', note: 'Permit office closed' })).toBe('Permit office closed');
  });
});
