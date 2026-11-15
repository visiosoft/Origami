/**
 * Sub invoices (Batch 6): the line items a sub bills through the portal,
 * with retention held on each invoice and California lien releases the sub
 * uploads. Pure, so it can be tested without a database.
 *
 *   - Each invoice holds back retention (the subcontract's %, else 10%):
 *     gross − retention = net payable.
 *   - It can't be paid until a CONDITIONAL release is on file and checked
 *     (its kind marked by the bookkeeper). After payment it waits for the
 *     UNCONDITIONAL release.
 *   - The retention held on a subcontract is paid out once, against a
 *     conditional FINAL release; then it waits for the unconditional final.
 */
export const RELEASE_KINDS = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'] as const;
export type ReleaseKind = (typeof RELEASE_KINDS)[number];
export const RELEASE_LABEL: Record<ReleaseKind, string> = {
  conditional_progress: 'Conditional — progress payment',
  unconditional_progress: 'Unconditional — progress payment',
  conditional_final: 'Conditional — final payment',
  unconditional_final: 'Unconditional — final payment',
};
export const DEFAULT_RETENTION_PCT = 10;

export interface ReleaseLike { kind: string | null; checkedAt: string | null }
const checked = (rs: ReleaseLike[], kinds: string[]) => rs.some((r) => !!r.checkedAt && !!r.kind && kinds.includes(r.kind));

/** Gross, retention and net of an invoice's live lines, in cents. */
export function invoiceFigures(amountsC: number[], retentionPct: number | null | undefined) {
  const grossC = amountsC.reduce((a, b) => a + b, 0);
  const pct = retentionPct == null ? DEFAULT_RETENTION_PCT : Math.max(0, Math.min(100, Number(retentionPct) || 0));
  const retentionC = Math.round((grossC * pct) / 100);
  return { grossC, retentionC, netC: grossC - retentionC, pct };
}

/** Why the invoice can't be paid yet (null = it can). */
export function payBlock(releases: ReleaseLike[]): string | null {
  if (checked(releases, ['conditional_progress', 'conditional_final'])) return null;
  if (releases.some((r) => !r.checkedAt)) return 'A lien release is waiting for you to mark its type.';
  return 'Waiting for the sub’s conditional lien release.';
}

/** After payment: still waiting for the unconditional release? */
export const unconditionalWaiting = (paid: boolean, releases: ReleaseLike[]) => paid && !checked(releases, ['unconditional_progress', 'unconditional_final']);

/** Why the retention held can't be paid out yet (null = it can). */
export function retentionBlock(heldC: number, finalReleases: ReleaseLike[], alreadyPaid: boolean): string | null {
  if (alreadyPaid) return 'The retention has already been paid.';
  if (heldC <= 0) return 'No retention is held on this subcontract.';
  if (!checked(finalReleases, ['conditional_final'])) return 'Waiting for the sub’s conditional final lien release.';
  return null;
}

export const isReleaseKind = (k: unknown): k is ReleaseKind => (RELEASE_KINDS as readonly string[]).includes(String(k));
