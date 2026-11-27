import { ProjectTasksService } from './project-tasks.service';

/** Nov 27 (Weekly Sync): admins and principals move a task made on the wrong project. */
describe('moving a task to another project', () => {
  function setup() {
    const rows: any[] = [
      { id: 'T1', parentId: null, projectId: 7, sectionId: 's7-prog', status: 'In progress', phaseId: 'PH-7-x', epicId: 'E1', activity: [] },
      { id: 'T2', parentId: 'T1', projectId: 7, sectionId: 's7-todo', status: 'Not started', activity: [] },
    ];
    const sections: Record<string, any[]> = {
      7: [{ id: 's7-todo', name: 'To Do' }, { id: 's7-prog', name: 'In Progress' }],
      9: [{ id: 's9-todo', name: 'To do' }, { id: 's9-prog', name: 'In progress' }, { id: 's9-rev', name: 'In Review' }],
    };
    const svc = Object.create(ProjectTasksService.prototype) as any;
    svc.repo = { find: async (o: any) => rows.filter((r) => r.parentId === o.where.parentId), save: async (x: any) => x };
    svc.load = async (id: string) => rows.find((r) => r.id === id);
    svc.hydrate = (t: any) => t;
    svc.sections = { forProject: async (pid: number | null) => sections[String(pid)] || [] };
    svc.projects = { findOne: async (o: any) => ({ 7: { id: 7, name: 'Countryside' }, 9: { id: 9, name: 'HŌM Cafe' } } as any)[o.where.id] || null };
    return { svc, rows };
  }
  it('moves the task and its subtasks into the same-named columns, clears phase and epic, and says so', async () => {
    const { svc, rows } = setup();
    await svc.move('T1', 9, { name: 'Edward', roleKey: 'admin' });
    expect(rows.map((r) => [r.projectId, r.sectionId, r.phaseId, r.epicId])).toEqual([[9, 's9-prog', null, null], [9, 's9-todo', null, null]]);
    expect(rows[0].activity.at(-1).text).toBe('moved this task from Countryside to HŌM Cafe with its 1 subtask');
  });
  it('only admins and principals; only main tasks; only real projects', async () => {
    const { svc } = setup();
    await expect(svc.move('T1', 9, { name: 'Astrid', roleKey: 'pm' })).rejects.toThrow(/admins and principals/);
    await expect(svc.move('T2', 9, { name: 'Edward', roleKey: 'admin' })).rejects.toThrow(/main task/);
    await expect(svc.move('T1', 99, { name: 'Edward', roleKey: 'principal' })).rejects.toThrow(/doesn’t exist/);
  });
});
