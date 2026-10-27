import { Fragment, useState } from 'react';
import { SignaturePad } from './SignaturePad';
import { sanitizeHtml, splitAtInitials } from '../data/contracts';

export interface SignInput { name: string; initials: string; image: string; initialled: number; reviewed: boolean }

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 13.5, marginTop: 4, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' };
const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' };

/**
 * A contract to initial and sign (Oct 27 backlog): the document with an
 * "Initial here" box at every marked section, then a drawn signature. Used by
 * the signer's own page and by Origami's counter-signature in the app.
 */
export function ContractSigner({ html, defaultName, defaultInitials, busy, error, submitLabel = 'Sign', onSubmit, extra }: {
  html: string; defaultName: string; defaultInitials: string; busy?: boolean; error?: string; submitLabel?: string;
  onSubmit: (d: SignInput) => void;
  /** Shown above the signature: attachments to review, etc. */
  extra?: React.ReactNode;
}) {
  const parts = splitAtInitials(html);
  const need = parts.length - 1;
  const [name, setName] = useState(defaultName);
  const [initials, setInitials] = useState(defaultInitials);
  const [done, setDone] = useState<boolean[]>(() => Array(need).fill(false));
  const [image, setImage] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [certified, setCertified] = useState(false);
  const count = done.filter(Boolean).length;
  const missing = !name.trim() ? 'Type your full name' : !initials.trim() ? 'Type your initials' : count < need ? `Initial ${need - count} more section${need - count === 1 ? '' : 's'}` : !image ? 'Draw your signature' : !reviewed ? 'Confirm you have read it all' : !certified ? 'Check the certification box' : '';
  const nextOpen = done.findIndex((d) => !d);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <label><span style={lbl}>Your full name</span><input value={name} onChange={(e) => setName(e.target.value)} style={input} autoComplete="name" /></label>
        <label><span style={lbl}>Your initials</span><input value={initials} maxLength={6} onChange={(e) => setInitials(e.target.value.toUpperCase())} style={input} /></label>
      </div>
      {need > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--body)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span><b>{count}</b> of {need} sections initialled.</span>
          {nextOpen >= 0 && <button type="button" onClick={() => document.getElementById(`ci-${nextOpen}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>Go to the next one ↓</button>}
        </div>
      )}
      <div className="contract-doc" style={{ background: '#fff', color: '#1d1d1b', border: '1px solid rgba(var(--rgb-shade), 0.1)', borderRadius: 10, padding: '18px 22px', fontSize: 14, lineHeight: 1.6, overflowWrap: 'anywhere', maxHeight: '70vh', overflowY: 'auto' }}>
        {parts.map((part, i) => (
          <Fragment key={i}>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(part) }} />
            {i < need && (
              <button type="button" id={`ci-${i}`} aria-pressed={done[i]} onClick={() => { if (!initials.trim()) return; setDone((d) => d.map((x, j) => (j === i ? !x : x))); }}
                title={initials.trim() ? (done[i] ? 'Remove your initials' : 'Initial this section') : 'Type your initials first'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '2px 0 10px', padding: '6px 12px', borderRadius: 8, border: done[i] ? '1px solid #2F7D4A' : '1.5px dashed #B45309', background: done[i] ? '#E7F3EA' : '#FFF6E5', color: done[i] ? '#1E6B36' : '#7A4A0B', font: '600 12.5px Helvetica, Arial, sans-serif', cursor: 'pointer' }}>
                {done[i] ? <>Initialled <b style={{ fontSize: 14, letterSpacing: '0.04em' }}>{initials}</b></> : 'Initial here'}
              </button>
            )}
          </Fragment>
        ))}
      </div>
      {extra}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Your signature</div>
        <SignaturePad onChange={setImage} />
      </div>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--body)', cursor: 'pointer', lineHeight: 1.5 }}>
        <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} style={{ marginTop: 3 }} />
        I have read the whole contract and the documents attached to it.
      </label>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--body)', cursor: 'pointer', lineHeight: 1.5 }}>
        <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} style={{ marginTop: 3 }} />
        I certify that these are my initials and signature, and that I intend to sign this contract electronically.
      </label>
      {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 9, background: '#F7E4DB', color: '#8E2E0A', fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" disabled={!!missing || busy} onClick={() => onSubmit({ name: name.trim(), initials: initials.trim(), image, initialled: count, reviewed })}
          style={{ padding: '11px 22px', borderRadius: 999, border: 0, fontSize: 13.5, fontWeight: 700, cursor: missing || busy ? 'default' : 'pointer', background: missing || busy ? 'var(--c-9ab0a4)' : 'var(--forest)', color: 'white', fontFamily: 'inherit' }}>
          {busy ? 'Signing…' : submitLabel}
        </button>
        {missing && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{missing}</span>}
      </div>
    </div>
  );
}
