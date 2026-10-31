import { describe, expect, it } from 'vitest';
import { toggleTag } from './actionTags';

describe('access tags', () => {
  it('Financial brings Internal with it; each can be toggled off; order is fixed', () => {
    expect(toggleTag([], 'financial')).toEqual(['internal', 'financial']);
    expect(toggleTag(['internal', 'financial'], 'internal')).toEqual(['financial']);
    expect(toggleTag(['design'], 'client')).toEqual(['client', 'design']);
    expect(toggleTag(['client', 'design'], 'design')).toEqual(['client']);
  });
});
