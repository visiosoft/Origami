import { CONTACT_STATUS_LABEL, contactStatusOf, type ContactStatus, type DupMatch, type Person } from '../data/people';

const ON: Record<string, string> = { name: 'name', email: 'email', phone: 'phone' };
const STATUS_TONE: Record<string, { bg: string; c: string }> = {
  active: { bg: 'var(--c-d2ead3)', c: 'var(--success-deep)' }, review: { bg: '#FBEFC9', c: '#7A5A0B' }, expired: { bg: '#E6E3DE', c: '#6B6660' },
};
const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);
const btn = (primary: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 999, border: primary ? 0 : '1px solid rgba(var(--rgb-shade), 0.14)', background: primary ? 'var(--forest)' : 'var(--surface)',
  color: primary ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer',
});

/**
 * On the Add form: people already in the directory with the same name, email
 * or phone (Expired ones first). The contact isn't added until someone says
 * whether it's the same person (the records are linked) or not.
 */
export function DuplicateWarning({ matches, decision, sameAs, onSame, onNot, onUndo }: {
  matches: DupMatch[]; decision: 'same' | 'not' | null; sameAs: number | null;
  onSame: (id: number) => void; onNot: () => void; onUndo: () => void;
}) {
  const expired = matches.some((m) => m.contactStatus === 'expired');
  if (decision) {
    const m = matches.find((x) => x.id === sameAs);
    return (
      <div role="status" style={{ gridColumn: '1 / -1', padding: '10px 14px', borderRadius: 'var(--r-12)', background: 'var(--panel)', fontSize: 12.5, color: 'var(--body)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }}>{decision === 'same' && m ? <>Will be linked to <b>{m.name}</b> as the same person.</> : 'Not a duplicate — it will be added on its own.'}</span>
        <button type="button" onClick={onUndo} style={{ ...btn(false), padding: '4px 10px' }}>Change</button>
      </div>
    );
  }
  return (
    <div role="alert" style={{ gridColumn: '1 / -1', padding: '14px 16px', borderRadius: 'var(--r-12)', background: '#FFF6E5', border: '1px solid #F1D29A', display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#7A4A0B' }}>
        Possible duplicate{matches.length > 1 ? 's' : ''}{expired ? ' — including an expired contact' : ''}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--body)', lineHeight: 1.5 }}>Is this the same person? It's added once you choose.</div>
      {matches.map((m) => {
        const st = contactStatusOf({ contactStatus: m.contactStatus as ContactStatus });
        const tone = STATUS_TONE[st];
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, background: 'var(--surface)' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {m.name}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: tone.bg, color: tone.c }}>{CONTACT_STATUS_LABEL[st]}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, overflowWrap: 'anywhere' }}>
                {[m.company && m.company !== m.name ? m.company : null, m.email && m.email !== '—' ? m.email : null, m.phone && m.phone !== '—' ? m.phone : null].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--body)', marginTop: 2 }}>
                Same {m.matchedOn.map((k) => ON[k]).join(' and ')}{st === 'expired' && m.contactStatusReason ? ` · Expired: ${m.contactStatusReason}` : ''}{day(m.lastActivityAt) ? ` · last activity ${day(m.lastActivityAt)}` : ''}
              </div>
            </div>
            <button type="button" onClick={() => onSame(m.id)} style={btn(true)}>Same person — link</button>
          </div>
        );
      })}
      <button type="button" onClick={onNot} style={{ ...btn(false), justifySelf: 'start' }}>Not a duplicate</button>
    </div>
  );
}

/** Reference (read-only): the other records confirmed as this same person. */
export function SameAsReference({ ids, people, canManage, onOpen, onUnlink }: {
  ids: number[]; people: Person[]; canManage: boolean; onOpen: (id: number) => void; onUnlink: (id: number) => void;
}) {
  const rows = ids.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  if (!rows.length) return null;
  return (
    <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Reference — same person</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>Other records for this person, read-only here.</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((p) => {
          const st = contactStatusOf(p);
          return (
            <div key={p.id} style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--panel)', display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: STATUS_TONE[st].bg, color: STATUS_TONE[st].c }}>{CONTACT_STATUS_LABEL[st]}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => onOpen(p.id)} style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>Open</button>
                  {canManage && <button type="button" onClick={() => { if (confirm(`Unlink ${p.name}? Both records stay; they just stop pointing at each other.`)) onUnlink(p.id); }} style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, color: '#8E2E0A', cursor: 'pointer' }}>Unlink</button>}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--body)', overflowWrap: 'anywhere' }}>{[p.company && p.company !== p.name ? p.company : null, p.role, p.email !== '—' ? p.email : null, p.phone !== '—' ? p.phone : null].filter(Boolean).join(' · ')}</div>
              {st !== 'active' && p.contactStatusReason && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{CONTACT_STATUS_LABEL[st]}: {p.contactStatusReason}</div>}
              {p.since && <div style={{ fontSize: 11, color: 'var(--muted)' }}>With us since {p.since}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
