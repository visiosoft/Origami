import { TasksService } from './tasks.service';

/** Request Log tasks can be linked to a lead as well as a project. */
describe('Request Log lead links', () => {
  const setup = () => {
    const rows: any[] = [
      { id: 'T1', topicType: 'Task', subject: 'Site visit', status: 'To Do', project: 'D-7', activity: [] },
      { id: 'T2', topicType: 'Task', subject: 'Order tile', status: 'To Do', project: 'Chelliah', activity: [] },
    ];
    const repo = {
      create: (r: any) => r,
      find: async (o?: any) => {
        const where = o?.where;
        if (!where) return rows;
        const ors = Array.isArray(where) ? where : [where];
        return rows.filter((r) => ors.some((w: any) => Object.entries(w).every(([k, v]) => r[k] === v)));
      },
      findBy: async (w: any) => rows.filter((r) => Object.entries(w).every(([k, v]) => r[k] === v)),
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      save: async (r: any) => { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
      update: async (w: any, p: any) => { const r = rows.find((x) => x.id === w.id); if (r) Object.assign(r, p); },
    };
    const users = { findOneBy: async () => null, find: async () => [] };
    const notifications = { taskAssigned: () => undefined, taskFollowUp: () => undefined };
    const leadRows = [{ id: 'D-7', leadName: 'Ana Ruiz', businessName: 'Ruiz Bakery' }, { id: 'D-9', leadName: 'Tom Lee', businessName: '' }];
    const leads = { find: async () => leadRows, findOneBy: async (w: any) => leadRows.find((l) => l.id === w.id) || null };
    const deals = { find: async () => leadRows.map((l) => ({ id: l.id, stage: 'intake' })), findOneBy: async (w: any) => (leadRows.some((l) => l.id === w.id) ? { id: w.id } : null) };
    const projects = { find: async () => [] };
    const svc = new TasksService(repo as any, users as any, {} as any, notifications as any, undefined, undefined, undefined, leads as any, deals as any, projects as any);
    return { svc, rows };
  };

  it('moves tasks filed under a lead id onto a real lead link once', async () => {
    const { svc, rows } = setup();
    expect(await svc.linkLeads()).toBe(1);
    expect(rows[0]).toMatchObject({ leadId: 'D-7', leadName: 'Ruiz Bakery', project: '' });
    expect(await svc.linkLeads()).toBe(0);
    // The CRM panel still finds them by the lead's id.
    expect((await svc.findAll(undefined, 'D-7')).map((t: any) => t.id)).toEqual(['T1']);
  });

  it('links a new or edited task to a lead, by leadId or a lead id given as the project', async () => {
    const { svc, rows } = setup();
    const t = await svc.create({ subject: 'Measure', project: 'D-9' }, { name: 'Sara' });
    expect(t).toMatchObject({ leadId: 'D-9', leadName: 'Tom Lee', project: '' });
    const u = await svc.update('T2', { leadId: 'D-7' }, { name: 'Sara' });
    expect(u).toMatchObject({ leadId: 'D-7', leadName: 'Ruiz Bakery', project: 'Chelliah' });
    await expect(svc.update('T2', { leadId: 'NOPE' }, { name: 'Sara' })).rejects.toThrow(/no longer exists/);
    // Converting the lead puts its project-less tasks on the new project.
    await svc.adoptLead('D-9', 'Lee Residence');
    expect(rows.find((r) => r.id === t.id).project).toBe('Lee Residence');
  });
});
