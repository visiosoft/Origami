import { MailService } from './mail.service';
import { sealSecret } from '../auth/totp';

const fromB64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

describe('My Mail drafts and templates (Batch 6)', () => {
  function setup() {
    const users = [{ id: 'U-1', name: 'Ed', email: 'ed@o.co', roleKey: 'project_manager', tier: 'internal', mailEmail: 'ed@o.co', mailRefreshToken: sealSecret('refresh', 'jwt') }];
    const templates: any[] = [];
    const repo = (rows: any[]) => ({
      findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null,
      find: async () => rows, create: (x: any) => x,
      save: async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; },
      delete: async (w: any) => { const i = rows.findIndex((r) => r.id === w.id); if (i >= 0) rows.splice(i, 1); },
    });
    const calls: { method: string; url: string; body?: any }[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      const u = String(url);
      if (u.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'AT', expires_in: 3600 }) } as any;
      calls.push({ method: init?.method || 'GET', url: u, body: init?.body ? JSON.parse(init.body) : undefined });
      if (u.endsWith('/drafts') && init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'D1', message: { threadId: 'T9' } }) } as any;
      if (u.includes('/drafts/D1') && init?.method === 'PUT') return { ok: true, status: 200, json: async () => ({ id: 'D1', message: { threadId: 'T9' } }) } as any;
      if (u.endsWith('/drafts/send')) return { ok: true, status: 200, json: async () => ({ id: 'M5', threadId: 'T9' }) } as any;
      if (u.includes('/drafts/D1') && init?.method === 'DELETE') return { ok: true, status: 204, json: async () => ({}) } as any;
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });
    const none: any = repo([]);
    const svc = new MailService(repo(users) as any, none, none, none, none, none, none, { jwtSecret: async () => 'jwt' } as any,
      { credentials: async () => ({ clientId: 'c', clientSecret: 's' }) } as any, {} as any, repo(templates) as any);
    return { svc, calls, templates };
  }
  afterEach(() => jest.restoreAllMocks());

  it('a draft is saved in Gmail (no recipient needed yet), updated in place, then sent', async () => {
    const { svc, calls } = setup();
    expect(await svc.saveDraft('U-1', null, { to: '', subject: 'Tile', html: '<p>Half done</p>' })).toEqual({ id: 'D1', threadId: 'T9' });
    expect(fromB64(calls[0].body.message.raw)).toContain('Half done');
    await svc.saveDraft('U-1', 'D1', { to: 'kai@lono.test', subject: 'Tile', html: '<p>Done</p>', threadId: 'T9' });
    expect(calls[1]).toMatchObject({ method: 'PUT' });
    expect(calls[1].body.message.threadId).toBe('T9');
    expect(await svc.sendDraft('U-1', 'D1', null)).toEqual({ id: 'M5', threadId: 'T9' });
    expect(calls[2].body).toEqual({ id: 'D1' });
    await expect(svc.send('U-1', { to: '', subject: 'x', html: '' })).rejects.toThrow(/Who is it to/);
  });

  it('templates: personal ones for their owner, shared ones only by administrators', async () => {
    const { svc } = setup();
    const ed = { sub: 'U-1', name: 'Ed', roleKey: 'project_manager' } as any;
    const admin = { sub: 'U-9', name: 'Admin', roleKey: 'admin' } as any;
    await expect(svc.saveTemplate(ed, null, { name: 'Welcome', html: 'Hi {{clientFirstName}}', shared: true })).rejects.toThrow(/Only administrators/);
    const mine = await svc.saveTemplate(ed, null, { name: 'Follow-up', html: 'Hi {{clientFirstName}}' });
    const shared = await svc.saveTemplate(admin, null, { name: 'Welcome', html: 'Welcome', shared: true });
    expect((await svc.templates('U-1')).map((t) => [t.name, t.shared])).toEqual([['Follow-up', false], ['Welcome', true]]);
    expect((await svc.templates('U-9')).map((t) => t.name)).toEqual(['Welcome']);
    await expect(svc.removeTemplate(admin, mine.id)).rejects.toThrow(/can’t delete/);
    await expect(svc.removeTemplate(ed, shared.id)).rejects.toThrow(/can’t delete/);
    expect(await svc.removeTemplate(ed, mine.id)).toEqual({ removed: true });
  });
});
