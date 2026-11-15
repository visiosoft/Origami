/**
 * Split funding (Batch 6): where a project's money comes from -- a
 * construction loan, the owner's cash, a grant -- each with the amount
 * approved, what's been invoiced and paid against it, and the gap between
 * the contract (with approved change orders) and the funding approved.
 * Pure and in cents, so it can be tested without a database.
 */
export const FUNDING_KINDS = ['loan', 'owner_cash', 'other'] as const;
export type FundingKind = (typeof FUNDING_KINDS)[number];
export const isFundingKind = (k: unknown): k is FundingKind => (FUNDING_KINDS as readonly string[]).includes(String(k));

export interface FundingSourceIn { id: string; kind: string; name: string; approvedC: number }
/** An issued invoice (credit notes carry a negative total), and which source pays it. */
export interface FundedInvoice { id: string; fundingSourceId: string | null; totalC: number; paidC: number }
export interface FundedChange { id: string; fundingSourceId: string | null; amountC: number }

export function fundingSummary(sources: FundingSourceIn[], invoices: FundedInvoice[], changes: FundedChange[], revisedContractC: number) {
  const rows = sources.map((s) => {
    const mine = invoices.filter((i) => i.fundingSourceId === s.id);
    const invoicedC = mine.reduce((a, i) => a + i.totalC, 0);
    const paidC = mine.reduce((a, i) => a + i.paidC, 0);
    const changesC = changes.filter((c) => c.fundingSourceId === s.id).reduce((a, c) => a + c.amountC, 0);
    return { id: s.id, kind: s.kind, name: s.name, approvedC: s.approvedC, invoicedC, paidC, leftC: s.approvedC - invoicedC, changesC, over: invoicedC > s.approvedC };
  });
  const known = new Set(sources.map((s) => s.id));
  const loose = invoices.filter((i) => !i.fundingSourceId || !known.has(i.fundingSourceId));
  const approvedC = sources.reduce((a, s) => a + s.approvedC, 0);
  return {
    sources: rows,
    approvedC,
    revisedContractC,
    /** Positive: contract not yet covered by approved funding. Negative: more funding than contract. */
    gapC: revisedContractC - approvedC,
    unassignedInvoicedC: loose.reduce((a, i) => a + i.totalC, 0),
    unassignedCount: loose.length,
  };
}
