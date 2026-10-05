import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { SignaturePad } from '../components/SignaturePad';
import { PROGRAM_STEPS, num, rangeText, type ProgramData } from '../data/projectProgram';

const BG = "'Outfit', system-ui, sans-serif";

/**
 * A client's own read of their Project Program, and where they sign it.
 *
 * Deliberately separate from the internal ProjectProgram wizard: a client
 * account has no business hitting the internal-only endpoints that back the
 * editor, and shouldn't see raw phase-board / budget-editing UI either --
 * just what was sent to them, and the certification.
 */
export function MyProjectProgram() {
  const navigate = useNavigate();
  const { toast, currentUser } = useApp();
  const [params] = useSearchParams();
  const projectId = Number(params.get('projectId'));
  const [data, setData] = useState<ProgramData>({});
  const [sentAt, setSentAt] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [signedByName, setSignedByName] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState(currentUser?.name || '');
  const [image, setImage] = useState('');
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(projectId)) { setError('No project given.'); setLoading(false); return; }
    api.projectProgram.mine(projectId)
      .then((res: any) => {
        setData(res?.data || {});
        setSentAt(res?.sentAt || '');
        setSignedAt(res?.signedAt || '');
        setSignedByName(res?.signedByName || '');
        setSignatureImage(res?.signatureImage || '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const submit = () => {
    if (!name.trim()) { toast('Type your name to certify the signature'); return; }
    if (!image) { toast('Draw your signature above'); return; }
    if (!certified) { toast('Check the certification box first'); return; }
    setSubmitting(true);
    api.projectProgram.sign(projectId, name.trim(), image)
      .then((res: any) => { setSignedAt(res?.signedAt || new Date().toISOString()); setSignedByName(res?.signedByName || name.trim()); setSignatureImage(image); toast('Signed'); })
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <div style={{ padding: 28, fontSize: 13, color: '#8B877F' }}>Loading…</div>;
  if (error) return (
    <div style={{ padding: 28 }}>
      <div style={{ fontSize: 13, color: '#8E2E0A', marginBottom: 10 }}>{error}</div>
      <div onClick={() => navigate('/dashboard')} style={{ fontSize: 12.5, fontWeight: 700, color: '#232321', cursor: 'pointer' }}>← Back to dashboard</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, animation: 'fadeIn 0.3s ease' }}>
      <div onClick={() => navigate('/dashboard')} style={{ fontSize: 12, fontWeight: 700, color: '#232321', cursor: 'pointer', marginBottom: 10 }}>← Back to dashboard</div>
      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#1D1D1B', marginBottom: 4 }}>Project Program</div>
      <div style={{ fontSize: 12.5, color: '#65615A', marginBottom: 20 }}>
        {sentAt ? `Sent to you ${new Date(sentAt).toLocaleDateString()}.` : 'What your project team has recorded so far.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        {PROGRAM_STEPS.map((step) => {
          const values = data[step.key] || {};
          const rows: { label: string; value: string }[] = [];
          for (const sec of step.sections) {
            if (sec.kind === 'fields') {
              for (const f of sec.fields || []) {
                const v = values[`${sec.key}.${f.key}`];
                if (v !== undefined && String(v).trim()) rows.push({ label: f.label, value: String(v) });
              }
            } else if (sec.kind === 'table') {
              for (const r of sec.rows || []) {
                const cell = values[r.key] || {};
                const hasRange = String(cell.rangeLow ?? '').trim() || String(cell.rangeHigh ?? '').trim();
                const v = hasRange ? rangeText(num(cell.rangeLow), num(cell.rangeHigh ?? cell.rangeLow)) : String(cell.budget ?? '');
                if (v.trim()) rows.push({ label: r.label, value: v });
              }
            } else if (sec.kind === 'list') {
              for (const item of (values[sec.key] || []) as string[]) {
                if (String(item || '').trim()) rows.push({ label: '', value: item });
              }
            }
          }
          if (!rows.length) return null;
          return (
            <div key={step.key} style={{ background: '#FDFCF9', border: '1px solid rgba(29, 29, 27,0.06)', borderRadius: 18, padding: '14px 16px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1D1D1B', marginBottom: 8 }}>{step.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                    {r.label && <span style={{ color: '#8B877F', flex: '0 0 180px' }}>{r.label}</span>}
                    <span style={{ color: '#1D1D1B' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: '#FDFCF9', border: '1px solid rgba(29, 29, 27,0.06)', borderRadius: 20, padding: 20 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, color: '#1D1D1B', marginBottom: 4 }}>Approval</div>
        {signedAt ? (
          <div>
            <div style={{ fontSize: 13, color: '#34552E', fontWeight: 600, marginBottom: signatureImage ? 10 : 0 }}>
              Signed by {signedByName} on {new Date(signedAt).toLocaleString()}.
            </div>
            {signatureImage && (
              <img src={signatureImage} alt={`Signature of ${signedByName}`} style={{ maxWidth: 260, height: 'auto', border: '1px solid rgba(29, 29, 27,0.1)', borderRadius: 8, background: '#FDFCF9', padding: 8 }} />
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: '#8B877F', marginBottom: 14, lineHeight: 1.6 }}>
              Review what's above, then sign to approve it. This records the exact answers you're approving, along with when and from where.
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: '#8B877F', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(29, 29, 27,0.14)', fontSize: 13.5, marginTop: 4 }} />
            </div>
            <SignaturePad onChange={setImage} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#4A4741', marginTop: 12, cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} style={{ marginTop: 2 }} />
              I certify that this is my legal signature and that I intend to sign this document electronically.
            </label>
            <div
              onClick={submitting ? undefined : submit}
              style={{ marginTop: 14, display: 'inline-block', padding: '11px 22px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', background: submitting ? '#ABA79E' : '#232321', color: 'white' }}
            >
              {submitting ? 'Submitting…' : 'Sign & approve'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
