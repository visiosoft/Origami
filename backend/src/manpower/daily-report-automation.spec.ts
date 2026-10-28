import { DailyReportAutomationService, noWorkRange } from './daily-report-automation.service';

function table(rows: any[] = []) {
  const match = (r: any, w: any) => Object.entries(w || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where))),
    findOneBy: jest.fn(async (w: any) => rows.find((r) => match(r, w)) || null),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
  };
}

const stop = (o: any = {}) => ({ activity: { worked: 'no', reason: 'stop', stop: { by: 'Owner', asOf: '2026-10-10', end: '2026-10-20', ...o } } });

function setup(opts: { logs?: any[]; onHold?: boolean; tz?: string } = {}) {
  const logs = table(opts.logs || []);
  const projects = table([{ id: 7, name: 'Chelliah', holdSince: opts.onHold === false ? null : '2026-10-10T00:00:00Z' }]);
  const users = table([{ id: 'U-1', email: 'george@x.com', status: 'active', roleKey: 'superintendent' }, { id: 'U-9', email: 'boss@x.com', status: 'active', roleKey: 'admin' }, { id: 'U-5', email: 'z@x.com', status: 'active', roleKey: 'pm' }]);
  const store: Record<string, string> = { 'reminders.timezone': 'UTC' };
  const settings = { getMany: jest.fn(async () => ({})), get: jest.fn(async (k: string) => store[k] ?? null), set: jest.fn(async (k: string, v: string) => { store[k] = v; }), baseUrl: jest.fn(async () => 'https://o.test') };
  const hold = { hold: jest.fn(async () => ({})) };
  const google = { isConnected: jest.fn(async () => true), sendMail: jest.fn(async () => undefined) };
  const svc = new DailyReportAutomationService(logs as any, projects as any, users as any, settings as any, hold as any, google as any);
  return { svc, logs, projects, hold, google, store };
}

describe('Daily Report automation', () => {
  it('reads the stop / holiday range from Section II', () => {
    expect(noWorkRange({ date: '2026-10-10', sections: stop() } as any)).toEqual({ reason: 'stop', from: '2026-10-10', to: '2026-10-20' });
    expect(noWorkRange({ date: '2026-10-10', sections: stop({ end: '', endUnknown: true }) } as any)).toEqual({ reason: 'stop', from: '2026-10-10', to: null });
    expect(noWorkRange({ date: '2026-12-24', sections: { activity: { worked: 'no', reason: 'holiday', holiday: { start: '2026-12-24', end: '2026-12-26' } } } } as any)).toEqual({ reason: 'holiday', from: '2026-12-24', to: '2026-12-26' });
    expect(noWorkRange({ date: '2026-10-10', sections: { activity: { worked: 'yes' } } } as any)).toBeNull();
  });

  it('a stop order holds the project until its end date and fills the days so far, once', async () => {
    const src = { id: 'DL-1', projectId: 7, date: '2026-10-10', status: 'submitted', supervisorId: 'U-1', supervisorName: 'George', sections: stop() };
    const { svc, logs, hold } = setup({ logs: [src] });
    jest.spyOn(svc as any, 'today').mockResolvedValue('2026-10-13');
    const r = await svc.afterSubmit('DL-1', { id: 'U-1', name: 'George' });
    expect(hold.hold).toHaveBeenCalledWith(7, expect.objectContaining({ until: '2026-10-20', followUpId: 'U-1', reason: expect.stringContaining('Stop order by Owner') }), expect.anything());
    expect(r).toEqual({ held: true, created: 3 }); // 11th, 12th, 13th -- the 10th already has the filed report
    expect(logs.rows.filter((l) => l.autoReason === 'stop').map((l) => l.date)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
    expect(logs.rows.find((l) => l.date === '2026-10-11')).toMatchObject({ status: 'approved', approvedByName: 'Automatic', sections: { activity: expect.objectContaining({ reason: 'stop' }) } });
    expect(await svc.fillDays(src as any, '2026-10-13')).toBe(0);
  });

  it('an open-ended stop follows up in 14 days, and stops making days once the project is resumed', async () => {
    const src = { id: 'DL-1', projectId: 7, date: '2026-10-10', status: 'submitted', supervisorId: 'U-1', sections: stop({ end: '', endUnknown: true }) };
    const { svc, hold, projects, logs } = setup({ logs: [src] });
    jest.spyOn(svc as any, 'today').mockResolvedValue('2026-10-11');
    await svc.afterSubmit('DL-1', { id: 'U-1', name: 'George' });
    expect(hold.hold).toHaveBeenCalledWith(7, expect.objectContaining({ until: '2026-10-25', reason: expect.stringContaining('end date unknown') }), expect.anything());
    projects.rows[0].holdSince = null;
    expect(await svc.fillDays(src as any, '2026-10-15')).toBe(0);
    expect(logs.rows.filter((l) => l.autoReason)).toHaveLength(1);
  });

  it('holidays fill only up to today and skip days someone already filed', async () => {
    const src = { id: 'DL-H', projectId: 7, date: '2026-12-24', status: 'approved', sections: { activity: { worked: 'no', reason: 'holiday', holiday: { start: '2026-12-24', end: '2026-12-28' } } } };
    const filed = { id: 'DL-X', projectId: 7, date: '2026-12-25', status: 'draft' };
    const { svc, logs, hold } = setup({ logs: [src, filed] });
    const r = await svc.runDaily('2026-12-26');
    expect(hold.hold).not.toHaveBeenCalled();
    expect(r.created).toBe(1);
    expect(logs.rows.filter((l) => l.autoReason === 'holiday').map((l) => l.date)).toEqual(['2026-12-26']);
  });

  it('reminds the filer and admins 7 and 2 days before a stop ends, once each', async () => {
    const src = { id: 'DL-1', projectId: 7, date: '2026-10-10', status: 'submitted', supervisorId: 'U-1', sections: stop() };
    const { svc, google } = setup({ logs: [src] });
    expect(await svc.stopNotices(src as any, '2026-10-13')).toBe(1); // 7 days before the 20th
    expect(google.sendMail.mock.calls.map((c: any) => c[0].to).sort()).toEqual(['boss@x.com', 'george@x.com']);
    expect(await svc.stopNotices(src as any, '2026-10-13')).toBe(0); // already sent
    expect(await svc.stopNotices(src as any, '2026-10-14')).toBe(0); // not a reminder day
    expect(await svc.stopNotices(src as any, '2026-10-18')).toBe(1); // 2 days before
    const open = { ...src, id: 'DL-2', sections: stop({ end: '', endUnknown: true }) };
    expect(await svc.stopNotices(open as any, '2026-10-13')).toBe(0);
  });
});
