import { AUTO_REVIEW_REASON, nextContactStatus } from './contact-status';
import { ContactStatusService } from './contact-status.service';

const now = new Date('2026-10-17T12:00:00Z');

describe('contact status rule', () => {
  it('an active contact quiet for 12 months goes to Review; recent activity keeps it Active', () => {
    expect(nextContactStatus({ contactStatus: 'active' }, '2025-10-01T00:00:00Z', now)).toEqual({ contactStatus: 'review', contactStatusReason: AUTO_REVIEW_REASON });
    expect(nextContactStatus({ contactStatus: 'active' }, '2026-01-01T00:00:00Z', now)).toBeNull();
  });
  it('Expired is left alone; an automatic Review lifts with new activity, a hand-set one does not', () => {
    expect(nextContactStatus({ contactStatus: 'expired' }, '2020-01-01T00:00:00Z', now)).toBeNull();
    expect(nextContactStatus({ contactStatus: 'review', contactStatusReason: AUTO_REVIEW_REASON, contactStatusAt: '2026-05-01T00:00:00Z' }, '2026-10-01T00:00:00Z', now))
      .toEqual({ contactStatus: 'active', contactStatusReason: null });
    expect(nextContactStatus({ contactStatus: 'review', contactStatusReason: 'RFP never answered', contactStatusAt: '2026-05-01T00:00:00Z' }, '2026-10-01T00:00:00Z', now)).toBeNull();
  });
});

describe('daily contact check', () => {
  const table = (rows: any[]) => ({ rows, find: jest.fn(async () => rows.map((r) => ({ ...r }))), save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); rows[i] = { ...x }; return x; }) }) as any;
  it('finds activity on tasks and file shares, and starts the clock for contacts with none', async () => {
    const people = table([
      { id: 1, name: 'Old Sub', email: 'old@sub.com', since: '2023-01-01', lastActivityAt: '2024-01-01T00:00:00Z' },
      { id: 2, name: 'Kai Lono', email: 'kai@x.com', userId: 'U-2', since: '2023-01-01', lastActivityAt: '2024-01-01T00:00:00Z' },
      { id: 3, name: 'Drawings Guy', email: 'arch@firm.com', since: 'Added today' },
      { id: 4, name: 'Gone', email: 'g@x.com', since: '2020-01-01', contactStatus: 'expired' },
    ]);
    const logs = table([{ id: 't', assignedToId: 'U-2', updatedAt: '2026-09-01T00:00:00Z' }]);
    const boards = table([]);
    const shares = table([{ id: 's', to: 'Arch@firm.com, x@y.com', sentAt: '2026-08-01T00:00:00Z' }]);
    const s = new ContactStatusService(people, logs, boards, shares, {} as any);
    expect(await s.sweep(now)).toEqual({ review: 1, active: 0 });
    expect(people.rows[0]).toMatchObject({ contactStatus: 'review', contactStatusReason: AUTO_REVIEW_REASON });
    expect(people.rows[1]).toMatchObject({ lastActivityAt: '2026-09-01T00:00:00.000Z' });
    expect(people.rows[1].contactStatus).toBeUndefined();
    expect(people.rows[2].lastActivityAt).toBe('2026-08-01T00:00:00.000Z');
    expect(people.rows[3].contactStatus).toBe('expired');
  });
});
