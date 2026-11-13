import { createHmac } from 'crypto';
import { blocked, incomingText, keywordOf, prefsToken, readPrefsToken, verifyQuoSignature, withFooter } from './opt-out';
import { OptedOutError, SmsService } from './sms.service';
import { MassTextsService, personalise } from './mass-texts.service';

const SECRET = Buffer.from('a-very-secret-signing-key').toString('base64');

function svc(prefs: Record<string, any> = {}) {
  const settings: any = {
    get: async (k: string) => ({ 'sms.provider': 'quo', 'sms.quoApiKey': 'k', 'sms.quoWebhookSecret': SECRET } as any)[k] ?? null,
    baseUrl: async () => 'https://app.test', jwtSecret: async () => 'jwt',
  };
  const repo = { findOneBy: async (w: any) => prefs[w.phone] || null, save: async (r: any) => { prefs[r.phone] = r; return r; } };
  return { s: new SmsService(settings, repo as any), prefs };
}

describe('texts: opt-out, preferences and mass texts (Nov 13)', () => {
  it('STOP / START keywords, footer, and what a choice blocks', () => {
    expect(keywordOf(' Stop ')).toBe('stop');
    expect(keywordOf('UNSUBSCRIBE.')).toBe('stop');
    expect(keywordOf('start')).toBe('start');
    expect(keywordOf('please stop by the site')).toBeNull();
    expect(withFooter('Hi', 'https://x/t')).toBe('Hi\nReply STOP to opt out. Settings: https://x/t');
    expect(withFooter(withFooter('Hi'), 'u')).toBe('Hi\nReply STOP to opt out.');
    expect(blocked({ stopAll: true }, 'updates')).toBe(true);
    expect(blocked({ stopAll: true }, 'security')).toBe(false);
    expect(blocked({ off: ['announcements'] }, 'updates')).toBe(false);
    expect(blocked({ off: ['announcements'] }, 'announcements')).toBe(true);
  });

  it('preference links are signed per number', () => {
    const t = prefsToken('+14155550100', 's');
    expect(readPrefsToken(t, 's')).toBe('+14155550100');
    expect(readPrefsToken(t, 'other')).toBeNull();
    expect(readPrefsToken(t.replace('14155550100', '14155550199'), 's')).toBeNull();
  });

  it('Quo signatures: legacy and current schemes, fresh only', () => {
    const raw = '{"type":"message.received"}';
    const now = 1_800_000_000_000; const ts = String(now);
    const sig = createHmac('sha256', Buffer.from(SECRET, 'base64')).update(`${ts}.${raw}`).digest('base64');
    expect(verifyQuoSignature({ 'openphone-signature': `hmac;1;${ts};${sig}` }, raw, SECRET, now)).toBe(true);
    expect(verifyQuoSignature({ 'openphone-signature': `hmac;1;${ts};${sig}` }, raw + ' ', SECRET, now)).toBe(false);
    expect(verifyQuoSignature({ 'openphone-signature': `hmac;1;${ts};${sig}` }, raw, SECRET, now + 6 * 60_000)).toBe(false);
    const sec = Math.floor(now / 1000);
    const v1 = createHmac('sha256', Buffer.from(SECRET, 'base64')).update(`msg_1.${sec}.${raw}`).digest('base64');
    expect(verifyQuoSignature({ 'webhook-id': 'msg_1', 'webhook-timestamp': String(sec), 'webhook-signature': `v1,bad v1,${v1}` }, raw, 'whsec_' + SECRET, now)).toBe(true);
    expect(verifyQuoSignature({}, raw, SECRET, now)).toBe(false);
    expect(incomingText({ type: 'message.received', data: { object: { from: '+14155550100', body: 'STOP' } } })).toEqual({ from: '+14155550100', text: 'STOP' });
  });

  it('a STOP reply opts the number out; sending to it is refused; START undoes it', async () => {
    const { s, prefs } = svc();
    const raw = JSON.stringify({ type: 'message.received', data: { object: { from: '(415) 555-0100', body: 'stop' } } });
    const ts = String(Date.now());
    const sig = createHmac('sha256', Buffer.from(SECRET, 'base64')).update(`${ts}.${raw}`).digest('base64');
    await expect(s.quoWebhook({ 'openphone-signature': `hmac;1;${ts};${sig.replace(/^./, 'x')}` }, raw, JSON.parse(raw))).rejects.toThrow(/Signature/);
    expect(await s.quoWebhook({ 'openphone-signature': `hmac;1;${ts};${sig}` }, raw, JSON.parse(raw))).toEqual({ ok: true, action: 'stop' });
    expect(prefs['+14155550100'].stopAll).toBe(true);
    await expect(s.send({ to: '4155550100', body: 'Site visit moved' })).rejects.toBeInstanceOf(OptedOutError);
    const f = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'Q1' } }) } as any);
    await s.send({ to: '4155550100', body: 'Your code is 123456', category: 'security' });
    expect(JSON.parse((f.mock.calls[0][1] as any).body).content).toBe('Your code is 123456');
    await s.setPreference('4155550100', { stopAll: false }, 'start-reply');
    await s.send({ to: '4155550100', body: 'Site visit moved' });
    expect(JSON.parse((f.mock.calls[1][1] as any).body).content).toMatch(/^Site visit moved\nReply STOP to opt out\. Settings: https:\/\/app\.test\/texts\?t=14155550100\./);
    f.mockRestore();
  });

  it('mass texts: each person on their own, skipping no-number, repeats and opted-out', async () => {
    const people = [{ id: 1, name: 'Bea Bay', phone: '415-555-0101' }, { id: 2, name: 'Al', phone: '—' }, { id: 3, name: 'Cy', phone: '4155550101' }, { id: 4, name: 'Di', phone: '4155550104' }];
    const leads = [{ id: 'L-1', firstName: 'Ed', lastName: 'E', leadName: 'Ed E', phone: '4155550105' }];
    const blockedSet = new Set(['+14155550104']);
    const sms: any = { isBlocked: async (p: string) => blockedSet.has(p) };
    const sent: any[] = [];
    const texts: any = { send: async (x: any) => { sent.push(x); return {}; } };
    const store: Record<string, any> = {};
    const batches: any = { save: async (b: any) => { store[b.id] = b; return b; }, findOneBy: async (w: any) => store[w.id], update: async (w: any, p: any) => Object.assign(store[w.id], p) };
    const m = new MassTextsService(sms, texts, batches, { findBy: async () => people } as any, { findBy: async () => leads } as any);
    const rows = await m.preview({ people: [1, 2, 3, 4], leads: ['L-1'] });
    expect(rows.map((r) => [r.name, r.status, r.note || ''])).toEqual([
      ['Bea Bay', 'waiting', ''], ['Al', 'skipped', 'No phone number'], ['Cy', 'skipped', 'Same number as someone above'], ['Di', 'skipped', 'Opted out'], ['Ed E', 'waiting', ''],
    ]);
    MassTextsService.GAP_MS = 0;
    const b = await m.start({ people: [1, 2, 3, 4], leads: ['L-1'] }, 'Hi {first name}, the office is closed Friday.', { name: 'Edward' });
    await m.run(b.id, null, 0); // already sending: does nothing
    for (let i = 0; i < 400 && store[b.id].status !== 'done'; i++) await new Promise((r) => setTimeout(r, 5));
    expect(sent.map((x) => [x.to, x.body, x.category])).toEqual([
      ['+14155550101', 'Hi Bea, the office is closed Friday.', 'announcements'],
      ['+14155550105', 'Hi Ed, the office is closed Friday.', 'announcements'],
    ]);
    expect((await m.get(b.id))).toEqual(expect.objectContaining({ status: 'done', sent: 2, skipped: 3 }));
    expect(personalise('Hi {first name}', '')).toBe('Hi there');
  });
});
