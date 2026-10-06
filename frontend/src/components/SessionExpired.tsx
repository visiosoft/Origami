import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

/**
 * Shown over the page when the session ran out while someone was working. They
 * sign in again right here -- password, or Google in a small pop-up -- and stay on
 * the same page: nothing typed is lost, and unsaved changes are sent once they're back.
 */
export function SessionExpired() {
  const { sessionExpired, restoreSession, currentUser, signOut } = useApp();
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (sessionExpired) { setEmail(currentUser?.email || ''); setPassword(''); setError(''); } }, [sessionExpired]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sessionExpired) return null;

  const submit = () => {
    if (!email.trim() || !password) { setError('Enter your password to continue.'); return; }
    setBusy(true); setError('');
    api.auth.login(email.trim(), password)
      .then((r) => restoreSession(r.token, r.user as any))
      .catch((e: Error) => setError(e.message || 'Sign in failed.'))
      .finally(() => setBusy(false));
  };
  const google = () => {
    // The pop-up signs in with Google and hands the new session back (see Auth); this page stays as it is.
    const w = window.open(api.auth.googleLoginUrl(), 'origami-reauth', 'width=520,height=680');
    if (!w) setError('Your browser blocked the pop-up — allow pop-ups for this site, or use your password.');
  };

  const input: React.CSSProperties = { height: 44, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', font: 'inherit', fontSize: 14, color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const btn = (dark: boolean): React.CSSProperties => ({ height: 44, borderRadius: 999, border: dark ? 0 : '1px solid var(--border-strong)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#FDFCF9' : 'var(--ink)', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 });

  return (
    <div role="dialog" aria-modal="true" aria-label="Sign in again" style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(29, 29, 27, 0.4)', animation: 'fadeIn 0.15s ease' }}>
      <div style={{ width: 'min(420px, 100%)', display: 'grid', gap: 12, padding: 24, borderRadius: 'var(--radius-card)', background: 'var(--surface)', boxShadow: 'var(--shadow-pop)', color: 'var(--ink)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '-0.02em' }}>You were signed out</div>
        <div style={{ fontSize: 13.5, color: 'var(--body)', lineHeight: 1.55 }}>
          Your session ended. Sign in again to keep going — <b>this page stays open and nothing you typed is lost</b>; anything not saved yet is sent as soon as you’re back.
        </div>
        <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" />
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        {error && <div style={{ fontSize: 13, color: '#9A4318' }}>{error}</div>}
        <button type="button" style={btn(true)} disabled={busy} onClick={submit}>{busy ? 'Signing in…' : 'Sign in and continue'}</button>
        <button type="button" style={btn(false)} disabled={busy} onClick={google}>Continue with Google</button>
        <button type="button" onClick={signOut} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', justifySelf: 'center' }}>Sign out instead</button>
      </div>
    </div>
  );
}
