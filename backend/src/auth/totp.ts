import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Two-step sign-in (Nov 13, Batch 4): time-based one-time codes as in RFC
 * 6238 (HMAC-SHA1, 30-second steps, 6 digits) -- what Google Authenticator,
 * Microsoft Authenticator, 1Password and the like generate. Written on
 * Node's crypto rather than an npm package (see crypto.util.ts: auth adds no
 * dependencies).
 */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A new secret: 20 random bytes, as base32 (what authenticator apps take). */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for one 30-second step (RFC 4226 dynamic truncation). */
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totp(secretB32: string, at = Date.now(), digits = 6, step = 30): string {
  return hotp(base32Decode(secretB32), Math.floor(at / 1000 / step), digits);
}

/**
 * Does the code match? One step either side is allowed for clock drift.
 * Returns the matching step (to refuse the same code twice), or null.
 */
export function checkTotp(secretB32: string, code: string, at = Date.now(), lastStep?: number | null): number | null {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const key = base32Decode(secretB32);
  const now = Math.floor(at / 1000 / 30);
  for (const s of [now, now - 1, now + 1]) {
    if (lastStep != null && s <= lastStep) continue;
    const want = Buffer.from(hotp(key, s));
    if (timingSafeEqual(want, Buffer.from(c))) return s;
  }
  return null;
}

/** What an authenticator app scans: otpauth://totp/Issuer:account?secret=…&issuer=… */
export function otpauthUri(secretB32: string, account: string, issuer = 'Origami'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Ten one-time backup codes, like "k7m2-9xq4" (easy to read out and type). */
export function newBackupCodes(n = 10): string[] {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => abc[x % abc.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
export const normBackupCode = (c: string) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The secret is kept encrypted with a key made from the server's JWT secret (AES-256-GCM). */
const keyOf = (serverSecret: string) => createHash('sha256').update(`${serverSecret}:totp`).digest();
export function sealSecret(plain: string, serverSecret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyOf(serverSecret), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}
export function openSecret(sealed: string, serverSecret: string): string | null {
  try {
    const [v, iv, tag, enc] = String(sealed || '').split('.');
    if (v !== 'v1') return null;
    const d = createDecipheriv('aes-256-gcm', keyOf(serverSecret), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
  } catch { return null; }
}
