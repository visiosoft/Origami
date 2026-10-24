import { fromCents, toCents } from './money';

/**
 * The dashboard's "Invoiced vs Collected" (Oct 2026): per calendar month, what
 * was invoiced (issued invoices, credits taking away), what came in (payments),
 * and what's still open on that month's invoices -- past due or within terms --
 * with the retention they hold back. Pure, so it's tested without a database.
 */
export interface BillingInvoice { id: string; projectId: number; issuedNumber?: string | null; kind?: string | null; status?: string | null; invoiceDate?: string | null; dueDate?: string | null; total?: number | null; retentionAmount?: number | null; fxRate?: number | null; voidedAt?: string | null }
export interface BillingPayment { invoiceId: string; date?: string | null; amount: number; fxRate?: number | null; voidedAt?: string | null }

export function monthKeys(months: number, now = new Date()) {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  return keys;
}

export function billingMonths(invoices: BillingInvoice[], payments: BillingPayment[], opts: { months: number; today: string; projectName: (id: number) => string; now?: Date }) {
  const keys = monthKeys(opts.months, opts.now);
  const live = payments.filter((p) => !p.voidedAt);
  const paidOn = new Map<string, number>();
  for (const p of live) paidOn.set(p.invoiceId, (paidOn.get(p.invoiceId) || 0) + toCents(Number(p.amount) * (Number(p.fxRate) || 1)));
  const issued = invoices.filter((i) => i.status === 'issued' && !i.voidedAt && i.invoiceDate);
  return keys.map((month) => {
    const mine = issued.filter((i) => String(i.invoiceDate).slice(0, 7) === month);
    let invoicedC = 0, pastDueC = 0, withinC = 0, retentionC = 0;
    const open: { id: string; number: string; projectId: number; project: string; dueDate: string | null; unpaid: number; pastDue: boolean }[] = [];
    for (const i of mine) {
      const fx = Number(i.fxRate) || 1;
      const totalC = toCents(Number(i.total || 0) * fx);
      const credit = i.kind === 'credit';
      invoicedC += credit ? -Math.abs(totalC) : totalC;
      if (credit) continue;
      retentionC += toCents(Number(i.retentionAmount || 0) * fx);
      const unpaidC = Math.max(totalC - (paidOn.get(i.id) || 0), 0);
      if (unpaidC <= 0) continue;
      const late = !!i.dueDate && String(i.dueDate).slice(0, 10) < opts.today;
      if (late) pastDueC += unpaidC; else withinC += unpaidC;
      open.push({ id: i.id, number: i.issuedNumber || i.id, projectId: i.projectId, project: opts.projectName(i.projectId), dueDate: i.dueDate || null, unpaid: fromCents(unpaidC), pastDue: late });
    }
    const collectedC = live.filter((p) => String(p.date || '').slice(0, 7) === month).reduce((s, p) => s + toCents(Number(p.amount) * (Number(p.fxRate) || 1)), 0);
    return {
      month, invoiced: fromCents(invoicedC), collected: fromCents(collectedC),
      pastDue: fromCents(pastDueC), withinTerms: fromCents(withinC), retention: fromCents(retentionC),
      open: open.sort((a, b) => b.unpaid - a.unpaid),
    };
  });
}
