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

/** Delivery types the chart filters by (CONTRACT_TYPES in projectTypes.ts). */
export const DELIVERY_CODES = ['DO', 'BO', 'DB', 'PDB'] as const;
export type DeliveryCode = (typeof DELIVERY_CODES)[number];

/**
 * A project's delivery type from its Contract Type: "Design Build (DB)", "DB",
 * or older free text like "Design + Build" / "Build". Blank when it's none of
 * them (T&M, Consulting, unset).
 */
export function deliveryCode(contractType: string | null | undefined): DeliveryCode | '' {
  const v = String(contractType || '').trim();
  const code = /\(([A-Z]{2,3})\)\s*$/.exec(v)?.[1] || v.toUpperCase();
  if ((DELIVERY_CODES as readonly string[]).includes(code)) return code as DeliveryCode;
  const t = v.toLowerCase();
  if (t.includes('progressive')) return 'PDB';
  if (/design\s*(\+|&|and|-|\/)?\s*build/.test(t)) return 'DB';
  if (/design\s*only/.test(t) || t === 'design') return 'DO';
  if (/build\s*only/.test(t) || t === 'build') return 'BO';
  return '';
}

export interface ProjectBar {
  projectId: number; name: string; stage?: string;
  /** Original contract, approved change orders, approved reimbursables: the bar's three sections. */
  base: number; co: number; reimb: number; total: number;
  /** Contract work billed (across contract + change orders) and reimbursables billed. */
  billed: number; reimbBilled: number; paid: number;
  /** Billed as a % of the total ("$ Used"); costs spent as a % of the total, null without cost access. */
  dollarPct: number; spentPct: number | null; spent: number | null;
  timePct: number | null;
  /** $ used 90%+ or time 25+ points ahead of it (the Classic chart's rule); spentHot is the same rule on costs. */
  hot: boolean; spentHot: boolean;
  delivery: DeliveryCode | ''; pricing: string; labor: string;
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const isHot = (used: number, time: number | null) => used >= 90 || (time != null && time - used >= 25);

/** Projects with a client contract, biggest first: contract, change orders and reimbursables against what's billed, spent and the time used. */
export function projectBars(portfolio: any[], projects: { id: number; estStart?: string; duration?: string; contractType?: string; pricing?: string | null; labor?: string | null }[], today = new Date()): ProjectBar[] {
  return (portfolio || []).filter((r) => r.hasClientContract && Number(r.revisedContract) + Number(r.reimbursablesApproved || 0) > 0).map((r) => {
    const p = projects.find((x) => x.id === r.projectId);
    const base = Math.max(0, Number(r.originalContract ?? r.revisedContract) || 0);
    const co = Math.max(0, (Number(r.revisedContract) || 0) - base);
    const reimbBilled = Math.max(0, Number(r.reimbursablesBilled) || 0);
    // Billed reimbursables were approved first; older data may only have the billed figure.
    const reimb = Math.max(Number(r.reimbursablesApproved) || 0, reimbBilled);
    const total = base + co + reimb;
    const billed = Math.max(0, Number(r.contractWorkInvoiced) || 0);
    const timePct = p ? timeUsedPct(p.estStart, p.duration, today) : null;
    const dollarPct = pct(billed + reimbBilled, total);
    const spent = r.costToDate == null ? null : Math.max(0, Number(r.costToDate) || 0);
    const spentPct = spent == null ? null : pct(spent, total);
    return {
      projectId: r.projectId, name: r.name, stage: r.stage,
      base, co, reimb, total, billed, reimbBilled, paid: Math.max(0, Number(r.paid) || 0),
      dollarPct, spentPct, spent, timePct,
      hot: isHot(dollarPct, timePct), spentHot: spentPct != null && isHot(spentPct, timePct),
      delivery: deliveryCode(r.contractType ?? p?.contractType), pricing: String(r.pricing ?? p?.pricing ?? ''), labor: String(r.labor ?? p?.labor ?? ''),
    };
  }).sort((a, b) => b.total - a.total);
}

/** How a bar's fill splits across its sections (each 0-100, as a % of the whole bar). */
export function barFill(b: Pick<ProjectBar, 'base' | 'co' | 'reimb' | 'total' | 'billed' | 'reimbBilled'>) {
  const w = (n: number) => (b.total > 0 ? (n / b.total) * 100 : 0);
  const contract = Math.min(b.billed, b.base + b.co);
  return {
    base: w(b.base), co: w(b.co), reimb: w(b.reimb),
    baseFill: w(Math.min(contract, b.base)), coFill: w(Math.max(0, contract - b.base)), reimbFill: w(Math.min(b.reimbBilled, b.reimb)),
  };
}

/** Money axis: 0 up to a round top at or above the biggest bar, in 4 even round steps. */
export function axisTicks(max: number, steps = 4) {
  const raw = Math.max(max, 1) / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * mag).find((s) => s >= raw) || 10 * mag;
  return Array.from({ length: steps + 1 }, (_, i) => ({ f: i / steps, value: step * i }));
}

/** Round axis top for the monthly chart. */
export function axisTop(max: number) {
  if (max <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => Math.ceil(max / s) <= 5) || 10 * mag;
  return Math.ceil(max / step) * step;
}
