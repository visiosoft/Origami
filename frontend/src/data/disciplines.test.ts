import { describe, expect, it } from 'vitest';
import { CONSULTANT_DISCIPLINES, INTERNAL_ROLES, canonicalRole } from './disciplines';

describe('People categories (Nov 19)', () => {
  it('has each consultant discipline once, A-Z', () => {
    const low = CONSULTANT_DISCIPLINES.map((d) => d.toLowerCase());
    expect(new Set(low).size).toBe(low.length);
    expect([...CONSULTANT_DISCIPLINES]).toEqual([...CONSULTANT_DISCIPLINES].sort((a, b) => a.localeCompare(b)));
    for (const d of ['Arborist', 'Title Insurance', 'Waterproofing Consultant', 'Attorney', 'Structural Engineer']) expect(CONSULTANT_DISCIPLINES).toContain(d);
  });
  it('has one name per internal role', () => {
    expect(new Set(INTERNAL_ROLES).size).toBe(INTERNAL_ROLES.length);
    expect(canonicalRole('PM')).toBe('Project Manager');
    expect(canonicalRole('site superintendent')).toBe('Superintendent');
    expect(canonicalRole('Marketing lead')).toBe('Marketing lead');
  });
});
