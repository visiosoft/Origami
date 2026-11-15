import { MailService } from './mail.service';
import { sealSecret } from '../auth/totp';

const fromB64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('My Mail open tracking and mail with an address (Batch 6)', () => {
  function setup() {
    const users = [{ id: 'U-1', name: 'Ed', email: 'ed@o.co', mailEmail: 'ed@o.co', mailRefreshToken: sealSecret('refresh', 'jwt') }];
    const sends: any[] = [];
    const repo = (rows: any[]) => ({
      findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null,
      find: async (o?: any) => (o?.where ? rows.filter((r) => Object.entries(o.where).every(([k, v]: any) => (v?._type === 'in' ? v._value.includes(r[k]) : r[k] === v))) : rows),
      save: async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; },
      update: async (w: any, p: any) => { Object.assign(rows.find((r) => r.id === w.id), p); },
      create: (x: any) => x,
    });
    let sentRaw = '';
    const seen: string[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      const u = String(url);
      if (u.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'AT', expires_in: 3600 }) } as any;
      seen.push(decodeURIComponent(u.replace(/\+/g, ' ')));
      if (u.endsWith('/messages/send')) { sentRaw = fromB64(JSON.parse(init.body).raw); return { ok: true, status: 200, json: async () => ({ id: 'G1', threadId: 'TH1' }) } as any; }
      if (u.includes('/threads/TH1?format=full')) {
        const id = (sentRaw.match(/mail-open\/([a-f0-9]{24})\.gif/) || [])[1];
        return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'G1', threadId: 'TH1', payload: { mimeType: 'text/html', headers: [{ name: 'Subject', value: 'Tile' }], body: { data: b64(`<p>Hello</p><img src="https://app.test/api/mail-open/${id}.gif" width="1">`) } } }] }) } as any;
      }
      if (u.includes('/threads?')) return { ok: true, status: 200, json: async () => ({ threads: [] }) } as any;
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });
    const none: any = repo([]);
    const svc = new MailService(repo(users) as any, none, none, none, none, none, none, { jwtSecret: async () => 'jwt', baseUrl: async () => 'https://app.test' } as any,
      { credentials: async () => ({ clientId: 'c', clientSecret: 's' }) } as any, { seesClientContacts: () => false } as any, none, repo(sends) as any);
    return { svc, sends, raw: () => sentRaw, seen };
  }
  afterEach(() => jest.restoreAllMocks());

  it('a sent email carries the tracking image; each load counts; the app hides the image and shows the opens', async () => {
    const { svc, sends, raw } = setup();
    await svc.send('U-1', { to: 'kai@lono.test', subject: 'Tile', html: '<p>Hello</p>' });
    expect(raw()).toMatch(/https:\/\/app\.test\/api\/mail-open\/[a-f0-9]{24}\.gif/);
    expect(sends[0]).toMatchObject({ gmailId: 'G1', threadId: 'TH1', ownerId: 'U-1' });
    await svc.opened(sends[0].id); await svc.opened(sends[0].id);
    await svc.opened('not-a-real-id');
    const t = await svc.thread('U-1', 'TH1');
    expect(t.messages[0].opens).toMatchObject({ count: 2 });
    expect(t.messages[0].html).toBe('<p>Hello</p>');
  });

  it('tracking can be switched off for one email', async () => {
    const { svc, sends, raw } = setup();
    await svc.send('U-1', { to: 'kai@lono.test', subject: 'Tile', html: '<p>Hello</p>', track: false });
    expect(raw()).not.toContain('mail-open');
    expect(sends).toEqual([]);
  });

  it('mail with an address searches the caller’s own mailbox', async () => {
    const { svc, seen } = setup();
    expect(await svc.withAddress('U-1', 'Kai@Lono.test')).toEqual({ connected: true, threads: [] });
    expect(seen.some((u) => u.includes('q=from:kai@lono.test OR to:kai@lono.test OR cc:kai@lono.test'))).toBe(true);
    expect(await svc.withAddress('U-1', 'not an email')).toEqual({ connected: true, threads: [] });
  });
});
