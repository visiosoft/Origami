import { TasksService } from './tasks.service';

/** Request Log tasks use the task buckets (Oct 16). */
describe('Request Log task buckets', () => {
  const setup = () => {
    const rows: any[] = [
      { id: 'T1', topicType: 'Task', subject: 'Order flooring', status: 'To Do', originator: 'Sara', activity: [{ type: 'created', by: 'Sara', byId: 'U-SARA', at: '' }] },
      { id: 'T2', topicType: 'Task', subject: 'Old one', status: 'Confirmed', confirmedAt: '2026-01-01T00:00:00Z', activity: [] },
      { id: 'T3', topicType: 'Task', subject: 'Legacy', status: 'Open', assignedTo: 'Kai', activity: [] },
    ];
    const repo = {
      create: (r: any) => r,
      find: async () => rows,
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      save: async (r: any) => { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
      update: async (w: any, p: any) => { const r = rows.find((x) => x.id === w.id); if (r) Object.assign(r, p); },
    };
    const users = { findOneBy: async (w: any) => (w.id === 'U-ADMIN' ? { id: 'U-ADMIN', roleKey: 'admin' } : w.id ? { id: w.id, name: w.id } : null), find: async () => [] };
    const notifications = { taskAssigned: () => undefined, taskFollowUp: () => undefined };
    const settings = { store: {} as Record<string, string>, async get(k: string) { return this.store[k] ?? null; }, async set(k: string, v: string) { this.store[k] = v; } };
    const svc = new TasksService(repo as any, users as any, {} as any, notifications as any, settings as any);
    return { svc, rows, settings };
  };

  it('assigning moves To Do to Assigned and back', async () => {
    const { svc } = setup();
    expect((await svc.update('T1', { assignedTo: 'Kai', assignedToId: 'U-KAI' }, { name: 'Sara', id: 'U-SARA' })).status).toBe('Assigned');
    expect((await svc.update('T1', { assignedTo: '', assignedToId: '' }, { name: 'Sara', id: 'U-SARA' })).status).toBe('To Do');
  });

  it('only whoever raised it, or an admin, confirms it', async () => {
    const { svc } = setup();
    await svc.update('T1', { status: 'Complete' }, { name: 'Kai', id: 'U-KAI' });
    await expect(svc.update('T1', { status: 'Confirmed' }, { name: 'Kai', id: 'U-KAI' })).rejects.toThrow(/Only Sara/);
    const t = await svc.update('T1', { status: 'Confirmed' }, { name: 'Sara', id: 'U-SARA' });
    expect(t.confirmedAt).toBeTruthy();
    expect((await svc.update('T1', { status: 'In Progress' }, { name: 'Edward', id: 'U-ADMIN' })).confirmedAt).toBeNull();
  });

  it('archives confirmed tasks after a week, and moves old statuses onto the buckets once', async () => {
    const { svc, rows, settings } = setup();
    await svc.findAll();
    expect(rows[1].archivedAt).toBeTruthy();
    settings.store['requestLog.statuses'] = JSON.stringify([{ name: 'Open' }, { name: 'Closed', closed: true }]);
    expect(await svc.moveToBuckets()).toBe(1);
    expect(rows[2].status).toBe('Assigned');
    expect(JSON.parse(settings.store['requestLog.statuses']).map((s: any) => s.name)).toEqual(['To Do', 'Assigned', 'In Progress', 'On hold', 'Complete', 'Confirmed']);
    expect(await svc.moveToBuckets()).toBe(0);
  });

  it('a new entry starts in To Do, or Assigned when someone is named', async () => {
    const { svc } = setup();
    expect((await svc.create({ subject: 'A', status: 'Open' }, { name: 'Sara' })).status).toBe('To Do');
    expect((await svc.create({ subject: 'B', assignedTo: 'Kai' }, { name: 'Sara' })).status).toBe('Assigned');
  });
});
