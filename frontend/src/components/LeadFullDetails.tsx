import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

type Row = [label: string, value: string, field?: string];
type Version = { id: number; at: string; by?: string; changes: Record<string, { from: unknown; to: unknown }> };

/** A stored value as one readable line. */
const show = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.map(show).join(', ') || '—';
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).filter((x) => x !== '' && x != null && typeof x !== 'object').join(', ') || '—';
  return String(v);
};
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const filled = (v: unknown) => !(v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length));

/**
 * Full Details (Oct 26 review notes): everything collected on the lead, latest
 * values only, a tab per section. A value that was changed after it was first
 * filled in is shown in orange (hover for what it was), and each section ends
 * with its earlier versions -- who changed what, when.
 */
export function LeadFullDetails({ leadId, stamp, sections }: { leadId: string; stamp?: string; sections: { key: string; title: string; rows: Row[] }[] }) {
  const [tab, setTab] = useState(sections[0]?.key || '');
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    let live = true;
    api.leads.history(leadId).then((v) => { if (live) setVersions(Array.isArray(v) ? v : []); }).catch(() => { if (live) setVersions([]); });
    return () => { live = false; };
  }, [leadId, stamp]);
  const current = sections.find((s) => s.key === tab) || sections[0];
  useEffect(() => { setShowAll(false); }, [tab]);

  // The latest real change (not the first time it was filled in) for each field.
  const lastChange = useMemo(() => {
    const m = new Map<string, { at: string; by?: string; from: unknown }>();
    for (const v of versions || []) for (const [k, c] of Object.entries(v.changes || {})) if (!m.has(k) && filled(c.from)) m.set(k, { at: v.at, by: v.by, from: c.from });
    return m;
  }, [versions]);
  if (!current) return null;
  const fields = new Set(current.rows.map((r) => r[2]).filter(Boolean) as string[]);
  const labelOf = (k: string) => current.rows.find((r) => r[2] === k)?.[0] || k;
  const history = (versions || []).map((v) => ({ ...v, changes: Object.entries(v.changes || {}).filter(([k]) => fields.has(k)) })).filter((v) => v.changes.length);
  const shown = showAll ? history : history.slice(0, 5);

  return (
    <div>
      <div role="tablist" aria-label="Sections" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {sections.map((s) => {
          const changed = s.rows.some((r) => r[2] && lastChange.has(r[2]));
          const on = s.key === current.key;
          return (
            <button key={s.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(s.key)}
              style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)'), background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {s.title.replace(/^\d+\.\s*/, '')}
              {changed && <span title="Something here was changed" style={{ width: 7, height: 7, borderRadius: 999, background: '#E08A2E' }} />}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {current.rows.map(([label, value, field], i) => {
          const ch = field ? lastChange.get(field) : undefined;
          return (
            <div key={label + i} title={ch ? `Changed ${when(ch.at)}${ch.by ? ` by ${ch.by}` : ''} — was: ${show(ch.from)}` : undefined}
              style={{ display: 'flex', gap: 10, padding: '8px 10px', background: ch ? '#FBE3C6' : 'var(--panel)', border: ch ? '1px solid #E8A55C' : '1px solid transparent', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: ch ? '#8A4B0F' : 'var(--muted)', fontWeight: 600, flex: '0 0 44%' }}>{label}</span>
              <span style={{ fontSize: 12, color: ch ? '#5A300A' : 'var(--ink)', flex: 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{value}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Earlier versions of this section</div>
        {versions === null ? <div style={{ fontSize: 12, color: 'var(--c-9aa39d)' }}>Loading…</div>
          : !history.length ? <div style={{ fontSize: 12, color: 'var(--c-9aa39d)', fontStyle: 'italic' }}>No changes since it was filled in.</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {shown.map((v) => (
                  <div key={v.id} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.08)' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>{when(v.at)}{v.by ? ` · ${v.by}` : ''}</div>
                    {v.changes.map(([k, c]) => (
                      <div key={k} style={{ fontSize: 12, color: 'var(--body)', lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 600 }}>{labelOf(k)}</strong>: <span style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{show(c.from)}</span> → {show(c.to)}
                      </div>
                    ))}
                  </div>
                ))}
                {history.length > 5 && <button type="button" onClick={() => setShowAll((x) => !x)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>{showAll ? 'Show fewer' : `Show all ${history.length}`}</button>}
              </div>
            )}
      </div>
    </div>
  );
}
