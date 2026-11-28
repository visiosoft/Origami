import { FileRoomService } from './file-room.service';
import { DrawingSetsService } from './drawing-sets.service';
import { drawingTab, drawingHistory } from './drawing-sets';

/** Nov 27 (Weekly Sync): Approved set / Under review / Not city-approved, in use / Other files. */
describe('drawing-set tabs', () => {
  const set = { buildSet: ['Drawings'] };
  it('works out each file\'s tab; a city flag wins over approval', () => {
    expect(drawingTab({ id: 'x', folderPath: ['Contracts'], approvedAt: 'y' }, set)).toBe('other');
    expect(drawingTab({ id: 'x', folderPath: ['Drawings'], approvedAt: '2026-11-01' }, set)).toBe('approved');
    expect(drawingTab({ id: 'x', folderPath: ['Drawings'], approvedAt: '2026-11-01', notCityApproved: true }, set)).toBe('city');
    expect(drawingTab({ id: 'x', folderPath: ['Drawings'] }, { ...set, pendingIds: new Set(['x']) })).toBe('city');
    expect(drawingTab({ id: 'x', folderPath: ['Drawings'] }, set)).toBe('review');
    expect(drawingTab({ id: 'x', folderPath: ['Plans', 'Base sets'] }, set)).toBe('review');
  });

  const files = [
    { id: 'a1', projectId: 3, folderPath: ['Drawings'], name: 'A-201 r1.pdf', groupId: 'A', isLatest: false, approvedAt: '2026-11-01' },
    { id: 'a2', projectId: 3, folderPath: ['Drawings'], name: 'A-201 r2.pdf', groupId: 'A', isLatest: true },
    { id: 'b1', projectId: 3, folderPath: ['Drawings'], name: 'A-300.pdf', groupId: 'B', isLatest: true },
    { id: 'c1', projectId: 3, folderPath: ['Drawings'], name: 'S-100.pdf', groupId: 'C', isLatest: true, approvedAt: '2026-11-02', notCityApproved: true },
    { id: 'o1', projectId: 3, folderPath: ['Contracts'], name: 'Contract.pdf', isLatest: true },
  ];
  const repo = { find: async (o: any = {}) => files.filter((f) => Object.entries(o.where || {}).every(([k, v]) => (f as any)[k] === v)) };
  const svc = new FileRoomService(repo as any, { find: async () => [] } as any, { find: async () => [{ id: 3, name: 'Narvaes', buildSetFolders: ['Drawings'] }] } as any, {} as any, {} as any, {} as any, {} as any);

  it('filters by tab and counts each tab for managers', async () => {
    const all = await svc.filesPage({ projectId: '3' });
    expect(all.tabCounts).toEqual({ approved: 1, review: 2, city: 1, other: 1 });
    expect(all.tabs).toEqual(['approved', 'review', 'city', 'other']);
    expect((await svc.filesPage({ projectId: '3', tab: 'approved' })).rows.map((f) => f.id)).toEqual(['a1']);
    expect((await svc.filesPage({ projectId: '3', tab: 'review' })).rows.map((f: any) => f.drawingTab)).toEqual(['review', 'review']);
  });

  it('field staff work from the approved set: newer revisions of an approved drawing are hidden, nothing else', async () => {
    const r = await svc.filesPage({ projectId: '3' }, () => true, { manage: false });
    expect(r.rows.map((f) => f.id).sort()).toEqual(['a1', 'b1', 'c1', 'o1']);
    expect(r.tabs).toEqual(['approved', 'review', 'city', 'other']); // review (never-approved B) and other still have files
    expect(r.tabCounts).toEqual({ approved: 1, review: 1, city: 1, other: 1 });
    const only = new FileRoomService({ find: async () => files.filter((f) => f.groupId === 'A') } as any, {} as any, { find: async () => [{ id: 3, buildSetFolders: ['Drawings'] }] } as any, {} as any, {} as any, {} as any, {} as any);
    expect((await only.filesPage({}, () => true, { manage: false })).tabs).toEqual(['approved', 'city']);
  });

  it('logs an open from the Approved tab once per person per day, and shows it in the history', async () => {
    const events: any[] = [];
    const audit = { find: async ({ where }: any) => events.filter((e) => e.entityId === where.entityId && (!where.userId || e.userId === where.userId)), insert: async (e: any) => { events.push(e); } };
    const ds = new DrawingSetsService(
      { find: async () => files } as any, {} as any,
      { buildSetOf: async () => ['Drawings'] } as any,
      { file: async (id: string) => files.find((f) => f.id === id) } as any,
      {} as any, undefined, undefined, { getRepository: () => audit } as any,
    );
    expect(await ds.opened('a1', { sub: 'U-7', name: 'Jerrod' } as any)).toEqual({ logged: true, tab: 'approved' });
    expect(await ds.opened('a1', { sub: 'U-7', name: 'Jerrod' } as any)).toEqual({ logged: false, tab: 'approved' });
    expect(await ds.opened('b1', { sub: 'U-7', name: 'Jerrod' } as any)).toEqual({ logged: false, tab: 'review' });
    expect(events).toHaveLength(1);
    const h = drawingHistory({ revisions: [{ id: 'a1', name: 'A-201', revMajor: 1, revMinor: 0 }], markups: [], opens: [{ fileId: 'a1', at: events[0].at, by: 'Jerrod' }] });
    expect(h.find((e) => e.kind === 'open')).toMatchObject({ by: 'Jerrod', text: 'Rev 1: opened' });
  });
});
