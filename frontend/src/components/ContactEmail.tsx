import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type MailThreadRow } from '../api';

const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString() : '');

/**
 * Email with this person or lead (Batch 6, like HubSpot): the conversations
 * in your own Gmail with their address, newest first, and an "Email" button
 * that starts one. Staff with My Mail connected; others see the button only.
 */
export function ContactEmail({ email, name }: { email?: string | null; name?: string | null }) {
  const navigate = useNavigate();
  const [st, setSt] = useState<{ connected: boolean; threads: MailThreadRow[] } | null>(null);
  const addr = String(email || '').trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
  useEffect(() => { if (valid) api.mail.withAddress(addr).then(setSt).catch(() => setSt(null)); }, [addr, valid]);
  if (!valid) return null;
  const to = name ? `${name} <${addr}>` : addr;
  return (
    <section aria-label="Email with them" style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', flex: 1 }}>Email</span>
        <button type="button" onClick={() => navigate(`/mail?to=${encodeURIComponent(to)}`)} style={{ padding: '6px 14px', borderRadius: 999, border: 0, background: 'var(--forest)', color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Email</button>
      </div>
      {st && !st.connected && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Connect your Gmail in My Mail to see your emails with them here.</div>}
      {st?.connected && !st.threads.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No emails with them in your mailbox.</div>}
      {st?.threads.map((t) => (
        <button key={t.id} type="button" onClick={() => navigate(`/mail?thread=${encodeURIComponent(t.id)}`)} style={{ display: 'grid', gap: 1, textAlign: 'left', padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.08)', background: 'var(--surface)', font: 'inherit', cursor: 'pointer' }}>
          <span style={{ display: 'flex', gap: 8 }}><b style={{ flex: 1, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</b><span style={{ fontSize: 11, color: 'var(--muted)' }}>{when(t.date)}{t.count > 1 ? ` · ${t.count}` : ''}</span></span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.snippet}</span>
        </button>
      ))}
    </section>
  );
}
