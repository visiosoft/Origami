import { findDuplicates, normName, normPhone, withLink, withoutLink } from './contact-duplicates';

const rows = [
  { id: 1, name: 'Kai Lono', email: 'kai@lono.com', phone: '(808) 555-0101', contactStatus: 'active' },
  { id: 2, name: 'Dr. Kai  Lono', email: 'old@x.com', phone: '', contactStatus: 'expired', contactStatusReason: 'Left Lono Builders' },
  { id: 3, name: 'Amara Okafor', email: 'amara@x.com', phone: '+1 808 555 0101', contactStatus: 'active' },
  { id: 4, name: 'Kai', email: '', phone: '', contactStatus: 'active' },
];

describe('contact duplicates', () => {
  it('normalises names and phones', () => {
    expect(normName('Dr. Kai  Lono-Smith')).toBe('kai lono smith');
    expect(normPhone('+1 (808) 555-0101')).toBe('8085550101');
    expect(normPhone('555')).toBe('');
  });
  it('matches on name, email or phone, Expired first', () => {
    const m = findDuplicates({ firstName: 'Kai', lastName: 'Lono', phone: '808.555.0101' }, rows);
    expect(m.map((r) => [r.id, r.matchedOn])).toEqual([[2, ['name']], [1, ['name', 'phone']], [3, ['phone']]]);
  });
  it('a single first name or nothing typed matches nothing; the record itself is skipped', () => {
    expect(findDuplicates({ name: 'Kai' }, rows)).toEqual([]);
    expect(findDuplicates({}, rows)).toEqual([]);
    expect(findDuplicates({ email: 'KAI@lono.com ' }, rows, 1)).toEqual([]);
  });
  it('links', () => {
    expect(withLink([2], 3, 1)).toEqual([2, 3]);
    expect(withLink([2], 2, 1)).toEqual([2]);
    expect(withLink(null, 1, 1)).toEqual([]);
    expect(withoutLink([2, 3], 2)).toEqual([3]);
  });
});
