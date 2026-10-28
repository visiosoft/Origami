import { ALERT_REASON_PREFIX, alertStatus, contactAlerts } from './contact-alerts';

const now = new Date('2026-10-27T12:00:00Z');
const recent = '2026-10-01T00:00:00Z';
const kinds = (a: { kind: string }[]) => a.map((x) => x.kind);

describe('contact alerts', () => {
  it('responsiveness: no interested reply to the last two RFPs', () => {
    const a = contactAlerts({ bids: [{ dateReceived: '2026-09-01', outcome: 'declined' }, { dateReceived: '2026-10-01', outcome: 'invited' }, { dateReceived: '2026-01-01', outcome: 'awarded' }], lastInteractionAt: recent }, now);
    expect(a.map((x) => x.text)).toContain('No “interested” reply to the last 2 RFPs');
    expect(contactAlerts({ bids: [{ dateReceived: '2026-09-01', outcome: 'interested', dueDate: '2026-12-01' }, { dateReceived: '2026-10-01', outcome: 'invited' }], lastInteractionAt: recent }, now)).toEqual([]);
  });
  it('responsiveness: closed with no response, or interested and never submitted', () => {
    const a = contactAlerts({ bids: [
      { projectName: 'Narvaes', dateReceived: '2026-09-01', outcome: 'invited', dueDate: '2026-10-15' },
      { projectName: 'Hadland', dateReceived: '2026-09-10', outcome: 'interested', dueDate: '2026-10-20' },
      { projectName: 'Perez', dateReceived: '2026-09-12', outcome: 'interested', dueDate: '2026-11-20' },
    ], lastInteractionAt: recent }, now);
    expect(a.map((x) => x.text)).toEqual([
      'Said interested in “Hadland” but never submitted (closed Oct 20, 2026)',
      'No response to “Narvaes” — it closed Oct 15, 2026',
    ]);
  });
  it('interactions: three proposals without an award', () => {
    const lost = (d: string) => ({ dateReceived: d, outcome: 'not_awarded' });
    expect(contactAlerts({ bids: [lost('2026-01-01'), lost('2026-02-01'), lost('2026-03-01')], lastInteractionAt: recent }, now)[0].text).toBe('3 proposals and none awarded — give them feedback');
    expect(contactAlerts({ bids: [lost('2026-01-01'), { dateReceived: '2026-02-01', outcome: 'awarded' }, lost('2026-03-01'), lost('2026-04-01')], lastInteractionAt: recent }, now)).toEqual([]);
  });
  it('pulse: nothing in 12 months', () => {
    expect(kinds(contactAlerts({ bids: [], lastInteractionAt: '2025-09-01T00:00:00Z' }, now))).toEqual(['pulse']);
    expect(kinds(contactAlerts({ bids: [], lastInteractionAt: null }, now))).toEqual(['pulse']);
  });
  it('status: alerts move Active to Review and lift their own Review; pulse and hand-set reviews are left alone', () => {
    const resp = [{ kind: 'responsiveness' as const, text: 'No response' }];
    expect(alertStatus({ contactStatus: 'active' }, resp)).toEqual({ contactStatus: 'review', contactStatusReason: ALERT_REASON_PREFIX + 'No response' });
    expect(alertStatus({ contactStatus: 'review', contactStatusReason: ALERT_REASON_PREFIX + 'x' }, [])).toEqual({ contactStatus: 'active', contactStatusReason: null });
    expect(alertStatus({ contactStatus: 'review', contactStatusReason: 'Checking insurance' }, [])).toBeNull();
    expect(alertStatus({ contactStatus: 'active' }, [{ kind: 'pulse', text: 'p' }])).toBeNull();
    expect(alertStatus({ contactStatus: 'expired' }, resp)).toBeNull();
  });
});
