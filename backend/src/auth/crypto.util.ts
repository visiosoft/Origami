import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

// Small, dependency-free helpers for password hashing and session tokens.
// Node's crypto covers everything we need (scrypt + HMAC-SHA256), so the app
// gains no new npm dependencies for authentication.

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// ------------------------------------------------------------------ passwords

/** Hash a password with scrypt. Stored as `salt:hash` (both hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Minimum bar for a new password. Returns an error message, or null if fine. */
export function passwordProblem(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain a letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  return null;
}

// --------------------------------------------------------------------- tokens

/** A random, URL-safe token to email out. Only its hash is stored. */
export function randomToken(): string {
  return b64url(randomBytes(32));
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ----------------------------------------------------------------------- JWT

export interface SessionClaims {
  sub: string;      // user id
  email: string;
  name: string;
  roleKey: string;
  tier: string;
  iat: number;
  exp: number;
}

/** Sign an HS256 JWT. */
export function signJwt(claims: Omit<SessionClaims, 'iat' | 'exp'>, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat: now, exp: now + ttlSeconds };
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

/** Verify an HS256 JWT. Returns the claims, or null if invalid/expired. */
export function verifyJwt(token: string, secret: string): SessionClaims | null {
  const parts = token?.split('.');
  if (!parts || parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const given = fromB64url(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(fromB64url(body).toString('utf8')) as SessionClaims;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Sign a short-lived value (used for the OAuth `state` round-trip). */
export function signState(data: Record<string, unknown>, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify({ ...data, t: Date.now() })));
  const sig = b64url(createHmac('sha256', secret).update(body).digest()).slice(0, 32);
  return `${body}.${sig}`;
}

export function readState(state: string, secret: string, maxAgeMs = 10 * 60_000): Record<string, any> | null {
  const parts = state?.split('.');
  if (!parts || parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(createHmac('sha256', secret).update(body).digest()).slice(0, 32);
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(fromB64url(body).toString('utf8'));
    if (!data.t || Date.now() - data.t > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}
