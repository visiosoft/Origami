import { readFileSync } from 'fs';
import { join } from 'path';
import { fillByRole, roleKeyOf, roleSummary } from './project-roles';
import { PhasesService } from './phases.service';

describe('role-based task assignment (Nov 13)', () => {
  it('one list for the programme teams, CRM keys and access role names', () => {
    expect(roleKeyOf('Project Manager')).toBe('projectManager');
    expect(roleKeyOf('projectCoordinator')).toBe('projectCoordinator');
    expect(roleKeyOf('Internal Project Coordinator')).toBe('projectCoordinator');
    expect(roleKeyOf('Interior Design')).toBe('designer');
    expect(roleKeyOf('Permits & Compliance')).toBe('permits');
    expect(roleKeyOf('Admin')).toBe('admin');
    expect([roleKeyOf('Client'), roleKeyOf('Automation'), roleKeyOf('')]).toEqual([null, null, null]);
  });

  it('fills unassigned role tasks from the team; never a hand-picked person or a done task', () => {
    const tasks: any[] = [
      { id: 1, team: 'Project Manager' },
      { id: 2, team: 'Project Manager', assignee: 'Someone', assigneeId: 'U-X' },
      { id: 3, team: 'Architect' },
      { id: 4, team: 'Project Coordinator', completed: true },
      { id: 5, team: 'Client' },
    ];
    const names: Record<string, string> = { 'U-PM': 'Pat PM', 'U-AR': 'Ari Arch' };
    const changed = fillByRole(tasks, { projectManager: 'U-PM', architect: 'U-AR', projectCoordinator: 'U-PC' }, (id) => names[id] || null);
    expect(changed.map((t) => t.id)).toEqual([1, 3]);
    expect(tasks[0]).toMatchObject({ assigneeId: 'U-PM', assignee: 'Pat PM' });
    expect(tasks[1]).toMatchObject({ assigneeId: 'U-X' });
    expect(tasks[3].assigneeId).toBeUndefined();
  });

  it('the team card counts open tasks waiting on each empty role', () => {
    const s = roleSummary([{ team: 'Project Coordinator' }, { team: 'Project Coordinator', status: 'Done' }, { team: 'Admin' }, { team: 'Admin', assignee: 'X' }], { projectManager: 'U-PM' });
    expect(s.find((r) => r.key === 'projectCoordinator')).toMatchObject({ waiting: 1, userId: null });
    expect(s.find((r) => r.key === 'admin')).toMatchObject({ waiting: 1 });
    expect(s.find((r) => r.key === 'projectManager')).toMatchObject({ userId: 'U-PM', waiting: 0 });
  });

  it('setting the team fills that project’s open tasks', async () => {
    const tasks: any[] = [{ id: 'T1', projectId: 7, team: 'Project Coordinator' }, { id: 'T2', projectId: 7, team: 'Estimator' }];
    const project: any = { id: 7, roles: null };
    const svc = new PhasesService(
      {} as any,
      { find: async () => tasks, save: async (x: any) => x } as any,
      { findOne: async () => ({ ...project }), findOneBy: async () => ({ ...project }), update: async (_w: any, p: any) => Object.assign(project, p) } as any,
      {} as any, {} as any,
      { find: async () => [{ id: 'U-PC', name: 'Casey PC', status: 'active' }] } as any,
    );
    await expect(svc.setTeam(7, { nope: 'U-1' })).rejects.toThrow(/Unknown role/);
    const out = await svc.setTeam(7, { projectCoordinator: 'U-PC' });
    expect(out.filled).toBe(1);
    expect(tasks[0]).toMatchObject({ assignee: 'Casey PC', assigneeId: 'U-PC' });
    expect(out.summary.find((r: any) => r.key === 'estimator')).toMatchObject({ waiting: 1 });
  });

  it('the browser copy of the role list is identical', () => {
    const a = readFileSync(join(__dirname, 'project-roles.ts'), 'utf8');
    const b = readFileSync(join(__dirname, '../../../frontend/src/data/projectRoles.ts'), 'utf8');
    expect(b).toBe(a);
  });
});
