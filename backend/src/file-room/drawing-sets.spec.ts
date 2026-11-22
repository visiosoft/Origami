import { PDFDocument } from 'pdf-lib';
import { backfillPlan, canUploadBase, drawingHistory, isBaseArea, nextLayerCode, nextMinor, nextUploadRev, revLabel } from './drawing-sets';
import { DrawingSetsService, stampNotApproved } from './drawing-sets.service';
import { MarkupsService } from './markups.service';

/** Nov 20 Weekly Sync: strict drawing sets -- who uploads, revisions 1.0 / 1.02, review layers, approved set, city flag, history. */
describe('drawing sets', () => {
  it('knows a drawing set: the build set’s folders, or a "Base sets" folder', () => {
    expect(isBaseArea(['Drawings & Plans', 'Base sets'], [])).toBe(true);
    expect(isBaseArea(['Architectural', 'A-series'], ['Architectural'])).toBe(true);
    expect(isBaseArea(['Drawings & Plans', 'Markups'], ['Architectural'])).toBe(false);
    expect(isBaseArea([], ['Architectural'])).toBe(false);
  });

  it('only i-1 / i-2 and the people named upload base drawings', () => {
    expect(canUploadBase({ sub: 'U-1', roleKey: 'admin' }, [])).toBe(true);
    expect(canUploadBase({ sub: 'U-2', roleKey: 'principal' }, [])).toBe(true);
    expect(canUploadBase({ sub: 'U-3', roleKey: 'pm' }, [])).toBe(false);
    expect(canUploadBase({ sub: 'U-3', roleKey: 'pm' }, ['U-3'])).toBe(true);
    expect(canUploadBase(null, ['U-3'])).toBe(false);
  });

  it('numbers revisions: the original is Rev 0, the architect’s before the decimal, ours after it, up to .05 (Nov 22)', () => {
    expect(revLabel(0, 0)).toBe('Rev 0');
    expect(revLabel(0, 1)).toBe('Rev 0.01');
    expect(revLabel(1, 0)).toBe('Rev 1');
    expect(revLabel(1, 2)).toBe('Rev 1.02');
    expect(revLabel(null, null)).toBe('');
    expect(nextUploadRev([])).toEqual({ revMajor: 0, revMinor: 0 });
    expect(nextUploadRev([{ id: 'a', revMajor: 0, revMinor: 0 }, { id: 'b', revMajor: 0, revMinor: 1 }])).toEqual({ revMajor: 1, revMinor: 0 });
    expect(nextUploadRev([{ id: 'a' }, { id: 'b' }])).toEqual({ revMajor: 2, revMinor: 0 }); // two older, unnumbered: Rev 0 and 1
    expect(nextMinor([{ id: 'a', revMajor: 1, revMinor: 0 }], 1)).toBe(1);
    expect(nextMinor([{ id: 'a', revMajor: 1, revMinor: 0 }, { id: 'b', revMajor: 1, revMinor: 4 }, { id: 'c', revMajor: 2, revMinor: 0 }], 1)).toBe(5);
    expect(() => nextMinor([{ id: 'a', revMajor: 1, revMinor: 5 }], 1)).toThrow(/architect’s next revision/);
  });

  it('numbers drawings already in a set by date from Rev 0, and moves ones numbered from Rev 1 one lower', () => {
    const plan = backfillPlan([
      { id: 'a2', name: 'A1.pdf', groupId: 'G', updatedAt: '2026-11-10' }, { id: 'a1', name: 'A1.pdf', groupId: 'G', updatedAt: '2026-11-01' },
      { id: 's', name: 'S1.pdf', updatedAt: '2026-11-05' },
      { id: 'n1', name: 'N.pdf', groupId: 'H', revMajor: 1, revMinor: 0 }, { id: 'n2', name: 'N.pdf', groupId: 'H', revMajor: 1, revMinor: 1 },
      { id: 'z', name: 'Z.pdf', groupId: 'Z', revMajor: 0, revMinor: 0 },
    ]);
    expect(plan.map((p) => [p.id, p.rev])).toEqual([['a1', 'Rev 0'], ['a2', 'Rev 1'], ['s', 'Rev 0'], ['n1', 'Rev 1 → Rev 0'], ['n2', 'Rev 1.01 → Rev 0.01']]);
  });

  it('gives review layers codes: I for our team, X for outside', () => {
    expect(nextLayerCode([], false)).toBe('I1');
    expect(nextLayerCode(['I1', 'I2', 'X1', 'Electrical', null], false)).toBe('I3');
    expect(nextLayerCode(['I1', 'X1'], true)).toBe('X2');
  });

  it('a drawing’s history: revisions, approvals, layers started, RFIs, emails -- newest first', () => {
    const h = drawingHistory({
      revisions: [{ id: 'F1', name: 'A1.pdf', revMajor: 1, revMinor: 0, uploadedBy: 'Edward', updatedAt: '2026-11-01T10:00:00Z', drawingLog: [{ at: '2026-11-02T10:00:00Z', by: 'Edward', kind: 'approve', text: 'approved as the working set' }] }],
      markups: [
        { fileId: 'F1', layer: 'X1', authorName: 'Kai (structural)', createdAt: '2026-11-03T10:00:00Z' },
        { fileId: 'F1', layer: 'X1', authorName: 'Kai (structural)', createdAt: '2026-11-03T11:00:00Z', linkType: 'rfi', linkId: 'RFI-505' },
      ],
      shares: [{ fileId: 'F1', at: '2026-11-04T10:00:00Z', by: 'Astrid', to: 'kai@x.co' }],
    });
    expect(h.map((e) => e.kind)).toEqual(['share', 'rfi', 'layer', 'approve', 'upload']);
    expect(h[2].text).toBe('Rev 1: started layer X1');
  });

  it('prints "not city-approved" across a published copy', async () => {
    const doc = await PDFDocument.create(); doc.addPage([612, 792]);
    const out = await stampNotApproved(await doc.save(), 'Structural, foundation only');
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
    expect(out.length).toBeGreaterThan(500);
  });

  // ---------------------------------------------------------------- service
  const setup = (buildSet: string[] = ['Architectural']) => {
    const files: any[] = [];
    const marks: any[] = [];
    const layers: any[] = [];
    const store: Record<string, string> = {};
    const filesRepo = {
      find: async (o?: any) => files.filter((f) => !o?.where?.groupId || f.groupId === o.where.groupId),
      findOneBy: async (w: any) => files.find((f) => f.id === w.id) || null,
      save: async (f: any) => { if (!files.includes(f)) files.push(f); return f; },
      update: async (w: any, p: any) => files.filter((f) => f.id === w.id).forEach((f) => Object.assign(f, p)),
    };
    const marksRepo = { find: async (o?: any) => marks.filter((m) => !o?.where?.fileId || (typeof o.where.fileId === 'string' ? m.fileId === o.where.fileId : true)), create: (r: any) => r, save: async (r: any) => { marks.push(r); return r; }, findOneBy: async () => null, delete: async () => undefined };
    const layerRepo = { find: async (o?: any) => layers.filter((l) => l.fileId === o?.where?.fileId), findOneBy: async (w: any) => layers.find((l) => l.id === w.id) || null, create: (r: any) => r, save: async (r: any) => { const i = layers.findIndex((l) => l.id === r.id); if (i >= 0) layers[i] = r; else layers.push(r); return r; }, delete: async () => undefined };
    const uploaded: any[] = [];
    const fileRoom = {
      buildSetOf: async () => buildSet,
      upload: async (projectId: number, folderPath: string[], incoming: any[]) => incoming.map((i) => {
        const prev = files.find((f) => f.name === i.originalname && f.isLatest);
        const row = { id: 'F' + (files.length + 1), projectId, folderPath, name: i.originalname, groupId: prev?.groupId || 'G1', isLatest: true, updatedAt: new Date().toISOString() };
        if (prev) { prev.isLatest = false; prev.groupId = prev.groupId || 'G1'; }
        files.push(row); uploaded.push(i); return row;
      }),
    };
    const settings = { get: async (k: string) => store[k] ?? null, set: async (k: string, v: string) => { store[k] = v; } };
    const markups = new MarkupsService(marksRepo as any, filesRepo as any, fileRoom as any, undefined, undefined, layerRepo as any);
    (markups as any).flatten = async (_id: string, _c: any, _a: any, ls: string[]) => ({ file: files[0], pdf: await (async () => { const d = await PDFDocument.create(); d.addPage(); return d.save(); })(), count: marks.filter((m) => ls.includes('L:' + String(m.layer).toLowerCase())).length });
    const svc = new DrawingSetsService(filesRepo as any, marksRepo as any, fileRoom as any, markups, settings as any);
    return { svc, markups, files, marks, layers, uploaded, store };
  };
  const ed = { sub: 'U-1', name: 'Edward', roleKey: 'admin', tier: 'internal' } as any;
  const pm = { sub: 'U-3', name: 'Astrid', roleKey: 'pm', tier: 'internal' } as any;
  const kai = { sub: 'U-K', name: 'Kai', roleKey: 'consultant', tier: 'consultant' } as any;

  it('stops others uploading into a drawing set, and numbers what i-1 / i-2 put in', async () => {
    const { svc, files, store } = setup();
    await expect(svc.assertBaseUpload(pm, 16, ['Architectural'])).rejects.toThrow(/keep the drawing sets/);
    await svc.assertBaseUpload(pm, 16, ['Photos']); // elsewhere is fine
    await svc.setUploaders(['U-3'], ed);
    expect(JSON.parse(store['fileRoom.baseUploaders'])).toEqual(['U-3']);
    await svc.assertBaseUpload(pm, 16, ['Architectural']);
    await expect(svc.setUploaders([], pm)).rejects.toThrow(/admin or principal/);
    files.push({ id: 'F1', projectId: 16, folderPath: ['Architectural'], name: 'A1.pdf', groupId: 'G1', isLatest: false, revMajor: 0, revMinor: 0 });
    const row = { id: 'F2', projectId: 16, folderPath: ['Architectural'], name: 'A1.pdf', groupId: 'G1', isLatest: true };
    files.push(row);
    const [stamped] = await svc.stampUploads([row as any], { name: 'Edward' });
    expect(stamped).toMatchObject({ revMajor: 1, revMinor: 0 });
    expect(stamped.drawingLog![0].text).toBe('Rev 1 put in');
  });

  it('markups on a drawing set go on an Internal-only review layer: I1 for our team, X1 for a consultant; i-1 / i-2 draw freely', async () => {
    const { markups, files, layers } = setup();
    files.push({ id: 'F1', projectId: 16, folderPath: ['Architectural'], name: 'A1.pdf', groupId: 'G1', isLatest: true });
    const box = { kind: 'rect', page: 1, data: { points: [[0.1, 0.1], [0.3, 0.3]] } };
    const a = await markups.create('F1', box, pm);
    const a2 = await markups.create('F1', box, pm);
    const k = await markups.create('F1', box, kai);
    const e = await markups.create('F1', box, ed);
    expect([a.layer, a2.layer, k.layer, e.layer]).toEqual(['I1', 'I1', 'X1', null]);
    expect(layers.map((l) => [l.layerKey, l.audience])).toEqual([['L:i1', 'internal'], ['L:x1', 'internal']]);
    await expect(markups.setLayerAccess('F1', 'L:i1', { audience: 'everyone' }, pm)).rejects.toThrow(/Review layers/);
    await expect(markups.renameLayer('F1', { from: 'I1', to: 'Astrid' }, pm)).rejects.toThrow(/Review layers/);
  });

  it('a typed layer name starts Private; the owner routes it; only i-1 / i-2 hold, approve or reject; Modify copies it back to the owner (Nov 22)', async () => {
    const { markups, files, layers, marks } = setup();
    files.push({ id: 'F1', projectId: 16, folderPath: ['Architectural'], name: 'A1.pdf', groupId: 'G1', isLatest: true });
    const box = { kind: 'rect', page: 1, data: { points: [[0.1, 0.1], [0.3, 0.3]] } };
    await markups.create('F1', { ...box, layer: 'C-10 Electrical – Move power by Losi' }, kai);
    const key = 'L:c-10 electrical – move power by losi';
    expect(layers[0]).toMatchObject({ layerKey: key, audience: 'internal', state: 'private' });
    await expect(markups.setLayerState('F1', key, { state: 'approved' }, kai)).rejects.toThrow(/Only its owner/);
    await expect(markups.setLayerState('F1', key, { state: 'routed' }, pm)).rejects.toThrow(/Only its owner/);
    expect(await markups.setLayerState('F1', key, { state: 'routed' }, kai)).toMatchObject({ state: 'routed', audience: 'internal' });
    expect(await markups.setLayerState('F1', key, { state: 'private' }, kai)).toMatchObject({ state: 'private' });
    expect(await markups.setLayerState('F1', key, { state: 'rejected' }, ed)).toMatchObject({ state: 'rejected', audience: 'people', people: [{ type: 'user', id: 'U-K', name: 'Kai' }] });
    await expect(markups.setLayerAccess('F1', key, { audience: 'everyone' }, kai)).rejects.toThrow(/Review layers/);
    expect(await markups.setLayerState('F1', key, { state: 'approved', audience: 'everyone' }, ed)).toMatchObject({ state: 'approved', audience: 'everyone' });
    expect((await markups.layerAccess('F1')).find((r: any) => r.layerKey === key)).toMatchObject({ state: 'approved', audience: 'everyone' });
    await expect(markups.duplicateLayer('F1', key, pm)).rejects.toThrow(/admin or principal/);
    const copy = await markups.duplicateLayer('F1', key, ed);
    expect(copy).toMatchObject({ layer: 'C-10 Electrical – Move power by Losi (Modified)', markups: 1 });
    expect(marks.filter((m) => m.layer === copy.layer)).toHaveLength(1);
    expect(marks.find((m) => m.layer === 'C-10 Electrical – Move power by Losi')).toMatchObject({ authorId: 'U-K' }); // the original is untouched
    expect(layers.find((l) => l.layerKey === copy.layerKey)).toMatchObject({ state: 'modified', copyOf: key, audience: 'people', people: [{ id: 'U-K' }] });
    expect(files[0].drawingLog.map((e: any) => e.kind)).toEqual(['layer-routed', 'layer-private', 'layer-rejected', 'layer-approved', 'layer-modified']);
  });

  it('publishes chosen layers as the next revision after the decimal, approves one revision, and flags city approval', async () => {
    const { svc, markups, files, uploaded } = setup();
    files.push({ id: 'F1', projectId: 16, folderPath: ['Architectural'], name: 'A1.pdf', groupId: 'G1', isLatest: true, revMajor: 1, revMinor: 0 });
    await markups.create('F1', { kind: 'rect', page: 1, data: { points: [[0.1, 0.1], [0.3, 0.3]] } }, pm);
    await expect(svc.publish('F1', ['L:i1'], pm)).rejects.toThrow(/admin or principal/);
    await svc.setCity('F1', { notCityApproved: true, cityNote: 'Structural, foundation only' }, ed);
    const r = await svc.publish('F1', ['L:i1'], ed);
    expect(r).toMatchObject({ rev: 'Rev 1.01', markups: 1 });
    expect(uploaded).toHaveLength(1);
    const neu = files.find((f) => f.id === r.id);
    expect(neu).toMatchObject({ revMajor: 1, revMinor: 1, notCityApproved: true, cityNote: 'Structural, foundation only' });
    await svc.approve('F1', true, ed);
    let st = await svc.state(r.id);
    expect(st).toMatchObject({ rev: 'Rev 1.01', isApproved: false, approved: { id: 'F1', rev: 'Rev 1', by: 'Edward' }, notCityApproved: true });
    await svc.approve(r.id, true, ed);
    st = await svc.state('F1');
    expect(st.approved?.id).toBe(r.id);
    expect(files.filter((f) => f.approvedAt)).toHaveLength(1);
    await expect(svc.approve('F1', true, pm)).rejects.toThrow(/admin or principal/);
    const h = await svc.history(r.id);
    expect(h.some((e) => /Rev 1.01 published/.test(e.text))).toBe(true);
    expect(h.some((e) => /approved as the working set/.test(e.text))).toBe(true);
  });

  it('numbers drawings already in sets only after a preview', async () => {
    const { svc, files } = setup();
    files.push({ id: 'F1', projectId: 16, folderPath: ['Architectural'], name: 'A1.pdf', updatedAt: '2026-11-01' }, { id: 'F2', projectId: 16, folderPath: ['Photos'], name: 'P.pdf' });
    expect(await svc.backfill(null, false, ed)).toMatchObject({ count: 1, rows: [{ id: 'F1', rev: 'Rev 0' }] });
    expect(files[0].revMajor).toBeUndefined();
    await svc.backfill(null, true, ed);
    expect(files[0]).toMatchObject({ revMajor: 0, revMinor: 0 });
    await expect(svc.backfill(null, true, pm)).rejects.toThrow(/admin/);
  });
});
