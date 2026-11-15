import { RolesService } from './roles.service';

/** Nov 3 sync: two "Consultant", two "Subcontractor"… keep the access-matrix set. */
describe('duplicate roles', () => {
  const setup = () => {
    const roles: any[] = [
      { key: 'consultant', name: 'Consultant' }, { key: 'r_consultant', name: 'Consultant' },
      { key: 'site_super', name: 'Site Superintendent' }, { key: 'r_internal_super', name: 'Internal Super' },
      { key: 'project_manager', name: 'Project Manager' },
    ];
    const users: any[] = [{ id: 'U-G', name: 'George', email: 'g@o.com', roleKey: 'site_super' }, { id: 'U-C', name: 'Cons', email: 'c@x.com', roleKey: 'r_consultant' }];
    const repo = { find: async () => roles, delete: jest.fn(async (w: any) => { const i = roles.findIndex((r) => r.key === w.key); if (i >= 0) roles.splice(i, 1); }), save: jest.fn() };
    const userRepo = { find: async () => users, update: jest.fn(async (w: any, p: any) => Object.assign(users.find((u) => u.id === w.id), p)), count: async (q: any) => users.filter((u) => u.roleKey === q.where.roleKey).length };
    return { svc: new RolesService(repo as any, {} as any, userRepo as any), roles, users, repo };
  };
  it('previews who would move without changing anything', async () => {
    const { svc, repo } = setup();
    const plan = await svc.duplicatePlan();
    expect(plan.map((p) => `${p.from.key}->${p.to.key}:${p.users.map((u) => u.name).join(',')}`)).toEqual(['site_super->r_internal_super:George', 'consultant->r_consultant:']);
    expect((await svc.mergeDuplicates(false)).applied).toBe(false);
    expect(repo.delete).not.toHaveBeenCalled();
  });
  it('applies only when confirmed: people move, the empty old roles go', async () => {
    const { svc, roles, users } = setup();
    expect(await svc.mergeDuplicates(true)).toEqual({ applied: true, moved: 1, removed: ['site_super', 'consultant'] });
    expect(users[0].roleKey).toBe('r_internal_super');
    expect(roles.map((r) => r.key)).toEqual(['r_consultant', 'r_internal_super', 'project_manager']);
  });
});
