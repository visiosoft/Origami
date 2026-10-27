/**
 * A contact's Activity alerts (Oct 27 backlog, Contacts):
 *  - Responsiveness: no "interested" reply to the last two RFPs; no response
 *    after an RFP closed; said interested but never submitted.
 *  - Interactions: several proposals since their last award (or none ever
 *    awarded) -- worth giving them feedback.
 *  - Pulse: no known interaction (email, call, meeting...) in 12 months.
 * Any of them moves an Active contact to Review; Review lifts once they clear.
 */
export type AlertKind = 'responsiveness' | 'interactions' | 'pulse';
export interface ContactAlert { kind: AlertKind; text: string }
export interface AlertBid { projectName?: string | null; dateReceived: string; outcome: string; dueDate?: string | null; outcomeDate?: string | null }

/** Proposals not awarded since the last award before the "give feedback" alert. */
export const FEEDBACK_AFTER = 3;
export const PULSE_MONTHS = 12;
/** Reasons the daily check writes start with this, so it knows which Reviews it may lift. */
export const ALERT_REASON_PREFIX = 'Alert: ';

const job = (b: AlertBid) => (b.projectName ? `“${b.projectName}”` : 'an RFP');
const fmt = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const monthsBefore = (now: Date, n: number) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d.toISOString(); };

export function contactAlerts(input: { bids: AlertBid[]; lastInteractionAt: string | null }, now = new Date()): ContactAlert[] {
  const today = now.toISOString().slice(0, 10);
  const out: ContactAlert[] = [];
  const rfps = [...input.bids].sort((a, b) => b.dateReceived.localeCompare(a.dateReceived));

  // Responsiveness
  const lastTwo = rfps.slice(0, 2);
  if (lastTwo.length === 2 && lastTwo.every((b) => b.outcome === 'invited' || b.outcome === 'declined')) {
    out.push({ kind: 'responsiveness', text: 'No “interested” reply to the last 2 RFPs' });
  }
  for (const b of rfps) {
    const closed = !!b.dueDate && b.dueDate.slice(0, 10) < today;
    if (closed && b.outcome === 'invited') out.push({ kind: 'responsiveness', text: `No response to ${job(b)} — it closed ${fmt(b.dueDate!)}` });
    if (closed && b.outcome === 'interested') out.push({ kind: 'responsiveness', text: `Said interested in ${job(b)} but never submitted (closed ${fmt(b.dueDate!)})` });
  }

  // Interactions: proposals without an award
  const priced = rfps.filter((b) => !['invited', 'interested', 'declined'].includes(b.outcome));
  const lastAward = priced.find((b) => b.outcome === 'awarded');
  const since = priced.filter((b) => b.outcome === 'not_awarded' && (!lastAward || b.dateReceived > lastAward.dateReceived)).length;
  if (since >= FEEDBACK_AFTER) {
    out.push({ kind: 'interactions', text: `${since} proposals ${lastAward ? 'since their last award' : 'and none awarded'} — give them feedback` });
  }

  // Pulse
  if (!input.lastInteractionAt || input.lastInteractionAt < monthsBefore(now, PULSE_MONTHS)) {
    out.push({ kind: 'pulse', text: `No known interaction in ${PULSE_MONTHS} months` });
  }
  return out;
}

/**
 * The status change the alerts call for (pulse is left to the existing 12-month
 * rule). Expired and hand-set Reviews are never touched.
 */
export function alertStatus(p: { contactStatus?: string | null; contactStatusReason?: string | null }, alerts: ContactAlert[]) {
  const cur = p.contactStatus || 'active';
  const flags = alerts.filter((a) => a.kind !== 'pulse');
  if (cur === 'active' && flags.length) return { contactStatus: 'review', contactStatusReason: (ALERT_REASON_PREFIX + flags.map((a) => a.text).join('; ')).slice(0, 300) };
  if (cur === 'review' && String(p.contactStatusReason || '').startsWith(ALERT_REASON_PREFIX) && !flags.length) return { contactStatus: 'active', contactStatusReason: null };
  return null;
}
