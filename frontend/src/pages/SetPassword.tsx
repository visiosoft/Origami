import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useWindowWidth } from '../useWindowWidth';
import { AuthLayout, authInput, label as fieldLabel } from './AuthLayout';
import { GoogleMark } from './Auth';

/** Local mirror of the server's password rules, so the bar is visible as you type. */
const RULES = [
  { test: (p: string) => p.length >= 8, text: 'At least 8 characters' },
  { test: (p: string) => /[a-zA-Z]/.test(p), text: 'Contains a letter' },
  { test: (p: string) => /[0-9]/.test(p), text: 'Contains a number' },
];

export function SetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const width = useWindowWidth();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<{ name: string; email: string; isReset: boolean } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError('This link is missing its token. Ask an administrator to send a new invitation.'); return; }
    api.auth.invite(token)
      .then(setInvite)
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  const unmet = useMemo(() => RULES.filter((r) => !r.test(password)), [password]);

  const submit = () => {
    if (unmet.length) { setError(unmet[0].text.replace(/^At least/, 'Password needs at least')); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setError('');
    setBusy(true);
    api.auth.setPassword(token, password)
      .then(() => setDone(true))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  if (loadError) {
    return (
      <AuthLayout showBrand={width > 760} title="Link not valid" subtitle="This invitation can no longer be used.">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#8E2E0A', flexShrink: 0, marginTop: 6 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8E2E0A', lineHeight: 1.55 }}>{loadError}</span>
        </div>
        <div onClick={() => navigate('/login')} style={{ padding: '14px 0', borderRadius: 10, background: '#173326', color: '#fff', textAlign: 'center', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Go to log in</div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout showBrand={width > 760} title="You're all set" subtitle="Your password is saved and your account is active.">
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#43514D' }}>
          Sign in with <strong>{invite?.email}</strong> and your new password — or use <strong>Continue with Google</strong> if that
          address is a Google account.
        </div>
        <div onClick={() => navigate('/login')} style={{ padding: '14px 0', borderRadius: 10, background: '#173326', color: '#fff', textAlign: 'center', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Log in</div>
        <a href={api.auth.googleLoginUrl()} style={{ padding: '13px 0', borderRadius: 10, background: '#fff', border: '1px solid rgba(20,8,31,0.12)', color: '#0B1A12', textAlign: 'center', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }}>
          <GoogleMark /><span>Continue with Google</span>
        </a>
      </AuthLayout>
    );
  }

  const heading = invite?.isReset ? 'Choose a new password' : 'Create your password';
  const sub = invite
    ? `${invite.name} · ${invite.email}`
    : 'Checking your invitation…';

  return (
    <AuthLayout showBrand={width > 760} title={heading} subtitle={sub}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={fieldLabel}>New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" style={authInput} disabled={!invite} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={fieldLabel}>Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Type it again" style={authInput} disabled={!invite} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <div key={r.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 999, display: 'grid', placeItems: 'center', background: ok ? '#1E6B36' : '#E3E9E4', flexShrink: 0 }}>
                <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: ok ? 1 : 0.35 }}><path d="M20 6L9 17l-5-5" /></svg>
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: ok ? '#1E6B36' : '#7E9B93' }}>{r.text}</span>
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#8E2E0A', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>{error}</span>
        </div>
      )}

      <div onClick={busy || !invite ? undefined : submit} style={{ padding: '14px 0', borderRadius: 10, background: busy || !invite ? '#9AB0A4' : '#173326', color: '#fff', textAlign: 'center', fontSize: 13.5, fontWeight: 700, cursor: busy || !invite ? 'default' : 'pointer' }}>
        {busy ? 'Saving…' : invite?.isReset ? 'Save new password' : 'Create password & activate'}
      </div>
    </AuthLayout>
  );
}
