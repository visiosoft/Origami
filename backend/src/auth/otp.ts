import { randomInt } from 'crypto';
import { hashToken } from './crypto.util';

/**
 * Two-step codes by text or email (Nov 13 sync), for people who find an
 * authenticator app hard: 6 digits, 10 minutes, one live at a time, used once.
 */
export const OTP_MS = 10 * 60_000;
export type TwoFactorMethod = 'app' | 'sms' | 'email';
export const METHODS: TwoFactorMethod[] = ['app', 'sms', 'email'];

export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
/** Hashed with the user id, so the same code for two people doesn't look the same. */
export const otpHash = (uid: string, code: string) => hashToken(`otp:${uid}:${String(code).replace(/\D/g, '')}`);

/** May another code be sent? Not within 30 seconds of the last, and at most 5 an hour. */
export function canSend(sends: string[] | null | undefined, now = Date.now()): { ok: true; keep: string[] } | { ok: false; wait: number } {
  const recent = (sends || []).filter((t) => now - Date.parse(t) < 60 * 60_000);
  const last = recent.length ? Math.max(...recent.map((t) => Date.parse(t))) : 0;
  if (last && now - last < 30_000) return { ok: false, wait: Math.ceil((30_000 - (now - last)) / 1000) };
  if (recent.length >= 5) return { ok: false, wait: Math.ceil((60 * 60_000 - (now - Math.min(...recent.map((t) => Date.parse(t))))) / 1000) };
  return { ok: true, keep: [...recent, new Date(now).toISOString()] };
}

export function otpValid(u: { id: string; otpHash?: string | null; otpExpiresAt?: string | null }, code: string, now = Date.now()) {
  return !!u.otpHash && !!u.otpExpiresAt && Date.parse(u.otpExpiresAt) > now && otpHash(u.id, code) === u.otpHash;
}

/** "•••• 0100" / "e•••@origami.com" -- where the code went. */
export function maskTo(method: TwoFactorMethod, to: string) {
  if (method === 'sms') return '•••• ' + String(to).replace(/\D/g, '').slice(-4);
  const [name, domain] = String(to).split('@');
  return `${(name || '').slice(0, 1)}•••@${domain || ''}`;
}

/** Which methods the administrators allow (Settings: auth.twoFactorMethods, comma list; default all three). */
export function allowedMethods(setting: string | null | undefined): TwoFactorMethod[] {
  const list = String(setting || '').split(',').map((s) => s.trim()).filter((s): s is TwoFactorMethod => (METHODS as string[]).includes(s));
  return list.length ? (list.includes('app') ? list : ['app', ...list]) : METHODS;
}
