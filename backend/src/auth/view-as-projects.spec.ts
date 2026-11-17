import { ProjectAccessService } from './project-access.service';

/** Nov 17: "View as" showed projects the person isn't on. */
describe('project membership and scope', () => {
  const roles: Record<string, any> = {
    site_super: { key: 'site_super', permissions: {} },
    pm: { key: 'pm', permissions: { __overall: { view: true, manage: true, extent: 'portfolio' } } },
    pm_assigned: { key: 'pm_assigned', permissions: { __overall: { view: true, manage: true, extent: 'assigned' } } },
  };
  const projects = [
    { id: 7, name: 'Countryside', roles: { superintendent: 'U-G' } },
    { id: 8, name: 'HOM Cafe', roles: { projectManager: 'U-P' } },
    { id: 9, name: 'Kinos', roles: null },
  ];
  const svc = new ProjectAccessService(
    { find: async () => [{ id: 1, email: 'p@o.com', userId: 'U-P', projects: ['Kinos'] }] } as any,
    { find: async () => projects } as any,
    { findOneBy: async (w: any) => roles[w.key] || null } as any,
    { findOneBy: async (w: any) => ({ id: w.id, permissionOverrides: null }) } as any,
  );
  const who = (sub: string, roleKey: string) => ({ sub, email: sub === 'U-P' ? 'p@o.com' : 'g@o.com', name: sub, roleKey, tier: 'internal' }) as any;

  it('a project’s own team counts as being on it, even with no People entry', async () => {
    expect(await svc.allowedIds(who('U-G', 'site_super'))).toEqual(new Set([7]));
  });
  it('People entries and team roles add up', async () => {
    expect(await svc.allowedIds(who('U-P', 'pm_assigned'))).toEqual(new Set([8, 9]));
  });
  it('says how far access reaches, for the View as banner', async () => {
    expect(await svc.projectScope(who('U-P', 'pm'))).toBe('all');
    expect(await svc.projectScope(who('U-P', 'pm_assigned'))).toBe('assigned');
    expect(await svc.projectScope({ sub: 'C', roleKey: 'client', tier: 'client' } as any)).toBe('linked');
  });
  it('viewing as a role has no person behind it: no team projects', async () => {
    expect(await svc.allowedIds({ sub: 'VIEW-site_super', email: '', roleKey: 'site_super', tier: 'internal' } as any)).toEqual(new Set());
  });
});
