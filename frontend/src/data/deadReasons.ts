/**
 * Why a lead died (Oct 26 review notes). Cold / Lost holds Cold (the talking
 * stopped) or Lost (the client turned our offer down); Cancelled / Pass holds
 * Cancelled (called off, by anyone) or Pass (we walked away, without referring
 * it). Each has its own reasons; Cancelled's come in groups with sub-reasons.
 * Mirrors backend pipeline/dead-leads.ts (keep the two lists the same).
 */
export type DeadKind = 'cold' | 'lost' | 'cancelled' | 'pass';
export interface DeadReasonOption { code: string; label: string; hint?: string; subs?: { code: string; label: string }[] }
export const DEAD_KINDS: Record<DeadKind, { stage: 'cold' | 'rejected'; label: string; hint: string; single?: boolean; reasons: DeadReasonOption[] }> = {
  cold: {
    stage: 'cold', label: 'Cold', hint: 'Conversations ceased', single: true,
    reasons: [
      { code: 'ours', label: 'Ours', hint: 'Internal lack of correspondence or communication with the potential client' },
      { code: 'theirs', label: 'Theirs', hint: 'The potential client no longer responds to us' },
    ],
  },
  lost: {
    stage: 'cold', label: 'Lost', hint: 'Client rejected our offer',
    reasons: [
      { code: 'unclear', label: 'Unclear', hint: 'Went with someone else, no other feedback' },
      { code: 'value', label: 'Value', hint: 'We failed to present a viable value proposition (price deemed too high)' },
      { code: 'experience', label: 'Experience', hint: 'We failed to show experience' },
      { code: 'reputation', label: 'Reputation', hint: 'A bad review -- say where it was found; a task is made to follow it up' },
      { code: 'trust', label: 'Trust', hint: 'Unable to feel they trust us, or no personal fit' },
      { code: 'quality', label: 'Quality', hint: 'Past and current work showed a mismatch with their craftsmanship expectations' },
      { code: 'timeline', label: 'Timeline', hint: 'The schedule felt too long, or we couldn’t justify it' },
    ],
  },
  cancelled: {
    stage: 'rejected', label: 'Cancelled', hint: 'The lead or job was cancelled (by anyone)',
    reasons: [
      { code: 'budget', label: 'Financial and budget pressure', subs: [
        { code: 'bids_over', label: 'Estimates came in lower than real bids, or developed designs priced over budget' },
        { code: 'unrealistic', label: 'Client had unrealistic expectations of requirements' },
      ] },
      { code: 'funding', label: 'Funding and financial failure', subs: [
        { code: 'interest', label: 'Increased interest rate' },
        { code: 'lender', label: 'Lender denied the loan' },
        { code: 'investor', label: 'Investor backed out' },
        { code: 'pencil', label: 'Project did not “pencil out”' },
      ] },
      { code: 'legal', label: 'Legal roadblocks', subs: [
        { code: 'zoning', label: 'Zoning' }, { code: 'permitting', label: 'Permitting' }, { code: 'other_legal', label: 'Other legal' },
      ] },
      { code: 'site', label: 'Unfavorable site conditions', subs: [
        { code: 'toxic', label: 'Toxic contamination' }, { code: 'debris', label: 'Undocumented debris' },
        { code: 'water', label: 'High water tables' }, { code: 'bedrock', label: 'Unstable bedrock' },
      ] },
      { code: 'market', label: 'Market and economic shifts', subs: [
        { code: 'demand', label: 'Stale or drop in demand' }, { code: 'pencil', label: 'Project does not “pencil out”' },
        { code: 'materials', label: 'Unexpected spikes in the cost of essential materials' },
      ] },
      { code: 'other', label: 'Other', subs: [{ code: 'force_majeure', label: 'Force majeure' }, { code: 'dispute', label: 'Client dispute' }] },
    ],
  },
  pass: {
    stage: 'rejected', label: 'Pass', hint: 'We are passing on the client/job and not referring it out',
    reasons: [
      { code: 'score', label: 'Client score too low' },
      { code: 'bandwidth', label: 'We do not have enough bandwidth' },
      { code: 'cash', label: 'We do not have enough cash flow' },
      { code: 'small', label: 'It is too small' },
      { code: 'big', label: 'It is too big' },
      { code: 'scope', label: 'It is a scope we do not want to do' },
    ],
  },
};

/** What a dead lead carries: which kind, the picked reason codes ("value", or "funding.lender" for a sub-reason), notes. */
export interface DeadReason {
  kind: DeadKind;
  reasons: string[];
  note?: string;
  /** Cold: the last known conversation date (YYYY-MM-DD). */
  lastContactAt?: string;
  /** Lost for Reputation: where the bad review was found. */
  reviewWhere?: string;
  /** Pass: the client score at the time, if we had one. */
  clientScore?: string;
  at?: string;
  by?: string;
}

/** Labels for the picked codes, in list order ("Funding and financial failure: Lender denied the loan"). */
export function deadReasonLabels(kind: DeadKind, codes: string[]): string[] {
  const out: string[] = [];
  for (const r of DEAD_KINDS[kind].reasons) {
    if (codes.includes(r.code)) out.push(r.label);
    for (const s of r.subs || []) if (codes.includes(`${r.code}.${s.code}`)) out.push(`${r.label}: ${s.label}`);
  }
  return out;
}

/** Which kinds belong to a dead stage: Cold / Lost or Cancelled / Pass. */
export const KINDS_FOR_STAGE: Record<'cold' | 'rejected', DeadKind[]> = { cold: ['cold', 'lost'], rejected: ['cancelled', 'pass'] };

/** What's still missing before it can be saved, or '' when it's complete (same rules as the server). */
export function deadReasonMissing(r: DeadReason): string {
  const def = DEAD_KINDS[r.kind];
  if (!r.reasons.length) return `Pick at least one reason it was ${def.label.toLowerCase()}.`;
  if (def.single && r.reasons.length > 1) return 'Pick one reason.';
  if (r.kind === 'cold' && !/^\d{4}-\d{2}-\d{2}$/.test(r.lastContactAt || '')) return 'Add the last known conversation date.';
  if (r.kind === 'lost' && r.reasons.includes('reputation') && !(r.reviewWhere || '').trim()) return 'Say where the bad review was found.';
  return '';
}
