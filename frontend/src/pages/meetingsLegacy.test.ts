import { describe, expect, it } from 'vitest';
import { stampedNotMet } from './Meetings';

describe('Special Actions entries that are not meetings (Nov 17: Nov 16 vs Nov 12)', () => {
  it('an entry made in the app, dated the day it was made, is not a meeting', () => {
    expect(stampedNotMet({ meetingDate: '2026-11-16', activity: [{ type: 'created', at: '2026-11-16T18:00:00Z' }] })).toBe(true);
  });
  it('an entry given an earlier meeting date still groups as that meeting', () => {
    expect(stampedNotMet({ meetingDate: '2026-11-12', activity: [{ type: 'created', at: '2026-11-16T18:00:00Z' }] })).toBe(false);
  });
  it('old spreadsheet rows (no created event) and entries linked to a meeting are left alone', () => {
    expect(stampedNotMet({ meetingDate: '2026-07-14', activity: [] })).toBe(false);
    expect(stampedNotMet({ meetingId: 'M1', meetingDate: '2026-11-16', activity: [{ type: 'created', at: '2026-11-16T18:00:00Z' }] })).toBe(false);
  });
});
