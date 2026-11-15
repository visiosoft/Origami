import { ProjectTasksService } from './project-tasks.service';

/** Oct 30 sync: a task set to Emergency alerts its people and the admins at once -- once. */
describe('Emergency board tasks', () => {
  const setup = () => {
    const rows: any[] = [{ id: 'P1', projectId: null, sectionId: 'S1', status: 'Assigned', title: 'Leak', priority: 'High', assigneeId: 'U-2', assignee: 'Astrid', createdById: 'U-1', collaborators: [{ id: 'U-3', name: 'Kai' }], activity: [] }];
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
    const hub = { emergency: jest.fn(async () => undefined), highVizTask: jest.fn(async () => undefined) };
    const svc = new ProjectTasksService(repo as any, userRepo as any, { forProject: async () => [{ id: 'S1', name: 'To Do' }] } as any, {} as any, notifications as any, undefined, undefined, hub as any);
    return { svc, hub };
  };
  const me = { id: 'U-9', name: 'Edward' };
  const flush = () => new Promise((r) => setImmediate(r));

  it('alerts when a task becomes Emergency, with the people on it, and not again on later saves', async () => {
    const { svc, hub } = setup();
    await svc.update('P1', { priority: 'Emergency' }, me);
    await flush();
    expect(hub.emergency).toHaveBeenCalledTimes(1);
    const [ids, item] = (hub.emergency.mock.calls[0] as any[]);
    expect(ids).toEqual(expect.arrayContaining(['U-2', 'U-3', 'U-1']));
    expect(item.title).toBe('🚨 EMERGENCY: Leak');
    expect(item.actorId).toBe('U-9');
    await svc.update('P1', { description: 'Main valve' }, me);
    await svc.update('P1', { priority: 'Emergency' }, me);
    await flush();
    expect(hub.emergency).toHaveBeenCalledTimes(1);
  });

  it('alerts when a task is created as Emergency, and not for other priorities', async () => {
    const { svc, hub } = setup();
    await svc.create({ title: 'Gas smell', projectId: null, sectionId: 'S1', priority: 'Urgent' }, me);
    await flush();
    expect(hub.emergency).not.toHaveBeenCalled();
    await svc.create({ title: 'Gas smell', projectId: null, sectionId: 'S1', priority: 'Emergency', assigneeId: 'U-2', assignee: 'Astrid' }, me);
    await flush();
    expect(hub.emergency).toHaveBeenCalledTimes(1);
  });
});
