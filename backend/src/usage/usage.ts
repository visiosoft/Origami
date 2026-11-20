/**
 * Nov 20: pure helpers for API usage -- what's used of the credit loaded, and
 * whether to warn. Credits are typed in by the office (Settings → Integrations
 * → Usage & credits): an amount and how many units it buys.
 */
export const SERVICES = ['quo', 'twilio', 'openai'] as const;
export type Service = typeof SERVICES[number];
export const SERVICE_LABEL: Record<Service, string> = { quo: 'Quo texts', twilio: 'Twilio texts', openai: 'AI (ChatGPT)' };
export const UNIT_LABEL: Record<Service, string> = { quo: 'segments', twilio: 'segments', openai: 'tokens' };

/** Credit loaded: e.g. $50 buys about 5,000 segments, loaded on a date (use is counted from then). */
export interface Credit { amount?: number; units: number; since: string }
export type Credits = Partial<Record<Service, Credit>>;

export const monthOf = (d: Date | string) => new Date(d).toISOString().slice(0, 7);

export function cleanCredits(raw: unknown): Credits {
  const out: Credits = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const s of SERVICES) {
    const c = (raw as any)[s];
    if (!c) continue;
    const units = Math.max(0, Math.round(Number(c.units) || 0));
    if (!units) continue;
    const since = /^\d{4}-\d{2}-\d{2}/.test(String(c.since || '')) ? String(c.since).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const amount = Number(c.amount);
    out[s] = { units, since, ...(Number.isFinite(amount) && amount > 0 ? { amount: Math.round(amount * 100) / 100 } : {}) };
  }
  return out;
}

/** How a service stands against its credit: used since it was loaded, share, and days left at the recent rate. */
export function standing(credit: Credit | undefined, usedSince: number, now: Date) {
  if (!credit) return { used: usedSince, share: null as number | null, left: null as number | null, daysLeft: null as number | null, level: 'none' as const };
  const left = Math.max(0, credit.units - usedSince);
  const share = credit.units ? usedSince / credit.units : 0;
  const days = Math.max(1, (now.getTime() - Date.parse(credit.since + 'T00:00:00Z')) / 864e5);
  const perDay = usedSince / days;
  const daysLeft = perDay > 0 ? Math.floor(left / perDay) : null;
  const level = share >= 1 ? 'out' as const : share >= 0.8 ? 'low' as const : 'ok' as const;
  return { used: usedSince, share, left, daysLeft, level };
}

/** A provider refusing for lack of credit -- Quo 402, OpenAI insufficient_quota, Twilio balance errors. */
export function isOutOfCredit(message: string): boolean {
  return /\b402\b|insufficient_quota|api credits|out of credit|insufficient (funds|balance)|billing/i.test(String(message || ''));
}
