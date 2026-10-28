import { DEFAULT_PRIORITY_MEANINGS, parsePriorityDefs, storePriorityDefs } from './priority-definitions';

describe('priority definitions', () => {
  it('defaults when nothing is stored', () => {
    expect(parsePriorityDefs(null).map((d) => d.priority)).toEqual(['Urgent', 'High', 'Medium', 'Low']);
    expect(parsePriorityDefs(null)[0]).toEqual({ priority: 'Urgent', window: 'Due within 24 hours', meaning: DEFAULT_PRIORITY_MEANINGS.Urgent });
  });
  it('keeps the office wording, falls back for blanks, ignores unknown names and trims', () => {
    const d = parsePriorityDefs(JSON.stringify({ Urgent: '  Stop everything ', High: '', Bogus: 'x' }));
    expect(d[0].meaning).toBe('Stop everything');
    expect(d[1].meaning).toBe(DEFAULT_PRIORITY_MEANINGS.High);
    expect(d).toHaveLength(4);
  });
  it('reads the list the Settings page sends, and stores only meanings', () => {
    const d = parsePriorityDefs([{ priority: 'Low', meaning: 'Whenever', window: 'ignored' }]);
    expect(d[3]).toMatchObject({ meaning: 'Whenever', window: 'Due in more than a month' });
    expect(JSON.parse(storePriorityDefs(d)).Low).toBe('Whenever');
  });
});
