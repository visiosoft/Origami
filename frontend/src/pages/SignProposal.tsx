import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { SignaturePad } from '../components/SignaturePad';

const BG = "'Bricolage Grotesque', serif";

/**
 * The prospect's own page for reviewing and signing a proposal -- reached
 * from the link in the proposal email, no Origami account needed. Access is
 * entirely the signed, 10-day token in the URL; there is no login here.
 */
export function SignProposal() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [doc, setDoc] = useState<{ dealName: string; subject: string; html: string; amount: string; signedAt: string; signedByName: string; signatureImage?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState('');
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError('This link is missing its signing code.'); setLoading(false); return; }
    api.proposals.public.get(token)
      .then((res: any) => setDoc(res))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = () => {
    if (!name.trim()) { setError('Type your name to certify the signature.'); return; }
    if (!image) { setError('Draw your signature above.'); return; }
    if (!certified) { setError('Check the certification box first.'); return; }
    setError('');
    setSubmitting(true);
    api.proposals.public.sign(token, name.trim(), email.trim(), image)
      .then((res: any) => setDoc((d) => (d ? { ...d, signedAt: res?.signedAt || new Date().toISOString(), signedByName: res?.signedByName || name.trim(), signatureImage: image } : d)))
      .catch((e: Error) => setError(e.message))
      .finally(() => setSubmitting(false));
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#FBF8F2', padding: '24px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 18, color: '#173326', marginBottom: 18 }}>Origami Design + Build</div>
        {children}
      </div>
    </div>
  );

  // The real, rendered PDF -- a template's own {{clientSignature}}/{{signedDate}}
  // tokens are merged in server-side, so the drawn signature appears right
  // where the document put it once signed. Cache-busted on signedAt so the
  // just-submitted signature shows immediately instead of the cached blank copy.
  const pdfUrl = token ? `${api.proposals.public.pdfUrl(token)}&v=${encodeURIComponent(doc?.signedAt || '0')}` : '';

  if (loading) return shell(<div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>);
  if (!doc) return shell(<div style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600 }}>{error || 'This proposal could not be found.'}</div>);

  return shell(
    <div>
      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{doc.dealName}</div>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 21, color: '#0B1A12', marginTop: 4, marginBottom: 4 }}>{doc.subject}</div>
        <div style={{ fontSize: 12, color: '#7E9B93', marginBottom: 14 }}>Scroll through the document below — the signing section is at the end.</div>
        <iframe
          title={doc.subject}
          src={pdfUrl}
          style={{ width: '100%', height: '70vh', minHeight: 420, border: '1px solid rgba(20,8,31,0.08)', borderRadius: 10, display: 'block' }}
        />
      </div>

      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 22 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, color: '#0B1A12', marginBottom: 4 }}>Approval</div>
        {doc.signedAt ? (
          <div>
            <div style={{ fontSize: 13, color: '#1C5230', fontWeight: 600 }}>
              Signed by {doc.signedByName} on {new Date(doc.signedAt).toLocaleString()}. Your project team has been notified.
            </div>
            <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 4 }}>Your signature now appears on the document above.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: '#7E9B93', marginBottom: 14, lineHeight: 1.6 }}>
              Review the proposal above, then sign below to approve it and move your project forward.
            </div>
            {error && <div style={{ padding: '9px 12px', borderRadius: 9, background: '#F7E4DB', color: '#8E2E0A', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.14)', fontSize: 13.5, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Email (optional)</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.14)', fontSize: 13.5, marginTop: 4 }} />
              </div>
            </div>
            <SignaturePad onChange={setImage} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#43514D', marginTop: 12, cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} style={{ marginTop: 2 }} />
              I certify that this is my legal signature and that I intend to sign this document electronically.
            </label>
            <div
              onClick={submitting ? undefined : submit}
              style={{ marginTop: 14, display: 'inline-block', padding: '11px 22px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', background: submitting ? '#9AB0A4' : '#173326', color: 'white' }}
            >
              {submitting ? 'Submitting…' : 'Sign & approve'}
            </div>
          </>
        )}
      </div>
    </div>,
  );
}
