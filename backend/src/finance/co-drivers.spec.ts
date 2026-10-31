import { BadRequestException } from '@nestjs/common';
import { CO_DRIVERS, CO_EFFECTS, CO_REASONS, cleanEffects } from './change-orders.service';

describe('change order drivers and categories', () => {
  it('offers the eight drivers and keeps the older reasons valid', () => {
    expect(CO_DRIVERS).toEqual(['force_majeure', 'unknown_site', 'authority', 'procurement', 'client_request', 'design_eo', 'builder', 'sub_third_party']);
    expect(CO_REASONS).toEqual(expect.arrayContaining(['unforeseen', 'scope_addition', 'other']));
  });
  it('categories are additive / deductive / zero-sum on dollar, time or scope', () => {
    expect(CO_EFFECTS).toHaveLength(9);
    expect(cleanEffects(['additive.dollar', 'deductive.time', 'additive.dollar'])).toEqual(['additive.dollar', 'deductive.time']);
    expect(cleanEffects(undefined)).toBeUndefined();
    expect(() => cleanEffects(['sideways.dollar'])).toThrow(BadRequestException);
  });
});
