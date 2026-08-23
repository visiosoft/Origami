import type { CookieOptions } from 'express';

/** Name of the session cookie. Also the key the guard reads on image requests. */
export const SESSION_COOKIE = 'origami_session';

/**
 * Read one cookie out of a raw Cookie header.
 *
 * Hand-rolled rather than pulling in `cookie-parser`: the host runs
 * `npm install --omit=dev` on every container start, so a new dependency is a
 * new way for production to fail to boot. Express can already *write* cookies
 * without it, and reading is this.
 */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Cookie flags for the session.
 *
 * `sameSite: 'strict'` keeps it off cross-site requests entirely; `secure` is
 * relaxed only off HTTPS so local development over http://localhost still works.
 */
export function sessionCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}
