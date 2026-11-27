import { encodeAudience, fileAccessOk, fileAudience } from './folder-access';

describe('Nov 27: file audience in any combination', () => {
  it('reads the new code and the older single words the same as before', () => {
    expect(fileAudience(null)).toEqual(['internal']);
    expect(fileAudience('client')).toEqual(['internal', 'client']);
    expect(fileAudience('external')).toEqual(['internal', 'client', 'external']);
    expect(fileAudience('+ie')).toEqual(['internal', 'external']);
    expect(encodeAudience(['external', 'internal'])).toBe('+ie');
    expect(encodeAudience('client')).toBe('+c');
    expect(() => encodeAudience([])).toThrow(/Pick who sees it/);
    expect(encodeAudience(['internal', 'client', 'external']).length).toBeLessThanOrEqual(12);
  });
  it('a client needs Client ticked, a consultant / trade External; staff see everything', () => {
    const client = { staff: false, tier: 'client' }, sub = { staff: false, tier: 'consultant' }, staff = { staff: true };
    expect([fileAccessOk(client, '+ic'), fileAccessOk(sub, '+ic')]).toEqual([true, false]);
    expect([fileAccessOk(client, '+ie'), fileAccessOk(sub, '+ie')]).toEqual([false, true]);
    expect([fileAccessOk(client, 'external'), fileAccessOk(sub, 'client'), fileAccessOk(staff, '+i')]).toEqual([true, false, true]);
  });
});
