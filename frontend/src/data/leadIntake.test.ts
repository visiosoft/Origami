import { describe, expect, it } from 'vitest';
import { INTAKE_FIELDS, missingIntake } from './leadIntake';

describe('New Lead intake', () => {
  it('needs every field answered or N/A, referral fields only for a referral', () => {
    const all = Object.fromEntries(INTAKE_FIELDS.map((f) => [f.key, 'N/A']));
    expect(missingIntake({ ...all, leadSource: 'Website' })).toEqual([]);
    expect(missingIntake({ ...all, leadSource: 'Referral from Client', leadSourceReferrerName: '' }).map((f) => f.key)).toEqual(['leadSourceReferrerName']);
    expect(missingIntake({ ...all, secondPointOfContact: '' }).map((f) => f.tab)).toEqual([1]);
  });
});
