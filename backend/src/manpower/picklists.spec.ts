import { DEFAULT_PICKLISTS, parsePicklists } from './picklists';

describe('Manpower picklists', () => {
  it('uses the defaults until something is saved', () => {
    expect(parsePicklists(null)).toEqual(DEFAULT_PICKLISTS);
    expect(parsePicklists('not json')).toEqual(DEFAULT_PICKLISTS);
  });

  it('keeps a saved list, cleaned: trimmed, no duplicates, blanks dropped', () => {
    const out = parsePicklists({ departments: ['  Field ', 'field', '', 'Office'], designations: ['Foreman'], skills: [] });
    expect(out.departments).toEqual(['Field', 'Office']);
    expect(out.designations).toEqual(['Foreman']);
    expect(out.skills).toEqual(DEFAULT_PICKLISTS.skills); // an emptied list falls back rather than leaving nothing to pick
  });
});
