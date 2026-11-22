import { cleanSaved } from './mass-saved';

describe('mass-text templates and groups (Nov 19)', () => {
  it('keeps named templates and groups with people, drops empty or bad ones', () => {
    const s = cleanSaved({
      templates: [{ name: 'Site closed', body: 'Hi {first name}, the site is closed today.' }, { name: '', body: 'x' }],
      groups: [{ name: 'Countryside subs', people: [3, '4', 4, -1, 'x'], leads: [], body: 'Hi {first name}' }, { name: 'Empty', people: [] }],
    });
    expect(s.templates).toHaveLength(1);
    expect(s.templates[0].id).toMatch(/^MT-/);
    expect(s.groups).toEqual([{ id: expect.stringMatching(/^MG-/), name: 'Countryside subs', people: [3, 4], leads: [], body: 'Hi {first name}' }]);
    expect(cleanSaved(null)).toEqual({ templates: [], groups: [] });
  });
});
