import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWindowWidth } from '../useWindowWidth';
import { api } from '../api';
import { useApp } from '../AppContext';
import { AuthLayout, authInput, label as fieldLabel } from './AuthLayout';

export function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const width = useWindowWidth();
  const { signIn, authUser, authReady } = useApp();
  const isLogin = mode === 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(params.get('error') ?? '');
  const [notice, setNotice] = useState(params.get('notice') ?? '');
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Google sends the browser back to /login#token=… after a successful sign-in.
  useEffect(() => {
    const hash = window.location.hash;
    const match = /token=([^&]+)/.exec(hash);
    if (!match) return;
    window.history.replaceState(null, '', window.location.pathname);
    signIn(decodeURIComponent(match[1]));
    navigate('/dashboard', { replace: true });
  }, [signIn, navigate]);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (authReady && authUser) navigate('/dashboard', { replace: true });
  }, [authReady, authUser, navigate]);

  const submit = () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password to continue.');
      return;
    }
    setError('');
    setBusy(true);
    api.auth.login(email.trim(), password)
      .then((res) => {
        signIn(res.token, res.user as any);
        navigate('/dashboard', { replace: true });
      })
      .catch((e: Error) => setError(e.message || 'Sign in failed.'))
      .finally(() => setBusy(false));
  };

  const sendReset = () => {
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setError('');
    setBusy(true);
    api.auth.forgotPassword(email.trim())
      .then((res) => {
        setForgotOpen(false);
        // The server says plainly when it has no mailbox to send from, rather
        // than promising an email that will never arrive.
        if (res?.ok === false) {
          setError("Password resets aren't available yet — no mailbox is connected. Ask an administrator to reset your password for you.");
        } else {
          setNotice(`If an account exists for ${email.trim()}, a reset link is on its way.`);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  // Sign-up is invitation-only: accounts are created by an administrator, who
  // triggers the "set your password" email.
  if (!isLogin) {
    return (
      <AuthLayout showBrand={width > 760} title="Access is by invitation" subtitle="Origami accounts are created by an administrator.">
        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#43514D' }}>
          Ask an administrator to add you under <strong>User Access &amp; Roles</strong>. You'll get an email with a link to
          choose your password, and can then sign in with that password or with your Google account.
        </div>
        <div onClick={() => navigate('/login')} style={{ padding: '14px 0', borderRadius: 10, background: '#173326', color: '#fff', textAlign: 'center', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Back to log in</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBrand={width > 760} title="Welcome back" subtitle="Sign in to pick up where the team left off.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={fieldLabel}>Work email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@origamidb.com" style={authInput} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={fieldLabel}>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Enter your password" style={authInput}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={() => setRemember((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ width: 16, height: 16, borderRadius: 5, display: 'grid', placeItems: 'center', flexShrink: 0, background: remember ? '#173326' : 'white', border: '1px solid ' + (remember ? '#173326' : 'rgba(20,8,31,0.2)') }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: remember ? 1 : 0 }}><path d="M20 6L9 17l-5-5" /></svg>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#43514D' }}>Keep me signed in</span>
        </div>
        <span onClick={() => { setForgotOpen(true); setNotice(''); }} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#173326', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>Forgot password?</span>
      </div>

      {forgotOpen && (
        <div style={{ padding: 13, borderRadius: 10, background: '#EEF3EE', border: '1px solid rgba(20,8,31,0.08)', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 12.5, color: '#43514D', lineHeight: 1.55 }}>We'll email a reset link to <strong>{email.trim() || 'your address'}</strong>.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={busy ? undefined : sendReset} style={{ padding: '9px 16px', borderRadius: 999, background: '#173326', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Send reset link</div>
            <div onClick={() => setForgotOpen(false)} style={{ padding: '9px 16px', borderRadius: 999, background: 'white', color: '#43514D', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)' }}>Cancel</div>
          </div>
        </div>
      )}

      {notice && <Banner tone="ok" text={notice} />}
      {error && <Banner tone="bad" text={error} />}

      <div onClick={busy ? undefined : submit} style={{ padding: '14px 0', borderRadius: 10, background: busy ? '#9AB0A4' : '#173326', color: '#ffffff', textAlign: 'center', fontSize: 13.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Signing in…' : 'Log in'}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, height: 1, background: 'rgba(20,8,31,0.09)' }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93' }}>or</span>
        <span style={{ flex: 1, height: 1, background: 'rgba(20,8,31,0.09)' }} />
      </div>

      <a
        href={api.auth.googleLoginUrl()}
        style={{ padding: '13px 0', borderRadius: 10, background: '#ffffff', border: '1px solid rgba(20,8,31,0.12)', color: '#0B1A12', textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }}
      >
        <GoogleMark />
        <span>Continue with Google</span>
      </a>

      <div style={{ fontSize: 11.5, lineHeight: 1.6, color: '#7E9B93', textAlign: 'center' }}>
        Google sign-in works for accounts an administrator has already added.
      </div>
    </AuthLayout>
  );
}

function Banner({ tone, text }: { tone: 'ok' | 'bad'; text: string }) {
  const s = tone === 'ok'
    ? { bg: '#D8ECD9', border: 'rgba(30,107,54,0.2)', dot: '#1E6B36', color: '#1E6B36' }
    : { bg: '#F7E4DB', border: 'rgba(142,46,10,0.18)', dot: '#8E2E0A', color: '#8E2E0A' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 10, background: s.bg, border: `1px solid ${s.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: s.color, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

export function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.7 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 14 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.5l-7.6-5.9c-2.1 1.4-4.8 2.3-7.7 2.3-6.3 0-11.7-4.5-13.6-10.4l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
  );
}
