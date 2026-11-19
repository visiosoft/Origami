import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';

interface View {
  companyName: string; projectName: string; number: string; title: string; dueDate?: string | null; notes?: string | null; closed: boolean;
  instructions?: string | null; siteVisit?: { date: string; time?: string | null; place?: string | null; note?: string | null } | null;
  scopes: { key: string; title: string; csi?: string | null; lines: { key: string; description: string }[]; notes: { kind: string; label: string; text: string }[] }[];
  invite: { vendorName?: string | null; status: string; total?: number | null; lineAmounts: Record<string, number>; notes?: string | null; submittedAt?: string | null; attending?: boolean | null; questions?: { id: string; text: string; at: string; answer?: string | null }[] };
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: 18, marginBottom: 16 };
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.16)', fontSize: 16, background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit' };
const num = (v: string) => { const n = Number(v.replace(/[$,\s]/g, '')); return v.trim() && Number.isFinite(n) ? n : null; };
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A sub's page for a bid request (K10, Nov 13), from the emailed link -- no
 * account needed. The scope, lines and inclusions / exclusions to price
 * (never the contractor's own amounts), and their price per line and/or in
 * total, or "decline". They can update it until a bid is chosen.
 */
export function SubBid() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [doc, setDoc] = useState<View | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [question, setQuestion] = useState('');
  const take = (v: View) => {
    setDoc(v);
    setLines(Object.fromEntries(Object.entries(v.invite.lineAmounts || {}).map(([k, n]) => [k, String(n)])));
    setTotal(v.invite.total != null ? String(v.invite.total) : '');
    setNotes(v.invite.notes || '');
  };
  useEffect(() => {
    if (!token) { setErr('This link is missing its code.'); setLoading(false); return; }
    api.finance.bidPublic.get(token).then(take).catch((e: Error) => setErr(e.message)).finally(() => setLoading(false));
  }, [token]);
  const sum = useMemo(() => Object.values(lines).reduce((a, v) => a + (num(v) || 0), 0), [lines]);
  const send = async (decline = false) => {
    if (!decline && !Object.values(lines).some((v) => num(v) != null) && num(total) == null) { setErr('Enter your price — per line, or a total.'); return; }
    if (decline && !window.confirm('Decline this bid request?')) return;
    setBusy(true); setErr('');
    try {
      const r = await api.finance.bidPublic.submit(token, decline ? { decline: true, notes } : { total: total.trim() || null, lineAmounts: lines, notes });
      setSaved(r.status === 'declined' ? 'You’ve declined. Thank you for letting us know.' : 'Your price is in. You can change it here until a bid is chosen.');
      take(await api.finance.bidPublic.get(token));
    } catch (e: any) { setErr(e?.message || 'Not sent.'); }
    finally { setBusy(false); }
  };

  const shell = (c: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'var(--panel)', padding: '24px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--forest)', marginBottom: 18 }}>{doc?.companyName || 'Origami Design + Build'}</div>
        {c}
      </div>
    </div>
  );
  if (loading) return shell(<Skeleton label="Loading…" />);
  if (!doc) return shell(<div role="alert" style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600 }}>{err || 'This bid request could not be found.'}</div>);
  const locked = doc.closed || doc.invite.status === 'awarded' || doc.invite.status === 'not_awarded';
  return shell(
    <div>
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{doc.projectName} · Bid request {doc.number}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--ink)', margin: '4px 0' }}>{doc.title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{doc.invite.vendorName ? `For ${doc.invite.vendorName}. ` : ''}{doc.dueDate ? `Prices due ${new Date(doc.dueDate + 'T12:00:00').toLocaleDateString()}.` : ''}</div>
        {doc.notes && <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.55, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{doc.notes}</div>}
      </div>
      {/* Nov 19 (Edward): bid instructions, the site visit, and questions -- answered to you only. */}
      {doc.instructions && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>Bid instructions</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{doc.instructions}</div>
        </div>
      )}
      {doc.siteVisit && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Site visit</div>
          <div style={{ fontSize: 13.5, color: 'var(--body)', margin: '4px 0 10px' }}>{new Date(doc.siteVisit.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}{doc.siteVisit.time ? ` at ${doc.siteVisit.time}` : ''}{doc.siteVisit.place ? ` — ${doc.siteVisit.place}` : ''}{doc.siteVisit.note ? `. ${doc.siteVisit.note}` : ''}</div>
          {!locked && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {[true, false].map((yes) => (
                <button key={String(yes)} type="button" aria-pressed={doc.invite.attending === yes} onClick={() => void api.finance.bidPublic.attend(token, yes).then(() => api.finance.bidPublic.get(token)).then(take).catch((e: Error) => setErr(e.message))}
                  style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .16)', background: doc.invite.attending === yes ? 'var(--forest)' : 'var(--surface)', color: doc.invite.attending === yes ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {yes ? 'I’ll attend' : 'Can’t make it'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Questions</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 8px' }}>Ask about the scope — the answer comes to you by email and shows here.</div>
        {(doc.invite.questions || []).map((q) => (
          <div key={q.id} style={{ fontSize: 13, padding: '6px 0', borderTop: '1px solid rgba(var(--rgb-shade), .06)' }}>
            <div><b>You asked:</b> {q.text}</div>
            <div style={{ color: q.answer ? 'var(--success-deep)' : 'var(--muted)' }}>{q.answer ? <><b>Answer:</b> {q.answer}</> : 'Waiting for an answer.'}</div>
          </div>
        ))}
        {!locked && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input aria-label="Your question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Your question" style={{ flex: 1, padding: '10px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 16, fontFamily: 'inherit' }} />
            <button type="button" disabled={!question.trim()} onClick={() => void api.finance.bidPublic.ask(token, question.trim()).then(() => { setQuestion(''); return api.finance.bidPublic.get(token); }).then(take).catch((e: Error) => setErr(e.message))}
              style={{ padding: '10px 18px', borderRadius: 999, border: 0, background: 'var(--ink)', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Ask</button>
          </div>
        )}
      </div>
      {locked && <div role="status" style={{ ...card, fontWeight: 600, color: doc.invite.status === 'awarded' ? 'var(--success-deep)' : 'var(--muted)' }}>{doc.invite.status === 'awarded' ? 'Your bid was chosen — we’ll be in touch.' : 'A bid has been chosen for this package. Thank you for pricing it.'}</div>}
      {doc.scopes.map((s) => (
        <div key={s.key} style={card}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{s.title}{s.csi && <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 12.5 }}> · {s.csi}</span>}</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {s.lines.map((l) => (
              <label key={l.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 10, alignItems: 'center', fontSize: 13.5, color: 'var(--body)' }}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{l.description}</span>
                <input inputMode="decimal" aria-label={`Your price for ${l.description}`} placeholder="$" disabled={locked} value={lines[l.key] || ''} onChange={(e) => setLines((x) => ({ ...x, [l.key]: e.target.value }))} style={{ ...field, textAlign: 'right' }} />
              </label>
            ))}
          </div>
          {s.notes.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--body)' }}>
              {[...new Set(s.notes.map((n) => n.label))].map((lbl) => (
                <div key={lbl} style={{ marginTop: 4 }}><b style={{ fontSize: 12 }}>{lbl}</b>
                  <ul style={{ margin: '2px 0 0 18px', padding: 0 }}>{s.notes.filter((n) => n.label === lbl).map((n, i) => <li key={i}>{n.text}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {!locked && (
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>Your price</div>
          {err && <div role="alert" style={{ padding: '9px 12px', borderRadius: 9, background: '#F7E4DB', color: '#8E2E0A', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{err}</div>}
          {saved && <div role="status" style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(var(--rgb-success), 0.12)', color: 'var(--success-deep)', fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>{saved}</div>}
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Lines entered: <b style={{ color: 'var(--ink)' }}>{usd(sum)}</b>. Or give one total for everything:</div>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, maxWidth: 260 }}>Total (optional)
            <input inputMode="decimal" placeholder="$" value={total} onChange={(e) => setTotal(e.target.value)} style={{ ...field, textAlign: 'right' }} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, marginTop: 10 }}>Notes, exclusions, how long the price holds
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={field} />
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" disabled={busy} onClick={() => void send()} style={{ padding: '12px 24px', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700, background: 'var(--forest)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Sending…' : doc.invite.submittedAt && doc.invite.status === 'submitted' ? 'Update my price' : 'Send my price'}</button>
            <button type="button" disabled={busy} onClick={() => void send(true)} style={{ padding: '12px 20px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.2)', fontSize: 14, fontWeight: 600, background: 'transparent', color: 'var(--body)', cursor: 'pointer', fontFamily: 'inherit' }}>Decline</button>
          </div>
        </div>
      )}
    </div>,
  );
}
