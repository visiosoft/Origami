import { ForbiddenException } from '@nestjs/common';
import { ProjectAccessService } from './project-access.service';
import { PermGuard } from './guards/perm.guard';
import { PeopleController } from '../people/people.controller';

/** Nov 3 sync: George (superintendent) saw projects, leads and the address book he shouldn't. */
describe('field roles and write access', () => {
  const roles: Record<string, any> = {
    site_super: { key: 'site_super', permissions: { dashboard: { view: true }, tasks: { view: true, manage: true } } }, // no overall setting
    r_internal_super: { key: 'r_internal_super', permissions: { __overall: { view: true, manage: true, extent: 'assigned' }, pipeline: { view: true, manage: false }, people: { view: true, manage: true }, manpower_con: { view: true, manage: false } } },
    office: { key: 'office', permissions: { projects: { view: true } } },
    accounting: { key: 'accounting', permissions: { manpower_con: { view: true, manage: true } } },
  };
  const projects = [{ id: 7, name: 'Countryside', leadId: 'PL-7' }, { id: 8, name: 'HOM Cafe', leadId: 'PL-8' }];
  const svc = new ProjectAccessService(
    { find: async () => [{ id: 1, email: 'george@o.com', userId: 'U-G', projects: ['Countryside'] }] } as any,
    { find: async () => projects } as any,
    { findOneBy: async (w: any) => roles[w.key] || null } as any,
    { findOneBy: async (w: any) => ({ id: w.id, permissionOverrides: null }) } as any,
  );
  const george = (roleKey: string) => ({ sub: 'U-G', email: 'george@o.com', name: 'George', roleKey, tier: 'internal' }) as any;
  const office = { sub: 'U-O', email: 'o@o.com', name: 'Olive', roleKey: 'office', tier: 'internal' } as any;

  it('a field role with no overall setting sees only its own projects; office roles keep every project', async () => {
    expect(await svc.allowedIds(george('site_super'))).toEqual(new Set([7]));
    expect(await svc.allowedIds(office)).toBe('all');
  });

  it('leads follow "Assigned projects": the lead behind their project, and leads they hold', async () => {
    const deals = [{ id: 'PL-7' }, { id: 'PL-8' }, { id: 'PL-9', assignee: 'George' }, { id: 'PL-10', roles: { pm: 'U-G' } }, { id: 'PL-11' }];
    expect(await svc.allowedLeadIds(george('r_internal_super'), deals)).toEqual(new Set(['PL-7', 'PL-9', 'PL-10']));
    expect(await svc.allowedLeadIds(office, deals)).toBe('all');
  });

  it('changing resource management needs manage; reading doesn’t', async () => {
    const guard = new PermGuard({ getAllAndOverride: (key: string) => (key === 'auth:manage-writes' ? ['manpower_con'] : undefined) } as any, svc);
    const ctx = (claims: any, method: string) => ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ claims, method }) }) }) as any;
    await expect(guard.canActivate(ctx(george('r_internal_super'), 'POST'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx(george('r_internal_super'), 'DELETE'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx(george('r_internal_super'), 'GET'))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ sub: 'U-AC', name: 'Acc', roleKey: 'accounting', tier: 'internal' }, 'POST'))).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ sub: 'U-A', roleKey: 'admin', tier: 'internal' }, 'DELETE'))).resolves.toBe(true);
  });

  it('the address book: our team, plus outside contacts on their own projects only', async () => {
    const people = [
      { id: 1, name: 'Astrid', kind: 'Staff', projects: [] },
      { id: 2, name: 'Jordan (client)', kind: 'Client', projects: ['Countryside'] },
      { id: 3, name: 'Other client', kind: 'Client', projects: ['HOM Cafe'] },
      { id: 4, name: 'Bay Electric', kind: 'Sub', projects: [] },
      { id: 5, name: 'George', kind: 'Staff', userId: 'U-G', projects: ['Countryside'] },
    ];
    const ctrl = new PeopleController({ findAll: async () => people } as any, {} as any, {} as any, {} as any, svc);
    expect((await ctrl.findAll(undefined, george('r_internal_super'))).map((p: any) => p.id)).toEqual([1, 2, 5]);
  });
});
