import { MailService } from './mail.service';

describe('Nov 27: opening a thread marks it read in Gmail too', () => {
  function svc(fail?: string) {
    const calls: any[] = [];
    const s = Object.create(MailService.prototype) as any;
    s.metaCache = new Map();
    s.gmail = async (_u: string, path: string, init: any) => { calls.push([path, JSON.parse(init.body)]); if (fail) throw new Error(fail); return {}; };
    return { s, calls };
  }
  it('removes UNREAD (or adds it back for Mark unread)', async () => {
    const { s, calls } = svc();
    expect(await s.markRead('U1', 'T1')).toEqual({ ok: true, read: true });
    expect(await s.markRead('U1', 'T1', false)).toEqual({ ok: true, read: false });
    expect(calls).toEqual([['/threads/T1/modify', { removeLabelIds: ['UNREAD'] }], ['/threads/T1/modify', { addLabelIds: ['UNREAD'] }]]);
  });
  it('a connection without the modify permission is asked to reconnect, not failed', async () => {
    expect(await svc('Request had insufficient authentication scopes.').s.markRead('U1', 'T1')).toEqual({ ok: false, read: false, reconnect: true });
    await expect(svc('Gmail answered 500.').s.markRead('U1', 'T1')).rejects.toThrow(/500/);
  });
});
