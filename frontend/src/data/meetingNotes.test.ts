import { describe, expect, it } from 'vitest';
import { dueFromText, matchPeople, parseMeetingNotes, parseNextStep } from './meetingNotes';

// The Hom Cafe weekly sync from the Oct 26 review notes (Saturday, Oct 24 2026).
const NOTES = `Hom Cafe - Weekly Sync
Oct 24, 2026
City plan review and permit updates with cushion repricing and material purchasing decisions.

City Permitting and Plan Submissions
• The city requested administrative formatting changes that do not alter the inherent architectural design.
• Edward rescheduled the weekly project sync to Tuesday to match the accelerated permitting timeline.

Fire Sprinkler Bidding and Budgeting
• United Fire Sprinklers submitted a competitive estimate of $4,200 following their property site visit.
• Edward recommended budgeting $5,500 for fire sprinklers to provide financial wiggle room.

Next steps
☐ [Jared] Rerun Calculations: Rerun Title 24 energy efficiency calculations and submit the updates to the city on Monday.
☐ [Edward Ciccarelli] Prepare Schedule: Prepare the schedule of values for construction and send the documentation to the group by Tuesday the 27th.
☐ [HomCafe, Kellen Davies] Obtain Requirements: Request a list of required documentation from the property manager to begin construction.
`;

describe('meeting notes -> special actions', () => {
  it('turns each summary bullet into its own FOR RECORD item, titled with its heading', () => {
    const { records } = parseMeetingNotes(NOTES, '2026-10-24');
    expect(records).toHaveLength(4);
    expect(records[0]).toEqual({ title: 'City Permitting and Plan Submissions', description: 'The city requested administrative formatting changes that do not alter the inherent architectural design.' });
    expect(records[1].title).toBe('City Permitting and Plan Submissions');
    expect(records[3]).toMatchObject({ title: 'Fire Sprinkler Bidding and Budgeting', description: expect.stringMatching(/^Edward recommended budgeting \$5,500/) });
  });

  it('turns next steps into tasks: names, title, detail and a due date read from the text', () => {
    const { tasks } = parseMeetingNotes(NOTES, '2026-10-24');
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({ names: ['Jared'], title: 'Rerun Calculations', dueDate: '2026-10-26' });
    expect(tasks[1]).toMatchObject({ names: ['Edward Ciccarelli'], title: 'Prepare Schedule', dueDate: '2026-10-27' });
    expect(tasks[2]).toMatchObject({ names: ['HomCafe', 'Kellen Davies'], title: 'Obtain Requirements', priority: 'High' });
    expect(tasks[2].dueDate).toBeUndefined();
  });

  it('reads due dates relative to the meeting', () => {
    expect(dueFromText('send it Oct 30', '2026-10-24')).toBe('2026-10-30');
    expect(dueFromText('by 11/2', '2026-10-24')).toBe('2026-11-02');
    expect(dueFromText('tomorrow please', '2026-10-24')).toBe('2026-10-25');
    expect(dueFromText('by Saturday', '2026-10-24')).toBe('2026-10-31');
    expect(dueFromText('no date here', '2026-10-24')).toBeUndefined();
    expect(parseNextStep('- Call Enrique about the sign quote.', '2026-10-24')).toMatchObject({ names: [], title: 'Call Enrique about the sign quote', priority: 'High' });
  });

  it('matches bracketed names to people by full name or a unique first name', () => {
    const people = [{ id: 'U1', name: 'Edward Ciccarelli' }, { id: 'U2', name: 'Andrea Castillo' }, { id: 'U3', name: 'Jared Kim' }];
    expect(matchPeople(['Edward Ciccarelli', 'Jared', 'HomCafe'], people)).toEqual({ matched: [people[0], people[2]], unmatched: ['HomCafe'] });
  });
});
