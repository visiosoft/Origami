import { describe, expect, it } from 'vitest';
import { foldOf } from './Estimating';

describe('Estimating start page folds (Nov 13)', () => {
  it('puts projects under CRM, Design, Precon (Kickoff), Construction, or closed', () => {
    expect([foldOf(null), foldOf(''), foldOf('Lead')]).toEqual(['crm', 'crm', 'crm']);
    expect(foldOf('Design')).toBe('design');
    expect(foldOf('Kickoff')).toBe('precon');
    expect(foldOf('Construction')).toBe('construction');
    expect([foldOf('Closeout'), foldOf('Cancelled')]).toEqual(['closed', 'closed']);
  });
});
