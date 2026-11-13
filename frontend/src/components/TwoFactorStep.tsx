import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';
import { authInput, label as fieldLabel } from '../pages/AuthLayout';

export interface TwoFactorTicket { step: 'setup' | 'code'; ticket: string; name?: string; email?: string }

const btn = (busy: boolean): React.CSSProperties => ({ padding: '14px 0', borderRadius: 10, border: 0, width: '100%', background: busy ? 'var(--c-9ab0a4)' : 'var(--forest)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' });
const link: React.CSSProperties = { background: 'none', border: 0, padding: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--forest)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, fontFamily: 'inherit' };
const err: React.CSSProperties = { padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', color: '#8E2E0A', fontSize: 12.5, fontWeight: 600 };

/**
 * The second sign-in step for staff (Nov 13): set up an authenticator app
 * (scan the QR code, enter its first code, keep the backup codes), or enter
 * the app's code -- or a backup code. "Remember this device" skips it here
 * for 30 days.
 */
type Method = 'app' | 'sms' | 'email';
const METHOD_LABEL: Record<Method, string> = { app: 'Authenticator app', sms: 'Text message', email: 'Email' };
const METHOD_HINT: Record<Method, string> = { app: 'Google or Microsoft Authenticator — works without signal', sms: 'A code texted to your mobile each time', email: 'A code emailed to you each time' };

export function TwoFactorStep({ t, onSignedIn, onCancel }: { t: TwoFactorTicket; onSignedIn: (token: string, user: unknown) => void; onCancel: () => void }) {
  // Which way the codes come (Nov 13): an app, a text or an email.
  const [info, setInfo] = useState<{ method: Method; methods: Method[]; sentTo?: string } | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<{ list: string[]; token: string; user: unknown } | null>(null);
  useEffect(() => {
    api.auth.twoFactorInfo(t.ticket).then((r) => {
      if (!r || !Array.isArray(r.methods)) throw new Error('no info');
      setInfo(r);
      if (t.step === 'code') setMethod(r.method);
      else if (r.methods.length === 1) setMethod(r.methods[0]);
    }).catch(() => { setInfo({ method: 'app', methods: ['app'] }); setMethod('app'); });
  }, [t]);
  useEffect(() => {
    if (t.step !== 'setup' || method !== 'app' || setup) return;
    api.auth.twoFactorSetup(t.ticket)
      .then(async (r) => setSetup({ ...r, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 220 }) }))
      .catch((e: Error) => setError(e.message || 'Could not start the set-up.'));
  }, [t, method, setup]);
  // Signing in by text / email: send the code straight away.
  const send = async (choice?: { method: 'sms' | 'email'; phone?: string }) => {
    setBusy(true); setError('');
    try { const r = await api.auth.twoFactorSend(t.ticket, choice); setSentTo(r.sentTo); }
    catch (e) { setError((e as Error).message || 'Could not send a code.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (t.step === 'code' && (method === 'sms' || method === 'email')) void send(); }, [t, method]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const c = code.trim();
    if (!c) { setError(useBackup ? 'Type one of your backup codes.' : method === 'app' ? 'Type the 6-digit code from your app.' : 'Type the 6-digit code we sent.'); return; }
    setBusy(true); setError('');
    try {
      if (t.step === 'setup') {
        const r = await api.auth.twoFactorEnable(t.ticket, c, remember, method || 'app');
        setCodes({ list: r.backupCodes, token: r.token, user: r.user });
      } else {
        const r = await api.auth.twoFactorVerify(t.ticket, useBackup ? { backupCode: c, remember } : { code: c, remember });
        onSignedIn(r.token, r.user);
      }
    } catch (e) { setError((e as Error).message || 'That didn’t work.'); }
    finally { setBusy(false); }
  };

  if (codes) {
    return (
      <div style={{ display: 'grid', gap: 13 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--body)' }}><b>Two-step sign-in is on.</b> Keep these backup codes somewhere safe — each one signs you in once if you don’t have your phone. They won’t be shown again.</div>
        <div aria-label="Backup codes" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, padding: 14, borderRadius: 10, background: 'var(--mist)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 15, letterSpacing: '0.04em', color: 'var(--ink)' }}>
          {codes.list.map((c) => <span key={c}>{c}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <button type="button" style={link} onClick={() => void navigator.clipboard?.writeText(codes.list.join('\n'))}>Copy</button>
          <button type="button" style={link} onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`Origami backup codes for ${t.email || ''}\n\n${codes.list.join('\n')}\n`], { type: 'text/plain' })); a.download = 'origami-backup-codes.txt'; a.click(); }}>Download</button>
        </div>
        <button type="button" style={btn(false)} onClick={() => onSignedIn(codes.token, codes.user)}>I’ve saved them — continue</button>
      </div>
    );
  }

  if (!info) return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Preparing…</div>;
  // Set-up, first: how should the codes come?
  if (t.step === 'setup' && !method) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--body)' }}>Staff sign in in two steps: your password, then a 6-digit code. How would you like to get the code?</div>
        {info.methods.map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), 0.15)', background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer' }}>
            <b style={{ fontSize: 14, color: 'var(--ink)' }}>{METHOD_LABEL[m]}</b><span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{METHOD_HINT[m]}</span>
          </button>
        ))}
        <button type="button" style={{ ...link, justifySelf: 'center' }} onClick={onCancel}>Back to sign in</button>
      </div>
    );
  }
  const byMessage = method === 'sms' || method === 'email';
  return (
    <div style={{ display: 'grid', gap: 13 }}>
      {t.step === 'setup' && byMessage ? (
        <>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--body)' }}>
            {method === 'sms' ? 'We’ll text a code to your mobile each time you sign in on a new device.' : `We’ll email a code to ${t.email || 'you'} each time you sign in on a new device.`}
          </div>
          {method === 'sms' && (
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={fieldLabel} htmlFor="twofa-phone">Mobile number</label>
              <input id="twofa-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(415) 555-0100" style={authInput} />
            </div>
          )}
          <button type="button" disabled={busy || (method === 'sms' && phone.replace(/\D/g, '').length < 10)} style={btn(busy)} onClick={() => void send({ method: method as 'sms' | 'email', phone })}>{sentTo ? 'Send a new code' : method === 'sms' ? 'Text me a code' : 'Email me a code'}</button>
          {sentTo && <div role="status" style={{ fontSize: 12.5, color: 'var(--forest)' }}>Code sent to {sentTo}.</div>}
        </>
      ) : t.step === 'setup' ? (
        <>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--body)' }}>
            Staff sign in in two steps. Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password…), add an account, and scan this code.
          </div>
          {setup ? (
            <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
              <img src={setup.qr} alt="QR code to add Origami to your authenticator app" width={200} height={200} style={{ borderRadius: 8, background: '#fff', padding: 6 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Can’t scan it? Type this key into the app:<br /><code style={{ fontSize: 13, color: 'var(--ink)', letterSpacing: '0.06em', wordBreak: 'break-all' }}>{setup.secret.match(/.{1,4}/g)?.join(' ')}</code></div>
            </div>
          ) : !error && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Preparing…</div>}
        </>
      ) : (
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--body)' }}>
          {useBackup ? 'Type one of the backup codes you saved when you set this up.'
            : byMessage ? <>We {method === 'sms' ? 'texted' : 'emailed'} a 6-digit code to {sentTo || info.sentTo}. <button type="button" style={link} disabled={busy} onClick={() => void send()}>Send a new code</button></>
            : 'Open your authenticator app and type the 6-digit code for Origami.'}
        </div>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        <label style={fieldLabel} htmlFor="twofa-code">{useBackup ? 'Backup code' : t.step === 'setup' ? (byMessage ? 'Code we sent' : 'Code from the app') : '6-digit code'}</label>
        <input id="twofa-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()}
          inputMode={useBackup ? 'text' : 'numeric'} autoComplete="one-time-code" placeholder={useBackup ? 'xxxx-xxxx' : '123456'} maxLength={useBackup ? 12 : 7}
          style={{ ...authInput, fontSize: 20, letterSpacing: '0.2em', textAlign: 'center' }} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--body)', cursor: 'pointer' }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--forest)' }} />
        Remember this device for 30 days
      </label>
      {error && <div role="alert" style={err}>{error}</div>}
      <button type="button" disabled={busy} style={btn(busy)} onClick={() => void submit()}>{busy ? 'Checking…' : t.step === 'setup' ? 'Turn on and sign in' : 'Sign in'}</button>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {t.step === 'code' && <button type="button" style={link} onClick={() => { setUseBackup((v) => !v); setCode(''); setError(''); }}>{useBackup ? (byMessage ? 'Use a sent code instead' : 'Use the app instead') : 'Use a backup code'}</button>}
        {t.step === 'setup' && info.methods.length > 1 && <button type="button" style={link} onClick={() => { setMethod(null); setCode(''); setSentTo(''); setError(''); }}>Another way</button>}
        <button type="button" style={link} onClick={onCancel}>Back to sign in</button>
      </div>
      {t.step === 'code' && <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>Lost your phone and your backup codes? An administrator can reset your two-step sign-in.</div>}
    </div>
  );
}
