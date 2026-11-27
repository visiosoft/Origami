import { hiddenFrom } from './task.types';

/** Nov 27 (Weekly Sync): Internal / Client / External in any combination -- tick = who sees it. */
describe('who sees a task by its tags', () => {
  const cases: [string[], boolean, boolean][] = [
    // tags, hidden from a client, hidden from a consultant / sub
    [[], false, false],
    [['internal'], true, true],
    [['internal', 'client'], false, true],
    [['internal', 'external'], true, false],
    [['client', 'external'], false, false],
    [['internal', 'client', 'external'], false, false],
    [['client'], false, true],
    [['internal', 'client', 'financial'], true, true],
    [['crm', 'design'], false, false],
  ];
  it.each(cases)('%j', (tags, client, consultant) => {
    expect(hiddenFrom(tags, 'client')).toBe(client);
    expect(hiddenFrom(tags, 'consultant')).toBe(consultant);
  });
});
