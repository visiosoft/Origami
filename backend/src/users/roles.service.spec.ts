import { RolesService, SITE_SUPER_TRIM_KEY } from './roles.service';
import { SITE_SUPER_PERMISSIONS } from '../seed-data/users';

const repoOf = (rows: any[]) => ({
  rows,
  find: jest.fn(async () => rows),
  findOneBy: jest.fn(async (w: any) => rows.find((r) => r.key === w.key) || null),
  save: jest.fn(async (x: any) => {
    for (const r of Array.isArray(x) ? x : [x]) {
      const i = rows.findIndex((y) => y.key === r.key);
      if (i >= 0) rows[i] = r; else rows.push(r);
    }
    return x;
  }),
});

describe('RolesService.trimSiteSuper', () => {
  it('cuts the Site Superintendent role to dashboard and tasks, once', async () => {
    const roles = repoOf([{ key: 'site_super', permissions: { manpower_con: { view: true, manage: true }, rfis: { view: true, manage: true } } }]);
    const settings = repoOf([]);
    const svc = new RolesService(roles as any, settings as any);
    await svc.trimSiteSuper();
    const p = roles.rows[0].permissions;
    expect(p).toEqual(SITE_SUPER_PERMISSIONS);
    expect(Object.entries(p).filter(([, v]: any) => v.view).map(([k]) => k).sort()).toEqual(['dashboard', 'tasks']);
    expect(Object.values(p).some((v: any) => v.manage)).toBe(false);
    expect(settings.rows.map((r) => r.key)).toEqual([SITE_SUPER_TRIM_KEY]);

    // Later edits in User Access & Roles are left alone.
    roles.rows[0].permissions = { ...p, rfis: { view: true, manage: false } };
    await svc.trimSiteSuper();
    expect(roles.rows[0].permissions.rfis.view).toBe(true);
  });
});

describe('RolesService: changing a role\'s type', () => {
  const setup = (holders: number) => {
    const roles = repoOf([{ key: 'role_1', name: 'Owner rep', tier: 'internal', isSystem: false }, { key: 'pm', name: 'Project Manager', tier: 'internal', isSystem: true }]);
    const users = { count: jest.fn(async () => holders) };
    return { roles, svc: new RolesService(roles as any, repoOf([]) as any, users as any) };
  };
  it('changes the type while nobody has the role', async () => {
    const { roles, svc } = setup(0);
    await svc.update('role_1', { name: 'Owner rep', tier: 'client' });
    expect(roles.rows[0].tier).toBe('client');
  });
  it('refuses while people have it, for built-in roles, and for unknown types', async () => {
    await expect(setup(2).svc.update('role_1', { tier: 'client' })).rejects.toThrow('2 people have the Owner rep role');
    await expect(setup(0).svc.update('pm', { tier: 'client' })).rejects.toThrow('built-in role');
    await expect(setup(0).svc.update('role_1', { tier: 'vendor' })).rejects.toThrow('Pick Internal, Client or Third Party');
  });
  it('a save that keeps the type is not a type change', async () => {
    const { roles, svc } = setup(5);
    await svc.update('role_1', { name: 'Owner rep 2', tier: 'internal' });
    expect(roles.rows[0].name).toBe('Owner rep 2');
  });
});
