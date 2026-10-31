import type { CSSProperties } from 'react';

/** What a paged list request returns. */
export interface Paged<T> { rows: T[]; total: number; page: number; size: number; pages: number }

export const PAGE_SIZES = [25, 50, 100, 200];

/** The page numbers to show: first, last, and a window around the current page, with gaps as null. */
export function pageWindow(page: number, pages: number, around = 1): (number | null)[] {
  const want = new Set([1, pages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pages) want.add(p);
  const list = [...want].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  list.forEach((p, i) => { if (i && p - list[i - 1] > 1) out.push(null); out.push(p); });
  return out;
}

const btn = (on: boolean, disabled = false): CSSProperties => ({
  minWidth: 32, height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)'),
  background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
});

/** « 1 … 4 5 6 … 20 » with "Showing 151–200 of 987" and a page-size picker. */
export function Pager({ page, pages, total, size, onPage, onSize, loading, sizes = PAGE_SIZES }: {
  page: number; pages: number; total: number; size: number;
  onPage: (p: number) => void; onSize?: (s: number) => void; loading?: boolean; sizes?: number[];
}) {
  if (!total) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav aria-label="Pages" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '12px 4px', fontSize: 12.5, color: 'var(--muted)' }}>
      <span style={{ marginRight: 'auto' }}>{loading ? 'Loading…' : `Showing ${from}–${to} of ${total}`}</span>
      {pages > 1 && <>
        <button type="button" style={btn(false, page <= 1)} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
        {pageWindow(page, pages).map((p, i) => p === null
          ? <span key={'gap' + i} aria-hidden style={{ padding: '0 2px' }}>…</span>
          : <button key={p} type="button" style={btn(p === page)} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>{p}</button>)}
        <button type="button" style={btn(false, page >= pages)} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
      </>}
      {onSize && (
        <select aria-label="Rows per page" value={size} onChange={(e) => onSize(Number(e.target.value))}
          style={{ height: 32, borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--surface)', color: 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, padding: '0 6px' }}>
          {sizes.map((s) => <option key={s} value={s}>{s} per page</option>)}
        </select>
      )}
    </nav>
  );
}
