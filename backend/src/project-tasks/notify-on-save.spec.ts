import { ProjectTasksService } from './project-tasks.service';

/** Task emails wait for Save in the editor; card actions still send at once. */
describe('board task emails wait for Save', () => {
  const setup = () => {
    const rows: any[] = [{ id: 'P1', projectId: null, sectionId: 'S1', status: 'Not started', title: 'Parent', collaborators: [], activity: [] }];
    const repo = {
      findOneBy: jest.fn(async (w: any) => rows.find((r) => r.id === w.id) || null),
      findBy: jest.fn(async (w: any) => rows.filter((r) => Object.entries(w).every(([k, v]) => r[k] === v))),
      find: jest.fn(async () => rows),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
      update: jest.fn(async (w: any, p: any) => { const r = rows.find((x) => x.id === w.id); if (r) Object.assign(r, p); }),
    };
    const users = [{ id: 'U-2', name: 'Astrid' }, { id: 'U-3', name: 'Kai' }];
    const userRepo = { findOneBy: jest.fn(async (w: any) => users.find((u) => u.id === w.id) || null), find: jest.fn(async () => users) };
    const notifications = { taskAssigned: jest.fn(), taskFollowUp: jest.fn() };
    const svc = new ProjectTasksService(repo as any, userRepo as any, { forProject: async () => [{ id: 'S1', name: 'To Do' }] } as any, {} as any, notifications as any);
    return { svc, rows, notifications };
  };
  const me = { id: 'U-1', name: 'Edward' };

  it('holds an editor assignment until Save, then sends only what is still true', async () => {
    const { svc, rows, notifications } = setup();
    await svc.update('P1', { assigneeId: 'U-2', deferNotify: true }, me);
    await svc.update('P1', { assigneeId: 'U-3', deferNotify: true }, me);
    expect(notifications.taskAssigned).not.toHaveBeenCalled();
    expect(rows[0].pendingNotices).toHaveLength(1);
    expect(await svc.flushNotices('P1')).toEqual({ sent: 1 });
    expect(notifications.taskAssigned).toHaveBeenCalledTimes(1);
    expect(notifications.taskAssigned.mock.calls[0][0].assigneeId).toBe('U-3');
    expect(rows[0].pendingNotices).toBeNull();
  });

  it('a new subtask waits for its parent to be saved', async () => {
    const { svc, notifications } = setup();
    await svc.create({ title: 'Sub', parentId: 'P1', projectId: null, sectionId: 'S1', assigneeId: 'U-2', assignee: 'Astrid', dueDate: '2026-11-01' }, me);
    expect(notifications.taskAssigned).not.toHaveBeenCalled();
    await svc.flushNotices('P1');
    expect(notifications.taskAssigned).toHaveBeenCalledTimes(1);
  });

  it('a change made outside the editor sends at once', async () => {
    const { svc, notifications } = setup();
    await svc.update('P1', { assigneeId: 'U-2' }, me);
    expect(notifications.taskAssigned).toHaveBeenCalledTimes(1);
  });
});
