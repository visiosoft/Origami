import { ProjectTasksService } from './project-tasks.service';

/** Completed means Done; "Close task" archives at once; reopening un-archives. */
describe('completed tasks are Done', () => {
  const SECTIONS = [{ id: 'S-todo', name: 'To Do' }, { id: 'S-prog', name: 'In Progress' }, { id: 'S-rev', name: 'In Review' }, { id: 'S-done', name: 'Done' }];
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
    const notifications = { taskAssigned: jest.fn(), taskFollowUp: jest.fn() };
    return new ProjectTasksService(repo as any, users as any, { forProject: async () => SECTIONS } as any, {} as any, notifications as any);
  };
  const me = { id: 'U-1', name: 'Edward' };

  it('fixes completed tasks that are not in Done', async () => {
    const rows = [
      { id: 'A', projectId: 5, sectionId: 'S-rev', status: 'Done', completed: true },
      { id: 'B', projectId: 5, sectionId: 'S-todo', status: 'Not started', completed: true },
      { id: 'C', projectId: 5, sectionId: 'S-prog', status: 'In progress', completed: false },
    ];
    const svc = setup(rows);
    expect(await svc.fixCompleted()).toBe(2);
    expect(rows[0]).toMatchObject({ sectionId: 'S-done' });
    expect(rows[1]).toMatchObject({ status: 'Done', sectionId: 'S-done' });
    expect(rows[2]).toMatchObject({ sectionId: 'S-prog' });
    expect(await svc.fixCompleted()).toBe(0);
  });

  it('a finished card dragged into In Review is back in work', async () => {
    const svc = setup([{ id: 'A', projectId: 5, sectionId: 'S-done', status: 'Done', completed: true, assignee: 'Kai', assigneeId: 'U-KAI', activity: [] }]);
    const t = await svc.update('A', { sectionId: 'S-rev' }, me);
    expect(t).toMatchObject({ status: 'In progress', completed: false, sectionId: 'S-rev' });
  });

  it('Close task archives it (and its subtasks); changing its status reopens it', async () => {
    const rows: any[] = [
      { id: 'P', projectId: 5, sectionId: 'S-prog', status: 'In progress', completed: false, activity: [] },
      { id: 'K', parentId: 'P', projectId: 5, sectionId: 'S-prog', status: 'Done', completed: true, activity: [] },
    ];
    const svc = setup(rows);
    const t = await svc.update('P', { close: true }, me);
    expect(t).toMatchObject({ status: 'Done', completed: true, sectionId: 'S-done' });
    expect(t.archivedAt).toBeTruthy();
    expect(rows[1].archivedAt).toBeTruthy();
    expect((t.activity || []).some((e: any) => /closed this task/.test(e.text))).toBe(true);
    const back = await svc.update('P', { status: 'In progress' }, me);
    expect(back).toMatchObject({ archivedAt: null, closedAt: null, completed: false });
  });
});
