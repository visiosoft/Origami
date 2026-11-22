import { cleanCredits, isOutOfCredit, standing } from './usage';
import { UsageService } from './usage.service';

/** Nov 20 Weekly Sync: "monitor API usage ... to prevent unexpected service interruptions". */
describe('API usage and credits', () => {
  it('cleans the credits the office types in', () => {
    expect(cleanCredits({ quo: { amount: '50', units: '5000', since: '2026-11-01' }, openai: { units: 0 }, junk: { units: 9 } })).toEqual({ quo: { amount: 50, units: 5000, since: '2026-11-01' } });
  });

  it('says how much is left, and when it’s low', () => {
    const now = new Date('2026-11-21T00:00:00Z');
    expect(standing({ units: 5000, since: '2026-11-01' }, 1000, now)).toMatchObject({ left: 4000, level: 'ok', daysLeft: 80 });
    expect(standing({ units: 5000, since: '2026-11-01' }, 4100, now).level).toBe('low');
    expect(standing({ units: 5000, since: '2026-11-01' }, 5200, now)).toMatchObject({ left: 0, level: 'out' });
    expect(standing(undefined, 12, now)).toMatchObject({ used: 12, level: 'none' });
  });

  it('knows a refusal for lack of credit', () => {
    expect(isOutOfCredit('Quo: Not Enough Credits. Texts sent from Origami use Quo’s API credits')).toBe(true);
    expect(isOutOfCredit('You exceeded your current quota (insufficient_quota)')).toBe(true);
    expect(isOutOfCredit('"+1555" is not a usable phone number.')).toBe(false);
  });

  const make = (credits: any = null) => {
    const rows: any[] = [];
    const store: Record<string, string> = credits ? { 'usage.credits': JSON.stringify(credits) } : {};
    const mails: any[] = [];
    const repo = {
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      create: (r: any) => r,
      save: async (r: any) => { if (!rows.includes(r)) rows.push(r); return r; },
      find: async (o?: any) => rows.filter((r) => !o?.where?.service || r.service === o.where.service),
    };
    const settings = { get: async (k: string) => store[k] ?? null, set: async (k: string, v: string) => { store[k] = v; } };
    const data = { getRepository: () => ({ find: async () => [{ roleKey: 'admin', status: 'active', email: 'Ed@o.co' }, { roleKey: 'pm', status: 'active', email: 'x@o.co' }] }) };
    const google = { sendMail: async (m: any) => { mails.push(m); } };
    return { svc: new UsageService(repo as any, settings as any, data as any, google as any), rows, mails };
  };

  it('counts texts per month and emails admins once a day at 80% of the credit', async () => {
    const { svc, rows, mails } = make({ quo: { units: 10, since: '2026-11-01' } });
    const now = new Date('2026-11-20T10:00:00Z');
    for (let i = 0; i < 7; i++) await svc.record('quo', 1, true, undefined, now);
    expect(mails).toHaveLength(0);
    await svc.record('quo', 1, true, undefined, now);
    await svc.record('quo', 1, true, undefined, now);
    expect(rows[0]).toMatchObject({ id: 'quo|2026-11', units: 9, calls: 9, failures: 0 });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: 'ed@o.co' });
    expect(mails[0].subject).toMatch(/Quo texts credit running low/);
    const st = await svc.status(now);
    expect(st.services.find((s) => s.service === 'quo')).toMatchObject({ used: 9, left: 1, level: 'low', thisMonth: { units: 9, calls: 9 } });
  });

  it('emails straight away when a provider refuses for lack of credit, and never throws', async () => {
    const { svc, rows, mails } = make();
    await svc.record('quo', 0, false, 'Quo: Not Enough Credits. … API credits …', new Date('2026-11-20T10:00:00Z'));
    expect(rows[0]).toMatchObject({ failures: 1 });
    expect(mails[0].subject).toMatch(/out of credit/);
    await svc.record('quo', 0, false, 'Quo: Not Enough Credits', new Date('2026-11-20T11:00:00Z'));
    expect(mails).toHaveLength(1); // once a day
  });
});
