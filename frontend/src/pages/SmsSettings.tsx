import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const BG = "'Bricolage Grotesque', serif";
const MASK = '••••••••';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

const card: React.CSSProperties = {
  background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 18, marginBottom: 16,
};

type Form = { 'sms.accountSid': string; 'sms.authToken': string; 'sms.fromNumber': string; 'sms.enabled': string };
const EMPTY: Form = { 'sms.accountSid': '', 'sms.authToken': '', 'sms.fromNumber': '', 'sms.enabled': 'true' };

interface Status { configured: boolean; enabled: boolean; fromNumber: string; accountSid: string }

/**
 * Settings → SMS.
 *
 * Twilio credentials and the sending number. The auth token is stored masked
 * like the other secrets, so posting the mask back leaves it unchanged.
 */
export function SmsSettings() {
  const { toast } = useApp();
  const [form, setForm] = useState<Form>(EMPTY);
  const [status, setStatus] = useState<Status | null>(null);
  const [testTo, setTestTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = () => api.sms.status().then((s: any) => setStatus(s as Status)).catch(() => setStatus(null));

  useEffect(() => {
    Promise.all([api.settings.get(), api.sms.status().catch(() => null)])
      .then(([s, st]: any[]) => {
        setForm({ ...EMPTY, ...(s as Partial<Form>) });
        if (st) setStatus(st as Status);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setSaving(true);
    setError('');
    api.settings.save(form)
      .then((s: any) => { setForm({ ...EMPTY, ...(s as Partial<Form>) }); toast('SMS settings saved'); return loadStatus(); })
      .catch((e: Error) => { setError(e.message); toast('⚠ Failed to save'); })
      .finally(() => setSaving(false));
  };

  const sendTest = () => {
    if (!testTo.trim()) { setError('Enter a number to text.'); return; }
    setSending(true);
    setError('');
    api.sms.test(testTo.trim())
      .then((r: any) => toast(`Test sent to ${r?.to || testTo}`))
      .catch((e: Error) => { setError(e.message); toast('⚠ ' + e.message); })
      .finally(() => setSending(false));
  };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  const enabled = form['sms.enabled'] !== 'false';

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>SMS</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
          Texting clients from the system, using the same templates as email. Sent through Twilio — the credentials
          come from your Twilio console, and the sending number must be one you own there.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>
          {error}
        </div>
      )}

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: status?.configured ? (status.enabled ? '#2F7D4A' : '#93520F') : '#B8410F' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0B1A12' }}>
            {status?.configured ? (status.enabled ? 'Ready to send' : 'Configured, but switched off') : 'Not configured'}
          </div>
          <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 2 }}>
            {status?.configured ? `Sending as ${status.fromNumber} · account ${status.accountSid}` : 'Add the account SID, auth token and sending number below.'}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93', marginBottom: 14 }}>Twilio Account</div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D' }}>Account SID</label>
            <input style={inputStyle} value={form['sms.accountSid']} onChange={(e) => set('sms.accountSid', e.target.value)} placeholder="ACxxxxxxxx…" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D' }}>Auth Token</label>
            <input style={inputStyle} type="password" value={form['sms.authToken']} onChange={(e) => set('sms.authToken', e.target.value)} placeholder={MASK} />
            <span style={{ fontSize: 11, color: '#7E9B93' }}>Stored masked. Leave as {MASK} to keep the saved token.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D' }}>Sending Number</label>
            <input style={inputStyle} value={form['sms.fromNumber']} onChange={(e) => set('sms.fromNumber', e.target.value)} placeholder="+14155550100" />
            <span style={{ fontSize: 11, color: '#7E9B93' }}>A number on your Twilio account, in +country format.</span>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12.5, color: '#0B1A12', cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => set('sms.enabled', e.target.checked ? 'true' : 'false')} />
          Sending is on
          <span style={{ fontSize: 11, color: '#7E9B93' }}>— untick to stop every outgoing text without clearing the credentials.</span>
        </label>
      </div>

      <div style={card}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93', marginBottom: 12 }}>Send a Test</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inputStyle, flex: '1 1 220px' }} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+14155551234" />
          <div onClick={sending || !status?.configured ? undefined : sendTest}
            style={{ padding: '9px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: sending || !status?.configured ? 'default' : 'pointer', background: status?.configured ? (sending ? '#9AB0A4' : '#173326') : '#D6DED8', color: status?.configured ? 'white' : '#9AA39D' }}>
            {sending ? 'Sending…' : 'Send test'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#9AA39D', marginTop: 8, lineHeight: 1.5 }}>
          Sends one real text and is billed like any other. Save your credentials first.
        </div>
      </div>

      <div onClick={saving ? undefined : save}
        style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>
        {saving ? 'Saving…' : 'Save SMS settings'}
      </div>
    </div>
  );
}
