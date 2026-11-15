import { MailService } from './mail.service';
import { sealSecret } from '../auth/totp';

/** My Mail only asks Gmail for threads that are new or changed (historyId). */
describe('My Mail cache', () => {
  function setup() {
    const users = [{ id: 'U-1', name: 'Ed', email: 'ed@o.co', mailEmail: 'ed@o.co', mailRefreshToken: sealSecret('refresh', 'jwt') }];
    const repo = (rows: any[]) => ({
      findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null,
      find: async () => [], create: (x: any) => x, save: async (x: any) => x,
    });
    const list = [{ id: 'T1', historyId: '10' }, { id: 'T2', historyId: '20' }];
    const hist: Record<string, string> = { T1: '10', T2: '20' };
    const calls: string[] = [];
    const msg = (id: string) => ({ id: 'M' + id, threadId: id, internalDate: '1763100000000', snippet: 'hi', labelIds: ['INBOX'], payload: { headers: [{ name: 'Subject', value: 'S ' + id }, { name: 'From', value: 'a@b.co' }] } });
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      const u = String(url);
      if (u.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'AT', expires_in: 3600 }) } as any;
      calls.push(`${init?.method || 'GET'} ${u.replace(/^.*gmail\/v1\/users\/me/, '')}`);
      if (/\/threads\?/.test(u)) return { ok: true, status: 200, json: async () => ({ threads: list.map((t) => ({ ...t, historyId: hist[t.id] })) }) } as any;
      const m = u.match(/\/threads\/(T\d)\?format=(\w+)/);
      if (m) return { ok: true, status: 200, json: async () => ({ id: m[1], historyId: hist[m[1]], ...(m[2] === 'minimal' ? {} : { messages: [msg(m[1])] }) }) } as any;
      if (u.endsWith('/messages/send')) return { ok: true, status: 200, json: async () => ({ id: 'M9', threadId: 'T1' }) } as any;
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });
    const none: any = repo([]);
    const svc = new MailService(repo(users) as any, none, none, none, none, none, none, { jwtSecret: async () => 'jwt' } as any,
      { credentials: async () => ({ clientId: 'c', clientSecret: 's' }) } as any, {} as any);
    return { svc, calls, hist };
  }
  afterEach(() => jest.restoreAllMocks());

  it('the list asks again only for threads that changed', async () => {
    const { svc, calls, hist } = setup();
    const first = await svc.threads('U-1');
    expect(first.threads.map((t) => t.subject)).toEqual(['S T1', 'S T2']);
    expect(calls.filter((c) => c.includes('format=metadata'))).toHaveLength(2);
    calls.length = 0;
    await svc.threads('U-1');
    expect(calls).toEqual([expect.stringMatching(/^GET \/threads\?/)]); // just the list
    calls.length = 0;
    hist.T2 = '21';
    await svc.threads('U-1');
    expect(calls.filter((c) => c.includes('format=metadata'))).toEqual([expect.stringContaining('/threads/T2?')]);
  });

  it('an opened thread is fetched in full only when it changed; sending into it refreshes it', async () => {
    const { svc, calls, hist } = setup();
    await svc.thread('U-1', 'T1');
    calls.length = 0;
    const again = await svc.thread('U-1', 'T1');
    expect(again.messages).toHaveLength(1);
    expect(calls).toEqual(['GET /threads/T1?format=minimal']);
    calls.length = 0;
    hist.T1 = '11';
    await svc.thread('U-1', 'T1');
    expect(calls).toEqual(['GET /threads/T1?format=minimal', 'GET /threads/T1?format=full']);
    calls.length = 0;
    await svc.send('U-1', { to: 'kai@lono.test', subject: 'Re', html: '<p>x</p>', threadId: 'T1', track: false } as any);
    calls.length = 0;
    await svc.thread('U-1', 'T1');
    expect(calls).toEqual(['GET /threads/T1?format=full']);
  });
});
