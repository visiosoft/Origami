import { describe, expect, it } from 'vitest';
import { dateInNotes } from './meetingNotes';

describe('meeting date from its notes (Nov 19)', () => {
  it('reads the date the notes give', () => {
    expect(dateInNotes('Meeting Date: November 12, 2026')).toBe('2026-11-12');
    expect(dateInNotes('Weekly Sync - 2026/11/12 13:58 PST - Transcript')).toBe('2026-11-12');
    expect(dateInNotes('')).toBeNull();
  });
});
