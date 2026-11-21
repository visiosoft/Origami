import { describe, expect, it } from 'vitest';
import { withMail } from './ActivityFeed';

/** Nov 20 (Edward): emails linked to a task sit in Activity & updates by date, none lost or shown twice across pages. */
describe('emails in the activity feed', () => {
  const e = (at: string) => ({ at, id: 'e' + at });
  const m = (at: string) => ({ at, id: 'm' + at });
  it('slots emails in by date on a single page', () => {
    const out = withMail([e('2026-11-20T10:00:00Z'), e('2026-11-18T10:00:00Z')], [m('2026-11-19T10:00:00Z'), m('2026-11-21T10:00:00Z'), m('2026-11-01T10:00:00Z')], true, true);
    expect(out.map((x: any) => x.id)).toEqual(['m2026-11-21T10:00:00Z', 'e2026-11-20T10:00:00Z', 'm2026-11-19T10:00:00Z', 'e2026-11-18T10:00:00Z', 'm2026-11-01T10:00:00Z']);
  });
  it('across pages: newer on the first, older on the last, in-between where they fall', () => {
    const mails = [m('2026-11-25T00:00:00Z'), m('2026-11-15T00:00:00Z'), m('2026-11-01T00:00:00Z')];
    const p1 = withMail([e('2026-11-20T00:00:00Z'), e('2026-11-18T00:00:00Z')], mails, true, false).map((x: any) => x.id);
    const p2 = withMail([e('2026-11-16T00:00:00Z'), e('2026-11-10T00:00:00Z')], mails, false, true).map((x: any) => x.id);
    expect(p1).toEqual(['m2026-11-25T00:00:00Z', 'e2026-11-20T00:00:00Z', 'e2026-11-18T00:00:00Z']);
    expect(p2).toEqual(['e2026-11-16T00:00:00Z', 'm2026-11-15T00:00:00Z', 'e2026-11-10T00:00:00Z', 'm2026-11-01T00:00:00Z']);
  });
  it('a task with no history yet still shows its emails', () => {
    expect(withMail([], [m('2026-11-01T00:00:00Z')], true, true)).toHaveLength(1);
  });
});
