import { MyTasksService } from './my-tasks.service';
import { slimSelect, slimTask } from '../database/slim-tasks';

describe('MyTasksService (the bell)', () => {
  it('asks only for the caller\'s rows and a few columns, and drops finished ones', async () => {
    const board = { find: jest.fn(async () => [
      { id: 'B1', title: 'Order tile', projectId: 3, status: 'Assigned', completed: false },
      { id: 'B2', title: 'Old', projectId: 3, status: 'Done', completed: true },
      { id: 'B3', title: 'Archived', projectId: null, status: 'Assigned', completed: false, archivedAt: '2026-10-01' },
    ]) };
    const log = { find: jest.fn(async () => [{ id: 'L1', subject: 'Call back', description: 'x'.repeat(900), project: 'Narvaes', status: 'Assigned' }]) };
    const projects = { find: jest.fn(async () => [{ id: 3, name: 'Narvaes Residence' }]) };
    const svc = new MyTasksService(board as any, log as any, projects as any);
    const out = await svc.list({ sub: 'U-7', name: 'Kai Lono' } as any);
    const bq = (board.find.mock.calls[0] as any[])[0];
    expect(bq.where[0]).toEqual({ assigneeId: 'U-7' });
    expect(bq.where[1].assignee).toBe('Kai Lono');
    expect(Object.keys(bq.select)).not.toContain('comments');
    expect(out.board).toEqual([expect.objectContaining({ id: 'B1', projectName: 'Narvaes Residence' })]);
    expect(out.log[0].description).toHaveLength(300);
  });
});

describe('slim task lists', () => {
  it('select every column but comments, history and queued emails', () => {
    const repo = { metadata: { columns: ['id', 'title', 'comments', 'activity', 'pendingNotices', 'derivedRefs', 'commentCount'].map((propertyName) => ({ propertyName })) } };
    expect(slimSelect(repo as any)).toEqual({ id: true, title: true, commentCount: true });
    expect(slimSelect({} as any)).toBeUndefined();
  });
  it('keep how many comments there are', () => {
    expect(slimTask({ id: 'T', comments: [], activity: [], commentCount: 3 })).toEqual({ id: 'T', commentCount: 3 });
    expect(slimTask({ id: 'T', comments: [{}, {}], commentCount: null }, [{}, {}])).toEqual({ id: 'T', commentCount: 2 });
    expect(slimTask({ id: 'T', comments: [], commentCount: null })).toEqual({ id: 'T', commentCount: null });
  });
});

describe('start-up backfills', () => {
  it('record each old board task\'s creator and comment count once', async () => {
    const { backfillCreatedBy, backfillCommentCounts } = await import('../database/slim-tasks');
    const updates: any[] = [];
    const repo = {
      find: jest.fn(async (q: any) => (q.select.activity
        ? [{ id: 'T1', activity: [{ type: 'edit' }, { type: 'created', byId: 'U-2', by: 'Andrea' }] }, { id: 'T2', activity: [] }]
        : [{ id: 'T1', comments: [{}, {}, {}] }, { id: 'T2', comments: null }])),
      update: jest.fn(async (w: any, p: any) => { updates.push([w.id, p]); }),
    };
    await backfillCreatedBy(repo as any);
    await backfillCommentCounts(repo as any);
    expect(updates).toEqual([
      ['T1', { createdById: 'U-2', createdByName: 'Andrea' }], ['T2', { createdById: '' }],
      ['T1', { commentCount: 3 }], ['T2', { commentCount: 0 }],
    ]);
  });
});
