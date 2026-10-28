import { describe, expect, it } from 'vitest';
import { pageWindow } from './Pager';

describe('pageWindow', () => {
  it('shows first, last and the pages around the current one', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 20)).toEqual([1, null, 4, 5, 6, null, 20]);
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, null, 20]);
  });
});
