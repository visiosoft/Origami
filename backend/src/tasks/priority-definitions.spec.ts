import { DEFAULT_PRIORITY_MEANINGS, parsePriorityDefs, storePriorityDefs } from './priority-definitions';

describe('priority definitions', () => {
  it('defaults to the six levels when nothing is stored', () => {
    expect(parsePriorityDefs(null).map((d) => d.priority)).toEqual(['Emergency', 'Urgent', 'High', 'Medium', 'Low', 'Very Low']);
    expect(parsePriorityDefs(null)[0]).toEqual({ priority: 'Emergency', window: 'Due within 1 to 3 hours', meaning: DEFAULT_PRIORITY_MEANINGS.Emergency });
    expect(parsePriorityDefs(null).map((d) => d.window)).toEqual([
      'Due within 1 to 3 hours', 'Due within 24 hours', 'Due within 5 business days', 'Due within 2 weeks', 'Due within a month', 'Due in more than a month',
    ]);
  });
  it('keeps the office wording, falls back for blanks, ignores unknown names and trims', () => {
    const d = parsePriorityDefs(JSON.stringify({ Urgent: '  Stop everything ', High: '', Bogus: 'x' }));
    expect(d[1].meaning).toBe('Stop everything');
    expect(d[2].meaning).toBe(DEFAULT_PRIORITY_MEANINGS.High);
    expect(d).toHaveLength(6);
  });
  it('reads the list the Settings page sends, and stores only meanings', () => {
    const d = parsePriorityDefs([{ priority: 'Very Low', meaning: 'Whenever', window: 'ignored' }]);
    expect(d[5]).toMatchObject({ meaning: 'Whenever', window: 'Due in more than a month' });
    expect(JSON.parse(storePriorityDefs(d))['Very Low']).toBe('Whenever');
  });
});
