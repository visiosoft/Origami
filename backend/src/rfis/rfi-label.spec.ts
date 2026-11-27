import { rfiLabel, shortName } from './rfi-label';

describe('Nov 27: an RFI label is the number and up to 25 characters', () => {
  it('uses the short label, else the subject cut at a word', () => {
    expect(rfiLabel({ number: 'RFI-012', shortLabel: 'Toilet change', subject: 'x' })).toBe('RFI-012 · Toilet change');
    expect(rfiLabel({ number: 'RFI-013', subject: 'Clarify the lighting control layout in the kitchen' })).toBe('RFI-013 · Clarify the lighting…');
    expect(shortName('Clarify the lighting control layout').length).toBeLessThanOrEqual(25);
    expect(rfiLabel({ number: 'RFI-014', subject: '' })).toBe('RFI-014');
  });
});
