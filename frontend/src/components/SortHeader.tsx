import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir }
type Value = string | number | null | undefined;

/** Compare two cell values: empty last, numbers as numbers, text A–Z ignoring case. */
export function compareValues(a: Value, b: Value): number {
  const ea = a === null || a === undefined || a === '';
  const eb = b === null || b === undefined || b === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** Rows sorted by `state`, using `by[key]` to read each column. Empty values stay last either way. */
export function sortRows<T>(rows: T[], by: Record<string, (r: T) => Value>, state: SortState | null): T[] {
  const get = state ? by[state.key] : undefined;
  if (!get || !state) return rows;
  const sign = state.dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: get(r) }))
    .sort((x, y) => {
      const ex = x.v === null || x.v === undefined || x.v === '';
      const ey = y.v === null || y.v === undefined || y.v === '';
      if (ex || ey) return ex === ey ? x.i - y.i : ex ? 1 : -1;
      return compareValues(x.v, y.v) * sign || x.i - y.i;
    })
    .map((x) => x.r);
}

/** Sort state for a list: click a heading to sort by it, click again to flip. */
export function useSort<T>(rows: T[], by: Record<string, (r: T) => Value>, initial: SortState | null = null, firstDir: Record<string, SortDir> = {}) {
  const [sort, setSort] = useState<SortState | null>(initial);
  const sorted = useMemo(() => sortRows(rows, by, sort),
    // `by` is usually written inline; the rows and the state are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sort]);
  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir[key] || 'asc' }));
  return { sorted, sort, setSort, toggle };
}

/** A clickable column heading with an arrow on the active column. */
export function SortHeader({ k, sort, onSort, children, style, align }: {
  k: string; sort: SortState | null; onSort: (k: string) => void; children: ReactNode; style?: CSSProperties; align?: 'left' | 'right';
}) {
  const on = sort?.key === k;
  return (
    <button type="button" onClick={() => onSort(k)} aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={on ? (sort!.dir === 'asc' ? 'Sorted ascending — click to reverse' : 'Sorted descending — click to reverse') : 'Sort by this column'}
      style={{
        all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'inherit', color: on ? 'var(--ink)' : 'inherit',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start', whiteSpace: 'nowrap', ...style,
      }}>
      {children}
      <span aria-hidden style={{ fontSize: 9, opacity: on ? 1 : 0.35 }}>{on ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}

/** For row lists without headings: one select of "Newest first", "A–Z"… */
export function SortSelect({ options, value, onChange, className, style }: {
  options: { key: string; dir: SortDir; label: string }[]; value: SortState | null; onChange: (s: SortState) => void; className?: string; style?: CSSProperties;
}) {
  const cur = value ? `${value.key}:${value.dir}` : `${options[0].key}:${options[0].dir}`;
  return (
    <select aria-label="Sort" className={className} style={style} value={cur} onChange={(e) => { const [key, dir] = e.target.value.split(':'); onChange({ key, dir: dir as SortDir }); }}>
      {options.map((o) => <option key={`${o.key}:${o.dir}`} value={`${o.key}:${o.dir}`}>Sort: {o.label}</option>)}
    </select>
  );
}

/** A sort as text, for saved views ("due:asc"), and back. "default" is the list's own order. */
export const sortToString = (s: SortState | null) => (s && s.key !== 'default' ? `${s.key}:${s.dir}` : '');
export const sortFromString = (v: unknown): SortState | null => {
  const [key, dir] = String(v || '').split(':');
  return key ? { key, dir: dir === 'desc' ? 'desc' : 'asc' } : null;
};
