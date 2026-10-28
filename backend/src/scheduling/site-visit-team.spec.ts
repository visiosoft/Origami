import { cleanTeam, DEFAULT_SITE_VISIT_TEAM, guestList, parseTeam } from './site-visit-team';

describe('site visit team', () => {
  it('defaults to Edward, Langston and Astrid, all required', () => {
    expect(parseTeam(null).map((m) => [m.email, m.optional])).toEqual([
      ['edward@origamidb.com', false], ['langston@origamidb.com', false], ['astrid@origamidb.com', false],
    ]);
    expect(parseTeam('not json')).toBe(DEFAULT_SITE_VISIT_TEAM);
  });
  it('keeps a saved team, even an empty one; drops bad and repeated emails', () => {
    expect(parseTeam('[]')).toEqual([]);
    expect(cleanTeam([{ email: ' Astrid@OrigamiDB.com ', optional: 1 }, { email: 'astrid@origamidb.com' }, { email: 'nope' }]))
      .toEqual([{ name: 'astrid', email: 'astrid@origamidb.com', optional: true }]);
  });
  it('turns guests into Calendar attendees: optional flag kept, a required duplicate wins', () => {
    expect(guestList(['client@x.com', { email: 'langston@origamidb.com', optional: true, name: 'Langston' }, { email: 'CLIENT@x.com', optional: true }, 'bad']))
      .toEqual([{ email: 'client@x.com' }, { email: 'langston@origamidb.com', optional: true, displayName: 'Langston' }]);
    expect(guestList([{ email: 'a@x.com', optional: true }, 'a@x.com'])).toEqual([{ email: 'a@x.com' }]);
  });
});
