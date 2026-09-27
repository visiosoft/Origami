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
  it('cuts the Site Superintendent role to dashboard, tasks and File Room, once', async () => {
    const roles = repoOf([{ key: 'site_super', permissions: { manpower_con: { view: true, manage: true }, rfis: { view: true, manage: true } } }]);
    const settings = repoOf([]);
    const svc = new RolesService(roles as any, settings as any);
    await svc.trimSiteSuper();
    const p = roles.rows[0].permissions;
    expect(p).toEqual(SITE_SUPER_PERMISSIONS);
    expect(Object.entries(p).filter(([, v]: any) => v.view).map(([k]) => k).sort()).toEqual(['dashboard', 'planroom', 'tasks']);
    expect(Object.values(p).some((v: any) => v.manage)).toBe(false);
    expect(settings.rows.map((r) => r.key)).toEqual([SITE_SUPER_TRIM_KEY]);

    // Later edits in User Access & Roles are left alone.
    roles.rows[0].permissions = { ...p, rfis: { view: true, manage: false } };
    await svc.trimSiteSuper();
    expect(roles.rows[0].permissions.rfis.view).toBe(true);
  });
});
