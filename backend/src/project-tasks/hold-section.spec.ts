import { ProjectTasksService } from './project-tasks.service';

const SECTIONS = [
  { id: 'S-todo', name: 'To Do' }, { id: 'S-prog', name: 'In Progress' }, { id: 'S-rev', name: 'In Review' }, { id: 'S-hold', name: 'On Hold' }, { id: 'S-done', name: 'Done' },
];
const service = new ProjectTasksService({} as any, {} as any, { forProject: async () => SECTIONS } as any, {} as any, {} as any);
const sync = (task: any, patch: any) => (service as any).syncBucketSection(task, patch).then(() => patch);

describe('bucket columns and the task status move together', () => {
  it('setting a status files the card in its column', async () => {
    expect(await sync({ projectId: 23, sectionId: 'S-prog', status: 'In progress' }, { status: 'On hold' })).toEqual({ status: 'On hold', sectionId: 'S-hold' });
    expect(await sync({ projectId: 23, sectionId: 'S-hold', status: 'On hold' }, { status: 'Done' })).toEqual({ status: 'Done', sectionId: 'S-done' });
    // No Confirmed column: it stays with Done; no Assigned column: it stays with To Do.
    expect(await sync({ projectId: 23, sectionId: 'S-done', status: 'Done' }, { status: 'Confirmed' })).toEqual({ status: 'Confirmed' });
    expect(await sync({ projectId: 23, sectionId: 'S-todo', status: 'Not started' }, { status: 'Assigned' })).toEqual({ status: 'Assigned' });
  });

  it('dragging into a bucket column sets that status; a plain column leaves it', async () => {
    expect(await sync({ projectId: 23, sectionId: 'S-todo', status: 'Not started' }, { sectionId: 'S-hold' })).toEqual({ sectionId: 'S-hold', status: 'On hold' });
    expect(await sync({ projectId: 23, sectionId: 'S-prog', status: 'In progress' }, { sectionId: 'S-done' })).toEqual({ sectionId: 'S-done', status: 'Done' });
    expect(await sync({ projectId: 23, sectionId: 'S-hold', status: 'On hold' }, { sectionId: 'S-todo' })).toEqual({ sectionId: 'S-todo', status: 'Not started' });
    expect(await sync({ projectId: 23, sectionId: 'S-prog', status: 'In progress' }, { sectionId: 'S-rev' })).toEqual({ sectionId: 'S-rev' });
    expect(await sync({ projectId: 23, sectionId: 'S-hold', status: 'On hold' }, { sectionId: 'S-rev' })).toEqual({ sectionId: 'S-rev', status: 'In progress' });
  });

  it('a board without bucket columns is left alone', async () => {
    const plain = new ProjectTasksService({} as any, {} as any, { forProject: async () => [{ id: 'A', name: 'Phase 1' }, { id: 'B', name: 'Phase 2' }] } as any, {} as any, {} as any);
    const patch = { status: 'On hold' };
    await (plain as any).syncBucketSection({ projectId: 23, sectionId: 'A', status: 'In progress' }, patch);
    expect(patch).toEqual({ status: 'On hold' });
  });
});

describe('task bucket rules', () => {
  function setup(task: any, users: any[] = []) {
    const rows = [task];
    const repo = {
      findOneBy: jest.fn(async (w: any) => rows.find((r) => r.id === w.id) || null),
      find: jest.fn(async () => []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const userRepo = { findOneBy: jest.fn(async (w: any) => users.find((u) => u.id === w.id) || null), find: jest.fn(async () => users) };
    const notifications = { taskAssigned: jest.fn(), taskFollowUp: jest.fn() };
    const svc = new ProjectTasksService(repo as any, userRepo as any, { forProject: async () => SECTIONS } as any, {} as any, notifications as any);
    return svc;
  }

  it('assigning a To Do makes it Assigned, and unassigning puts it back', async () => {
    const svc = setup({ id: 'T1', projectId: 23, sectionId: 'S-todo', status: 'Not started' }, [{ id: 'U-2', name: 'Astrid' }]);
    expect((await svc.update('T1', { assigneeId: 'U-2' }, { id: 'U-1', name: 'Edward' })).status).toBe('Assigned');
    expect((await svc.update('T1', { assigneeId: '', assignee: '' }, { id: 'U-1', name: 'Edward' })).status).toBe('Not started');
  });

  it('sets the start date the first time a task goes In Progress', async () => {
    const svc = setup({ id: 'T1', projectId: 23, sectionId: 'S-todo', status: 'Assigned', assigneeId: 'U-2' });
    const t = await svc.update('T1', { status: 'In progress' }, { id: 'U-2', name: 'Astrid' });
    expect(t.startDate).toBe(new Date().toISOString().slice(0, 10));
    expect(t.sectionId).toBe('S-prog');
  });

  it('only the originator or an admin confirms; leaving Confirmed clears the archive clock', async () => {
    const svc = setup({ id: 'T1', projectId: 23, sectionId: 'S-done', status: 'Done', completed: true, createdById: 'U-1', createdByName: 'Edward' }, [{ id: 'U-9', roleKey: 'admin' }, { id: 'U-2', roleKey: 'staff' }]);
    await expect(svc.update('T1', { status: 'Confirmed' }, { id: 'U-2', name: 'Astrid' })).rejects.toThrow(/Only Edward/);
    const ok = await svc.update('T1', { status: 'Confirmed' }, { id: 'U-1', name: 'Edward' });
    expect(ok).toMatchObject({ status: 'Confirmed', completed: true });
    expect(ok.confirmedAt).toBeTruthy();
    const back = await svc.update('T1', { status: 'In progress' }, { id: 'U-9', name: 'Admin' });
    expect(back).toMatchObject({ status: 'In progress', completed: false, confirmedAt: null, archivedAt: null });
  });

  it('archives a Confirmed task 7 days after it was confirmed', async () => {
    const old = new Date(Date.now() - 8 * 86400000).toISOString();
    const rows = [{ id: 'T1', status: 'Confirmed', confirmedAt: old }, { id: 'T2', status: 'Confirmed', confirmedAt: new Date().toISOString() }];
    const repo = { find: jest.fn(async () => rows), save: jest.fn(async (x: any) => x) };
    const svc = new ProjectTasksService(repo as any, {} as any, {} as any, {} as any, {} as any);
    const all = await svc.findAll();
    expect(all.find((t) => t.id === 'T1').archivedAt).toBeTruthy();
    expect(all.find((t) => t.id === 'T2').archivedAt).toBeFalsy();
  });
});
