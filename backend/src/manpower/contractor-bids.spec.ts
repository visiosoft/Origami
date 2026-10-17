import { bidStats, cleanBid } from './contractor-bids';

const b = (dateReceived: string, outcome: string, projectId: number | null = 1, extra: any = {}) => ({ dateReceived, outcome, projectId, ...extra });

describe('contractor bids', () => {
  it('counts the run of estimates since the last award', () => {
    const s = bidStats([
      b('2026-01-10', 'not_awarded', 1), b('2026-02-01', 'awarded', 2, { outcomeDate: '2026-03-01' }),
      b('2026-03-10', 'not_awarded', 3), b('2026-04-10', 'not_awarded', 4), b('2026-05-10', 'pending', 5),
      b('2026-06-10', 'declined', 6), b('2026-06-11', 'withdrawn', 7),
    ]);
    expect(s).toMatchObject({ received: 6, projects: 6, awarded: 1, notAwarded: 3, pending: 1, sinceLastAward: 2, lastAwardAt: '2026-03-01', lastBidAt: '2026-06-11', winRate: 25 });
  });
  it('never awarded: every not-awarded estimate counts', () => {
    expect(bidStats([b('2026-01-01', 'not_awarded', null, { projectName: 'Smith house' }), b('2026-02-01', 'not_awarded', null, { projectName: 'smith house ' })]))
      .toMatchObject({ sinceLastAward: 2, projects: 1, winRate: 0 });
    expect(bidStats([])).toMatchObject({ received: 0, sinceLastAward: 0, winRate: null, lastBidAt: null });
  });
  it('validates an estimate', () => {
    expect(() => cleanBid({ dateReceived: '2026-01-01' })).toThrow(/project/);
    expect(() => cleanBid({ projectId: 1 })).toThrow(/date/);
    expect(() => cleanBid({ projectId: 1, dateReceived: '2026-01-01', outcome: 'won' })).toThrow(/outcome/);
    expect(cleanBid({ projectId: '3', dateReceived: '2026-01-01', amount: '$12,500.50' })).toMatchObject({ projectId: 3, amount: 12500.5, outcome: 'pending' });
    expect(cleanBid({ outcome: 'awarded' }, true)).toEqual({ outcome: 'awarded' });
  });
});
