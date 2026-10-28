import { quoError, quoRequest, sendViaQuo } from './quo';
import { SmsService } from './sms.service';
import { SmsLogService } from './sms-log.service';

describe('texting through Quo', () => {
  it('builds the request Quo expects', () => {
    const { url, init } = quoRequest({ apiKey: 'KEY', from: '+16507614661' }, '+18085550100', 'Hi Jo');
    expect(url).toBe('https://api.openphone.com/v1/messages');
    expect(init.headers).toEqual({ Authorization: 'KEY', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ content: 'Hi Jo', from: '+16507614661', to: ['+18085550100'] });
    expect(quoRequest({ apiKey: 'K', from: '+1', base: 'https://x.test/v1/' }, '+1', 'a').url).toBe('https://x.test/v1/messages');
  });

  it('passes Quo’s own reason on', async () => {
    expect(quoError(401, {})).toMatch(/refused the API key/);
    expect(quoError(400, { message: 'Invalid to number' })).toBe('Invalid to number');
    const fail = jest.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ errors: [{ message: 'Not allowed' }] }) });
    await expect(sendViaQuo({ apiKey: 'K', from: '+1' }, '+1', 'x', fail as any)).rejects.toThrow('Not allowed');
    const ok = jest.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({ data: { id: 'AC123' } }) });
    expect(await sendViaQuo({ apiKey: 'K', from: '+1' }, '+1', 'x', ok as any)).toEqual({ id: 'AC123' });
  });

  const settings = (vals: Record<string, string>) => ({ get: jest.fn(async (k: string) => vals[k] ?? null) });

  it('uses Twilio unless Quo is switched on, and sends from the Quo line by default', async () => {
    const realFetch = global.fetch;
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: any) => { calls.push(String(url)); return { ok: true, status: 200, json: async () => ({ id: 'X', sid: 'SM1' }) }; }) as any;
    try {
      const quo = new SmsService(settings({ 'sms.provider': 'quo', 'sms.quoApiKey': 'KEY' }) as any);
      expect((await quo.status()).fromNumber).toBe('+16507614661');
      await quo.send({ to: '808 555 0100', body: 'Hi' });
      const twilio = new SmsService(settings({ 'sms.accountSid': 'AC1', 'sms.authToken': 'T', 'sms.fromNumber': '+15550001111' }) as any);
      await twilio.send({ to: '808 555 0100', body: 'Hi' });
      expect(calls[0]).toBe('https://api.openphone.com/v1/messages');
      expect(calls[1]).toContain('api.twilio.com');
      await expect(new SmsService(settings({ 'sms.provider': 'quo' }) as any).send({ to: '8085550100', body: 'x' })).rejects.toThrow(/Quo API key/);
    } finally { global.fetch = realFetch; }
  });

  it('logs every text against its record, sent or failed', async () => {
    const saved: any[] = [];
    const repo: any = { save: jest.fn(async (r: any) => { saved.push({ ...r }); return r; }), find: jest.fn() };
    const sms: any = { provider: jest.fn().mockResolvedValue('quo'), send: jest.fn().mockResolvedValueOnce({ sent: true, to: '+18085550100', sid: 'AC1', segments: 1 }).mockRejectedValueOnce(new Error('Invalid number')) };
    const log = new SmsLogService(sms, repo);
    await log.send({ to: '8085550100', body: 'Hi Jo', entityType: 'lead', entityId: 'L-1', templateKey: 'sms_intro' }, { id: 'U-1', name: 'Edward' });
    await expect(log.send({ to: 'x', body: 'Hi', entityType: 'bogus', entityId: '9' })).rejects.toThrow('Invalid number');
    expect(saved[0]).toMatchObject({ to: '+18085550100', status: 'sent', provider: 'quo', providerId: 'AC1', entityType: 'lead', entityId: 'L-1', templateKey: 'sms_intro', byName: 'Edward' });
    expect(saved[1]).toMatchObject({ status: 'failed', error: 'Invalid number', entityType: null, entityId: null });
    expect(await log.list('bogus', '1')).toEqual([]);
  });
});
