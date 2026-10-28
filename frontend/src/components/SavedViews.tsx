import { useEffect, useState } from 'react';
import { api, type SavedView } from '../api';
import { useApp } from '../AppContext';

/** Same filters, ignoring key order and empty values. */
const norm = (f: Record<string, unknown>) => JSON.stringify(Object.keys(f).sort().filter((k) => f[k] !== '' && f[k] != null).map((k) => [k, f[k]]));
export const sameFilters = (a: Record<string, unknown>, b: Record<string, unknown>) => norm(a) === norm(b);

/**
 * Saved views + "Clear all filters" for a list page. The page hands over its
 * filters as one object (`value`), what "no filters" looks like (`defaults`),
 * and how to put a set back (`onApply`). Views are the signed-in person's own,
 * kept on the server so they follow them to any device.
 */
export function SavedViews<F extends Record<string, unknown>>({ page, value, defaults, onApply }: {
  page: string; value: F; defaults: F; onApply: (f: F) => void;
}) {
  const { toast } = useApp();
  const [views, setViews] = useState<SavedView[]>([]);
  useEffect(() => { api.views.list(page).then((r) => setViews(Array.isArray(r) ? r : [])).catch(() => setViews([])); }, [page]);

  const filtered = !sameFilters(value, defaults);
  const active = views.find((v) => sameFilters({ ...defaults, ...(v.filters || {}) }, value));

  const save = async () => {
    const name = (window.prompt('Name this view:', active?.name || '') || '').trim();
    if (!name) return;
    try {
      const v = await api.views.save(page, name, value);
      setViews((prev) => [...prev.filter((x) => x.id !== v.id && x.name.toLowerCase() !== name.toLowerCase()), v].sort((a, b) => a.name.localeCompare(b.name)));
      toast(`Saved view “${name}”`);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not save the view')); }
  };
  const remove = async (v: SavedView) => {
    if (!window.confirm(`Delete the view “${v.name}”?`)) return;
    try { await api.views.remove(v.id); setViews((prev) => prev.filter((x) => x.id !== v.id)); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not delete the view')); }
  };

  if (!views.length && !filtered) return null;
  const chip = (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
    border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), .12)'), background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--body)', fontFamily: 'inherit',
  });
  return (
    <div role="toolbar" aria-label="Saved views" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
      {views.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 2 }}>Views</span>}
      {views.map((v) => (
        <button key={v.id} type="button" onClick={() => onApply({ ...defaults, ...(v.filters || {}) } as F)} title="Apply this view" style={chip(active?.id === v.id)}>
          {v.name}
          <span role="button" aria-label={`Delete view ${v.name}`} title="Delete view" onClick={(e) => { e.stopPropagation(); void remove(v); }} style={{ opacity: 0.6 }}>×</span>
        </button>
      ))}
      {filtered && !active && <button type="button" onClick={save} style={{ ...chip(false), borderStyle: 'dashed', color: 'var(--forest)' }}>+ Save view</button>}
      {filtered && <button type="button" onClick={() => onApply(defaults)} style={{ ...chip(false), border: 0, background: 'transparent', color: '#8E2E0A' }}>Clear all filters</button>}
    </div>
  );
}
