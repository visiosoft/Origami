import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword, verifyJwt } from './crypto.util';
import { base32Encode, checkTotp, hotp, openSecret, otpauthUri, sealSecret, totp } from './totp';

describe('TOTP (RFC 6238 / RFC 4226)', () => {
  // RFC 6238 appendix B: SHA1 seed "12345678901234567890", 8 digits.
  const seed = Buffer.from('12345678901234567890');
  const b32 = base32Encode(seed);
  it('matches the RFC test vectors', () => {
    expect(totp(b32, 59_000, 8)).toBe('94287082');
    expect(totp(b32, 1111111109_000, 8)).toBe('07081804');
    expect(totp(b32, 1234567890_000, 8)).toBe('89005924');
    expect(totp(b32, 2000000000_000, 8)).toBe('69279037');
    // RFC 4226 appendix D, 6 digits
    expect([0, 1, 2, 9].map((c) => hotp(seed, c))).toEqual(['755224', '287082', '359152', '520489']);
  });
  it('accepts one step of drift, refuses a reused step and junk', () => {
    const at = 1234567890_000;
    const step = Math.floor(at / 30000);
    expect(checkTotp(b32, totp(b32, at), at)).toBe(step);
    expect(checkTotp(b32, totp(b32, at - 30000), at)).toBe(step - 1);
    expect(checkTotp(b32, totp(b32, at - 90000), at)).toBeNull();
    expect(checkTotp(b32, totp(b32, at), at, step)).toBeNull();
    expect(checkTotp(b32, 'abcdef', at)).toBeNull();
  });
  it('seals the secret so it can only be read with the server key', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', 'server-key');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(openSecret(sealed, 'server-key')).toBe('JBSWY3DPEHPK3PXP');
    expect(openSecret(sealed, 'other-key')).toBeNull();
    expect(otpauthUri('ABC', 'sara@x.com')).toBe('otpauth://totp/Origami%3Asara%40x.com?secret=ABC&issuer=Origami&algorithm=SHA1&digits=6&period=30');
  });
});

describe('two-step sign-in for staff', () => {
  const SECRET = 'test-secret';
  let users: any[];
  let setting: string | null;
  const make = () => {
    users = [
      { id: 'U-1', email: 'sara@x.com', name: 'Sara', roleKey: 'project_manager', tier: 'internal', status: 'active', passwordHash: hashPassword('Secret-pass-1') },
      { id: 'U-2', email: 'kai@x.com', name: 'Kai', roleKey: 'client', tier: 'client', status: 'active', passwordHash: hashPassword('Secret-pass-1') },
    ];
    setting = null;
    const repo = {
      findOneBy: async (w: any) => users.find((u) => u.id === w.id) || null,
      findOne: async (o: any) => users.find((u) => u.email === o?.where?.email) || null,
      createQueryBuilder: () => { let email = ''; const qb: any = { where: (_: string, p: any) => { email = p.email; return qb; }, getOne: async () => users.find((u) => u.email === email) || null }; return qb; },
      save: async (u: any) => u,
    };
    return new AuthService(repo as any, { findOneBy: async () => null } as any, { find: async () => [] } as any, { jwtSecret: async () => SECRET, get: async () => setting } as any, {} as any);
  };
  const login = async (svc: AuthService, email: string, device?: string) => {
    (svc as any).findByEmail = async (e: string) => users.find((u) => u.email === e) || null;
    return svc.login(email, 'Secret-pass-1', device);
  };

  it('staff get a ticket instead of a session; clients sign straight in; the setting can turn it off', async () => {
    const svc = make();
    const s: any = await login(svc, 'sara@x.com');
    expect(s).toMatchObject({ twoFactor: 'setup', name: 'Sara' });
    expect(s.token).toBeUndefined();
    expect(((await login(svc, 'kai@x.com')) as any).token).toBeTruthy();
    setting = 'off';
    expect(((await login(svc, 'sara@x.com')) as any).token).toBeTruthy();
  });

  it('set up, then sign in with a code, a backup code once, or a remembered device', async () => {
    const svc = make();
    const t1: any = await login(svc, 'sara@x.com');
    const { secret } = await svc.twoFactorSetup(t1.ticket);
    await expect(svc.twoFactorEnable(t1.ticket, '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    const on = await svc.twoFactorEnable(t1.ticket, totp(secret), 'Chrome', true);
    expect(verifyJwt(on.token, SECRET)!.sub).toBe('U-1');
    expect(on.backupCodes).toHaveLength(10);
    expect(users[0].totpSecret).not.toContain(secret);
    expect(users[0].backupCodes.join()).not.toContain(on.backupCodes[0]);
    // next time: a code is needed...
    const t2: any = await login(svc, 'sara@x.com');
    expect(t2.twoFactor).toBe('code');
    // ...unless this device was remembered
    expect(((await login(svc, 'sara@x.com', on.deviceToken!)) as any).token).toBeTruthy();
    // the code just used can't be used again (same step)
    await expect(svc.twoFactorVerify(t2.ticket, { code: totp(secret) })).rejects.toBeInstanceOf(UnauthorizedException);
    const viaBackup = await svc.twoFactorVerify(t2.ticket, { backupCode: on.backupCodes[3].toUpperCase() });
    expect(viaBackup.token).toBeTruthy();
    expect(viaBackup.backupCodesLeft).toBe(9);
    await expect(svc.twoFactorVerify(t2.ticket, { backupCode: on.backupCodes[3] })).rejects.toThrow(/already used/);
  });

  it('locks for 10 minutes after five wrong codes; a stale ticket or admin reset start over', async () => {
    const svc = make();
    const t: any = await login(svc, 'sara@x.com');
    const { secret } = await svc.twoFactorSetup(t.ticket);
    await svc.twoFactorEnable(t.ticket, totp(secret));
    const t2: any = await login(svc, 'sara@x.com');
    for (let i = 0; i < 5; i++) await expect(svc.twoFactorVerify(t2.ticket, { code: '123456' })).rejects.toThrow(/isn’t right/);
    await expect(svc.twoFactorVerify(t2.ticket, { code: '123456' })).rejects.toThrow(/Too many wrong codes/);
    await expect(svc.twoFactorVerify('bad.ticket', { code: '123456' })).rejects.toThrow(/Sign in again/);
    await svc.resetTwoFactor('U-1');
    expect(users[0]).toMatchObject({ totpSecret: null, totpEnabledAt: null, backupCodes: null });
    expect(((await login(svc, 'sara@x.com')) as any).twoFactor).toBe('setup');
  });
});
