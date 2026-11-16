import { createHmac } from 'crypto';
import { QuoTasksService } from './quo-tasks.service';
import { QUO_ACTOR, originLabel, prettyPhone, taskIdOf, toLogTask } from './quo-tasks';

describe('Quo tasks: shapes', () => {
  it('finds the task id in either webhook shape', () => {
    expect(taskIdOf({ type: 'task.completed', data: { object: { taskId: 'TK1', status: 'completed' } } })).toBe('TK1');
    expect(taskIdOf({ object: { type: 'task.created', data: { object: { taskId: 'TK2' } } } })).toBe('TK2');
    expect(taskIdOf({ type: 'message.received', data: { object: { id: 'AC1' } } })).toBeNull();
  });

  it('says where a task came from', () => {
    expect(originLabel({ kind: 'text', from: 'Alton HVAC', to: 'Edward', at: '2026-10-21T20:09:00Z' }, null, null)).toBe('Quo, text from Alton HVAC to Edward on Oct 21, 2026, 1:09 PM');
    expect(originLabel(null, 'Edward', '2026-10-21T20:09:00Z')).toBe('Quo task by Edward on Oct 21, 2026, 1:09 PM');
    expect(prettyPhone('+16507614661')).toBe('(650) 761-4661');
    const t = toLogTask({ taskId: 'TK1', status: 'open', title: 'Send the HVAC quote', dueDate: '2026-11-20T00:00:00Z' }, { origin: { kind: 'text', from: 'Alton HVAC', to: 'Edward', at: null, text: 'Can you send the quote?' }, assigneeId: 'U-2', createdByName: 'Edward' });
    expect(t).toMatchObject({ subject: 'Send the HVAC quote', dueDate: '2026-11-20', assignedToId: 'U-2', sourceType: 'quo', sourceId: 'TK1', sourceLabel: 'Quo, text from Alton HVAC to Edward', topicType: 'Task' });
    expect(t.description).toContain('Text: “Can you send the quote?”');
  });
});

describe('QuoTasksService', () => {
  function setup() {
    const quoTasks: Record<string, any> = {
      TK1: { taskId: 'TK1', status: 'open', title: 'Send the HVAC quote', assignedTo: 'US1', createdBy: 'US1', activityId: 'AC1', dueDate: null, createdAt: '2026-11-15T18:00:00Z' },
      TK2: { taskId: 'TK2', status: 'completed', title: 'Old one' },
    };
    const calls: string[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      const u = String(url).replace('https://api.quo.com', '');
      calls.push(`${init?.method || 'GET'} ${u}${init?.body ? ' ' + init.body : ''}`);
      const json = (status: number, body: any) => ({ ok: status < 300, status, json: async () => body }) as any;
      if (u.startsWith('/users')) return json(200, { data: [{ id: 'US1', email: 'Edward@Origami.com', firstName: 'Edward', lastName: 'K' }], nextCursor: null });
      if (u === '/messages/AC1') return json(200, { data: { id: 'AC1', direction: 'incoming', from: '+16505550100', to: ['+16507614661'], text: 'Can you send the quote?', userId: 'US1', createdAt: '2026-11-15T17:59:00Z' } });
      const m = u.match(/^\/tasks\/(\w+)(\/status)?$/);
      if (m && m[2]) { quoTasks[m[1]].status = JSON.parse(init.body).status; return json(200, { data: { taskId: m[1], revision: 2 } }); }
      if (m) return quoTasks[m[1]] ? json(200, { data: quoTasks[m[1]] }) : json(404, { message: 'Not found' });
      if (u.startsWith('/tasks?')) return json(200, { data: Object.values(quoTasks), nextCursor: null });
      if (u === '/webhooks' && init?.method === 'POST') return json(201, { data: { id: '77', key: 'whsec_' + Buffer.from('secret-key').toString('base64') } });
      return json(404, {});
    });
    const logs: any[] = [];
    let listener: any = null;
    const tasks: any = {
      onStatusChange: (fn: any) => { listener = fn; },
      create: jest.fn(async (dto: any, actor: any) => { const t = { id: 'L' + (logs.length + 1), status: dto.assignedToId ? 'Assigned' : 'To Do', subject: dto.subject, dueDate: dto.dueDate, assignedToId: dto.assignedToId || null, ...dto, by: actor.name }; logs.push(t); return t; }),
      update: jest.fn(async (id: string, patch: any) => { const t = logs.find((x) => x.id === id); Object.assign(t, patch); return t; }),
    };
    const settings: Record<string, string> = { 'sms.quoApiKey': 'KEY', 'app.baseUrl': 'https://staging.origamidb.com' };
    const settingsSvc: any = { get: async (k: string) => settings[k] ?? null, set: async (k: string, v: string) => { settings[k] = v; }, baseUrl: async () => settings['app.baseUrl'] };
    const repo = (rows: () => any[]) => ({ find: async () => rows(), findOne: async (o: any) => rows().find((r) => Object.entries(o.where).every(([k, v]) => r[k] === v)) || null, count: async () => rows().length });
    const users = [{ id: 'U-2', name: 'Edward', email: 'edward@origami.com', status: 'active' }];
    const people = [{ id: 1, name: 'Alton HVAC', phone: '(650) 555-0100' }];
    const svc = new QuoTasksService(repo(() => logs) as any, repo(() => users) as any, repo(() => people) as any, settingsSvc, tasks);
    svc.onModuleInit();
    return { svc, calls, logs, tasks, quoTasks, settings, listener: () => listener };
  }
  afterEach(() => jest.restoreAllMocks());

  it('a new Quo task becomes an ODIN task, assigned by email, with where it came from', async () => {
    const { svc, logs, tasks } = setup();
    expect(await svc.sync('TK1')).toEqual({ action: 'created' });
    expect(tasks.create.mock.calls[0][1]).toEqual(QUO_ACTOR);
    expect(logs[0]).toMatchObject({ subject: 'Send the HVAC quote', assignedToId: 'U-2', sourceType: 'quo', sourceId: 'TK1' });
    expect(logs[0].sourceLabel).toMatch(/^Quo, text from Alton HVAC to Edward K on Nov 15, 2026/);
    expect(await svc.sync('TK1')).toEqual({ action: 'none' }); // already here, nothing changed
    expect(await svc.sync('TK2')).toEqual({ action: 'none' }); // a completed one isn't brought in
  });

  it('completed, reopened, edited and deleted in Quo: the same in ODIN', async () => {
    const { svc, logs, quoTasks } = setup();
    await svc.sync('TK1');
    quoTasks.TK1.status = 'completed';
    expect(await svc.sync('TK1')).toEqual({ action: 'closed' });
    expect(logs[0]).toMatchObject({ status: 'Complete', completionNote: 'Completed in Quo.' });
    quoTasks.TK1.status = 'open';
    expect(await svc.sync('TK1')).toEqual({ action: 'reopened' });
    expect(logs[0].status).toBe('Assigned');
    quoTasks.TK1.title = 'Send the HVAC quote today'; quoTasks.TK1.dueDate = '2026-11-18T00:00:00Z';
    expect(await svc.sync('TK1')).toEqual({ action: 'updated' });
    expect(logs[0]).toMatchObject({ subject: 'Send the HVAC quote today', dueDate: '2026-11-18' });
    delete quoTasks.TK1;
    expect(await svc.sync('TK1')).toEqual({ action: 'closed' });
    expect(logs[0].completionNote).toBe('Deleted in Quo.');
  });

  it('done or reopened in ODIN marks it in Quo; changes from Quo itself are not sent back', async () => {
    const { svc, calls, logs, listener } = setup();
    await svc.sync('TK1');
    calls.length = 0;
    await listener()({ ...logs[0] }, 'closed', { id: 'U-2', name: 'Edward' });
    expect(calls).toEqual(['PATCH /tasks/TK1/status {"status":"completed"}']);
    calls.length = 0;
    await listener()({ ...logs[0] }, 'reopened', { id: 'U-2', name: 'Edward' });
    expect(calls).toEqual(['PATCH /tasks/TK1/status {"status":"open"}']);
    calls.length = 0;
    await listener()({ ...logs[0] }, 'closed', QUO_ACTOR);
    await listener()({ ...logs[0], sourceType: null }, 'closed', { id: 'U-2', name: 'Edward' });
    expect(calls).toEqual([]);
  });

  it('connect subscribes to task events here; deliveries must be signed with its key', async () => {
    const { svc, calls, settings, logs } = setup();
    const st = await svc.connect();
    expect(st).toMatchObject({ connected: true, url: 'https://staging.origamidb.com/api/quo/tasks-webhook' });
    expect(calls.find((c) => c.startsWith('POST /webhooks'))).toContain('"task.completed"');
    const raw = JSON.stringify({ type: 'task.created', data: { object: { taskId: 'TK1' } } });
    await expect(svc.webhook({}, raw, JSON.parse(raw))).rejects.toThrow(/Signature/);
    const ts = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(settings['quo.tasksWebhookSecret'].replace(/^whsec_/, ''), 'base64');
    const sig = createHmac('sha256', key).update(`msg1.${ts}.${raw}`).digest('base64');
    expect(await svc.webhook({ 'webhook-id': 'msg1', 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` }, raw, JSON.parse(raw))).toMatchObject({ ok: true, action: 'created' });
    expect(logs).toHaveLength(1);
  });

  it('preview lists open Quo tasks not yet here; import brings them in', async () => {
    const { svc, logs } = setup();
    const p = await svc.preview();
    expect(p).toMatchObject({ open: 1, toImport: [{ taskId: 'TK1', title: 'Send the HVAC quote', assignee: 'Edward' }] });
    expect(logs).toHaveLength(0);
    expect(await svc.importOpen()).toEqual({ created: 1, failed: [] });
    expect((await svc.preview()).toImport).toEqual([]);
  });
});
