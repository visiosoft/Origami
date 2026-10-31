import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from '../data/users';

export interface PickedPerson { id: string; name: string }

/**
 * Pick one person for a job (who picks a held lead back up, who monitors a
 * referral). Internal, active people only. Resolves with them, or null for "Later".
 */
export function askPerson(opts: { heading: string; why: string; users: User[]; current?: string; button?: string }): Promise<PickedPerson | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: PickedPerson | null) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<AskPersonDialog {...opts} onDone={done} />);
  });
}

function AskPersonDialog({ heading, why, users, current, button = 'Assign', onDone }: { heading: string; why: string; users: User[]; current?: string; button?: string; onDone: (v: PickedPerson | null) => void }) {
  const people = users.filter((u) => u.status !== 'suspended' && u.tier === 'internal').sort((a, b) => a.name.localeCompare(b.name));
  const start = people.find((u) => u.id === current || u.name === current);
  const [id, setId] = useState(start?.id || '');
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onDone]);
  const picked = people.find((u) => u.id === id);
  return (
    <div onClick={() => onDone(null)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(var(--rgb-shade), 0.45)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-label={heading} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px, 100%)', boxSizing: 'border-box', background: 'var(--surface)', borderRadius: 'var(--r-12)', padding: 20, boxShadow: '0 18px 50px rgba(var(--rgb-ink), 0.25)', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{heading}</div>
        <div style={{ fontSize: 12.5, color: 'var(--body)', lineHeight: 1.5 }}>{why}</div>
        <select aria-label="Person" value={id} onChange={(e) => setId(e.target.value)} autoFocus
          style={{ height: 36, borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--panel)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', padding: '0 8px' }}>
          <option value="">Pick a person…</option>
          {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => onDone(null)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--body)', cursor: 'pointer' }}>Later</button>
          <button type="button" disabled={!picked} onClick={() => picked && onDone({ id: picked.id, name: picked.name })} style={{ padding: '8px 16px', borderRadius: 999, border: 0, background: picked ? 'var(--forest)' : 'var(--c-c9d4cc)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#fff', cursor: picked ? 'pointer' : 'default' }}>{button}</button>
        </div>
      </div>
    </div>
  );
}
