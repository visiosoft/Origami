import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';
import { useApp } from '../AppContext';

type Method = 'app' | 'sms' | 'email';
const LABEL: Record<Method, string> = { app: 'an authenticator app', sms: 'text message', email: 'email' };
const field = { padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16 } as const;
const dark = { padding: '9px 16px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const;
const light = { ...dark, background: 'var(--mist)', color: 'var(--forest)' } as const;

/**
 * My two-step sign-in (Nov 13): how codes come (app, text or email) and
 * switching it, backup codes left, and new backup codes.
 */
/** Administrators: is two-step sign-in required, and which ways may codes come (texts cost per message). */
function TwoStepPolicy() {
  const { toast } = useApp();
  const [s, setS] = useState<Record<string, string> | null>(null);
  useEffect(() => { api.settings.get().then(setS).catch(() => undefined); }, []);
  if (!s) return null;
  const on = s['auth.twoFactor'] !== 'off';
  const methods = (s['auth.twoFactorMethods'] || 'app,sms,email').split(',').map((x) => x.trim()).filter(Boolean);
  const save = async (patch: Record<string, string>) => {
    try { setS(await api.settings.save(patch)); toast('Saved'); } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
  };
  const toggle = (m: string) => void save({ 'auth.twoFactorMethods': (methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m]).join(',') });
  return (
    <div aria-label="Two-step policy" style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), 0.1)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>For everyone (administrators)</div>
      <label style={{ display: 'flex', gap: 8, fontSize: 13 }}><input type="checkbox" checked={on} onChange={() => { if (!on || confirm('Turn off two-step sign-in for all staff?')) void save({ 'auth.twoFactor': on ? 'off' : 'on' }); }} /> Staff must use two-step sign-in</label>
      <div style={{ fontSize: 12.5, color: 'var(--body)' }}>Ways people may get codes (the authenticator app is always allowed):</div>
      <label style={{ display: 'flex', gap: 8, fontSize: 13 }}><input type="checkbox" checked={methods.includes('sms')} onChange={() => toggle('sms')} /> Text message (each text costs)</label>
      <label style={{ display: 'flex', gap: 8, fontSize: 13 }}><input type="checkbox" checked={methods.includes('email')} onChange={() => toggle('email')} /> Email</label>
    </div>
  );
}

export function TwoStepSettings() {
  const { toast, authUser } = useApp();
  const [me, setMe] = useState<any>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  // Switching method: the new one, its number, its QR code or where the code went, and the code to confirm.
  const [change, setChange] = useState<{ method: Method; phone: string; qr?: string; secret?: string; sentTo?: string; code: string } | null>(null);
  const load = () => { api.auth.me().then(setMe).catch(() => undefined); };
  useEffect(load, []);
  if (!me) return null;
  if (!me.twoFactor) return <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}><div style={{ fontSize: 13.5, color: 'var(--body)' }}>{me.tier === 'internal' ? 'You’ll set up two-step sign-in the next time you sign in — with an authenticator app, a text or an email.' : 'Two-step sign-in is for staff accounts.'}</div>{authUser?.roleKey === 'admin' && <TwoStepPolicy />}</div>;
  const method: Method = me.twoFactorMethod === 'sms' || me.twoFactorMethod === 'email' ? me.twoFactorMethod : 'app';
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not done')); } finally { setBusy(false); } };
  const renew = () => run(async () => { setCodes((await api.auth.newBackupCodes(code.trim())).backupCodes); setCode(''); setSent(''); toast('New backup codes made — the old ones no longer work'); });
  const sendOwn = () => run(async () => { setSent((await api.auth.sendOwnCode()).sentTo); });
  const startChange = () => run(async () => {
    if (!change) return;
    const r = await api.auth.changeMethod(change.method, change.phone);
    setChange({ ...change, secret: r.secret, sentTo: r.sentTo, qr: r.uri ? await QRCode.toDataURL(r.uri, { margin: 1, width: 200 }) : undefined });
  });
  const confirmChange = () => run(async () => {
    if (!change) return;
    await api.auth.confirmMethod(change.method, change.code.trim());
    toast(`Codes now come by ${LABEL[change.method]}`); setChange(null); load();
  });
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
      <div style={{ fontSize: 13.5, color: 'var(--body)' }}>
        Two-step sign-in is <b>on</b>{me.totpEnabledAt ? ` since ${new Date(me.totpEnabledAt).toLocaleDateString()}` : ''}, with codes by <b>{LABEL[method]}</b>{method === 'sms' && me.twoFactorPhone ? ` to •••• ${String(me.twoFactorPhone).slice(-4)}` : ''}. {me.backupCodesLeft ?? 0} backup code{me.backupCodesLeft === 1 ? '' : 's'} left.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {method !== 'app' && <button type="button" disabled={busy} onClick={() => void sendOwn()} style={light}>{sent ? 'Send again' : 'Send me a code'}</button>}
        <input aria-label={method === 'app' ? 'Code from your app' : 'Code we sent'} inputMode="numeric" placeholder={method === 'app' ? 'Code from your app' : 'Code we sent'} value={code} onChange={(e) => setCode(e.target.value)} style={{ ...field, width: 180 }} />
        <button type="button" disabled={busy || code.trim().length < 6} onClick={() => void renew()} style={dark}>New backup codes</button>
      </div>
      {sent && <div role="status" style={{ fontSize: 12.5, color: 'var(--forest)' }}>Code sent to {sent}.</div>}
      {codes && <div aria-label="Backup codes" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, padding: 14, borderRadius: 10, background: 'var(--mist)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 15 }}>{codes.map((c) => <span key={c}>{c}</span>)}</div>}

      <div style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.08)', paddingTop: 12, display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Get codes another way</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['app', 'sms', 'email'] as Method[]).filter((m) => m !== method || m === 'sms').map((m) => (
            <button key={m} type="button" onClick={() => setChange({ method: m, phone: '', code: '' })} style={change?.method === m ? dark : light}>{m === 'app' ? 'Authenticator app' : m === 'sms' ? (method === 'sms' ? 'A different mobile' : 'Text message') : 'Email'}</button>
          ))}
        </div>
        {change && (
          <div aria-label="Switch method" style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'var(--mist)' }}>
            {change.method === 'sms' && !change.sentTo && <input aria-label="Mobile number" type="tel" placeholder="Mobile number" value={change.phone} onChange={(e) => setChange({ ...change, phone: e.target.value })} style={field} />}
            {!change.qr && !change.sentTo && <button type="button" disabled={busy || (change.method === 'sms' && change.phone.replace(/\D/g, '').length < 10)} onClick={() => void startChange()} style={{ ...dark, justifySelf: 'start' }}>{change.method === 'app' ? 'Show the QR code' : change.method === 'sms' ? 'Text me a code' : 'Email me a code'}</button>}
            {change.qr && <div style={{ display: 'grid', justifyItems: 'start', gap: 6 }}><img src={change.qr} alt="QR code for your authenticator app" width={180} height={180} style={{ background: '#fff', padding: 6, borderRadius: 8 }} /><code style={{ fontSize: 12 }}>{change.secret?.match(/.{1,4}/g)?.join(' ')}</code></div>}
            {change.sentTo && <div style={{ fontSize: 12.5 }}>Code sent to {change.sentTo}.</div>}
            {(change.qr || change.sentTo) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input aria-label="Code to confirm" inputMode="numeric" placeholder="6-digit code" value={change.code} onChange={(e) => setChange({ ...change, code: e.target.value })} style={{ ...field, width: 160 }} />
                <button type="button" disabled={busy || change.code.trim().length < 6} onClick={() => void confirmChange()} style={dark}>Switch</button>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Lost your phone? Use a backup code to sign in, or ask an administrator to reset your two-step sign-in.</div>
      {authUser?.roleKey === 'admin' && <TwoStepPolicy />}
    </div>
  );
}
