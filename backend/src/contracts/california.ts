/**
 * California home-improvement contract rules (Nov 13 sync, Edward):
 *  - the three-day right to cancel: until midnight at the end of the third
 *    business day after the day the owner signs. Business days here are
 *    Monday to Friday without federal holidays -- stricter than the law's own
 *    definition (which counts Saturdays), so the owner never gets less time;
 *  - the down payment may not exceed $1,000 or 10% of the contract price,
 *    whichever is less;
 *  - the draw schedule (down payment, mobilization, progress milestones)
 *    adds up to the contract price.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
/** The n-th weekday (0 = Sunday) of a month; n = -1 for the last. */
function nth(y: number, m: number, weekday: number, n: number) {
  if (n > 0) { const first = utc(y, m, 1); return utc(y, m, 1 + ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7); }
  const last = utc(y, m + 1, 0); return utc(y, m, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7));
}
/** A fixed-date holiday on a weekend is observed on the Friday before or the Monday after. */
function observed(d: Date) {
  const w = d.getUTCDay();
  return w === 6 ? utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1) : w === 0 ? utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) : d;
}

/** US federal holidays (observed dates) for a year, as YYYY-MM-DD. */
export function federalHolidays(y: number): Set<string> {
  return new Set([
    observed(utc(y, 0, 1)), nth(y, 0, 1, 3), nth(y, 1, 1, 3), nth(y, 4, 1, -1), observed(utc(y, 5, 19)), observed(utc(y, 6, 4)),
    nth(y, 8, 1, 1), nth(y, 9, 1, 2), observed(utc(y, 10, 11)), nth(y, 10, 4, 4), observed(utc(y, 11, 25)),
    observed(utc(y + 1, 0, 1)), // next New Year observed on Dec 31
  ].map(ymd));
}

export const isBusinessDay = (day: string) => {
  const d = new Date(day + 'T00:00:00Z');
  const w = d.getUTCDay();
  return w !== 0 && w !== 6 && !federalHolidays(d.getUTCFullYear()).has(day);
};

/** The last day to cancel: the third business day after the signing day (the signing day itself never counts). */
export function cancelByDay(signedDay: string): string {
  let d = new Date(signedDay.slice(0, 10) + 'T00:00:00Z');
  let left = 3;
  while (left > 0) {
    d = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    if (isBusinessDay(ymd(d))) left--;
  }
  return ymd(d);
}

const longDay = (day: string) => new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
/** The sentence that goes in the contract. Before the owner signs it says how it's worked out. */
export function cancelByText(signedDay: string | null | undefined): string {
  if (!signedDay) return 'midnight at the end of the third business day (Monday to Friday, not counting federal holidays) after the day you sign';
  return `midnight at the end of ${longDay(cancelByDay(signedDay))}`;
}

// ---------------------------------------------------------------- draw schedule
export type DrawKind = 'down' | 'mobilization' | 'progress' | 'final';
export interface DrawRow { label: string; kind: DrawKind; mode: 'pct' | 'amt'; value: number; milestone?: string }

/** Dollars from "$185,000.00", "185000" ... (null if none). */
export const parsePrice = (raw: unknown): number | null => {
  const n = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
  return String(raw ?? '').trim() && Number.isFinite(n) ? n : null;
};
const cents = (n: number) => Math.round(n * 100);
/** The legal maximum down payment: $1,000 or 10% of the price, whichever is less. */
export const downPaymentCap = (price: number) => Math.min(1000, Math.round(price * 10) / 100);

export function cleanDraws(raw: unknown): DrawRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map((r: any) => ({
    label: String(r?.label || '').trim().slice(0, 200) || 'Payment',
    kind: (['down', 'mobilization', 'progress', 'final'].includes(r?.kind) ? r.kind : 'progress') as DrawKind,
    mode: r?.mode === 'amt' ? 'amt' : 'pct',
    value: Math.max(0, Number(r?.value) || 0),
    milestone: r?.milestone ? String(r.milestone).trim().slice(0, 300) : undefined,
  }));
}

/** Each row's amount, the total, and what breaks the rules. */
export function checkDraws(rows: DrawRow[], price: number | null) {
  const p = price ?? 0;
  const out = rows.map((r) => ({ ...r, amount: r.mode === 'amt' ? r.value : Math.round(p * r.value) / 100 }));
  // The last row takes the rounding cents, so a 100% schedule adds up exactly.
  if (out.length && rows.every((r) => r.mode === 'pct') && Math.abs(rows.reduce((a, r) => a + r.value, 0) - 100) < 1e-9) {
    const rest = cents(p) - out.slice(0, -1).reduce((a, r) => a + cents(r.amount), 0);
    out[out.length - 1].amount = rest / 100;
  }
  const total = out.reduce((a, r) => a + cents(r.amount), 0) / 100;
  const errors: string[] = [];
  if (price == null || price <= 0) errors.push('Set the contract amount first.');
  const downs = out.filter((r) => r.kind === 'down');
  if (downs.length > 1) errors.push('Only one down payment.');
  const cap = downPaymentCap(p);
  if (downs[0] && downs[0].amount > cap + 1e-9) errors.push(`The down payment can be at most $${cap.toLocaleString('en-US', { minimumFractionDigits: 2 })} ($1,000 or 10% of the price, whichever is less).`);
  if (price != null && price > 0 && Math.abs(cents(total) - cents(p)) > 0) errors.push(`The payments add up to $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}, not the contract price of $${p.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
  return { rows: out, total, cap, errors };
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function drawScheduleHtml(rows: DrawRow[], price: number | null): string {
  if (!rows.length) return '';
  const c = checkDraws(rows, price);
  const tr = c.rows.map((r, i) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #ddd;">${i + 1}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;">${esc(r.label)}${r.milestone ? `<br/><span style="color:#555;font-size:11px;">${esc(r.milestone)}</span>` : ''}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right;">${r.mode === 'pct' ? `${r.value}%` : ''}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right;">${usd(r.amount)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font:12px Helvetica,Arial,sans-serif;margin:6px 0;"><thead><tr><th style="text-align:left;padding:4px 8px;border-bottom:2px solid #333;">#</th><th style="text-align:left;padding:4px 8px;border-bottom:2px solid #333;">Payment</th><th style="text-align:right;padding:4px 8px;border-bottom:2px solid #333;">%</th><th style="text-align:right;padding:4px 8px;border-bottom:2px solid #333;">Amount</th></tr></thead><tbody>${tr}<tr><td></td><td style="padding:4px 8px;"><strong>Total</strong></td><td></td><td style="padding:4px 8px;text-align:right;"><strong>${usd(c.total)}</strong></td></tr></tbody></table>`;
}

export function drawingListHtml(files: { name: string }[]): string {
  if (!files.length) return '<em>No drawings attached.</em>';
  return `<ol style="margin:6px 0 6px 18px;padding:0;">${files.map((f) => `<li>${esc(f.name)}</li>`).join('')}</ol>`;
}

/** The fields filled when the contract is shown, not when it's drafted: they depend on signing and on the schedule. */
export const LIVE_FIELDS = ['cancel_by', 'draw_schedule', 'drawing_list'];

export function fillLive(html: string, c: { amount?: string | null; drawSchedule?: DrawRow[] | null; attachments?: { name: string; kind: string }[] | null; parties?: { internal?: boolean; role?: string; signedAt?: string | null }[] }): string {
  // The owner's signing day: the first outside signer to sign.
  const signed = (c.parties || []).filter((p) => !p.internal && p.role !== 'copy' && p.signedAt).map((p) => String(p.signedAt).slice(0, 10)).sort()[0] || null;
  return String(html || '')
    .replace(/\{\{\s*cancel_by\s*\}\}/g, esc(cancelByText(signed)))
    .replace(/\{\{\s*draw_schedule\s*\}\}/g, (c.drawSchedule || []).length ? drawScheduleHtml(c.drawSchedule || [], parsePrice(c.amount)) : '{{draw_schedule}}')
    .replace(/\{\{\s*drawing_list\s*\}\}/g, drawingListHtml((c.attachments || []).filter((a) => a.kind === 'drawings')));
}
