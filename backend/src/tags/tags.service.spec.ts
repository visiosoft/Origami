import { TagsService } from './tags.service';
import { TasksService } from '../tasks/tasks.service';

const repo = (rows: any[], key = 'id') => ({
  find: jest.fn(async () => rows),
  findOneBy: jest.fn(async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null),
  create: (x: any) => x,
  save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r[key] === x[key]); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
  update: jest.fn(async (w: any, p: any) => { const r = rows.find((x) => x[key] === w[key]); if (r) Object.assign(r, p); }),
  delete: jest.fn(async (w: any) => { const i = rows.findIndex((r) => r[key] === w[key]); if (i >= 0) rows.splice(i, 1); }),
});

function setup() {
  const bank: any[] = [];
  const log = [{ id: 'L1', labels: ['Astrid private', 'Kitchen'] }, { id: 'L2', labels: ['kitchen'] }];
  const board = [{ id: 'B1', labels: ['Punch list', 'Kitchen'] }];
  const users = [{ id: 'U-AS', name: 'Astrid Rivas', tier: 'internal' }, { id: 'U-CL', name: 'Jordan Lee', tier: 'client' }];
  const projects = [{ id: 7, name: 'Cole Valley', stage: 'Construction' }];
  const svc = new TagsService(repo(bank, 'key') as any, repo(log) as any, repo(board) as any, repo(users) as any, repo(projects) as any);
  return { svc, bank, log, board, users, projects };
}

describe('the shared tag bank', () => {
  it('fills from tags already on tasks, and lists standard tags first with uses', async () => {
    const { svc } = setup();
    expect(await svc.seed()).toBe(3);
    const list = await svc.list();
    expect(list.slice(0, 7).every((t) => t.standard)).toBe(true);
    expect(list.slice(7).map((t) => [t.name, t.uses])).toEqual([['Astrid private', 1], ['Kitchen', 3], ['Punch list', 1]]);
  });
  it('a new tag joins once; standard names are refused', async () => {
    const { svc, bank } = setup();
    await svc.add('Permit', { name: 'Ed' });
    await svc.add('permit', { name: 'Ed' });
    expect(bank).toHaveLength(1);
    await expect(svc.add('Internal', { name: 'Ed' })).rejects.toThrow(/standard/);
  });
  it('renaming merges into an existing tag on every task; deleting takes it off', async () => {
    const { svc, log, board, bank } = setup();
    await svc.seed();
    const r = await svc.rename('kitchen', 'Punch list');
    expect(r.changed).toBe(3);
    expect(log[0].labels).toEqual(['Astrid private', 'Punch list']);
    expect(board[0].labels).toEqual(['Punch list']);
    expect(bank.map((b) => b.key).sort()).toEqual(['astrid private', 'punch list']);
    expect((await svc.remove('punch list')).changed).toBe(3);
    expect(log[1].labels).toEqual([]);
    await expect(svc.remove('internal')).rejects.toThrow(/Standard/);
  });
  it('a new item: Internal by default, Construction from its project, Client when assigned to a client', async () => {
    const { svc, bank } = setup();
    expect((await svc.newItemTags({ actor: { id: 'U-AS' }, projectId: 7, labels: ['Internal', 'Roof'] }))).toEqual({ tags: ['internal', 'construction'], labels: ['Roof'] });
    expect((await svc.newItemTags({ actor: { id: 'U-AS' }, assigneeId: 'U-CL', projectName: 'Cole Valley' })).tags).toEqual(['client', 'construction']);
    expect((await svc.newItemTags({ actor: { id: 'U-CL' } })).tags).toEqual([]);
    expect((await svc.newItemTags({ actor: { id: 'U-AS' }, leadId: 'L-1', projectId: 7 })).tags).toEqual(['internal', 'crm']);
    await new Promise((r) => setImmediate(r));
    expect(bank.map((b) => b.name)).toEqual(['Roof']);
  });
});

describe('Log entries get their tags when made', () => {
  it('Internal by default; Financial when it carries a change order; custom tags kept', async () => {
    const rows: any[] = [];
    const r = { create: (x: any) => x, find: async () => rows, findOneBy: async (w: any) => rows.find((x) => x.id === w.id) || null, save: async (x: any) => { rows.push(x); return x; }, update: async () => undefined };
    const users = { findOneBy: async (w: any) => (w.id ? { id: w.id, name: w.id, tier: 'internal' } : null), find: async () => [] };
    const { svc: tags } = setup();
    const svc = new TasksService(r as any, users as any, {} as any, { taskAssigned: () => undefined, taskFollowUp: () => undefined } as any, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, tags);
    const a = await svc.create({ subject: 'Check flashing', labels: ['Roof'] }, { id: 'U-AS', name: 'Astrid' });
    expect(a.tags).toEqual(['internal']);
    expect(a.labels).toEqual(['Roof']);
    const b = await svc.create({ subject: 'Price the extra', tags: ['client'], changeOrderIds: ['CO-1'] }, { id: 'U-AS', name: 'Astrid' });
    expect(b.tags).toEqual(['internal', 'client', 'financial']);
  });
});
