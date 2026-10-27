import { ProjectTasksService } from './project-tasks.service';

/** Task ids are made on the server and never repeat; numbers count across the board and the Request Log. */
describe('task ids and numbers', () => {
  const setup = () => {
    const rows: any[] = [{ id: 'T-1', projectId: 4, sectionId: 'S1', serial: `T-${new Date().getFullYear()}-0003`, title: 'Old', activity: [] }];
    const repo = {
      findOneBy: jest.fn(async (w: any) => rows.find((r) => r.id === w.id) || null),
      find: jest.fn(async () => rows),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => { rows.push(x); return x; }),
    };
    const userRepo = { findOneBy: jest.fn(async () => null), find: jest.fn(async () => []) };
    const logs = { find: jest.fn(async () => [{ id: '20261027-01', serial: `T-${new Date().getFullYear()}-0007` }]) };
    const projects = { findOneBy: jest.fn(async () => ({ id: 4, name: 'Narvaes Residence' })) };
    const svc = new ProjectTasksService(repo as any, userRepo as any, { forProject: async () => [{ id: 'S1', name: 'To Do' }] } as any, {} as any, { taskAssigned: jest.fn() } as any,
      undefined, undefined, undefined, logs as any, projects as any);
    return { svc, rows, logs };
  };

  it('ignores an id from the client and makes a fresh one each time, even back to back', async () => {
    const { svc } = setup();
    const a: any = await svc.create({ id: 'T-1', title: 'A', projectId: 4, sectionId: 'S1' }, { name: 'Edward' });
    const b: any = await svc.create({ title: 'B', projectId: 4, sectionId: 'S1' }, { name: 'Edward' });
    expect(a.id).not.toBe('T-1');
    expect(a.id).not.toBe(b.id);
  });

  it('numbers continue after the highest in the project, board and Request Log together', async () => {
    const { svc, logs } = setup();
    const t: any = await svc.create({ title: 'A', projectId: 4, sectionId: 'S1' }, { name: 'Edward' });
    expect(t.serial).toBe(`T-${new Date().getFullYear()}-0008`);
    expect(logs.find).toHaveBeenCalledWith(expect.objectContaining({ where: { project: 'Narvaes Residence' } }));
  });
});
