import { addDays, localToday, mondayOf } from './local-date';

describe('localToday (Nov 17: dates a day off)', () => {
  it('gives the company day, not the UTC one', () => {
    // 05:30 UTC on Nov 10 is still the evening of Nov 9 in California.
    expect(localToday('America/Los_Angeles', new Date('2026-11-10T05:30:00Z'))).toBe('2026-11-09');
  });
  it('falls back to the default zone for a bad name', () => {
    expect(localToday('Not/AZone', new Date('2026-11-10T05:30:00Z'))).toBe('2026-11-09');
  });
  it('does calendar maths', () => {
    expect(addDays('2026-11-09', 7)).toBe('2026-11-16');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
  });
});
