import { TasksService } from './tasks.service';

/** Nov 19 (Edward): a lead's stage task goes to whoever holds that stage's role, and follows a role change while unassigned. */
describe('lead stage tasks and the lead’s roles', () => {
  const setup = () => {
    const rows: any[] = [];
    const repo = {
      create: (r: any) => r,
      find: async () => rows,
      findBy: async (w: any) => rows.filter((r) => Object.entries(w).every(([k, v]) => r[k] === v)),
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      save: async (r: any) => { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
      update: async (w: any, p: any) => { const r = rows.find((x) => x.id === w.id); if (r) Object.assign(r, p); },
    };
    const people = [{ id: 'U-PC', name: 'Astrid', status: 'active' }, { id: 'U-PM', name: 'Edward', status: 'active' }, { id: 'U-PC2', name: 'Maria', status: 'active' }];
    const users = { findOneBy: async (w: any) => people.find((u) => u.id === w.id) || null, find: async () => people };
    const notifications = { taskAssigned: () => undefined, taskFollowUp: () => undefined };
    const leadRows = [{ id: 'D-7', leadName: 'Noah Medical', businessName: '' }];
    const leads = { find: async () => leadRows, findOneBy: async (w: any) => leadRows.find((l) => l.id === w.id) || null };
    const deal = { id: 'D-7', roles: { projectCoordinator: 'U-PC', projectManager: 'U-PM' } };
    const deals = { find: async () => [deal], findOneBy: async (w: any) => (w.id === 'D-7' ? deal : null) };
    const svc = new TasksService(repo as any, users as any, {} as any, notifications as any, undefined, undefined, undefined, leads as any, deals as any, { find: async () => [] } as any);
    return { svc, rows, deal };
  };

  it('a task filed under a PC stage goes to the Project Coordinator; a PM stage to the Project Manager', async () => {
    const { svc } = setup();
    const a = await svc.create({ subject: 'Call back', leadId: 'D-7', labels: ['section:New Lead'] } as any, { name: 'Sara' });
    const b = await svc.create({ subject: 'Fit review', leadId: 'D-7', labels: ['section:Project Fit Review'] } as any, { name: 'Sara' });
    const c = await svc.create({ subject: 'Picked by hand', leadId: 'D-7', labels: ['section:New Lead'], assignedToId: 'U-PM' } as any, { name: 'Sara' });
    expect([a.assignedToId, b.assignedToId, c.assignedToId]).toEqual(['U-PC', 'U-PM', 'U-PM']);
  });

  it('unassigned stage tasks follow a role change; picked ones stay', async () => {
    const { svc, rows } = setup();
    rows.push({ id: 'T1', leadId: 'D-7', labels: ['section:Initial Questions'], status: 'To Do', assignedTo: '', assignedToId: null });
    rows.push({ id: 'T2', leadId: 'D-7', labels: ['section:Initial Questions'], status: 'Assigned', assignedTo: 'Edward', assignedToId: 'U-PM' });
    expect(await svc.followLeadRoles('D-7', { projectCoordinator: 'U-PC2' })).toBe(1);
    expect(rows[0]).toMatchObject({ assignedToId: 'U-PC2', assignedTo: 'Maria' });
    expect(rows[1].assignedToId).toBe('U-PM');
  });
});
