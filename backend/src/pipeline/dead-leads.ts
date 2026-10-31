/**
 * Dead leads (Oct 27 sync): Cold / Lost and Cancelled / Pass leads leave the
 * board on their own 7 business days after landing there, and a lost lead says
 * why -- the reasons feed marketing and training later. Leads on hold stay put.
 */
export const DEAD_STAGES = ['cold', 'rejected'];

export const LOSS_REASONS = ['Value proposition', 'Experience', 'Trust', 'Quality', 'Timeline', 'Other'] as const;

export const ARCHIVE_AFTER_BUSINESS_DAYS = 7;

/**
 * The day this rule shipped. The clock for a lead already sitting dead starts
 * here rather than when it got there, so nothing is archived the moment the
 * rule goes live -- everyone gets the same 7 business days to rescue a lead.
 */
export const RULE_START = '2026-10-28T00:00:00.000Z';

/** `days` working days (Mon-Fri) after `from`. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export interface DeadLeadLike { stage: string; stageEnteredAt?: string | null; archived?: boolean | null; convertedProjectId?: number | null }

/** When a dead lead leaves the board, or null if it isn't a dead lead. */
export function archiveDueAt(deal: DeadLeadLike): Date | null {
  if (!DEAD_STAGES.includes(deal.stage) || deal.archived || deal.convertedProjectId) return null;
  const entered = Date.parse(deal.stageEnteredAt || '');
  const start = Math.max(Number.isNaN(entered) ? 0 : entered, Date.parse(RULE_START));
  return addBusinessDays(new Date(start), ARCHIVE_AFTER_BUSINESS_DAYS);
}

export const isDueForArchive = (deal: DeadLeadLike, now: Date = new Date()) => {
  const due = archiveDueAt(deal);
  return !!due && due.getTime() <= now.getTime();
};

/** A known reason, or null. */
export function cleanLossReason(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  return LOSS_REASONS.find((r) => r.toLowerCase() === s) ?? null;
}

/**
 * Why a lead died (Oct 26 review notes). Cold / Lost holds Cold (the talking
 * stopped) or Lost (the client turned our offer down); Cancelled / Pass holds
 * Cancelled (called off, by anyone) or Pass (we walked away, without referring
 * it). Each has its own reasons; Cancelled's come in groups with sub-reasons.
 * The browser has the same list in data/deadReasons.ts.
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

/** Checks and tidies what the browser sent; the message says what's missing. */
export function cleanDeadReason(raw: any): { ok: true; value: DeadReason } | { ok: false; message: string } {
  const kind = String(raw?.kind || '') as DeadKind;
  const def = DEAD_KINDS[kind];
  if (!def) return { ok: false, message: 'Say whether it went cold, was lost, was cancelled, or we passed.' };
  const known = new Set(def.reasons.flatMap((r) => [r.code, ...(r.subs || []).map((s) => `${r.code}.${s.code}`)]));
  const reasons = [...new Set((Array.isArray(raw?.reasons) ? raw.reasons : []).map(String).filter((c: string) => known.has(c)))] as string[];
  if (!reasons.length) return { ok: false, message: `Pick at least one reason it was ${def.label.toLowerCase()}.` };
  if (def.single && reasons.length > 1) return { ok: false, message: `Pick one reason it went ${def.label.toLowerCase()}.` };
  const note = String(raw?.note || '').trim().slice(0, 4000);
  const value: DeadReason = { kind, reasons, ...(note ? { note } : {}) };
  if (kind === 'cold') {
    const d = String(raw?.lastContactAt || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, message: 'Add the last known conversation date.' };
    value.lastContactAt = d;
  }
  if (kind === 'lost' && reasons.includes('reputation')) {
    const where = String(raw?.reviewWhere || '').trim().slice(0, 500);
    if (!where) return { ok: false, message: 'Say where the bad review was found.' };
    value.reviewWhere = where;
  }
  if (kind === 'pass' && raw?.clientScore != null && String(raw.clientScore).trim()) value.clientScore = String(raw.clientScore).trim().slice(0, 40);
  return { ok: true, value };
}

/** One line for the timeline and the card badge: "Lost — Value, Timeline: went with a cheaper builder". */
export function deadReasonSummary(r: DeadReason): string {
  const labels = deadReasonLabels(r.kind, r.reasons);
  return `${DEAD_KINDS[r.kind].label} — ${labels.join('; ')}${r.note ? `: ${r.note}` : ''}`;
}
