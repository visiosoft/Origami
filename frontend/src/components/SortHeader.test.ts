import { describe, expect, it } from 'vitest';
import { compareValues, sortRows } from './SortHeader';
import { sameFilters } from './SavedViews';

const rows = [
  { n: 'beta', d: '2026-10-02', a: 30 },
  { n: 'Alpha', d: '', a: 5 },
  { n: 'RFI-10', d: '2026-10-05', a: null },
  { n: 'RFI-2', d: '2026-09-01', a: 100 },
];
const by = { n: (r: typeof rows[0]) => r.n, d: (r: typeof rows[0]) => r.d, a: (r: typeof rows[0]) => r.a };

describe('sorting', () => {
  it('sorts text A–Z ignoring case, with numbers inside text in order', () => {
    expect(sortRows(rows, by, { key: 'n', dir: 'asc' }).map((r) => r.n)).toEqual(['Alpha', 'beta', 'RFI-2', 'RFI-10']);
  });
  it('sorts dates newest first and keeps empty values last either way', () => {
    expect(sortRows(rows, by, { key: 'd', dir: 'desc' }).map((r) => r.d)).toEqual(['2026-10-05', '2026-10-02', '2026-09-01', '']);
    expect(sortRows(rows, by, { key: 'd', dir: 'asc' }).map((r) => r.d)).toEqual(['2026-09-01', '2026-10-02', '2026-10-05', '']);
  });
  it('sorts numbers low to high', () => {
    expect(sortRows(rows, by, { key: 'a', dir: 'asc' }).map((r) => r.a)).toEqual([5, 30, 100, null]);
    expect(compareValues(2, 10)).toBeLessThan(0);
  });
  it('leaves the order alone with no sort', () => {
    expect(sortRows(rows, by, null)).toBe(rows);
  });
});

describe('saved view matching', () => {
  it('ignores key order and empty values', () => {
    expect(sameFilters({ a: 'x', b: '' }, { a: 'x' })).toBe(true);
    expect(sameFilters({ a: 'x', b: 'y' }, { b: 'y', a: 'x' })).toBe(true);
    expect(sameFilters({ a: 'x' }, { a: 'y' })).toBe(false);
  });
});
