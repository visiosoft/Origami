import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { signJwt, verifyJwt } from './crypto.util';

/** Renewing a session: active people get a fresh token; suspended accounts and guest links don't. */
describe('AuthService.refresh', () => {
  const SECRET = 'test-secret';
  const users: any[] = [
    { id: 'U-1', email: 'sara@x.com', name: 'Sara R.', roleKey: 'project_manager', tier: 'internal', status: 'active' },
    { id: 'U-2', email: 'gone@x.com', name: 'Gone', roleKey: 'designer', tier: 'internal', status: 'suspended' },
  ];
  const repo = { findOneBy: async (w: any) => users.find((u) => u.id === w.id) || null, save: async (u: any) => u };
  const svc = new AuthService(repo as any, { findOneBy: async () => null } as any, { find: async () => [] } as any,
    { jwtSecret: async () => SECRET } as any, {} as any);
  const bearer = (sub: string, ttl = 3600) => 'Bearer ' + signJwt({ sub, email: 'a@b.c', name: 'A', roleKey: 'designer', tier: 'internal' } as any, SECRET, ttl);

  it('issues a new 12-hour token for a signed-in, active user', async () => {
    const out = await svc.refresh(bearer('U-1', 60));
    const claims = verifyJwt(out.token, SECRET)!;
    expect(claims.sub).toBe('U-1');
    expect(claims.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(11 * 3600);
  });

  it('refuses an expired token, a suspended account and a guest link', async () => {
    await expect(svc.refresh(bearer('U-1', -10))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.refresh(bearer('U-2'))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.refresh(bearer('GUEST-abc'))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
