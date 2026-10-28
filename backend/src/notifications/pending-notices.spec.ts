import { holdNotices, overdue, stillTrue } from './pending-notices';

const a = { name: 'Sara', id: 'U-S' };
describe('held task notices', () => {
  it('keeps the latest assignment and adds up collaborators', () => {
    let h = holdNotices(null, [{ kind: 'assigned', ids: ['U-1'], actor: a, at: '2026-10-17T10:00:00Z' }]);
    h = holdNotices(h, [{ kind: 'assigned', ids: ['U-2'], actor: a, at: '2026-10-17T10:01:00Z' }, { kind: 'added', ids: ['U-3'], actor: a, at: 'x' }]);
    h = holdNotices(h, [{ kind: 'added', ids: ['U-3', 'U-4'], actor: a, at: 'x' }]);
    expect(h).toEqual([{ kind: 'assigned', ids: ['U-2'], actor: a, at: '2026-10-17T10:01:00Z' }, { kind: 'added', ids: ['U-3', 'U-4'], actor: a, at: 'x' }]);
  });
  it('drops notices that no longer hold', () => {
    const h = [{ kind: 'assigned' as const, ids: ['U-2'], actor: a, at: '' }, { kind: 'added' as const, ids: ['U-3', 'U-4'], actor: a, at: '' }, { kind: 'done' as const, ids: [], actor: a, at: '' }];
    expect(stillTrue(h, { assigneeId: 'U-9', collaboratorIds: ['U-4'], done: false })).toEqual([{ kind: 'added', ids: ['U-4'], actor: a, at: '' }]);
  });
  it('is overdue after 15 minutes', () => {
    const at = '2026-10-17T10:00:00Z';
    expect(overdue([{ kind: 'done', ids: [], actor: a, at }], Date.parse(at) + 14 * 60000)).toBe(false);
    expect(overdue([{ kind: 'done', ids: [], actor: a, at }], Date.parse(at) + 15 * 60000)).toBe(true);
  });
});
