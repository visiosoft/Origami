import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * Text settings (Nov 13 sync), public: the link at the foot of every text.
 * Choose which texts to get, or stop them all -- no account needed.
 */
export function TextPrefs() {
  const t = new URLSearchParams(window.location.search).get('t') || '';
  const [st, setSt] = useState<{ phone: string; stopAll: boolean; off: string[] } | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.sms.prefs(t).then(setSt).catch((e) => setErr((e as Error).message || 'This link is not valid.')); }, [t]);
  const save = async (next: { stopAll: boolean; off: string[] }) => {
    setSaved(false);
    try { setSt(await api.sms.savePrefs(t, next)); setSaved(true); } catch (e) { setErr((e as Error).message); }
  };
  const box = { maxWidth: 440, margin: '60px auto', padding: 24, borderRadius: 18, background: 'var(--surface, #fff)', boxShadow: '0 10px 40px rgba(0,0,0,.08)', fontFamily: 'inherit', display: 'grid', gap: 14 } as const;
  if (err) return <div style={box}><b>Text settings</b><div>{err}</div></div>;
  if (!st) return <div style={box}>Loading…</div>;
  const on = (k: string) => !st.stopAll && !st.off.includes(k);
  const toggle = (k: string) => void save({ stopAll: false, off: on(k) ? [...st.off, k] : st.off.filter((x) => x !== k) });
  return (
    <main style={box}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Text settings</h1>
      <div style={{ fontSize: 13.5, color: '#5c6b65' }}>For {st.phone}. Choose which texts you get from us.</div>
      <label style={{ display: 'flex', gap: 10, fontSize: 14 }}><input type="checkbox" checked={on('updates')} onChange={() => toggle('updates')} /> <span><b>Project updates</b><br /><small>Your project, tasks, meetings and visits</small></span></label>
      <label style={{ display: 'flex', gap: 10, fontSize: 14 }}><input type="checkbox" checked={on('announcements')} onChange={() => toggle('announcements')} /> <span><b>Announcements</b><br /><small>News and messages sent to many people</small></span></label>
      <button type="button" onClick={() => void save(st.stopAll ? { stopAll: false, off: [] } : { stopAll: true, off: st.off })}
        style={{ padding: '10px 16px', borderRadius: 999, border: 0, background: st.stopAll ? '#1e6b36' : '#8E2E0A', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
        {st.stopAll ? 'Start getting texts again' : 'Stop all texts'}
      </button>
      {saved && <div role="status" style={{ fontSize: 13, color: '#1e6b36' }}>Saved{st.stopAll ? ' — you won’t get texts from us.' : '.'}</div>}
      <div style={{ fontSize: 12, color: '#7a857f' }}>You can also reply STOP to any text to stop them all, or START to get them again.</div>
    </main>
  );
}
