import { isScannerHit, recordHit } from './open-rules';
import { TrackingService } from './tracking.service';
import { TrackedLinkController } from './tracking.controller';
import { viewButton } from '../finance/change-orders.service';
import { ProposalService } from '../proposals/proposal.service';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('open tracking', () => {
  it('tells a person from a mail scanner', () => {
    const sent = '2026-10-28T10:00:00.000Z';
    expect(isScannerHit(sent, new Date('2026-10-28T10:00:20Z'), CHROME)).toBe(true);           // too soon
    expect(isScannerHit(sent, new Date('2026-10-28T10:05:00Z'), 'Microsoft Office/16.0')).toBe(true);
    expect(isScannerHit(sent, new Date('2026-10-28T10:05:00Z'), 'Mozilla/5.0 (compatible; GoogleImageProxy)')).toBe(true);
    expect(isScannerHit(sent, new Date('2026-10-28T10:05:00Z'), '')).toBe(true);
    expect(isScannerHit(sent, new Date('2026-10-28T10:05:00Z'), CHROME)).toBe(false);
  });

  it('counts opens and scanner hits apart', () => {
    const link: any = { createdAt: '2026-10-28T10:00:00.000Z' };
    expect(recordHit(link, new Date('2026-10-28T10:00:05Z'), CHROME)).toBe('scanner');
    expect(recordHit(link, new Date('2026-10-28T11:00:00Z'), CHROME)).toBe('open');
    expect(recordHit(link, new Date('2026-10-28T12:00:00Z'), CHROME)).toBe('open');
    expect(link).toMatchObject({ opens: 2, scannerHits: 1, firstOpenedAt: '2026-10-28T11:00:00.000Z', lastOpenedAt: '2026-10-28T12:00:00.000Z' });
  });

  const memRepo = () => {
    const rows: any[] = [];
    return { rows, save: jest.fn(async (r: any) => { const i = rows.findIndex((x) => x.token === r.token); if (i >= 0) rows[i] = r; else rows.push(r); return r; }), findOneBy: jest.fn(async ({ token }: any) => rows.find((r) => r.token === token) || null), find: jest.fn(async () => rows) };
  };

  it('makes a tracked link, forwards to the target, and tells the team on the first real open', async () => {
    const repo = memRepo();
    const hub = { broadcast: jest.fn().mockResolvedValue(undefined) };
    const svc = new TrackingService(repo as any, { baseUrl: async () => 'https://odin.test' } as any, hub as any);
    const url = await svc.link({ kind: 'co', refId: 'CO-1', target: 'https://odin.test/api/change-order-view?token=x', recipient: 'jo@x.com', label: 'change order CO-0004' });
    expect(url).toMatch(/^https:\/\/odin\.test\/api\/d\/[\w-]{20,}$/);
    const token = url.split('/').pop()!;
    repo.rows[0].createdAt = '2026-10-28T10:00:00.000Z';
    expect(await svc.open(token, CHROME, new Date('2026-10-28T11:00:00Z'))).toBe('https://odin.test/api/change-order-view?token=x');
    await svc.open(token, CHROME, new Date('2026-10-28T12:00:00Z'));
    expect(hub.broadcast).toHaveBeenCalledTimes(1);
    expect(hub.broadcast.mock.calls[0][1].title).toBe('jo@x.com opened change order CO-0004');
    expect(await svc.open('nope', CHROME)).toBeNull();
    const listed = await svc.forRef('co', 'CO-1');
    expect(listed[0]).not.toHaveProperty('token');
    expect(listed[0]).not.toHaveProperty('target');
  });

  it('redirects /d/:token, or says the link is gone', async () => {
    const res: any = { redirect: jest.fn(), status: jest.fn(() => res), type: jest.fn(() => res), send: jest.fn() };
    const c = new TrackedLinkController({ open: jest.fn().mockResolvedValueOnce('https://x.test/file').mockResolvedValueOnce(null) } as any);
    await c.go('t1', CHROME, res);
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://x.test/file');
    await c.go('t2', CHROME, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('puts a View button in the change order email only when there is a link', () => {
    expect(viewButton(null)).toBe('');
    expect(viewButton('https://odin.test/api/d/abc')).toContain('href="https://odin.test/api/d/abc"');
  });

  it('stamps a proposal view from the signing page, first view noted on the lead', async () => {
    const row: any = { dealId: 'L-1', sentAt: '2026-10-27' };
    const repo: any = { findOneBy: jest.fn(async () => row), update: jest.fn(async (_w: any, patch: any) => Object.assign(row, patch)) };
    const pipeline: any = { clientEvent: jest.fn().mockResolvedValue(undefined) };
    const svc = Object.create(ProposalService.prototype);
    Object.assign(svc, { repo, pipeline, readToken: async (t: string) => (t === 'good' ? { dealId: 'L-1' } : null) });
    await svc.recordView('good');
    await svc.recordView('good');
    await svc.recordView('bad');
    expect(row.viewCount).toBe(2);
    expect(row.firstViewedAt).toBeTruthy();
    expect(pipeline.clientEvent).toHaveBeenCalledTimes(1);
  });
});
