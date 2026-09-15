import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, session } from '../api';

const BG = "'Bricolage Grotesque', serif";

/**
 * Where a guest access link lands: no login form, just the token from the
 * URL. On success this stores a normal session -- from here on the guest is
 * using the ordinary app (their own dashboard, scoped by the People
 * directory entry the grant created), not a bespoke guest UI.
 */
export function GuestEntry() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('This link is missing its access code.'); return; }
    api.guestAccess.resolve(token)
      .then((res) => {
        session.set(res.token);
        // Full reload so the app boots fresh with the new session, same as after a normal login.
        window.location.href = '/dashboard';
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FBF8F2', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 18, color: '#173326', marginBottom: 14 }}>Origami Design + Build</div>
        {error ? (
          <div style={{ fontSize: 13.5, color: '#8E2E0A', fontWeight: 600, lineHeight: 1.6 }}>{error}</div>
        ) : (
          <div style={{ fontSize: 13, color: '#7E9B93' }}>Signing you in…</div>
        )}
      </div>
    </div>
  );
}
