import { describe, expect, it } from 'vitest';
import { quoCallHref } from '../components/ContactLinks';

/** Nov 22: Call dials through Quo -- its app link on phones, tel: on computers. */
describe('Call through Quo', () => {
  it('opens the Quo app on a phone, with the number in +1 form', () => {
    expect(quoCallHref('(408) 555-0101', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('openphone://dial?number=%2B14085550101&action=call');
    expect(quoCallHref('+1 408 555 0101', 'Mozilla/5.0 (Linux; Android 15)')).toBe('openphone://dial?number=%2B14085550101&action=call');
  });
  it('uses tel: on a computer (Quo desktop as the calling app)', () => {
    expect(quoCallHref('408-555-0101', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('tel:+14085550101');
  });
});
