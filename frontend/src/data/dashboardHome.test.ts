import { describe, expect, it } from 'vitest';
import { ago, donutArcs, niceAxis, plot, smoothPath, toneOf, trend } from './dashboardHome';

describe('dashboard helpers', () => {
  it('plots values with the max at the top and zero at the bottom', () => {
    expect(plot([0, 10], 100, 50, 10, 0)).toEqual([[0, 50], [100, 0]]);
    expect(plot([5], 100, 50, 10, 0)).toEqual([[0, 25]]);
    expect(plot([], 100, 50)).toEqual([]);
  });

  it('draws a smooth path through every point', () => {
    const d = smoothPath([[0, 10], [10, 0], [20, 10]]);
    expect(d.startsWith('M0,10')).toBe(true);
    expect(d.endsWith('20,10')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(smoothPath([])).toBe('');
  });

  it('rounds the axis up to a tidy step', () => {
    expect(niceAxis(380)).toEqual([0, 100, 200, 300, 400]);
    expect(niceAxis(92000)).toEqual([0, 25000, 50000, 75000, 100000]);
    expect(niceAxis(0)).toEqual([0, 1, 2, 3, 4]);
  });

  it('compares the last month with the one before', () => {
    expect(trend([100, 112])).toEqual({ up: true, pct: 12 });
    expect(trend([100, 96])).toEqual({ up: false, pct: 4 });
    expect(trend([0, 50])).toBeNull();
    expect(trend([50])).toBeNull();
  });

  it('reads the tone of an event', () => {
    expect(toneOf('task.overdue')).toBe('bad');
    expect(toneOf('co.approved')).toBe('good');
    expect(toneOf('task.assigned', 'Waiting for your review')).toBe('warn');
    expect(toneOf('mention')).toBe('info');
  });

  it('says how long ago', () => {
    const now = new Date('2026-10-29T12:00:00Z');
    expect(ago('2026-10-29T11:58:00Z', now)).toBe('2m ago');
    expect(ago('2026-10-29T09:00:00Z', now)).toBe('3h ago');
    expect(ago('2026-10-28T09:00:00Z', now)).toBe('Yesterday');
    expect(ago('nope', now)).toBe('');
  });

  it('splits a donut by share, skipping empty parts', () => {
    const a = donutArcs([3, 1, 0], 100, 0);
    expect(a.map((x) => x.len)).toEqual([75, 25, 0]);
    expect(a[1].offset).toBe(-75);
    expect(donutArcs([0, 0], 100)).toEqual([{ len: 0, offset: 0 }, { len: 0, offset: 0 }]);
  });
});
