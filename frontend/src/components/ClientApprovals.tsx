import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

export type BundleItem = { kind: 'rfi' | 'record' | 'co'; id: string; label: string; summary: string; decision?: 'approved' | 'declined' | null; note?: string | null };
export type Bundle = { id: string; number: string; title: string; items: BundleItem[]; status: 'draft' | 'sent' | 'signed'; sentTo?: string | null; sentAt?: string | null; signedName?: string | null; signedAt?: string | null; signedFileId?: string | null; createdAt?: string | null };
export type Candidates = { rfis: BundleItem[]; records: BundleItem[]; changeOrders: BundleItem[]; clientEmail: string; clientName: string };

const KIND: Record<BundleItem['kind'], string> = { rfi: 'RFIs', record: 'For record (decisions, observations)', co: 'Change orders' };
const pill = (dark?: boolean) => ({ padding: '7px 14px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), .14)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

/**
 * Nov 17 sync (Edward): pick RFIs, decisions / observations and change orders
 * on a project and send them to the client together. They approve or decline
 * each one and sign once; the signed PDF lands in the project's files
 * (Approvals).
 */
export function ClientApprovals({ projectId }: { projectId: number }) {
  const { toast } = useApp();
  const [list, setList] = useState<Bundle[] | null>(null);
  const [cand, setCand] = useState<Candidates | null>(null);
  const [making, setMaking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.clientApprovals.list(projectId).then(setList).catch(() => setList([]));
  useEffect(() => { void load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = () => {
    setMaking(true); setPicked(new Set()); setTitle(''); setMessage('');
    api.clientApprovals.candidates(projectId).then((c) => { setCand(c); setTo(c.clientEmail || ''); }).catch((e: Error) => toast('⚠ ' + e.message));
  };
  const groups = useMemo(() => (cand ? ([['rfi', cand.rfis], ['record', cand.records], ['co', cand.changeOrders]] as [BundleItem['kind'], BundleItem[]][]) : []), [cand]);
  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const send = async () => {
    if (!picked.size) { toast('⚠ Pick at least one item'); return; }
    setBusy(true);
    try {
      const b = await api.clientApprovals.create({ projectId, title: title.trim() || undefined, items: [...picked].map((k) => { const [kind, ...id] = k.split(':'); return { kind, id: id.join(':') }; }) });
      const r = await api.clientApprovals.send(b.id, { to: to.trim() || undefined, message: message.trim() || undefined });
      toast(`Sent ${b.number} to ${r.to}`); setMaking(false); void load();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not sent')); }
    finally { setBusy(false); }
  };
  const statusOf = (b: Bundle) => (b.status === 'signed'
    ? `Signed by ${b.signedName} ${day(b.signedAt)} · ${b.items.filter((i) => i.decision === 'approved').length} approved, ${b.items.filter((i) => i.decision === 'declined').length} declined`
    : b.status === 'sent' ? `Sent to ${b.sentTo} ${day(b.sentAt)} · waiting for the client` : 'Not sent');

  return (
    <section className="client-approvals" aria-label="Client approvals" style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), .07)', borderRadius: 'var(--r-14, 14px)', padding: 16, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b style={{ fontSize: 14, color: 'var(--ink)' }}>Client approvals</b>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Send RFIs, decisions and change orders to the client together — they approve or decline each and sign once.</div>
        </div>
        {!making && <button type="button" style={pill(true)} onClick={start}>+ Send for client approval</button>}
      </div>

      {making && (
        <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'var(--panel)' }}>
          {!cand ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</div> : (
            <>
              {groups.every(([, items]) => !items.length) && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Nothing to send yet: no open or answered RFIs, FOR RECORD entries, or change orders with the client on this project.</div>}
              {groups.filter(([, items]) => items.length).map(([kind, items]) => (
                <div key={kind}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 4 }}>{KIND[kind]}</div>
                  {items.map((it) => {
                    const k = `${it.kind}:${it.id}`;
                    return (
                      <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 4px', fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} style={{ marginTop: 3 }} />
                        <span><b style={{ color: 'var(--ink)' }}>{it.label}</b>{it.summary && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{it.summary.slice(0, 160)}</span>}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                <input aria-label="Title" placeholder="Title (e.g. Week 46 decisions)" value={title} onChange={(e) => setTitle(e.target.value)} className="ak-search" />
                <input aria-label="Client email" placeholder="Client email" value={to} onChange={(e) => setTo(e.target.value)} className="ak-search" />
              </div>
              <textarea aria-label="Message" placeholder="A note for the client (optional)" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), .14)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" style={pill()} onClick={() => setMaking(false)}>Cancel</button>
                <button type="button" style={{ ...pill(true), opacity: busy || !picked.size ? 0.6 : 1 }} disabled={busy || !picked.size} onClick={send}>{busy ? 'Sending…' : `Send ${picked.size || ''} for approval`}</button>
              </div>
            </>
          )}
        </div>
      )}

      {list && list.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {list.map((b) => (
            <li key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), .06)', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 13, color: 'var(--ink)' }}>{b.number}</b>
              <span style={{ fontSize: 13, flex: 1, minWidth: 160 }}>{b.title} <span style={{ color: 'var(--muted)' }}>· {b.items.length} item{b.items.length === 1 ? '' : 's'}</span></span>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: b.status === 'signed' ? 'var(--c-d2ead3)' : '#FBEBDD', color: b.status === 'signed' ? 'var(--success-deep)' : '#8A4B12' }}>{statusOf(b)}</span>
              {b.signedFileId && <a href={`/planroom?file=${encodeURIComponent(b.signedFileId)}`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>Signed PDF</a>}
              {b.status === 'sent' && <button type="button" style={pill()} onClick={() => api.clientApprovals.send(b.id, { to: b.sentTo || undefined }).then(() => { toast('Sent again'); void load(); }).catch((e: Error) => toast('⚠ ' + e.message))}>Send again</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
