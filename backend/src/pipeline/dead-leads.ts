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
