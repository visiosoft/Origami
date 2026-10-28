import { SettingsService } from './settings.service';

describe('SettingsService cache', () => {
  const setup = () => {
    const rows = new Map<string, any>([['auth.jwtSecret', { key: 'auth.jwtSecret', value: 'abc' }], ['reminders.lastRunDate', { key: 'reminders.lastRunDate', value: '2026-10-27' }]]);
    const repo = {
      findOneBy: jest.fn(async (w: any) => rows.get(w.key) || null),
      create: (x: any) => x,
      save: jest.fn(async (x: any) => { rows.set(x.key, x); return x; }),
    };
    return { svc: new SettingsService(repo as any), repo };
  };

  it('reads a setting from the database once, not on every request', async () => {
    const { svc, repo } = setup();
    expect(await svc.get('auth.jwtSecret')).toBe('abc');
    expect(await svc.get('auth.jwtSecret')).toBe('abc');
    expect(repo.findOneBy).toHaveBeenCalledTimes(1);
  });

  it('sees its own changes at once, and always reads run-once markers fresh', async () => {
    const { svc, repo } = setup();
    await svc.get('auth.jwtSecret');
    await svc.set('auth.jwtSecret', 'new');
    expect(await svc.get('auth.jwtSecret')).toBe('new');
    await svc.get('reminders.lastRunDate');
    await svc.get('reminders.lastRunDate');
    expect(repo.findOneBy.mock.calls.filter((c) => c[0].key === 'reminders.lastRunDate')).toHaveLength(2);
  });
});
