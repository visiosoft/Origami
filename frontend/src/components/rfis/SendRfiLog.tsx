import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useApp } from '../../AppContext';

type Who = { name: string; email: string; kind: string };
const pill = (dark?: boolean) => ({ padding: '8px 16px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), .14)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });

/**
 * Nov 19 (Edward: "Is there a way to send out the RFI Log to all?"): the
 * project's RFI Log as a PDF, emailed to the team and the people on the
 * project (everyone ticked, Bcc). The weekly RFI Log notification sends it
 * by itself on Mondays.
 */
export function SendRfiLog({ projectId, projectName, onClose }: { projectId: number; projectName?: string; onClose: () => void }) {
  const { toast } = useApp();
  const [who, setWho] = useState<Who[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.rfis.logRecipients(projectId).then((r) => { setWho(r); setPicked(new Set(r.map((x) => x.email.toLowerCase()))); }).catch((e: Error) => { setWho([]); toast('⚠ ' + e.message); });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (e: string) => setPicked((s) => { const n = new Set(s); if (n.has(e)) n.delete(e); else n.add(e); return n; });
  const send = async () => {
    const to = [...picked, ...extra.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => x.includes('@'))];
    if (!to.length) { toast('⚠ Pick at least one person'); return; }
    setBusy(true);
    try { const r = await api.rfis.sendLog(projectId, to, note.trim() || undefined); toast(`RFI Log sent to ${r.sent} — ${r.open} open${r.overdue ? `, ${r.overdue} overdue` : ''}`); onClose(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not sent')); }
    finally { setBusy(false); }
  };
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), .45)', zIndex: 140, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Send the RFI Log" onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 16, padding: 20, display: 'grid', gap: 12 }}>
        <div>
          <b style={{ fontSize: 16, color: 'var(--ink)' }}>Send the RFI Log{projectName ? ` — ${projectName}` : ''}</b>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>A PDF of every RFI on this project, open ones first. Everyone ticked gets it in one email (Bcc). It also goes out every Monday to people who chose the weekly RFI Log.</div>
        </div>
        {who === null ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</div> : (
          <div style={{ display: 'grid', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
            {!who.length && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No one on this project has an email yet — type addresses below.</div>}
            {who.map((w) => (
              <label key={w.email} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '4px 2px', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(w.email.toLowerCase())} onChange={() => toggle(w.email.toLowerCase())} />
                <span style={{ flex: 1 }}><b style={{ color: 'var(--ink)' }}>{w.name}</b> <span style={{ color: 'var(--muted)' }}>· {w.email}</span></span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{w.kind}</span>
              </label>
            ))}
          </div>
        )}
        <input aria-label="Other addresses" placeholder="Other addresses, separated by commas" value={extra} onChange={(e) => setExtra(e.target.value)} className="ak-search" />
        <textarea aria-label="Note" placeholder="A note at the top of the email (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), .14)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={pill()} onClick={onClose}>Cancel</button>
          <button type="button" style={{ ...pill(true), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={send}>{busy ? 'Sending…' : `Send to ${picked.size + extra.split(/[\s,;]+/).filter((x) => x.includes('@')).length}`}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
