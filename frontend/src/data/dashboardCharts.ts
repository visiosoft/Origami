/**
 * The New-look dashboard charts (Oct 2026), on live figures: invoiced vs
 * collected by month (/finance/billing) and each project's contract, billing
 * and time used (/finance/portfolio + the project's start and duration).
 */
export interface BillingMonth {
  month: string; invoiced: number; collected: number; pastDue: number; withinTerms: number; retention: number;
  open: { id: string; number: string; projectId: number; project: string; dueDate: string | null; unpaid: number; pastDue: boolean }[];
}

/** "8 months", "12 wks", "1.5 years", "90 days" -> days; null when it can't be read. */
export function durationDays(raw: string | null | undefined): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(d|day|days|w|wk|wks|week|weeks|m|mo|mos|month|months|y|yr|yrs|year|years)\b/i.exec(String(raw || ''));
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  return Math.round(n * (u.startsWith('d') ? 1 : u.startsWith('w') ? 7 : u.startsWith('y') ? 365 : 30.44));
}

/** How much of the planned time has gone (0-100), from the start date and duration; null without both. */
export function timeUsedPct(start: string | null | undefined, duration: string | null | undefined, today = new Date()): number | null {
  const s = /^\d{4}-\d{2}-\d{2}/.test(String(start || '')) ? new Date(String(start).slice(0, 10) + 'T12:00:00') : null;
  const days = durationDays(duration);
  if (!s || !days) return null;
  const used = (today.getTime() - s.getTime()) / 86400000;
  return Math.max(0, Math.min(100, Math.round((used / days) * 100)));
}

export interface ProjectBar { projectId: number; name: string; stage?: string; contract: number; billed: number; paid: number; billedPct: number; paidPct: number; timePct: number | null; behind: boolean }

/** Projects with a client contract, biggest first: billed and paid against contract, and time used. */
export function projectBars(portfolio: any[], projects: { id: number; estStart?: string; duration?: string }[], today = new Date()): ProjectBar[] {
  return (portfolio || []).filter((r) => r.hasClientContract && Number(r.revisedContract) > 0).map((r) => {
    const contract = Number(r.revisedContract) || 0;
    const billed = Number(r.contractWorkInvoiced) || 0;
    const paid = Math.min(Number(r.paid) || 0, billed);
    const p = projects.find((x) => x.id === r.projectId);
    const timePct = p ? timeUsedPct(p.estStart, p.duration, today) : null;
    const billedPct = Math.round((billed / contract) * 100);
    return {
      projectId: r.projectId, name: r.name, stage: r.stage, contract, billed, paid, billedPct, paidPct: Math.round((paid / contract) * 100), timePct,
      // Time running well ahead of billing: work done but not billed, or a slipping job.
      behind: timePct != null && timePct - billedPct >= 25,
    };
  }).sort((a, b) => b.contract - a.contract);
}

/** Round axis top for the monthly chart. */
export function axisTop(max: number) {
  if (max <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => Math.ceil(max / s) <= 5) || 10 * mag;
  return Math.ceil(max / step) * step;
}
