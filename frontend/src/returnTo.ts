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

/** What was just handed out, so a second ask a moment later gets the same answer, not the dashboard. */
let last: { path: string; at: number } | null = null;

/** The remembered page (once), else the dashboard. */
export function takeReturnTo(): string {
  try {
    const p = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/login')) {
      last = { path: p, at: Date.now() };
      return p;
    }
  } catch { /* ignore */ }
  if (last && Date.now() - last.at < 5000) return last.path;
  return '/dashboard';
}
