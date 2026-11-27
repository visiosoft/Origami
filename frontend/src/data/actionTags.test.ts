import { describe, expect, it } from 'vitest';
import { audienceOf, toggleTag } from './actionTags';

describe('access tags', () => {
  it('Financial brings Internal with it; each can be toggled off; order is fixed', () => {
    expect(toggleTag([], 'financial')).toEqual(['internal', 'financial']);
    expect(toggleTag(['internal', 'financial'], 'internal')).toEqual(['financial']);
    expect(toggleTag(['design'], 'client')).toEqual(['client', 'design']);
    expect(toggleTag(['client', 'design'], 'design')).toEqual(['client']);
  });
  it('Nov 27: Internal, Client and External go together in any combination', () => {
    expect(toggleTag(['internal', 'construction'], 'client')).toEqual(['internal', 'client', 'construction']);
    expect(toggleTag(['internal', 'client'], 'external')).toEqual(['internal', 'client', 'external']);
    expect(toggleTag(['internal', 'financial'], 'client')).toEqual(['internal', 'client', 'financial']);
    expect(audienceOf(['internal'])).toBe('Our team only');
    expect(audienceOf(['internal', 'client'])).toBe('Our team + client');
    expect(audienceOf(['client', 'external'])).toBe('Our team + client + third parties');
    expect(audienceOf(['internal', 'client', 'financial'])).toBe('Our team only (financial)');
  });
});
