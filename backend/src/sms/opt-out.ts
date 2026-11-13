import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Text opt-out (Nov 13 sync): every text says how to stop, STOP replies are
 * honoured, and a preferences link lets people choose what they get.
 */
export type TextCategory = 'updates' | 'announcements' | 'security';

/** Carrier-standard keywords (CTIA): the whole reply, any case. */
const STOP = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'opt-out', 'revoke'];
const START = ['start', 'unstop', 'subscribe', 'resume'];

export function keywordOf(text: unknown): 'stop' | 'start' | null {
  const t = String(text ?? '').trim().toLowerCase().replace(/[.!\s]+$/g, '');
  if (STOP.includes(t)) return 'stop';
  if (START.includes(t)) return 'start';
  return null;
}

export const FOOTER_MARK = 'Reply STOP to opt out';
/** The line added to every text (not sign-in codes). */
export function withFooter(body: string, prefsUrl?: string | null): string {
  const b = String(body || '').trim();
  if (b.includes(FOOTER_MARK)) return b;
  return `${b}\n${FOOTER_MARK}${prefsUrl ? `. Settings: ${prefsUrl}` : '.'}`;
}

/** Is a text of this kind blocked by their choice? Sign-in codes are never blocked here. */
export function blocked(pref: { stopAll?: boolean | null; off?: string[] | null } | null | undefined, category: TextCategory): boolean {
  if (!pref || category === 'security') return false;
  return !!pref.stopAll || (Array.isArray(pref.off) && pref.off.includes(category));
}

// ---------------------------------------------------------------- preference links
const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** A link token for one phone number: the number and a short signature (no expiry; it only manages that number's texts). */
export function prefsToken(phone: string, secret: string): string {
  const digits = String(phone).replace(/\D/g, '');
  return `${digits}.${b64u(createHmac('sha256', secret).update('sms-prefs:' + digits).digest()).slice(0, 16)}`;
}
export function readPrefsToken(token: string, secret: string): string | null {
  const [digits, sig] = String(token || '').split('.');
  if (!digits || !/^\d{8,15}$/.test(digits) || !sig) return null;
  const want = prefsToken(digits, secret).split('.')[1];
  return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want)) ? '+' + digits : null;
}

// ---------------------------------------------------------------- Quo webhook signatures
/**
 * Quo signs webhooks two ways: the legacy `openphone-signature:
 * hmac;1;<timestamp>;<base64>` over "<timestamp>.<body>", and the current
 * Standard Webhooks headers (webhook-id, webhook-timestamp, webhook-signature
 * "v1,<base64> ...") over "<id>.<timestamp>.<body>". The secret is base64
 * (the current one prefixed whsec_). Within 5 minutes either way.
 */
export function verifyQuoSignature(headers: Record<string, string | string[] | undefined>, raw: string, secret: string, now = Date.now()): boolean {
  if (!secret) return false;
  const h = (k: string) => { const v = headers[k] ?? headers[k.toLowerCase()]; return Array.isArray(v) ? v[0] : v || ''; };
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const same = (a: string, b: string) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
  const fresh = (tsMs: number) => Number.isFinite(tsMs) && Math.abs(now - tsMs) <= 5 * 60_000;
  const legacy = h('openphone-signature');
  if (legacy) {
    const [, , ts, sig] = legacy.split(';');
    const tsMs = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
    if (!fresh(tsMs) || !sig) return false;
    return same(createHmac('sha256', key).update(`${ts}.${raw}`).digest('base64'), sig);
  }
  const id = h('webhook-id'); const ts = h('webhook-timestamp'); const sigs = h('webhook-signature');
  if (!id || !ts || !sigs || !fresh(Number(ts) * 1000)) return false;
  const want = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');
  return sigs.split(' ').some((s) => same(s.split(',')[1] || '', want));
}

/** The sender and text of an incoming-message event, whichever shape it came in. */
export function incomingText(payload: any): { from: string; text: string } | null {
  const type = String(payload?.type || '');
  if (!/message\.received/.test(type)) return null;
  const o = payload?.data?.object || payload?.data || {};
  const from = String(o.from || o.sender || '');
  const text = String(o.body ?? o.text ?? o.content ?? '');
  return from ? { from, text } : null;
}
