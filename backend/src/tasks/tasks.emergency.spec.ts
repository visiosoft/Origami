import { TasksService } from './tasks.service';

/** Oct 30 sync: a Request Log entry set to Emergency alerts its people and the admins at once -- once. */
describe('Emergency Request Log tasks', () => {
  const setup = () => {
    const rows: any[] = [{ id: 'T1', topicType: 'Task', subject: 'Leak', project: 'Cole Valley', status: 'To Do', priority: 'High', assignedTo: 'Kai', assignedToId: 'U-KAI', activity: [] }];
    const repo = {
      create: (r: any) => r,
      find: async () => rows,
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      save: async (r: any) => { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
      update: async (w: any, p: any) => { const r = rows.find((x) => x.id === w.id); if (r) Object.assign(r, p); },
    };
    const users = { findOneBy: async (w: any) => (w.id ? { id: w.id, name: w.id } : null), find: async () => [] };
    const notifications = { taskAssigned: () => undefined, taskFollowUp: () => undefined };
    const settings = { store: {} as Record<string, string>, async get(k: string) { return this.store[k] ?? null; }, async set(k: string, v: string) { this.store[k] = v; } };
    const hub = { emergency: jest.fn(async () => undefined), highVizTask: jest.fn(async () => undefined) };
    const svc = new TasksService(repo as any, users as any, {} as any, notifications as any, settings as any, undefined, undefined, undefined, undefined, undefined, hub as any);
    return { svc, hub };
  };
  const me = { id: 'U-9', name: 'Edward' };
  const flush = () => new Promise((r) => setImmediate(r));

  it('alerts once when an entry becomes Emergency', async () => {
    const { svc, hub } = setup();
    await svc.update('T1', { priority: 'Emergency' }, me);
    await svc.update('T1', { priority: 'Emergency' }, me);
    await flush();
    expect(hub.emergency).toHaveBeenCalledTimes(1);
    const [ids, item] = (hub.emergency.mock.calls[0] as any[]);
    expect(ids).toContain('U-KAI');
    expect(item.title).toBe('🚨 EMERGENCY: Leak — Cole Valley');
    expect(item.path).toBe('/tasks?task=T1&type=log');
  });
});
