import { activityEntries, activityPage } from './activity-page';

const ev = (id: string, at: string, type = 'field', text?: string) => ({ id, type, at, by: 'Edward', text });

describe('task history paging', () => {
  it('merges comments that predate the activity log, newest first', () => {
    const rows = activityEntries(
      [{ id: 'c1', author: 'Jo', text: 'old note', date: '2026-01-02T00:00:00Z' }, { id: 'c2', author: 'Jo', text: 'logged', date: '2026-03-01T00:00:00Z' }],
      [ev('a1', '2026-02-01T00:00:00Z'), ev('a2', '2026-03-01T00:00:00Z', 'comment', 'logged'), ev('a3', 'not a date')],
    );
    expect(rows.map((r) => (r.kind === 'event' ? r.event.id : r.comment.id))).toEqual(['a2', 'a1', 'c1', 'a3']);
  });

  it('pages 20 at a time by default', () => {
    const activity = Array.from({ length: 45 }, (_, i) => ev('e' + i, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()));
    const p1 = activityPage(null, activity, {});
    expect(p1).toMatchObject({ total: 45, page: 1, size: 20, pages: 3 });
    expect(p1.rows[0]).toMatchObject({ kind: 'event', event: { id: 'e44' } });
    const p3 = activityPage(null, activity, { page: '3' });
    expect(p3.rows.map((r) => (r.kind === 'event' ? r.event.id : ''))).toEqual(['e4', 'e3', 'e2', 'e1', 'e0']);
  });

  it('an empty history is one empty page', () => {
    expect(activityPage(undefined, undefined, { page: '2' })).toMatchObject({ rows: [], total: 0, page: 1, pages: 1 });
  });
});
