import { ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { signJwt } from './crypto.util';
import { SessionGuard } from './guards/session.guard';
import { parseViewAs, viewAsStore } from './view-as';

const SECRET = 's';
const users: any[] = [
  { id: 'U-A', email: 'ed@o.test', name: 'Edward', roleKey: 'admin', tier: 'internal', status: 'active' },
  { id: 'U-K', email: 'kai@x.test', name: 'Kai Lono', roleKey: 'r_client_closed_book', tier: 'client', status: 'active' },
  { id: 'U-P', email: 'pm@o.test', name: 'Pat PM', roleKey: 'project_manager', tier: 'internal', status: 'active' },
];
const roles: any[] = [{ key: 'r_client_closed_book', name: 'Client Closed Book', tier: 'client', permissions: { projects: { view: true, manage: false } } }];
const svc = new AuthService(
  { findOneBy: async (w: any) => users.find((u) => u.id === w.id) || null, save: async (u: any) => u } as any,
  { findOneBy: async (w: any) => roles.find((r) => r.key === w.key) || null } as any,
  { find: async () => [] } as any,
  { jwtSecret: async () => SECRET, get: async () => null } as any, {} as any,
);
const bearer = (u: any) => 'Bearer ' + signJwt({ sub: u.id, email: u.email, name: u.name, roleKey: u.roleKey, tier: u.tier } as any, SECRET, 3600);
const as = <T>(header: string | null, fn: () => Promise<T>) => viewAsStore.run({ header }, fn);

describe('View as (admins, read-only)', () => {
  it('reads the header', () => {
    expect(parseViewAs('role:r_client_closed_book')).toEqual({ kind: 'role', id: 'r_client_closed_book' });
    expect(parseViewAs('person:U-K')).toEqual({ kind: 'person', id: 'U-K' });
    expect(parseViewAs('admin')).toBeNull();
  });

  it('an admin viewing as a person gets that person’s claims, marked with who is really looking', async () => {
    const c = await as('person:U-K', () => svc.verify(bearer(users[0])));
    expect(c).toMatchObject({ sub: 'U-K', roleKey: 'r_client_closed_book', tier: 'client', viewedBy: { sub: 'U-A', as: 'Kai Lono' } });
  });

  it('as a role: a stand-in id and that role', async () => {
    const c = await as('role:r_client_closed_book', () => svc.verify(bearer(users[0])));
    expect(c).toMatchObject({ sub: 'VIEW-r_client_closed_book', roleKey: 'r_client_closed_book', tier: 'client', name: 'Client Closed Book' });
    const me: any = await as('role:r_client_closed_book', () => svc.me(bearer(users[0])));
    expect(me).toMatchObject({ roleName: 'Client Closed Book', tier: 'client', viewedBy: { as: 'Client Closed Book' } });
    expect(me.rolePermissions.projects).toMatchObject({ view: true });
  });

  it('ignored for anyone but an admin, for unknown targets, and for the real-account paths', async () => {
    expect((await as('person:U-K', () => svc.verify(bearer(users[2]))))!.sub).toBe('U-P');
    expect((await as('person:NOPE', () => svc.verify(bearer(users[0]))))!.sub).toBe('U-A');
    expect((await as('role:nope', () => svc.verify(bearer(users[0]))))!.sub).toBe('U-A');
    // refreshing the session renews the admin's own, never the viewed person's
    const s = await as('person:U-K', () => svc.refresh(bearer(users[0])));
    expect((s as any).user.id).toBe('U-A');
  });

  it('the guard lets reads through and refuses changes while viewing as', async () => {
    const guard = new SessionGuard({ getAllAndOverride: () => false } as any, svc);
    const ctx = (method: string, url: string) => {
      const req: any = { method, originalUrl: url, headers: { authorization: bearer(users[0]) } };
      return { req, c: { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => null, getClass: () => null } as any };
    };
    const get = ctx('GET', '/api/projects');
    expect(await as('person:U-K', () => guard.canActivate(get.c))).toBe(true);
    expect(get.req.claims.sub).toBe('U-K');
    await expect(as('person:U-K', () => guard.canActivate(ctx('PUT', '/api/projects/1').c))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(as('person:U-K', () => guard.canActivate(ctx('POST', '/api/auth/refresh').c))).resolves.toBe(true);
    expect(await as(null, () => guard.canActivate(ctx('PUT', '/api/projects/1').c))).toBe(true);
  });
});
