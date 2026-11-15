import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword, verifyJwt } from './crypto.util';
import { allowedMethods, canSend, maskTo } from './otp';

const SECRET = 'test-secret-test-secret-test-secret';

describe('two-step codes by text or email (Nov 13)', () => {
  let users: any[];
  let texts: { to: string; body: string; category?: string }[];
  let mails: { to: string; subject: string }[];
  let methodsSetting: string | null;
  const make = () => {
    users = [{ id: 'U-1', email: 'ed@x.com', name: 'Ed', roleKey: 'project_manager', tier: 'internal', status: 'active', passwordHash: hashPassword('Secret-pass-1') }];
    texts = []; mails = []; methodsSetting = null;
    const repo = { findOneBy: async (w: any) => users.find((u) => u.id === w.id) || null, save: async (u: any) => u };
    const settings = { jwtSecret: async () => SECRET, get: async (k: string) => (k === 'auth.twoFactorMethods' ? methodsSetting : null) };
    const google = { sendMail: async (m: any) => { mails.push(m); } };
    const sms = { send: async (m: any) => { texts.push(m); return { sent: true }; } };
    const svc = new AuthService(repo as any, { findOneBy: async () => null } as any, { find: async () => [] } as any, settings as any, google as any, undefined, sms as any);
    (svc as any).findByEmail = async (e: string) => users.find((u) => u.email === e) || null;
    return svc;
  };
  const codeIn = (s: string) => s.match(/\d{6}/)![0];
  const later = (ms: number) => { const real = Date.now; jest.spyOn(Date, 'now').mockReturnValue(real() + ms); };
  afterEach(() => jest.restoreAllMocks());

  it('rate limit, masking and allowed methods', () => {
    const now = Date.parse('2026-11-13T10:00:00Z');
    const iso = (s: number) => new Date(now - s * 1000).toISOString();
    expect(canSend([iso(10)], now)).toEqual({ ok: false, wait: 20 });
    expect(canSend([iso(100), iso(200), iso(300), iso(400), iso(500)], now)).toMatchObject({ ok: false });
    expect(canSend([iso(4000)], now)).toMatchObject({ ok: true });
    expect(maskTo('sms', '+14155550100')).toBe('•••• 0100');
    expect(maskTo('email', 'ed@origami.com')).toBe('e•••@origami.com');
    expect(allowedMethods('email')).toEqual(['app', 'email']);
    expect(allowedMethods('')).toEqual(['app', 'sms', 'email']);
  });

  it('set up by text: the code goes to the number picked; it proves the number; sign-in then texts a code', async () => {
    const svc = make();
    const t1: any = await svc.login('ed@x.com', 'Secret-pass-1');
    expect(t1).toMatchObject({ twoFactor: 'setup', methods: ['app', 'sms', 'email'] });
    expect(await svc.twoFactorSend(t1.ticket, { method: 'sms', phone: '(415) 555-0100' })).toEqual({ sentTo: '•••• 0100' });
    expect(texts[0]).toMatchObject({ to: '+14155550100', category: 'security' });
    await expect(svc.twoFactorEnable(t1.ticket, '000000', '', false, 'sms')).rejects.toBeInstanceOf(UnauthorizedException);
    const on: any = await svc.twoFactorEnable(t1.ticket, codeIn(texts[0].body), '', false, 'sms');
    expect(verifyJwt(on.token, SECRET)!.sub).toBe('U-1');
    expect(on.backupCodes).toHaveLength(10);
    expect(users[0]).toMatchObject({ twoFactorMethod: 'sms', twoFactorPhone: '+14155550100', otpHash: null });

    const t2: any = await svc.login('ed@x.com', 'Secret-pass-1');
    expect(t2).toMatchObject({ twoFactor: 'code', method: 'sms', sentTo: '•••• 0100' });
    later(31_000);
    await svc.twoFactorSend(t2.ticket);
    const code = codeIn(texts[1].body);
    const s: any = await svc.twoFactorVerify(t2.ticket, { code });
    expect(s.token).toBeTruthy();
    await expect(svc.twoFactorVerify(t2.ticket, { code })).rejects.toBeInstanceOf(UnauthorizedException); // used once
  });

  it('by email; a code runs out after 10 minutes; only the newest works; asking again too soon is refused', async () => {
    const svc = make();
    const t1: any = await svc.login('ed@x.com', 'Secret-pass-1');
    await svc.twoFactorSend(t1.ticket, { method: 'email' });
    expect(mails[0].to).toBe('ed@x.com');
    await expect(svc.twoFactorSend(t1.ticket, { method: 'email' })).rejects.toThrow(/Wait \d+ seconds/);
    await svc.twoFactorEnable(t1.ticket, codeIn(mails[0].subject), '', false, 'email');
    const t2: any = await svc.login('ed@x.com', 'Secret-pass-1');
    later(31_000);
    await svc.twoFactorSend(t2.ticket);
    const first = codeIn(mails[1].subject);
    jest.restoreAllMocks(); later(62_000);
    await svc.twoFactorSend(t2.ticket);
    const second = codeIn(mails[2].subject);
    if (first !== second) await expect(svc.twoFactorVerify(t2.ticket, { code: first })).rejects.toBeInstanceOf(UnauthorizedException);
    jest.restoreAllMocks(); later(62_000 + 11 * 60_000);
    await expect(svc.twoFactorVerify(t2.ticket, { code: second })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('only the methods the administrators allow', async () => {
    const svc = make();
    methodsSetting = 'app,email';
    const t1: any = await svc.login('ed@x.com', 'Secret-pass-1');
    await expect(svc.twoFactorSend(t1.ticket, { method: 'sms', phone: '4155550100' })).rejects.toThrow(/isn’t available/);
  });
});
