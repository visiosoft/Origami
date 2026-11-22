import { describe, expect, it } from 'vitest';
import { parseHours } from './CrewSheet';

/** Nov 19: pressing Delete in the hours box cleared the whole worker row. */
describe('daily report hours box', () => {
  it('an empty box clears the hours but is not a removal', () => {
    expect(parseHours('')).toBeUndefined();
    expect(parseHours('  ')).toBeUndefined();
  });
  it('keeps typed numbers, within a day', () => {
    expect(parseHours('9')).toBe(9);
    expect(parseHours('7.5')).toBe(7.5);
    expect(parseHours('30')).toBe(24);
    expect(parseHours('-2')).toBe(0);
  });
});
