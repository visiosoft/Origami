import { createHmac } from 'crypto';
import { callIdOf, callMinutes, meetingFromCall, otherNumbers } from './quo-calls';
import { QuoCallsService } from './quo-calls.service';
import { QuoTasksService } from './quo-tasks.service';

/** Nov 22: Quo's call summaries and transcripts come into Origami as Call meetings. */
describe('Quo call notes → Meetings', () => {
  it('reads the call id, the other side, and lays the notes out for the notes reader', () => {
    expect(callIdOf({ type: 'call.summary.completed', data: { resource: { callId: 'AC123' } } })).toBe('AC123');
    expect(callIdOf({ type: 'call.completed', data: { resource: { id: 'AC9' } } })).toBe('AC9');
    expect(callIdOf({ data: {} })).toBeNull();
    expect(otherNumbers({ id: 'AC1', participants: [{ phoneNumber: '+16507614661', actorId: 'US1' }, { phoneNumber: '+16505550100', actorId: null }] })).toEqual(['+16505550100']);
    expect(callMinutes(['Discussed the HVAC quote.'], ['Send the revised quote by Friday', '[Astrid] Book the site visit'], 'Edward'))
      .toBe('Call summary\n- Discussed the HVAC quote.\n\nNext steps\n- [Edward] Send the revised quote by Friday\n- [Astrid] Book the site visit\n\nSummary from Quo’s call notes.');
    const m = meetingFromCall({ id: 'AC1', direction: 'incoming', createdAt: '2026-11-22T18:05:00Z', duration: 400 }, { them: { name: 'Alton HVAC', phone: '(650) 555-0100' }, us: { id: 'U-2', name: 'Edward' }, project: { id: 16, name: 'Countryside' }, minutes: 'x' });
    expect(m).toMatchObject({ title: 'Call with Alton HVAC', date: '2026-11-22', time: '10:05', locationType: 'call', status: 'occurred', location: 'Incoming Quo call · 7 min · (650) 555-0100', projectId: 16, sourceType: 'quo-call', sourceId: 'AC1' });
  });

  function setup() {
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      const u = String(url).replace('https://api.quo.com', '');
      const json = (status: number, body: any) => ({ ok: status < 300, status, json: async () => body }) as any;
      if (u.startsWith('/users')) return json(200, { data: [{ id: 'US1', email: 'edward@origami.com', firstName: 'Edward', lastName: 'K' }], nextCursor: null });
      if (u === '/calls/AC1?include=summary') return json(200, { data: { id: 'AC1', direction: 'incoming', createdAt: '2026-11-22T18:05:00Z', duration: 400, answeredBy: 'US1', participants: [{ phoneNumber: '+16507614661', actorId: 'US1' }, { phoneNumber: '+16505550100', actorId: null }], summary: { status: 'completed', summary: ['Discussed the HVAC quote.'], nextSteps: ['Send the revised quote by Friday'] } } });
      if (u.startsWith('/calls/AC1/transcripts')) return json(200, { data: [{ dialogue: [{ content: 'Hi, it’s Edward.', actorId: 'US1' }, { content: 'Hi, about the quote…', identifier: '+16505550100' }] }], nextCursor: null });
      if (u === '/webhooks' && init?.method === 'POST') return json(201, { data: { id: '88', key: 'whsec_' + Buffer.from('call-key').toString('base64') } });
      return json(404, {});
    });
    const settings: Record<string, string> = { 'sms.quoApiKey': 'KEY', 'app.baseUrl': 'https://staging.origamidb.com' };
    const settingsSvc: any = { get: async (k: string) => settings[k] ?? null, set: async (k: string, v: string) => { settings[k] = v; }, baseUrl: async () => settings['app.baseUrl'] };
    const meetings: any[] = [];
    const repo = (rows: () => any[]) => ({ find: async () => rows(), findOne: async (o: any) => rows().find((r) => Object.entries(o.where).every(([k, v]) => r[k] === v)) || null, findOneBy: async (w: any) => rows().find((r) => r.id === w.id) || null, count: async () => rows().length, save: async (x: any) => x });
    const users = [{ id: 'U-2', name: 'Edward', email: 'edward@origami.com', status: 'active' }];
    const people = [{ id: 1, name: 'Alton HVAC', phone: '(650) 555-0100', projectIds: [16] }];
    const projects = [{ id: 16, name: 'Countryside' }];
    const quo = new QuoTasksService(repo(() => []) as any, repo(() => users) as any, repo(() => people) as any, settingsSvc, { onStatusChange: () => undefined } as any);
    const meetingsService: any = { create: jest.fn(async (dto: any, actor: any) => { const m = { id: 'MTG-' + (meetings.length + 1), ...dto, createdBy: actor.name }; meetings.push(m); return m; }) };
    const svc = new QuoCallsService(repo(() => meetings) as any, repo(() => people) as any, repo(() => []) as any, repo(() => projects) as any, settingsSvc, quo, meetingsService);
    return { svc, meetings, settings, meetingsService };
  }
  afterEach(() => jest.restoreAllMocks());

  it('a summarised call becomes one Call meeting with the person and their project; the transcript is added', async () => {
    const { svc, meetings, settings } = setup();
    expect(await svc.connect()).toMatchObject({ connected: true, url: 'https://staging.origamidb.com/api/quo/calls-webhook' });
    const raw = JSON.stringify({ type: 'call.summary.completed', data: { resource: { callId: 'AC1', processingStatus: 'completed' } } });
    await expect(svc.webhook({}, raw, JSON.parse(raw))).rejects.toThrow(/Signature/);
    const sign = (body: string, id: string) => {
      const ts = String(Math.floor(Date.now() / 1000));
      const key = Buffer.from(settings['quo.callsWebhookSecret'].replace(/^whsec_/, ''), 'base64');
      return { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}` };
    };
    // The same event twice at once: one meeting.
    const [a, b] = await Promise.all([svc.webhook(sign(raw, 'm1'), raw, JSON.parse(raw)), svc.webhook(sign(raw, 'm2'), raw, JSON.parse(raw))]);
    expect([a.action, b.action].sort()).toEqual(['created', 'none']);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toMatchObject({ title: 'Call with Alton HVAC', projectId: 16, project: 'Countryside', locationType: 'call', status: 'occurred', createdBy: 'Edward', sourceId: 'AC1' });
    expect(meetings[0].minutes).toMatch(/Next steps\n- \[Edward\] Send the revised quote by Friday/);
    const t = JSON.stringify({ type: 'call.transcript.completed', data: { resource: { callId: 'AC1', processingStatus: 'completed' } } });
    expect(await svc.webhook(sign(t, 'm3'), t, JSON.parse(t))).toMatchObject({ action: 'updated' });
    expect(meetings[0].transcript).toBe('Edward K: Hi, it’s Edward.\nAlton HVAC: Hi, about the quote…');
    expect((await svc.status()).imported).toBe(1);
  });

  it('brings in one call by its id, and refuses anything else', async () => {
    const { svc, meetings } = setup();
    await expect(svc.importCall('123')).rejects.toThrow(/starts with AC/);
    expect(await svc.importCall('AC1')).toMatchObject({ action: 'created' });
    expect(meetings[0].transcript).toMatch(/Hi, it’s Edward/);
  });
});
