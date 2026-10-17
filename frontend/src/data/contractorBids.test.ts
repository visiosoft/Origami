import { describe, expect, it } from 'vitest';
import { bidSummary, owedAJob } from './contractorBids';

const s = (o: Partial<Parameters<typeof bidSummary>[0]> = {}) => ({ received: 0, projects: 0, awarded: 0, notAwarded: 0, pending: 0, sinceLastAward: 0, lastBidAt: null, lastAwardAt: null, winRate: null, ...o });
describe('contractor bids', () => {
  it('summarises', () => {
    expect(bidSummary(s())).toBe('No estimates on record');
    expect(bidSummary(s({ received: 6, awarded: 1, sinceLastAward: 4 }))).toBe('6 estimates · 1 awarded · 4 since the last award');
    expect(bidSummary(s({ received: 3, sinceLastAward: 3 }))).toBe('3 estimates · 0 awarded · 3 without an award');
  });
  it('flags subs owed a job', () => {
    expect(owedAJob(s({ sinceLastAward: 2 }))).toBe(false);
    expect(owedAJob(s({ sinceLastAward: 3 }))).toBe(true);
  });
});
