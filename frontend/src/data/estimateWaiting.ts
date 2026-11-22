import { todayISO } from './localDate';

/**
 * Nov 17 (Edward): a timer on estimates waiting on the client -- "Sent, 9 days"
 * in amber after a week -- shown in Estimating only, not on the dashboard.
 */
export const WAIT_WARN_DAYS = 7;

export function estimateWaiting(r: { status: string; sentAt?: string | null }, today = todayISO()): { label: string; days: number | null; late: boolean } {
  if (r.status !== 'sent' || !r.sentAt) return { label: r.status === 'accepted' ? 'Accepted' : r.status === 'superseded' ? 'Replaced' : r.status === 'sent' ? 'Shared' : 'Draft', days: null, late: false };
  const sent = String(r.sentAt).slice(0, 10);
  const days = Math.max(0, Math.round((new Date(today + 'T12:00:00').getTime() - new Date(sent + 'T12:00:00').getTime()) / 86400000));
  return { label: days === 0 ? 'Shared today' : `Shared · waiting ${days} day${days === 1 ? '' : 's'}`, days, late: days > WAIT_WARN_DAYS };
}
