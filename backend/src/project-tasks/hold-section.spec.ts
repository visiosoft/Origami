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
    const svc = setup({ id: 'T1', projectId: 23, sectionId: 'S-done', status: 'Done', completed: true, assigneeId: 'U-2', assignee: 'Astrid', createdById: 'U-1', createdByName: 'Edward' }, [{ id: 'U-9', roleKey: 'admin' }, { id: 'U-2', roleKey: 'staff' }]);
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

  it('a start date that has arrived moves an assigned task to In Progress; a future one waits', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const svc = setup({ id: 'T1', projectId: 23, sectionId: 'S-todo', status: 'Assigned', assigneeId: 'U-2', assignee: 'Astrid' });
    expect((await svc.update('T1', { startDate: '2999-01-01' }, { id: 'U-1', name: 'Edward' })).status).toBe('Assigned');
    const t = await svc.update('T1', { startDate: today }, { id: 'U-1', name: 'Edward' });
    expect(t).toMatchObject({ status: 'In progress', sectionId: 'S-prog', startDate: today });
  });

  it('nothing goes In Progress without an assignee', async () => {
    const svc = setup({ id: 'T1', projectId: 23, sectionId: 'S-todo', status: 'Not started' });
    await expect(svc.update('T1', { status: 'In progress' }, { id: 'U-1', name: 'Edward' })).rejects.toThrow(/Assign someone/);
    expect((await svc.update('T1', { startDate: '2020-01-01' }, { id: 'U-1', name: 'Edward' })).status).toBe('Not started');
  });

  it('marking it complete needs a note, which goes into the activity', async () => {
    const svc = setup({ id: 'T1', projectId: 23, sectionId: 'S-prog', status: 'In progress', assigneeId: 'U-2', assignee: 'Astrid', activity: [] });
    await expect(svc.update('T1', { status: 'Done' }, { id: 'U-2', name: 'Astrid' })).rejects.toThrow(/note saying what was done/);
    const t = await svc.update('T1', { status: 'Done', completionNote: '  Sent to the client on the 20th ' }, { id: 'U-2', name: 'Astrid' });
    expect(t).toMatchObject({ status: 'Done', completionNote: 'Sent to the client on the 20th' });
    expect(t.activity.some((e: any) => e.type === 'comment' && /Sent to the client/.test(e.text))).toBe(true);
  });

  it('a start date reached later starts the task on the next check', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const row = { id: 'T1', projectId: 23, sectionId: 'S-todo', status: 'Assigned', assigneeId: 'U-2', assignee: 'Astrid', startDate: today };
    const svc = setup(row);
    (svc as any).repo.find = jest.fn(async () => [row]);
    expect(await svc.startDueTasks()).toBe(1);
    expect((await (svc as any).repo.findOneBy({ id: 'T1' })).status).toBe('In progress');
  });
});
