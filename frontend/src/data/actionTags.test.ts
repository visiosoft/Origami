import { describe, expect, it } from 'vitest';
import { toggleTag } from './actionTags';

describe('access tags', () => {
  it('Financial brings Internal with it; each can be toggled off; order is fixed', () => {
    expect(toggleTag([], 'financial')).toEqual(['internal', 'financial']);
    expect(toggleTag(['internal', 'financial'], 'internal')).toEqual(['financial']);
    expect(toggleTag(['design'], 'client')).toEqual(['client', 'design']);
    expect(toggleTag(['client', 'design'], 'design')).toEqual(['client']);
  });
  it('tagging an Internal item Client or External shares it, unless it is Financial', () => {
    expect(toggleTag(['internal', 'construction'], 'client')).toEqual(['client', 'construction']);
    expect(toggleTag(['internal'], 'external')).toEqual(['external']);
    expect(toggleTag(['internal', 'financial'], 'client')).toEqual(['internal', 'client', 'financial']);
  });
});
