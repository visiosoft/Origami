/** A subcontractor's estimate: what they priced, for which job, and whether they got it. */
export type BidOutcome = 'invited' | 'interested' | 'pending' | 'awarded' | 'not_awarded' | 'withdrawn' | 'declined';
export interface ContractorBid {
  id: string; contractorId: string; projectId: number | null; projectName: string; tradeId?: string | null; scope?: string;
  dateReceived: string; amount: number | null; outcome: BidOutcome; outcomeDate?: string | null; notes?: string;
  /** When the RFP closes (bids due). */
  dueDate?: string | null;
  createdByName?: string; createdAt: string; updatedAt?: string;
}
export interface BidStats {
  received: number; projects: number; awarded: number; notAwarded: number; pending: number;
  /** Not-awarded estimates since their last award -- how long they've gone without a job. */
  sinceLastAward: number; lastBidAt: string | null; lastAwardAt: string | null; winRate: number | null;
}

/** Invited = RFP sent, no reply; Interested = said they'd bid, no price yet; Pending = price in, awaiting a decision. */
export const BID_OUTCOMES: [BidOutcome, string, 'grey' | 'green' | 'red' | 'amber'][] = [
  ['invited', 'RFP sent — no reply', 'grey'], ['interested', 'Interested — not submitted', 'amber'], ['pending', 'Submitted — pending', 'amber'], ['awarded', 'Awarded', 'green'], ['not_awarded', 'Not awarded', 'red'],
  ['withdrawn', 'Withdrawn', 'grey'], ['declined', 'Declined to bid', 'grey'],
];
export const outcomeLabel = (o: string) => (BID_OUTCOMES.find(([k]) => k === o) || BID_OUTCOMES[2])[1];

/** This many estimates in a row without a job and the sub is flagged "owed a job". */
export const OWED_A_JOB = 3;
export const owedAJob = (s?: BidStats | null) => !!s && s.sinceLastAward >= OWED_A_JOB;

/** "6 estimates · 1 awarded · 4 since the last award" */
export function bidSummary(s?: BidStats | null): string {
  if (!s || !s.received) return 'No estimates on record';
  return [
    `${s.received} estimate${s.received === 1 ? '' : 's'}`,
    `${s.awarded} awarded`,
    s.sinceLastAward ? `${s.sinceLastAward} ${s.awarded ? 'since the last award' : 'without an award'}` : '',
  ].filter(Boolean).join(' · ');
}
