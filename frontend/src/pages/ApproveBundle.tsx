import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { SignaturePad } from '../components/SignaturePad';
import { Skeleton } from '../components/Skeleton';
import type { BundleItem } from '../components/ClientApprovals';

interface View { number: string; title: string; projectName: string; companyName: string; status: string; items: BundleItem[]; message?: string | null; signedName?: string | null; signedAt?: string | null }
const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 16, marginTop: 4, background: 'var(--surface)', color: 'var(--ink)' };
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: 18, marginBottom: 16 };
const KIND: Record<BundleItem['kind'], string> = { rfi: 'RFI', record: 'For record', co: 'Change order' };

/**
 * The client's page for an approval bundle (Nov 17), from the emailed link --
 * no account needed. Approve or decline each item (a decline needs a reason)
 * and sign once.
 */
export function ApproveBundle() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [doc, setDoc] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, { decision?: 'approved' | 'declined'; note?: string }>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => api.clientApprovals.publicView(token).then(setDoc).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => {
    if (!token) { setError('This link is missing its code.'); setLoading(false); return; }
    void load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string, p: { decision?: 'approved' | 'declined'; note?: string }) => setAnswers((a) => ({ ...a, [k]: { ...a[k], ...p } }));

  const submit = () => {
    if (!doc) return;
    const missing = doc.items.find((it) => !answers[`${it.kind}:${it.id}`]?.decision);
    if (missing) { setError(`Approve or decline “${missing.label}”.`); return; }
    const noReason = doc.items.find((it) => answers[`${it.kind}:${it.id}`]?.decision === 'declined' && !(answers[`${it.kind}:${it.id}`]?.note || '').trim());
    if (noReason) { setError(`Say why you’re declining “${noReason.label}”.`); return; }
    if (name.trim().length < 2) { setError('Type your full name.'); return; }
    if (!image) { setError('Draw your signature in the box.'); return; }
    if (!agree) { setError('Tick the box to sign.'); return; }
    setError(''); setBusy(true);
    api.clientApprovals.publicSign(token, { decisions: answers, name: name.trim(), email: email.trim(), image, agree })
      .then(() => load()).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'var(--panel)', padding: '24px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--forest)', marginBottom: 18 }}>{doc?.companyName || 'Origami Design + Build'}</div>
        {children}
      </div>
    </div>
  );
  if (loading) return shell(<Skeleton label="Loading…" />);
  if (!doc) return shell(<div role="alert" style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600 }}>{error || 'This approval could not be found.'}</div>);
  const signed = doc.status === 'signed';

  return shell(
    <div>
      <div style={card}>
        <div style={{ ...label, fontSize: 11 }}>{doc.projectName} · {doc.number}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--ink)', margin: '4px 0 8px' }}>{doc.title}</div>
        {doc.message && <p style={{ fontSize: 13.5, color: 'var(--body)', whiteSpace: 'pre-wrap', margin: '0 0 8px' }}>{doc.message}</p>}
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{signed ? 'Your answers:' : 'Approve or decline each item, then sign once at the end.'}</div>
      </div>

      {doc.items.map((it) => {
        const k = `${it.kind}:${it.id}`;
        const a = signed ? { decision: it.decision || undefined, note: it.note || '' } : answers[k] || {};
        return (
          <div key={k} className="bundle-item" style={card}>
            <div style={label}>{KIND[it.kind]}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: '3px 0 6px' }}>{it.label}</div>
            {it.summary && <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{it.summary}</div>}
            <div role="radiogroup" aria-label={`Decision for ${it.label}`} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {(['approved', 'declined'] as const).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={a.decision === d} disabled={signed} onClick={() => set(k, { decision: d })}
                  style={{ padding: '9px 18px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: signed ? 'default' : 'pointer',
                    border: '1px solid ' + (a.decision === d ? (d === 'approved' ? 'var(--forest)' : '#8E2E0A') : 'rgba(var(--rgb-shade), .16)'),
                    background: a.decision === d ? (d === 'approved' ? 'var(--forest)' : '#8E2E0A') : 'var(--surface)', color: a.decision === d ? '#fff' : 'var(--body)' }}>
                  {d === 'approved' ? '✓ Approve' : '✕ Decline'}
                </button>
              ))}
            </div>
            {(a.decision === 'declined' || (signed && a.note)) && (
              <textarea aria-label={`Reason for ${it.label}`} disabled={signed} value={a.note || ''} onChange={(e) => set(k, { note: e.target.value })} rows={2} placeholder="Why are you declining? (required)" style={{ ...input, resize: 'vertical' }} />
            )}
          </div>
        );
      })}

      <div style={{ ...card, padding: 22 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>Sign</div>
        {signed ? (
          <div role="status" style={{ fontSize: 13.5, color: 'var(--success-deep)', fontWeight: 600 }}>Signed by {doc.signedName}{doc.signedAt ? ` on ${new Date(doc.signedAt).toLocaleDateString()}` : ''}. Thank you — your project team has your answers.</div>
        ) : doc.status !== 'sent' ? (
          <div role="status" style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>This can’t be signed online. Please contact your project team.</div>
        ) : (
          <>
            {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 9, background: '#F7E4DB', color: '#8E2E0A', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
              <label><span style={label}>Your full name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={input} /></label>
              <label><span style={label}>Email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={input} /></label>
            </div>
            <div style={label}>Signature</div>
            <SignaturePad onChange={setImage} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--body)', marginTop: 12, cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              These are my decisions, and this is my signature, signed electronically.
            </label>
            <button type="button" disabled={busy} onClick={submit} style={{ marginTop: 14, padding: '12px 24px', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', background: busy ? 'var(--c-9ab0a4)' : 'var(--forest)', color: 'white', fontFamily: 'inherit' }}>
              {busy ? 'Sending…' : 'Sign and send'}
            </button>
          </>
        )}
      </div>
    </div>,
  );
}
