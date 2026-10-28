import { INTAKE_FIELDS, missingIntake } from './lead-intake';

describe('New Lead intake', () => {
  it('every field needs an answer or N/A; referral and event fields only when they apply', () => {
    const all = Object.fromEntries(INTAKE_FIELDS.map((f) => [f.key, 'x']));
    expect(missingIntake({ ...all, leadSource: 'Website' })).toEqual([]);
    expect(missingIntake({ ...all, leadSource: 'Website', website: 'N/A', goByName: '' }).map((f) => f.key)).toEqual(['goByName']);
    const referral = { ...all, leadSource: 'Referral from Client', leadSourceReferrerPhone: '' };
    expect(missingIntake(referral).map((f) => f.label)).toEqual(['Referrer Phone']);
    expect(missingIntake({}).length).toBeGreaterThan(25);
  });
});
