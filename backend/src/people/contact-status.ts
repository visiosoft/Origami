/** Contact statuses (Oct 16): Active, Review (12 months without activity, or by hand), Expired (by hand). */
export const CONTACT_STATUSES = ['active', 'review', 'expired'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const REVIEW_AFTER_MONTHS = 12;
/** The reason the daily check writes; a Review set by a person keeps theirs and isn't lifted automatically. */
export const AUTO_REVIEW_REASON = `No activity in ${REVIEW_AFTER_MONTHS} months`;

export const statusOf = (p: { contactStatus?: string | null }): ContactStatus =>
  (CONTACT_STATUSES as readonly string[]).includes(String(p.contactStatus)) ? (p.contactStatus as ContactStatus) : 'active';

/** The date `months` before `now`, as an ISO timestamp. */
export const monthsBefore = (now: Date, months: number) => { const d = new Date(now); d.setMonth(d.getMonth() - months); return d.toISOString(); };

/** A loose date ("2025-03-04", an ISO timestamp) or null for text like "Added today". */
export const asDate = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

/**
 * What the daily check does to one contact, given the latest activity it found.
 * Expired is never touched; an automatic Review lifts when there's new activity.
 */
export function nextContactStatus(
  p: { contactStatus?: string | null; contactStatusReason?: string | null; contactStatusAt?: string | null },
  lastActivity: string | null, now: Date,
): { contactStatus: ContactStatus; contactStatusReason: string | null } | null {
  const cur = statusOf(p);
  if (cur === 'expired' || !lastActivity) return null;
  const stale = lastActivity < monthsBefore(now, REVIEW_AFTER_MONTHS);
  if (cur === 'active' && stale) return { contactStatus: 'review', contactStatusReason: AUTO_REVIEW_REASON };
  if (cur === 'review' && !stale && p.contactStatusReason === AUTO_REVIEW_REASON && (!p.contactStatusAt || lastActivity > p.contactStatusAt)) {
    return { contactStatus: 'active', contactStatusReason: null };
  }
  return null;
}
