import { BadRequestException } from '@nestjs/common';

/**
 * Where an RFP / estimate stands. "Invited" = RFP sent, no reply yet;
 * "Interested" = they said they'd bid but haven't sent a price; "Pending" =
 * price in, awaiting our decision; "Declined" = asked to bid and didn't.
 */
export const BID_OUTCOMES = ['invited', 'interested', 'pending', 'awarded', 'not_awarded', 'withdrawn', 'declined'] as const;
/** Not an estimate (yet): no price came in. */
export const NOT_PRICED = ['invited', 'interested', 'declined'];
export type BidOutcome = (typeof BID_OUTCOMES)[number];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface BidLike {
  projectId?: number | null; projectName?: string | null; dateReceived: string; outcome: string; outcomeDate?: string | null; amount?: number | null;
  /** When the RFP closes (bids due). */
  dueDate?: string | null;
}

export interface BidStats {
  /** Estimates sent (not counting ones they declined to price). */
  received: number;
  /** Distinct projects they bid on. */
  projects: number;
  awarded: number;
  notAwarded: number;
  pending: number;
  /** Estimates not awarded since their last award (all of them, if never awarded) -- how long they've gone without a job. */
  sinceLastAward: number;
  lastBidAt: string | null;
  lastAwardAt: string | null;
  /** Awarded out of decided (awarded + not awarded), 0-100; null before any decision. */
  winRate: number | null;
}

/** Validate an estimate as sent (create, or a patch when `partial`). */
export function cleanBid(dto: any, partial = false) {
  const out: Record<string, any> = {};
  const has = (k: string) => dto && dto[k] !== undefined;
  if (has('projectId')) out.projectId = dto.projectId === null || dto.projectId === '' ? null : Number(dto.projectId);
  if (out.projectId != null && !Number.isInteger(out.projectId)) throw new BadRequestException('Pick a project.');
  if (has('projectName')) out.projectName = String(dto.projectName || '').trim().slice(0, 200);
  if (!partial && out.projectId == null && !out.projectName) throw new BadRequestException('Pick the project, or type its name.');
  if (has('tradeId')) out.tradeId = dto.tradeId ? String(dto.tradeId) : null;
  if (has('scope')) out.scope = String(dto.scope || '').trim().slice(0, 2000);
  if (has('notes')) out.notes = String(dto.notes || '').trim().slice(0, 4000);
  if (has('dateReceived') || !partial) {
    const d = String(dto?.dateReceived || '').slice(0, 10);
    if (!ISO.test(d)) throw new BadRequestException('Give the date the estimate came in.');
    out.dateReceived = d;
  }
  if (has('amount')) {
    if (dto.amount === null || dto.amount === '') out.amount = null;
    else {
      const n = Number(String(dto.amount).replace(/[$,\s]/g, ''));
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('The amount must be a number.');
      out.amount = Math.round(n * 100) / 100;
    }
  }
  if (has('outcome') || !partial) {
    const o = String(dto?.outcome || 'pending');
    if (!(BID_OUTCOMES as readonly string[]).includes(o)) throw new BadRequestException('Unknown outcome.');
    out.outcome = o;
  }
  if (has('dueDate')) {
    const d = String(dto.dueDate || '').slice(0, 10);
    if (d && !ISO.test(d)) throw new BadRequestException('The bid due date is not a date.');
    out.dueDate = d || null;
  }
  if (has('outcomeDate')) {
    const d = String(dto.outcomeDate || '').slice(0, 10);
    if (d && !ISO.test(d)) throw new BadRequestException('The decision date is not a date.');
    out.outcomeDate = d || null;
  }
  return out;
}

export function bidStats(bids: BidLike[]): BidStats {
  const priced = bids.filter((b) => !NOT_PRICED.includes(b.outcome));
  const when = (b: BidLike) => b.outcomeDate || b.dateReceived;
  const awards = priced.filter((b) => b.outcome === 'awarded');
  const lastAwardAt = awards.reduce<string | null>((m, b) => (!m || when(b) > m ? when(b) : m), null);
  const notAwarded = priced.filter((b) => b.outcome === 'not_awarded');
  const projects = new Set(priced.map((b) => (b.projectId != null ? `#${b.projectId}` : String(b.projectName || '').trim().toLowerCase())).filter(Boolean));
  const decided = awards.length + notAwarded.length;
  return {
    received: priced.length,
    projects: projects.size,
    awarded: awards.length,
    notAwarded: notAwarded.length,
    pending: priced.filter((b) => b.outcome === 'pending').length,
    sinceLastAward: notAwarded.filter((b) => !lastAwardAt || b.dateReceived > lastAwardAt || (b.dateReceived === lastAwardAt && when(b) > lastAwardAt)).length,
    lastBidAt: priced.reduce<string | null>((m, b) => (!m || b.dateReceived > m ? b.dateReceived : m), null),
    lastAwardAt,
    winRate: decided ? Math.round((awards.length / decided) * 100) : null,
  };
}
