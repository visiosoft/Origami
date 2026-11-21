import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const btn = { padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .18)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' } as const;

/**
 * Nov 20 drawing sets (admins): who besides i-1 / i-2 may upload base
 * drawings, and numbering the drawings already in sets (Rev 1.0, 2.0 … by
 * date) -- a preview first, then Apply.
 */
export function DrawingSetsAdmin({ onApplied }: { onApplied: () => void }) {
  const { users, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[] | null>(null);
  const [plan, setPlan] = useState<{ count: number; rows?: { id: string; name: string; rev: string }[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [starter, setStarter] = useState<Awaited<ReturnType<typeof api.fileRoom.starterSymbols>> | null>(null);
  useEffect(() => { if (open && ids === null) api.fileRoom.baseUploaders().then(setIds).catch(() => setIds([])); }, [open, ids]);
  const staff = users.filter((u) => u.status !== 'suspended' && (u.tier || 'internal') === 'internal' && !['admin', 'principal'].includes(String(u.roleKey || '')));
  const toggle = (id: string) => {
    const next = (ids || []).includes(id) ? (ids || []).filter((x) => x !== id) : [...(ids || []), id];
    setBusy('who');
    api.fileRoom.setBaseUploaders(next).then((r) => { setIds(r); toast('Saved'); }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusy(''));
  };
  const preview = () => { setBusy('plan'); api.fileRoom.numberDrawings(false).then(setPlan).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusy('')); };
  const previewSymbols = () => { setBusy('sym'); api.fileRoom.starterSymbols().then(setStarter).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusy('')); };
  const addSymbols = () => {
    setBusy('symadd');
    api.fileRoom.addStarterSymbols().then((r) => { toast(`Added ${r.added} symbol${r.added === 1 ? '' : 's'} — pick them with ◆ in any drawing`); setStarter(null); }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusy(''));
  };
  const apply = () => {
    setBusy('apply');
    api.fileRoom.numberDrawings(true).then((r) => { toast(`Numbered ${r.count} drawing${r.count === 1 ? '' : 's'}`); setPlan(null); onApplied(); }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusy(''));
  };
  return (
    <div style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), .12)', background: 'var(--surface)', fontSize: 12.5, color: 'var(--ink)', marginBottom: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>Drawing sets</b>
        <span style={{ color: 'var(--muted)' }}>Only admins, principals and the people you pick upload base drawings (the build set and “Base sets”); markups start on internal review layers.</span>
        <span style={{ flex: 1 }} />
        <button type="button" style={btn} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Set up'}</button>
      </div>
      {open && (
        <>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Who else uploads base drawings</div>
            {ids === null ? <span style={{ color: 'var(--muted)' }}>Loading…</span> : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {staff.map((u) => (
                  <label key={u.id} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                    <input type="checkbox" checked={ids.includes(u.id)} disabled={busy === 'who'} onChange={() => toggle(u.id)} /> {u.name}
                  </label>
                ))}
                {!staff.length && <span style={{ color: 'var(--muted)' }}>No other staff.</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Number the drawings already in sets</div>
            {!plan && <div><button type="button" style={btn} disabled={busy === 'plan'} onClick={preview}>{busy === 'plan' ? 'Looking…' : 'Preview'}</button></div>}
            {plan && (
              <>
                <span>{plan.count ? `${plan.count} drawing${plan.count === 1 ? '' : 's'} would get a revision number (oldest of each document Rev 1.0):` : 'Every drawing in the sets already has a number.'}</span>
                {!!plan.rows?.length && (
                  <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
                    {plan.rows.map((r) => <li key={r.id}>{r.name} → {r.rev}</li>)}
                  </ul>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={btn} onClick={() => setPlan(null)}>Not now</button>
                  {plan.count > 0 && <button type="button" disabled={busy === 'apply'} onClick={apply} style={{ ...btn, border: 0, background: 'var(--forest)', color: '#fff' }}>{busy === 'apply' ? 'Applying…' : `Apply: number ${plan.count}`}</button>}
                </div>
              </>
            )}
          </div>
          {/* Nov 20 (Edward shared links on standard drawing symbols): a starter set for the ◆ symbol tool. */}
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Starter drawing symbols</div>
            {!starter && <div><button type="button" style={btn} disabled={busy === 'sym'} onClick={previewSymbols}>{busy === 'sym' ? 'Looking…' : 'Preview'}</button></div>}
            {starter && (
              <>
                <span>{starter.toAdd.length ? `${starter.toAdd.length} common symbols (electrical, plumbing, HVAC, architectural) would be added to the shared library${starter.already ? ` — ${starter.already} you already have` : ''}:` : 'The library already has all the starter symbols.'}</span>
                {starter.toAdd.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {starter.toAdd.map((s) => (
                      <figure key={s.name} title={`${s.group} · ${s.name}`} style={{ margin: 0, width: 74, textAlign: 'center', fontSize: 10.5, color: 'var(--muted)' }}>
                        <img src={s.image} alt={s.name} width={40} height={40} style={{ display: 'block', margin: '0 auto', background: '#fff', borderRadius: 6 }} />
                        <figcaption>{s.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={btn} onClick={() => setStarter(null)}>Not now</button>
                  {starter.toAdd.length > 0 && <button type="button" disabled={busy === 'symadd'} onClick={addSymbols} style={{ ...btn, border: 0, background: 'var(--forest)', color: '#fff' }}>{busy === 'symadd' ? 'Adding…' : `Apply: add ${starter.toAdd.length}`}</button>}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
