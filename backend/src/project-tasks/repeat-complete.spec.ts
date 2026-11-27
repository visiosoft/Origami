import { ProjectTasksService } from './project-tasks.service';

/** Nov 27: one repeating task -- done moves it to its next day, still open; no copies. */
describe('completing a repeating board task', () => {
  const SECTIONS = [{ id: 'S-todo', name: 'To Do' }, { id: 'S-prog', name: 'In Progress' }, { id: 'S-done', name: 'Done' }];
  const setup = (rows: any[]) => {
    const repo = {
      findOneBy: jest.fn(async (w: any) => rows.find((r) => r.id === w.id) || null),
      findBy: jest.fn(async (w: any) => rows.filter((r) => Object.entries(w).every(([k, v]) => r[k] === v))),
      find: jest.fn(async (o?: any) => (o?.where ? rows.filter((r) => Object.entries(o.where).every(([k, v]) => r[k] === v)) : rows)),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
      update: jest.fn(async (w: any, p: any) => { const r = rows.find((x) => x.id === w.id); if (r) Object.assign(r, p); }),
    };
    const users = { findOneBy: jest.fn(async () => null), find: jest.fn(async () => []) };
    const notifications = { taskAssigned: jest.fn(), taskFollowUp: jest.fn(), taskStatus: jest.fn() };
    return new ProjectTasksService(repo as any, users as any, { forProject: async () => SECTIONS } as any, {} as any, notifications as any);
  };
  const me = { id: 'U-1', name: 'Astrid' };
  it('Done on a weekday task: due next weekday, back In progress in its column, a history line; nothing copied', async () => {
    const rows = [{ id: 'A', projectId: 5, sectionId: 'S-prog', status: 'In progress', dueDate: '2026-11-27', assignee: 'Astrid', assigneeId: 'U-1', repeat: { every: 'weekdays' }, activity: [] }];
    const svc = setup(rows);
    const t: any = await svc.update('A', { status: 'Done', completionNote: 'Checked the portal' }, me);
    expect(t).toMatchObject({ status: 'In progress', completed: false, sectionId: 'S-prog', dueDate: '2026-11-30' });
    expect(t.activity.some((e: any) => /done for 2026-11-27 — it repeats \(Every weekday\), next due 2026-11-30/.test(e.text || ''))).toBe(true);
    expect(rows).toHaveLength(1);
  });
  it('Complete task (close) on a repeating task rolls it too; past "until" it finishes for good', async () => {
    const rows = [{ id: 'A', projectId: 5, sectionId: 'S-prog', status: 'In progress', dueDate: '2026-11-27', assignee: 'Astrid', assigneeId: 'U-1', repeat: { every: 'day', until: '2026-11-28' }, activity: [] }];
    const svc = setup(rows);
    expect(await svc.update('A', { close: true }, me)).toMatchObject({ dueDate: '2026-11-28', completed: false, archivedAt: null });
    expect(await svc.update('A', { close: true }, me)).toMatchObject({ completed: true, status: 'Done' });
  });
});
