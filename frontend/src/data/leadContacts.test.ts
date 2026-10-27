import { describe, expect, it } from 'vitest';
import { relationshipOf as relOf, seedContactsFromLead as seed } from './leadContacts';
const RELS = ['Spouse', 'Partner', 'Business Partner'];
describe('relationship to the lead', () => {
  it('keeps spouse and partner apart, reading older titles too', () => {
    expect(relOf({ title: 'Spouse' }, RELS)).toBe('Spouse');
    expect(relOf({ title: 'Owner’s Rep' }, RELS)).toBe('');
    expect(relOf({ title: 'Spouse', relationship: 'Partner' }, RELS)).toBe('Partner');
    const [, second] = seed({ firstName: 'Kai', lastName: 'Lono', nameOfSecondContact: 'Ivy Ng', relationshipOfSecondContact: 'Partner' });
    expect(second).toMatchObject({ firstName: 'Ivy', relationship: 'Partner', title: '' });
  });
});
