import { describe, expect, it } from 'vitest';
import { rfiLabelOf, shortNameOf } from './rfiLabel';

describe('RFI label', () => {
  it('uses the short label, else the subject cut to 25 characters on a word', () => {
    expect(rfiLabelOf({ number: 'RFI-012', shortLabel: 'Toilet change', subject: 'Long subject' })).toBe('RFI-012 · Toilet change');
    const s = shortNameOf('Relocate the toilet in the master bathroom');
    expect(s.length).toBeLessThanOrEqual(25);
    expect(s.endsWith('…')).toBe(true);
    expect(rfiLabelOf({ number: 'RFI-001' })).toBe('RFI-001');
  });
});
