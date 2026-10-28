import { AuditService } from './audit.service';

describe('audit log pages', () => {
  const app = Array.from({ length: 7 }, (_, i) => ({ id: 'a' + i, at: `2026-10-${String(20 + i).padStart(2, '0')}T10:00`, userName: i % 2 ? 'Kai' : 'Edward', entityType: 'Task', entityId: 'T' + i, action: 'update', changes: [{ field: 'status', from: 'A', to: i === 1 ? 'Old match' : 'B' }], projectId: 3 }));
  const fin = [{ id: 'f1', at: '2026-10-23T12:00', byName: 'Edward', entityType: 'invoice', entityId: 'INV-1', action: 'approve', changes: {}, projectId: 3 }];
  const repo = (rows: any[]) => ({
    find: jest.fn(async (o: any) => [...rows].sort((a, b) => b.at.localeCompare(a.at)).slice(0, o.take)),
    count: jest.fn(async () => rows.length),
    createQueryBuilder: () => ({ select: () => ({ getRawMany: async () => [...new Set(rows.map((r) => r.entityType))].map((t) => ({ t })) }) }),
  });
  const setup = () => {
    const events = repo(app), finance = repo(fin);
    const svc = new AuditService(events as any, finance as any, { find: async () => [{ id: 3, name: 'Narvaes' }] } as any, {} as any);
    return { svc, events, finance };
  };

  it('pages both logs as one, newest first, reading only what the page needs', async () => {
    const { svc, events } = setup();
    const p2 = await svc.page({ page: '2', size: '3' });
    expect(p2.total).toBe(8);
    expect(p2.pages).toBe(3);
    expect(p2.rows.map((r) => r.id)).toEqual(['fin-f1', 'a3', 'a2']);
    expect((events.find.mock.calls[0] as any[])[0].take).toBe(6);
    expect(p2.types).toEqual(['Finance · invoice', 'Task']);
  });

  it('a search finds older matches too, before paging', async () => {
    const { svc } = setup();
    const r = await svc.page({ q: 'old match', size: '3' });
    expect(r.rows.map((x) => x.id)).toEqual(['a1']);
    expect(r.total).toBe(1);
  });
});
