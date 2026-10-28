import { FileRoomService } from './file-room.service';

describe('File Room: tree first, files a page at a time', () => {
  const files = [
    { id: 'a', projectId: 3, folderPath: ['Drawings'], name: 'A-201.pdf', size: 100, updatedAt: new Date().toISOString(), groupId: 'g', isLatest: true },
    { id: 'b', projectId: 3, folderPath: ['Drawings'], name: 'A-200.pdf', size: 50, updatedAt: '2026-01-01', groupId: 'g', isLatest: false },
    { id: 'c', projectId: 3, folderPath: ['Drawings', 'Old'], name: 'X.pdf', size: 10, updatedAt: '2026-01-01' },
    { id: 'd', projectId: 4, folderPath: [], name: 'Contract.pdf', size: 5, updatedAt: '2026-01-01' },
  ];
  const repo = {
    find: async (o: any = {}) => files.filter((f) => Object.entries(o.where || {}).every(([k, v]) => (f as any)[k] === v)),
    findOneBy: async (w: any) => files.find((f) => f.id === w.id) || null,
  };
  const svc = new FileRoomService(repo as any, { find: async () => [] } as any, { find: async () => [{ id: 3, name: 'Narvaes' }, { id: 4, name: 'Chelliah' }] } as any, {} as any, {} as any, {} as any, {} as any);

  it('the tree carries per-folder counts and totals, not files', async () => {
    const t = await svc.tree();
    expect(t.counts).toEqual({ 3: { Drawings: 2, 'Drawings>Old': 1 }, 4: { '': 1 } });
    expect(t.totals).toMatchObject({ total: 4, recent: 1, bytes: 165 });
    expect((t as any).files).toBeUndefined();
    expect((await svc.tree((id) => id === 4)).projects.map((p) => p.id)).toEqual([4]);
  });

  it('pages a folder or every file, with search and latest-only', async () => {
    expect((await svc.filesPage({ projectId: '3', path: 'Drawings' })).rows.map((f) => f.id)).toEqual(['b', 'a']);
    expect((await svc.filesPage({ projectId: '3', path: 'Drawings', latest: '1' })).rows.map((f) => f.id)).toEqual(['a']);
    const all = await svc.filesPage({ size: '2', page: '2' });
    expect(all.total).toBe(4);
    expect(all.rows.map((f) => f.id)).toEqual(['d', 'c']);
    expect((await svc.filesPage({ q: 'contract' })).rows.map((f) => f.id)).toEqual(['d']);
  });

  it('a file comes with its revisions', async () => {
    const r = await svc.fileWithVersions('a');
    expect(r.versions.map((v) => v.id).sort()).toEqual(['a', 'b']);
  });
});
