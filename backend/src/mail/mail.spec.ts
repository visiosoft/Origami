import { addressesIn, bodyOf, messageView, tagsIn } from './gmail';
import { MailService } from './mail.service';
import { sealSecret } from '../auth/totp';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('own Gmail in the app (Nov 13)', () => {
  it('reads messages: html, text, attachments, addresses', () => {
    const payload = { mimeType: 'multipart/mixed', headers: [{ name: 'Subject', value: 'Tile #P-7' }, { name: 'From', value: 'Kai <kai@lono.test>' }], parts: [
      { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: b64('Hello there') } }, { mimeType: 'text/html', body: { data: b64('<p>Hello <b>there</b></p>') } }] },
      { filename: 'plan.pdf', mimeType: 'application/pdf', body: { attachmentId: 'A1', size: 1200 } },
    ] };
    const b = bodyOf(payload);
    expect(b).toEqual({ html: '<p>Hello <b>there</b></p>', text: 'Hello there', attachments: [{ id: 'A1', filename: 'plan.pdf', mimeType: 'application/pdf', size: 1200 }] });
    expect(messageView({ id: 'm', threadId: 't', payload, labelIds: ['UNREAD'], internalDate: '1700000000000' })).toMatchObject({ subject: 'Tile #P-7', from: 'Kai <kai@lono.test>', unread: true });
    expect(addressesIn('Kai <KAI@lono.test>, b@x.co; kai@lono.test')).toEqual(['kai@lono.test', 'b@x.co']);
  });

  it('#tags: #P-45 a project, #L-x a lead, #CODE-T-2026-0001 a task; not e-mail fragments or colours', () => {
    expect(tagsIn('Re: tile #P-45 and #L-LD123 see #NARV-T-2026-0001 (#T-2026-0007)')).toEqual({ projects: [45], leads: ['LD123'], tasks: ['NARV-T-2026-0001', 'T-2026-0007'] });
    expect(tagsIn('color #ffffff and a@b.com#x and #hashtag')).toEqual({ projects: [], leads: [], tasks: [] });
  });

  function setup() {
    const users = [{ id: 'U-1', name: 'Ed', email: 'ed@o.co', roleKey: 'project_manager', tier: 'internal', mailEmail: 'ed@o.co', mailRefreshToken: sealSecret('refresh', 'jwt') }];
    const links: any[] = [];
    const repo = (rows: any[]) => ({
      findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null,
      findOne: async (o: any) => rows.find((r) => Object.entries(o.where).every(([k, v]) => r[k] === v)) || null,
      find: async (o?: any) => (o?.where ? rows.filter((r) => Object.entries(o.where).every(([k, v]: any) => (v?._type === 'in' ? v._value.includes(r[k]) : r[k] === v))) : rows),
      save: async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; },
      create: (x: any) => x, delete: async (w: any) => { const i = rows.findIndex((r) => r.id === w.id); if (i >= 0) rows.splice(i, 1); },
    });
    const access: any = { canSee: async (c: any, id: number) => id === 7, seesClientContacts: (c: any) => c.tier === 'internal', isStaff: () => true };
    const svc = new MailService(repo(users) as any, repo(links) as any, repo([{ id: 'LD1', leadName: 'Lono', email: 'kai@lono.test' }]) as any, repo([{ id: 7, name: 'Lono house' }, { id: 8, name: 'Other' }]) as any,
      repo([]) as any, repo([{ id: 'T-7-x', projectId: 7, title: 'Tile layout', serial: 'T-2026-0003' }]) as any, repo([]) as any,
      { jwtSecret: async () => 'jwt' } as any, { credentials: async () => ({ clientId: 'c', clientSecret: 's' }) } as any, access);
    const thread = { id: 'TH1', messages: [{ id: 'M1', threadId: 'TH1', internalDate: '1700000000000', payload: { headers: [{ name: 'Subject', value: 'Grout colour for NARV-T-2026-0003' }, { name: 'From', value: 'Kai <kai@lono.test>' }, { name: 'To', value: 'ed@o.co' }], mimeType: 'text/plain', body: { data: b64('Please see #P-7 and #P-8 and #NARV-T-2026-0003') } } }] };
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'AT', expires_in: 3600 }) } as any;
      if (u.includes('/threads/TH1')) return { ok: true, status: 200, json: async () => thread } as any;
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });
    return { svc, links, claims: { sub: 'U-1', name: 'Ed', email: 'ed@o.co', roleKey: 'project_manager', tier: 'internal' } as any };
  }
  afterEach(() => jest.restoreAllMocks());

  it('opening a thread links it by its tags and the lead’s address -- only to records the person can see; linked mail is readable on the record', async () => {
    const { svc, links, claims } = setup();
    const t = await svc.thread('U-1', 'TH1');
    expect(t.messages[0].text).toContain('#P-7');
    const kinds = links.map((l) => `${l.entityType}:${l.entityId}`).sort();
    expect(kinds).toEqual(['lead:LD1', 'project:7', 'task:T-7-x']); // not project 8: they can't see it
    expect(links.every((l) => l.auto)).toBe(true);
    const onProject = await svc.forRecord(claims, 'project', '7');
    expect(onProject[0].messages[0]).toMatchObject({ subject: 'Grout colour for NARV-T-2026-0003', from: 'Kai <kai@lono.test>' });
    await expect(svc.forRecord(claims, 'project', '8')).rejects.toThrow(/can’t see/);
    await expect(svc.link(claims, 'TH1', 'project', '8')).rejects.toThrow(/can’t see/);
    // Linking the same thread again doesn't duplicate it.
    await svc.link(claims, 'TH1', 'project', '7');
    expect(links.filter((l) => l.entityType === 'project').length).toBe(1);
    await expect(svc.unlink({ ...claims, sub: 'U-2' }, links[0].id)).rejects.toThrow(/Only the person/);
  });
});
