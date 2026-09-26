import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';

interface View {
  company: string; accent?: string; project: string; firstName: string; items: string[]; expiresAt: string;
  uploaded: { name: string; item: string; at?: string }[];
}

/**
 * The client's private upload page (F11) -- opened from the welcome email, no
 * account. One row per document we asked for, each with its own "Upload";
 * anything else goes under "Something else". Works from a phone.
 */
export function ClientUpload() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const pickFor = useRef<string>('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { api.clientUpload.view(token).then((r) => setV(r as View)).catch((e: Error) => setError(e.message)); }, [token]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files); // the input is cleared right after, so take the files now
    const item = pickFor.current;
    setBusy(item || '__other'); setDone(''); setError('');
    try {
      setV(await api.clientUpload.upload(token, list, item) as View);
      setDone(`${list.length === 1 ? list[0].name : `${list.length} files`} received — thank you.`);
    } catch (e: any) { setError(e.message || 'That didn’t upload — please try again.'); }
    finally { setBusy(null); }
  };
  const choose = (item: string) => { pickFor.current = item; fileRef.current?.click(); };

  const accent = /^#[0-9a-f]{6}$/i.test(v?.accent || '') ? v!.accent! : '#173326';
  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#FBF8F2', display: 'flex', justifyContent: 'center', padding: '28px 16px', boxSizing: 'border-box', fontFamily: "'Inter', system-ui, sans-serif", color: '#0B1A12' };
  const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 560, background: 'white', borderRadius: 16, boxShadow: '0 10px 40px rgba(11,26,18,0.08)', padding: '24px 22px', alignSelf: 'flex-start' };

  if (!v) {
    return (
      <div style={wrap}><div style={cardStyle}>
        {error ? <><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>This link isn’t working</div><div style={{ fontSize: 14, color: '#5C6B65', lineHeight: 1.6 }}>{error}</div></>
          : <div style={{ fontSize: 14, color: '#7E9B93' }}>Loading…</div>}
      </div></div>
    );
  }
  const forItem = (item: string) => v.uploaded.filter((u) => u.item === item);
  const others = v.uploaded.filter((u) => !u.item || !v.items.includes(u.item));
  const row = (item: string, label: string, list: View['uploaded']) => (
    <div key={item || '__other'} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</div>
        {list.length > 0 && <div style={{ fontSize: 12.5, color: '#2F7D4A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>✓ {list.map((u) => u.name).join(', ')}</div>}
      </div>
      <button type="button" disabled={!!busy} onClick={() => choose(item)} style={{ padding: '10px 16px', borderRadius: 999, border: 'none', background: list.length ? 'white' : accent, color: list.length ? accent : 'white', outline: list.length ? `1px solid ${accent}` : 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {busy === (item || '__other') ? 'Uploading…' : list.length ? 'Add more' : 'Upload'}
      </button>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{v.company}</div>
        <div style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 4px', lineHeight: 1.25 }}>{v.firstName ? `Hi ${v.firstName} — ` : ''}documents for {v.project}</div>
        <div style={{ fontSize: 14, color: '#5C6B65', lineHeight: 1.6, marginBottom: 12 }}>
          Upload whatever you have — PDFs, photos from your phone, scans. Only our team can see them.
        </div>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
        {done && <div style={{ padding: '10px 12px', borderRadius: 10, background: '#E4EFE5', color: '#145C33', fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{done}</div>}
        {error && <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F7E4DB', color: '#8E2E0A', fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{error}</div>}
        {v.items.map((i) => row(i, i, forItem(i)))}
        {row('', v.items.length ? 'Something else' : 'Your documents', others)}
        <div style={{ fontSize: 12, color: '#9AA39D', marginTop: 14, lineHeight: 1.5 }}>
          This private link works until {new Date(v.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Questions? Just reply to our email.
        </div>
      </div>
    </div>
  );
}
