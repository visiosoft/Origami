import { useEffect, useState } from 'react';
import { api } from '../api';

const box = { maxWidth: 560, margin: '40px auto', padding: 24, borderRadius: 18, background: 'var(--surface, #fff)', boxShadow: '0 10px 40px rgba(0,0,0,.08)', display: 'grid', gap: 12 } as const;
const field = { padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,.15)', font: 'inherit', fontSize: 16 } as const;
const lbl = { display: 'grid', gap: 4, fontSize: 12.5, fontWeight: 700, color: '#43514D' } as const;

/**
 * The prequalification form a sub fills in from our private link (Nov 13
 * sync): licence, insurance, trades, references, and their W-9 and
 * certificates. No account needed.
 */
export function PrequalForm() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [v, setV] = useState<Awaited<ReturnType<typeof api.prequal.publicView>> | null>(null);
  const [f, setF] = useState<Record<string, any>>({});
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.prequal.publicView(token).then((r) => {
      setV(r);
      setF({ licenseNumber: r.licenseNumber || '', licenseExpiry: r.licenseExpiry || '', insuranceProvider: r.insuranceProvider || '', insurancePolicyNumber: r.insurancePolicyNumber || '', insuranceExpiry: r.insuranceExpiry || '', trades: r.prequal?.trades || '', yearsInBusiness: r.prequal?.yearsInBusiness ?? '', references: r.prequal?.references || '', w9OnFile: !!r.prequal?.w9OnFile });
    }).catch((e) => setErr((e as Error).message || 'This link is not valid.'));
  }, [token]);
  if (err && !v) return <main style={box}><b>Prequalification</b><div>{err}</div></main>;
  if (!v) return <main style={box}>Loading…</main>;
  const submit = async () => {
    setBusy(true); setErr('');
    try { setV(await api.prequal.publicSubmit(token, f)); setDone(true); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr('');
    try { setV(await api.prequal.publicUpload(token, files)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const input = (k: string, label: string, type = 'text') => <label style={lbl}>{label}<input type={type} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={field} /></label>;
  return (
    <main style={box}>
      <h1 style={{ margin: 0, fontSize: 21 }}>Prequalification — {v.companyName}</h1>
      <div style={{ fontSize: 13.5, color: '#5c6b65', lineHeight: 1.55 }}>Please fill in your licence and insurance, and upload your W-9 and certificate of insurance. We review it before inviting you to bid.</div>
      {v.status === 'approved' && <div role="status" style={{ color: '#1e6b36', fontSize: 13.5 }}>You’re prequalified. Contact us if your details change.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {input('licenseNumber', 'Contractor licence number')}{input('licenseExpiry', 'Licence expires', 'date')}
        {input('insuranceProvider', 'Insurance company')}{input('insurancePolicyNumber', 'Policy number')}
        {input('insuranceExpiry', 'Insurance expires', 'date')}{input('yearsInBusiness', 'Years in business', 'number')}
      </div>
      {input('trades', 'Trades you do (e.g. tile, stone, framing)')}
      <label style={lbl}>References (jobs and contacts)<textarea rows={3} value={f.references || ''} onChange={(e) => setF({ ...f, references: e.target.value })} style={field} /></label>
      <label style={{ display: 'flex', gap: 8, fontSize: 14 }}><input type="checkbox" checked={!!f.w9OnFile} onChange={(e) => setF({ ...f, w9OnFile: e.target.checked })} /> I’ve uploaded our W-9</label>
      <label style={lbl}>Upload W-9, certificate of insurance, licence (PDF or photo)<input type="file" multiple disabled={busy} onChange={(e) => void upload(e.target.files)} /></label>
      {v.files.length > 0 && <div style={{ fontSize: 12.5, color: '#43514D' }}>Uploaded: {v.files.join(', ')}</div>}
      {err && <div role="alert" style={{ color: '#8E2E0A', fontSize: 13 }}>{err}</div>}
      {v.status !== 'approved' && <button type="button" disabled={busy} onClick={() => void submit()} style={{ padding: '12px 18px', borderRadius: 999, border: 0, background: '#1f3d33', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Sending…' : 'Send for review'}</button>}
      {done && <div role="status" style={{ color: '#1e6b36', fontSize: 13.5 }}>Thank you — we’ll review it and let you know.</div>}
    </main>
  );
}
