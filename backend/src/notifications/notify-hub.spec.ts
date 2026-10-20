import { NotifyHub } from './notify-hub.service';

/** A tiny in-memory repo. */
const repo = (rows: any[], key = 'id') => ({
  find: jest.fn(async (q?: any) => (q?.where ? rows.filter((r) => Object.entries(q.where).every(([k, v]) => r[k] === v)) : rows)),
  findOneBy: jest.fn(async (w: any) => rows.find((r) => r[key] === w[key]) || null),
  create: (x: any) => x,
  save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r[key] === x[key]); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
  update: jest.fn(async (w: any, p: any) => { const r = rows.find((x) => x[key] === w[key]); if (r) Object.assign(r, p); }),
});

function setup() {
  const users = [
    { id: 'U-ED', name: 'Edward', email: 'ed@x.com', roleKey: 'admin', tier: 'internal', status: 'active', notificationMatrix: { lead_new: ['text_now'], lead_status: ['email_daily', 'text_daily'] } },
    { id: 'U-AN', name: 'Andrea', email: 'an@x.com', roleKey: 'staff', tier: 'internal', status: 'active', notificationMatrix: null },
    { id: 'U-CL', name: 'Client', email: 'cl@x.com', roleKey: 'client', tier: 'client', status: 'active', notificationMatrix: null },
    { id: 'U-PM', name: 'Pat', email: 'pm@x.com', roleKey: 'pm_assigned', tier: 'internal', status: 'active', notificationMatrix: null },
  ];
  const roles = [{ key: 'staff', permissions: {} }, { key: 'pm_assigned', permissions: { __overall: { view: true, manage: true, level: 'modify', extent: 'assigned' } } }];
  const people = [{ id: 1, userId: 'U-ED', email: 'ed@x.com', phone: '(415) 555 0100', projects: [] }, { id: 2, email: 'pm@x.com', phone: '', projects: ['Cole Valley'] }];
  const items: any[] = [];
  const texts: any[] = [];
  const mails: any[] = [];
  const store: Record<string, string> = { 'app.baseUrl': 'https://app.test' };
  const settings = { getMany: async () => ({}), get: async (k: string) => store[k] ?? null, set: async (k: string, v: string) => { store[k] = v; }, baseUrl: async () => 'https://app.test' };
  const google = { isConnected: async () => true, sendMail: async (m: any) => { mails.push(m); } };
  const sms = { send: async (m: any) => { texts.push(m); return { sent: true }; }, status: async () => ({ configured: true }) };
  const hub = new NotifyHub(repo(users) as any, repo(roles, 'key') as any, repo(people) as any, repo(items) as any, repo([]) as any, repo([]) as any, settings as any, google as any, sms as any);
  return { hub, items, texts, mails, users };
}

describe('NotifyHub', () => {
  it('sends a new lead the way each person chose: a text for Edward, an email for staff, nothing for clients', async () => {
    const { hub, texts, mails, items } = setup();
    await hub.broadcast('lead_new', { title: 'New lead: Smith Residence', path: '/pipeline?open=PL-1' });
    expect(texts).toEqual([{ to: '(415) 555 0100', body: 'Incoming lead: New lead: Smith Residence — https://app.test/pipeline?open=PL-1' }]);
    expect(mails.map((m) => m.to).sort()).toEqual(['an@x.com', 'pm@x.com']);
    expect(items.map((i) => i.userId).sort()).toEqual(['U-AN', 'U-ED', 'U-PM']);
  });

  it('a project event reaches people who only see their projects only when it is theirs; never the actor', async () => {
    const { hub, items } = setup();
    await hub.broadcast('construction_status', { title: 'Hayes Valley is now Construction', actorId: 'U-ED' }, { projectName: 'Hayes Valley' });
    expect(items.map((i) => i.userId)).toEqual(['U-AN']);
    await hub.broadcast('construction_status', { title: 'Cole Valley is now Construction' }, { projectName: 'Cole Valley' });
    expect(items.filter((i) => i.title.startsWith('Cole')).map((i) => i.userId).sort()).toEqual(['U-AN', 'U-ED', 'U-PM']);
  });

  it('digest items wait for the daily run, then go out once as one email and one text', async () => {
    const { hub, texts, mails } = setup();
    await hub.broadcast('lead_status', { title: 'Smith moved to Proposal', path: '/pipeline?open=PL-1' });
    await hub.broadcast('lead_status', { title: 'Jones archived' });
    mails.length = 0; texts.length = 0;
    expect(await hub.sendDigests('daily')).toBeGreaterThan(0);
    const edMail = mails.find((m) => m.to === 'ed@x.com');
    expect(edMail.subject).toBe('Your daily digest — 2 updates');
    expect(texts).toEqual([{ to: '(415) 555 0100', body: 'Your daily digest: 2 updates — https://app.test/notifications?digest=daily' }]);
    mails.length = 0; texts.length = 0;
    expect(await hub.sendDigests('daily')).toBe(0);
  });

  it('settings: defaults filled in, a phone from People, and a warning when texts have no number', async () => {
    const { hub } = setup();
    const ed = await hub.prefs('U-ED');
    expect(ed!.matrix.lead_new).toEqual(['text_now']);
    expect(ed!.phoneFromPeople).toBe('(415) 555 0100');
    expect(ed!.warnings).toEqual([]);
    const an = await hub.setPrefs('U-AN', { matrix: { past_due: ['text_now'] } });
    expect(an!.warnings[0]).toMatch(/no phone number/);
    expect(an!.matrix.task_assigned).toEqual(['email_now']);
  });
});
