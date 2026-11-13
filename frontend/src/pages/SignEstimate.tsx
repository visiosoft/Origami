import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { SignaturePad } from '../components/SignaturePad';
import { Skeleton } from '../components/Skeleton';

interface View {
  number: string; rev: number; title?: string | null; status: string; projectName: string; companyName: string; html: string;
  canSign: boolean; replacedBy: number | null; acceptedAt?: string | null; signedName?: string | null; otherAccepted: number | null;
}

const label: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 16, marginTop: 4, background: 'var(--surface)', color: 'var(--ink)' };
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: 18, marginBottom: 16 };

/**
 * The client's own page for an estimate (K8, Nov 13), from the emailed
 * link -- no account needed; the signed 60-day link is the key. Read it,
 * download the PDF, and accept it with a typed name and drawn signature.
 */
export function SignEstimate() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [doc, setDoc] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => api.finance.estimatePublic.get(token).then(setDoc).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => {
    if (!token) { setError('This link is missing its code.'); setLoading(false); return; }
    void load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (name.trim().length < 2) { setError('Type your full name.'); return; }
    if (!image) { setError('Draw your signature in the box.'); return; }
    if (!agree) { setError('Tick the box to accept the estimate.'); return; }
    setError(''); setBusy(true);
    api.finance.estimatePublic.sign(token, { name: name.trim(), email: email.trim(), image, agree })
      .then(() => load())
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
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
  if (!doc) return shell(<div role="alert" style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600 }}>{error || 'This estimate could not be found.'}</div>);

  return shell(
    <div>
      <div style={card}>
        <div style={{ ...label, fontSize: 11 }}>{doc.projectName} · {doc.number} Rev {doc.rev}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--ink)', margin: '4px 0 10px' }}>{doc.title || 'Estimate'}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 12.5, color: 'var(--muted)' }}>
          <span>Read the estimate below; the acceptance is at the end.</span>
          <a href={api.finance.estimatePublic.pdfUrl(token)} target="_blank" rel="noreferrer" style={{ color: 'var(--forest)', fontWeight: 700 }}>Download the PDF</a>
        </div>
        <iframe title={`Estimate ${doc.number}`} srcDoc={doc.html} sandbox="" style={{ width: '100%', height: '70vh', minHeight: 420, border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 10, display: 'block', background: '#fff' }} />
      </div>

      <div style={{ ...card, padding: 22 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 6 }}>Accept the estimate</div>
        {doc.status === 'accepted' ? (
          <div role="status" style={{ fontSize: 13.5, color: 'var(--success-deep)', fontWeight: 600 }}>
            Accepted by {doc.signedName}{doc.acceptedAt ? ` on ${new Date(doc.acceptedAt).toLocaleDateString()}` : ''}. Thank you — your project team has been told.
          </div>
        ) : doc.replacedBy ? (
          <div role="status" style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600 }}>This estimate was replaced by Rev {doc.replacedBy}. Please use the link in the latest email.</div>
        ) : doc.otherAccepted ? (
          <div role="status" style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>Rev {doc.otherAccepted} of this estimate has already been accepted.</div>
        ) : !doc.canSign ? (
          <div role="status" style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>This estimate can’t be accepted online. Please contact your project team.</div>
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
              I accept this estimate, and this is my signature, signed electronically.
            </label>
            <button type="button" disabled={busy} onClick={submit} style={{ marginTop: 14, padding: '12px 24px', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer', background: busy ? 'var(--c-9ab0a4)' : 'var(--forest)', color: 'white', fontFamily: 'inherit' }}>
              {busy ? 'Sending…' : 'Accept and sign'}
            </button>
          </>
        )}
      </div>
    </div>,
  );
}
