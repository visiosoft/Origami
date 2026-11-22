import { describe, expect, it } from 'vitest';
import { parseMeetingNotes } from './meetingNotes';

/** Nov 22: notes from a Quo call summary read like any meeting's -- summary as FOR RECORD, next steps as tasks. */
describe('notes from a Quo call', () => {
  it('turns the summary and next steps into items', () => {
    const p = parseMeetingNotes('Call summary\n- Discussed the HVAC quote.\n\nNext steps\n- [Edward] Send the revised quote by Friday\n- [Astrid] Book the site visit\n\nSummary from Quo’s call notes.', '2026-11-22');
    expect(p.records.map((r) => r.description)).toEqual(['Discussed the HVAC quote.']);
    expect(p.tasks.map((t) => [t.title, t.names])).toEqual([['Send the revised quote by Friday', ['Edward']], ['Book the site visit', ['Astrid']]]);
  });
});
