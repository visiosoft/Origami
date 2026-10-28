/**
 * Page numbers for long lists: the first page loads first, the rest only when
 * asked for. `size` is capped so no single request pulls a whole table.
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface PageArgs { page: number; size: number }
export interface Page<T> { rows: T[]; total: number; page: number; size: number; pages: number }

export function pageArgs(page?: unknown, size?: unknown): PageArgs {
  const s = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(size)) || DEFAULT_PAGE_SIZE));
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  return { page: p, size: s };
}

/** One page of an already-filtered list; a page past the end comes back as the last page. */
export function pageOf<T>(rows: T[], args: PageArgs): Page<T> {
  const pages = Math.max(1, Math.ceil(rows.length / args.size));
  const page = Math.min(args.page, pages);
  return { rows: rows.slice((page - 1) * args.size, page * args.size), total: rows.length, page, size: args.size, pages };
}

type Value = string | number | null | undefined;
/** Empty last, numbers as numbers, text A–Z ignoring case (same as the tables' own sort). */
export function compareValues(a: Value, b: Value): number {
  const ea = a === null || a === undefined || a === '';
  const eb = b === null || b === undefined || b === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** Rows sorted by one column; empty values stay last either way, ties keep their order. */
export function sortRows<T>(rows: T[], get: ((r: T) => Value) | undefined, dir: 'asc' | 'desc' = 'asc'): T[] {
  if (!get) return rows;
  const sign = dir === 'desc' ? -1 : 1;
  return rows.map((r, i) => ({ r, i, v: get(r) })).sort((x, y) => {
    const ex = x.v === null || x.v === undefined || x.v === '';
    const ey = y.v === null || y.v === undefined || y.v === '';
    if (ex || ey) return ex === ey ? x.i - y.i : ex ? 1 : -1;
    return compareValues(x.v, y.v) * sign || x.i - y.i;
  }).map((x) => x.r);
}
