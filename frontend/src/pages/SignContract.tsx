import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ContractSigner } from '../components/ContractSigner';
import type { ContractSigningView } from '../data/contracts';

const BG = 'var(--font-display)';
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: 20, marginBottom: 16 };
const day = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * A signer's own page for a contract (Oct 27 backlog): read it and its
 * attachments, initial each marked section, sign. No account -- the link in
 * their email is theirs alone and lasts 30 days.
 */
export function SignContract() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [doc, setDoc] = useState<ContractSigningView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setError('This link is missing its signing code.'); setLoading(false); return; }
    api.contracts.public.get(token).then(setDoc).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [token]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'var(--panel)', padding: '24px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 18, color: 'var(--forest)', marginBottom: 18 }}>Origami Design + Build</div>
        {children}
      </div>
    </div>
  );
  if (loading) return shell(<div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>);
  if (!doc) return shell(<div role="alert" style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600 }}>{error || 'This contract could not be found.'}</div>);

  const attachments = doc.attachments.length > 0 && (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--panel)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Part of this contract</div>
      <div style={{ display: 'grid', gap: 4 }}>
        {doc.attachments.map((a) => <a key={a.fileId} href={api.contracts.public.fileUrl(token, a.fileId)} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 600 }}>{a.name}</a>)}
      </div>
    </div>
  );

  return shell(
    <div>
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{doc.number}</div>
        <h1 style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: 'var(--ink)', margin: '4px 0' }}>{doc.title}</h1>
        <div style={{ fontSize: 12.5, color: 'var(--body)' }}>
          {doc.amount ? <>Amount: <b>{doc.amount}</b> · </> : null}Signing as <b>{doc.you.label}</b>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {doc.parties.map((p, i) => <span key={i} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 999, background: p.signedAt ? 'var(--c-d2ead3)' : 'var(--c-efede8)', color: p.signedAt ? 'var(--success-deep)' : 'var(--body)' }}>{p.label}: {p.signedAt ? `signed ${new Date(p.signedAt).toLocaleDateString()}` : 'not yet'}</span>)}
        </div>
      </div>
      <div style={card}>
        {doc.status === 'void' ? (
          <div role="alert" style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600 }}>This contract was withdrawn. Your Origami contact will send a new one.</div>
        ) : doc.you.signedAt ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--success-deep)', fontWeight: 700 }}>You signed this on {day(doc.you.signedAt)}. Thank you.</div>
            <div style={{ fontSize: 12.5, color: 'var(--body)' }}>{doc.status === 'signed' ? 'Everyone has signed — download your copy below.' : 'Once everyone has signed, a signed copy will be available here.'}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href={api.contracts.public.pdfUrl(token)} target="_blank" rel="noreferrer" style={{ padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 13, fontWeight: 700, color: 'var(--forest)', textDecoration: 'none' }}>View PDF</a>
              <a href={api.contracts.public.pdfUrl(token, true)} style={{ padding: '9px 16px', borderRadius: 999, background: 'var(--forest)', fontSize: 13, fontWeight: 700, color: 'white', textDecoration: 'none' }}>Download a copy</a>
            </div>
            {attachments}
          </div>
        ) : (
          <ContractSigner html={doc.html} defaultName={doc.you.name} defaultInitials={doc.you.suggestedInitials} busy={busy} error={error} submitLabel="Sign the contract" extra={attachments || undefined}
            onSubmit={(d) => { setBusy(true); setError(''); api.contracts.public.sign(token, d).then(setDoc).catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); }} />
        )}
      </div>
    </div>,
  );
}
