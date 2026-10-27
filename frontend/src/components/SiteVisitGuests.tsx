import { useState, type CSSProperties } from 'react';
import { isEmail, type Guest } from '../data/siteVisitInvite';

const field: CSSProperties = {
  boxSizing: 'border-box', padding: '6px 9px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)',
  background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)', outline: 'none',
};
const pill = (on: boolean): CSSProperties => ({
  padding: '3px 9px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  background: on ? 'var(--forest)' : 'transparent', color: on ? 'white' : 'var(--muted)',
});

/**
 * The people on an invite: each Required or Optional, removable, and more
 * can be added by email. Used on the site visit invite and for its defaults
 * in Settings -> Calendars.
 */
export function SiteVisitGuests({ guests, onChange, lockedEmail }: {
  guests: Guest[];
  onChange: (next: Guest[]) => void;
  /** The client: always invited and required. */
  lockedEmail?: string;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const set = (i: number, patch: Partial<Guest>) => onChange(guests.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const taken = guests.some((g) => g.email.toLowerCase() === email.trim().toLowerCase());
  const add = () => {
    if (!isEmail(email) || taken) return;
    onChange([...guests, { name: name.trim() || email.trim().split('@')[0], email: email.trim(), optional: false }]);
    setEmail(''); setName('');
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {guests.map((g, i) => {
        const locked = !!lockedEmail && g.email.toLowerCase() === lockedEmail.toLowerCase();
        return (
          <div key={g.email} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{g.name}{locked && <span style={{ fontWeight: 600, color: 'var(--muted)' }}> · client</span>}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.email}</div>
            </div>
            {locked ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--forest)' }}>Required</span> : (
              <div role="group" aria-label={`${g.name}: required or optional`} style={{ display: 'flex', borderRadius: 999, background: 'var(--panel)', padding: 2 }}>
                <button type="button" aria-pressed={!g.optional} onClick={() => set(i, { optional: false })} style={pill(!g.optional)}>Required</button>
                <button type="button" aria-pressed={g.optional} onClick={() => set(i, { optional: true })} style={pill(g.optional)}>Optional</button>
              </div>
            )}
            {!locked && <button type="button" onClick={() => onChange(guests.filter((_, j) => j !== i))} aria-label={`Remove ${g.name}`} title="Remove"
              style={{ border: 0, background: 'none', color: '#8E2E0A', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>×</button>}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Guest name" style={{ ...field, width: 110 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@…" aria-label="Guest email" style={{ ...field, flex: 1, minWidth: 150 }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={!isEmail(email) || taken}
          style={{ ...pill(isEmail(email) && !taken), border: '1px solid rgba(var(--rgb-shade), 0.14)', cursor: isEmail(email) && !taken ? 'pointer' : 'default' }}>+ Add guest</button>
      </div>
      {taken && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Already on the invite.</div>}
    </div>
  );
}
