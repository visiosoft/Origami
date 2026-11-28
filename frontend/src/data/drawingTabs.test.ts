import { describe, expect, it } from 'vitest';
import { tabOptions } from './drawingTabs';

describe('drawing-set tabs', () => {
  it('lists the tabs with counts; none for a folder without drawings', () => {
    expect(tabOptions(['approved', 'review', 'city', 'other'], { approved: 2, review: 1, city: 0, other: 3 }, true).map((o) => [o[0], o[2]])).toEqual([['all', 6], ['approved', 2], ['review', 1], ['city', 0], ['other', 3]]);
    expect(tabOptions(['approved', 'city'], { approved: 2, city: 1 }, false).map((o) => o[0])).toEqual(['approved', 'city']);
    expect(tabOptions(['approved', 'review', 'city', 'other'], { other: 4 }, true)).toEqual([]);
  });
});
