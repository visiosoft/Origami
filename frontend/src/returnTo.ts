/**
 * Where to go after signing in: the page someone was sent away from (an
 * email's task link, say). Kept in sessionStorage so it survives the Google
 * sign-in round trip.
 */
const KEY = 'origami.returnTo';

export function rememberReturnTo(path: string) {
  if (!path.startsWith('/') || path.startsWith('/login')) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* ignore */ }
}

/** The remembered page (once), else the dashboard. */
export function takeReturnTo(): string {
  try {
    const p = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/login')) return p;
  } catch { /* ignore */ }
  return '/dashboard';
}
