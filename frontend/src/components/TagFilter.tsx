import { ACTION_TAGS } from '../data/actionTags';
import { useTagBank } from '../data/tagBank';

/** Has this standard tag (by key) or custom tag (any case). */
export function matchesTag(t: { tags?: string[] | null; labels?: string[] | null }, tag: string): boolean {
  const k = tag.trim().toLowerCase();
  if (!k) return true;
  return (t.tags || []).includes(k) || (t.labels || []).some((l) => l.toLowerCase() === k);
}

/**
 * Filter by any tag (Oct 30 sync): the standard ones, then every custom tag in
 * the shared bank. `counts` adds a count to the standard ones when known.
 */
export function TagFilter({ value, onChange, counts, size = 'small' }: { value: string; onChange: (v: string) => void; counts?: Record<string, number>; size?: 'small' | 'large' }) {
  const bank = useTagBank().filter((b) => !b.standard);
  return (
    <select aria-label="Tag" value={value} onChange={(e) => onChange(e.target.value)}
      style={{ padding: size === 'large' ? '9px 12px' : '6px 10px', borderRadius: 999, fontSize: size === 'large' ? 12.5 : 12, fontWeight: 700, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: value ? 'var(--ink)' : 'var(--surface)', color: value ? '#fff' : 'var(--body)', fontFamily: 'inherit', maxWidth: 200 }}>
      <option value="">Any tag</option>
      <optgroup label="Standard">
        {ACTION_TAGS.map(([k, l]) => <option key={k} value={k}>{l}{counts ? ` · ${counts[k] ?? 0}` : ''}</option>)}
      </optgroup>
      {bank.length > 0 && (
        <optgroup label="Custom">
          {bank.map((b) => <option key={b.key} value={b.key}>{b.name}{b.uses ? ` · ${b.uses}` : ''}</option>)}
        </optgroup>
      )}
    </select>
  );
}
