import { ForbiddenException } from '@nestjs/common';
import { ProjectAccessService } from './project-access.service';
import { PermGuard } from './guards/perm.guard';
import { narrow } from './project-scope.interceptor';
import { onMyProjects } from '../database/viewer.util';

/** Oct 30 sync: the server applies a role's access settings, not only the menu. */
describe('access enforcement', () => {
  const roles: Record<string, any> = {
    site_super: { key: 'site_super', permissions: { dashboard: { view: true }, tasks: { view: true, manage: true }, __overall: { view: true, extent: 'assigned' } } },
    pm: { key: 'pm', permissions: { projects: { view: true }, fin_project: { view: true }, pipeline: { view: false } } },
  };
  const users: Record<string, any> = { 'U-G': { id: 'U-G', permissionOverrides: null }, 'U-P': { id: 'U-P', permissionOverrides: { pipeline: { level: 'view' } } } };
  const svc = new ProjectAccessService(
    { find: async () => [{ id: 1, email: 'george@o.com', userId: 'U-G', projects: ['Countryside'] }] } as any,
    { find: async () => [{ id: 7, name: 'Countryside' }, { id: 8, name: 'HOM Cafe' }] } as any,
    { findOneBy: async (w: any) => roles[w.key] || null } as any,
    { findOneBy: async (w: any) => users[w.id] || null } as any,
  );
  const george = { sub: 'U-G', email: 'george@o.com', name: 'George', roleKey: 'site_super', tier: 'internal' } as any;
  const pm = { sub: 'U-P', email: 'p@o.com', name: 'Pat', roleKey: 'pm', tier: 'internal' } as any;
  const admin = { sub: 'U-A', email: 'a@o.com', name: 'Ed', roleKey: 'admin', tier: 'internal' } as any;
  const client = { sub: 'U-C', email: 'c@x.com', name: 'Client', roleKey: 'client', tier: 'client' } as any;

  it('checks module view from the role and the person’s own changes', async () => {
    expect(await svc.canView(george, 'fin_project', 'fin_business')).toBe(false);
    expect(await svc.canView(george, 'tasks')).toBe(true);
    expect(await svc.canView(pm, 'pipeline')).toBe(true); // granted to Pat personally
    expect(await svc.canView(admin, 'anything')).toBe(true);
    expect(await svc.canView(client, 'pipeline')).toBe(true); // outside accounts are scoped by project instead
  });

  it('refuses a route outside the role, with the guard', async () => {
    const guard = new PermGuard({ getAllAndOverride: () => ['fin_project'] } as any, svc);
    const ctx = (claims: any) => ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ claims }) }) }) as any;
    await expect(guard.canActivate(ctx(george))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx(pm))).resolves.toBe(true);
    const open = new PermGuard({ getAllAndOverride: () => undefined } as any, svc);
    await expect(open.canActivate(ctx(george))).resolves.toBe(true);
  });

  it('narrows "Assigned projects" to the person’s own projects', async () => {
    expect(await svc.allowedIds(george)).toEqual(new Set([7]));
    expect(await svc.allowedNames(george)).toEqual(new Set(['Countryside']));
    expect(await svc.allowedIds(pm)).toBe('all');
    const allowed = new Set([7]);
    expect(narrow([{ projectId: 7 }, { projectId: 8 }, { projectId: null }, { other: 1 }], allowed)).toEqual([{ projectId: 7 }, { projectId: null }, { other: 1 }]);
    expect(narrow({ rows: [{ projectId: 8 }], total: 1 }, allowed)).toEqual({ rows: [], total: 1 });
    expect(() => narrow({ id: 'INV-1', projectId: 8 }, allowed)).toThrow(ForbiddenException);
    const log = [{ id: 'a', project: 'Countryside' }, { id: 'b', project: 'HOM Cafe' }, { id: 'c', project: '', assignedToId: 'U-G' }, { id: 'd', project: '' }];
    expect(onMyProjects(log, new Set(['Countryside']), george).map((t) => t.id)).toEqual(['a', 'c']);
  });
});
