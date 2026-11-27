import { ProjectTasksService } from './project-tasks.service';
import { TasksService } from '../tasks/tasks.service';

/** Nov 27 (Weekly Sync): no deleting a task without saying why. */
describe('deleting a task needs a reason', () => {
  it('board task: refused without a reason; with one, the task and its subtasks go', async () => {
    const rows: any[] = [{ id: 'T1', parentId: null, attachments: [] }, { id: 'T2', parentId: 'T1', attachments: [] }];
    const repo: any = {
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      find: async (o: any) => rows.filter((r) => r.parentId === o.where.parentId),
      remove: async (x: any) => { for (const r of [x].flat()) rows.splice(rows.indexOf(r), 1); },
    };
    const svc = Object.create(ProjectTasksService.prototype) as any;
    svc.repo = repo; svc.attachments = { discardAll: async () => undefined };
    await expect(svc.remove('T1', '  ')).rejects.toThrow(/Say why/);
    expect(rows).toHaveLength(2);
    await svc.remove('T1', 'Duplicate of T-9');
    expect(rows).toHaveLength(0);
  });
  it('log task: refused without a reason', async () => {
    const svc = Object.create(TasksService.prototype) as any;
    svc.repo = { findOneBy: async () => ({ id: 'L1', attachments: [] }), remove: async () => undefined };
    svc.attachments = { discardAll: async () => undefined };
    await expect(svc.remove('L1')).rejects.toThrow(/Say why/);
    await expect(svc.remove('L1', 'Raised twice')).resolves.toMatchObject({ deleted: true });
  });
});
