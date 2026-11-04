import { PDFDocument, PDFName, degrees } from 'pdf-lib';
import { canEditMarkup, cleanMarkup, cleanSheetNames, isMarkable, photoPageSize, photoToPdf, cloudPath, flattenPdf, layerKey, linkLabel, toPage, trianglePts, visibleTo, wrapLines } from './markups';
import { MarkupsService, PIN_PHOTO_FOLDER } from './markups.service';

const twoPages = async (rotate = 0) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 2; i++) { const p = doc.addPage([792, 612]); p.setRotation(degrees(rotate)); }
  return Buffer.from(await doc.save());
};

describe('PDF markup rules', () => {
  it('cleans a markup: clamps points, defaults colour and width, needs a shape', () => {
    const m = cleanMarkup({ kind: 'rect', page: 2, data: { points: [[-1, 0.2], [0.5, 9]], color: 'red', width: 900 } });
    expect(m).toEqual({ kind: 'rect', page: 2, private: false, layer: null, data: { points: [[0, 0.2], [0.5, 1]], color: '#E0321B', width: 40 } });
    expect(() => cleanMarkup({ kind: 'line', page: 1, data: { points: [[0, 0]] } })).toThrow(/no shape/);
    expect(() => cleanMarkup({ kind: 'text', page: 1, data: { points: [[0, 0]], text: ' ' } })).toThrow(/Type some text/);
    expect(() => cleanMarkup({ kind: 'scale', page: 1, data: { points: [[0, 0], [1, 0]] } })).toThrow(/real length/);
    expect(cleanMarkup({ kind: 'scale', page: 1, data: { points: [[0, 0], [1, 0]], real: 12.5, unit: 'ft' } }).data).toMatchObject({ real: 12.5, unit: 'ft' });
    expect(() => cleanMarkup({ kind: 'bogus', page: 1, data: {} })).toThrow(/Unknown/);
  });

  it('private drafts show only to their author; only the author or an admin edits', () => {
    const rows = [{ id: 'a', private: false, authorId: 'U-1' }, { id: 'b', private: true, authorId: 'U-1' }, { id: 'c', private: true, authorId: 'U-2' }];
    expect(visibleTo(rows, 'U-1').map((r) => r.id)).toEqual(['a', 'b']);
    expect(visibleTo(rows, 'U-3').map((r) => r.id)).toEqual(['a']);
    expect(canEditMarkup({ authorId: 'U-1' }, { id: 'U-1' })).toBe(true);
    expect(canEditMarkup({ authorId: 'U-1' }, { id: 'U-2' })).toBe(false);
    expect(canEditMarkup({ authorId: 'U-1' }, { id: 'U-2', isAdmin: true })).toBe(true);
    // i-1 (admin) and i-2 (principal) see private drafts too (Oct 31).
    expect(visibleTo(rows, 'U-3', 'principal').map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(visibleTo(rows, 'U-3', 'admin').map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(visibleTo(rows, 'U-3', 'pm').map((r) => r.id)).toEqual(['a']);
  });

  it('maps a shown point onto the page for every rotation', () => {
    // A 100 x 50 page. Top-left as shown, in top-left page points.
    expect(toPage([0, 0], 100, 50, 0)).toEqual([0, 0]);
    expect(toPage([1, 1], 100, 50, 0)).toEqual([100, 50]);
    // Turned 90 degrees clockwise: the page's bottom-left shows at the top-left.
    expect(toPage([0, 0], 100, 50, 90)).toEqual([0, 50]);
    expect(toPage([1, 0], 100, 50, 90)).toEqual([0, 0]);
    expect(toPage([0, 0], 100, 50, 180)).toEqual([100, 50]);
    expect(toPage([0, 0], 100, 50, 270)).toEqual([100, 0]);
  });

  it('a cloud is one closed path of scallops', () => {
    const d = cloudPath([0, 0], [100, 50], 10);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/Q /g) || []).length).toBe(10 + 5 + 10 + 5);
  });

  it('draws markups into the PDF without changing its pages', async () => {
    for (const rot of [0, 90]) {
      const src = await twoPages(rot);
      const marks = [
        { page: 2, kind: 'cloud', data: { points: [[0.1, 0.1], [0.4, 0.3]], color: '#E0321B', width: 2 } },
        { page: 2, kind: 'arrow', data: { points: [[0.5, 0.5], [0.7, 0.6]], color: '#1D4ED8', width: 2 } },
        { page: 1, kind: 'text', data: { points: [[0.2, 0.2]], color: '#000000', width: 1, text: 'Check “this” → beam', size: 12 } },
        { page: 1, kind: 'measure_area', data: { points: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3]], color: '#047857', width: 1, label: '120 sq ft' } },
        { page: 1, kind: 'ellipse', data: { points: [[0.6, 0.6], [0.8, 0.7]], color: '#047857', width: 1 } },
        { page: 1, kind: 'highlight', data: { points: [[0.1, 0.8], [0.5, 0.8]], color: '#FACC15', width: 12 } },
        { page: 1, kind: 'pin', data: { points: [[0.4, 0.4]], color: '#E0321B', width: 1, text: 'Crack', photos: [{ fileId: 'F9', name: 'a.jpg' }] } },
        { page: 9, kind: 'line', data: { points: [[0, 0], [1, 1]], color: '#000000', width: 1 } },
      ] as any[];
      const out = await flattenPdf(src, marks);
      const doc = await PDFDocument.load(out);
      expect(doc.getPageCount()).toBe(2);
      expect(out.length).toBeGreaterThan(src.length);
    }
  });
});

describe('MarkupsService', () => {
  const setup = () => {
    const rows: any[] = [];
    const repo = {
      find: jest.fn(async (q: any) => rows.filter((r) => Object.entries(q.where).every(([k, v]) => r[k] === v))),
      findOneBy: jest.fn(async (w: any) => rows.find((r) => r.id === w.id) || null),
      create: (x: any) => x,
      save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
      delete: jest.fn(async (w: any) => { const i = rows.findIndex((r) => r.id === w.id); if (i >= 0) rows.splice(i, 1); }),
    };
    const fileRow: any = { id: 'F1', name: 'A-201.pdf', projectId: 3, folderPath: ['Drawings'], sheetNames: null };
    const files = { findOneBy: async () => fileRow, update: async (_w: any, patch: any) => Object.assign(fileRow, patch) };
    const uploads: any[] = [];
    const fileRoom = {
      content: async () => ({ file: { id: 'F1', name: 'A-201.pdf', projectId: 3, folderPath: ['Drawings'] }, body: new Blob([await twoPages()]).stream() }),
      upload: async (...a: any[]) => { uploads.push(a); return [{ id: 'F2', name: a[2][0].originalname }]; },
    };
    const symRows: any[] = [];
    const symbolRepo = {
      find: async () => symRows, findOneBy: async (w: any) => symRows.find((r) => r.id === w.id) || null, create: (x: any) => x,
      save: async (x: any) => { const i = symRows.findIndex((r) => r.id === x.id); if (i >= 0) symRows[i] = x; else symRows.push(x); return x; },
      delete: async (w: any) => { const i = symRows.findIndex((r) => r.id === w.id); if (i >= 0) symRows.splice(i, 1); },
    };
    return { svc: new MarkupsService(repo as any, files as any, fileRoom as any, undefined, symbolRepo as any), rows, uploads, symRows };
  };
  const ed = { sub: 'U-1', name: 'Edward', roleKey: 'admin', tier: 'internal' } as any;
  const an = { sub: 'U-2', name: 'Andrea', roleKey: 'staff', tier: 'internal' } as any;
  const client = { sub: 'U-9', name: 'Client', roleKey: 'client', tier: 'client' } as any;

  it('clients look but do not draw; a page keeps one scale', async () => {
    const { svc, rows } = setup();
    await expect(svc.create('F1', { kind: 'rect', page: 1, data: { points: [[0, 0], [1, 1]] } }, client)).rejects.toThrow(/team and consultants/);
    await svc.create('F1', { kind: 'scale', page: 1, data: { points: [[0, 0], [0.5, 0]], real: 10, unit: 'ft' } }, an);
    await svc.create('F1', { kind: 'scale', page: 1, data: { points: [[0, 0], [0.25, 0]], real: 10, unit: 'ft' } }, an);
    expect(rows.filter((r) => r.kind === 'scale')).toHaveLength(1);
  });

  it('a private draft stays with its author; others may only link a markup to their RFI', async () => {
    const { svc } = setup();
    const m = await svc.create('F1', { kind: 'cloud', page: 2, private: true, data: { points: [[0.1, 0.1], [0.2, 0.2]] } }, an);
    expect(await svc.list('F1', { ...ed, roleKey: 'staff' })).toHaveLength(0);
    expect(await svc.list('F1', an)).toHaveLength(1);
    // i-1 / i-2 see every markup, private drafts included.
    expect(await svc.list('F1', ed)).toHaveLength(1);
    expect(await svc.list('F1', { ...ed, roleKey: 'principal' })).toHaveLength(1);
    await svc.update(m.id, { private: false }, an);
    await expect(svc.update(m.id, { data: { points: [[0, 0], [1, 1]] } }, { ...ed, roleKey: 'staff' })).rejects.toThrow(/Only whoever drew it/);
    expect((await svc.update(m.id, { linkType: 'rfi', linkId: 'RFI-7' }, { ...ed, roleKey: 'staff' })).linkId).toBe('RFI-7');
  });

  it('records a change order or FOR RECORD item made from a markup, and nothing else', async () => {
    const { svc } = setup();
    const m = await svc.create('F1', { kind: 'pin', page: 1, data: { points: [[0.4, 0.4]], text: 'Crack at footing' } }, an);
    expect((await svc.update(m.id, { linkType: 'co', linkId: 'CO-9' }, an)).linkType).toBe('co');
    expect((await svc.update(m.id, { linkType: 'record', linkId: 'T-3' }, an)).linkType).toBe('record');
    expect((await svc.update(m.id, { linkType: 'invoice', linkId: 'X' } as any, an)).linkType).toBeNull();
  });

  it('saves a marked-up copy beside the drawing, named so the drawing stays Current', async () => {
    const { svc, uploads } = setup();
    await svc.create('F1', { kind: 'rect', page: 1, data: { points: [[0.1, 0.1], [0.3, 0.3]] } }, an);
    await svc.saveCopy('F1', an);
    expect(uploads[0][0]).toBe(3);
    expect(uploads[0][1]).toEqual(['Drawings']);
    expect(uploads[0][2][0].originalname).toMatch(/^A-201 — markup \d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('a pin holds a note and site photos, kept in the project\'s Markup photos folder', async () => {
    const { svc, uploads } = setup();
    const pin = await svc.create('F1', { kind: 'pin', page: 1, data: { points: [[0.4, 0.5]], text: 'Crack at footing' } }, an);
    expect(pin.data).toMatchObject({ text: 'Crack at footing' });
    const img = { originalname: 'IMG_1.jpg', mimetype: 'image/jpeg', size: 3, buffer: Buffer.from('abc') };
    await expect(svc.addPhotos(pin.id, [{ ...img, mimetype: 'application/pdf' }], an)).rejects.toThrow(/Pick a photo/);
    const withPhoto = await svc.addPhotos(pin.id, [img], ed);
    expect(uploads[0][1]).toEqual(PIN_PHOTO_FOLDER);
    expect((withPhoto.data as any).photos).toEqual([{ fileId: 'F2', name: 'IMG_1.jpg' }]);
    expect(((await svc.removePhoto(pin.id, 'F2', an)).data as any).photos).toEqual([]);
    const box = await svc.create('F1', { kind: 'rect', page: 1, data: { points: [[0, 0], [1, 1]] } }, an);
    await expect(svc.addPhotos(box.id, [img], an)).rejects.toThrow(/go on a pin/);
  });

  it('named layers: drawn on, renamed for everyone, downloaded on their own', async () => {
    const { svc, rows } = setup();
    await svc.create('F1', { kind: 'rect', page: 1, layer: '  Electrical  walk ', data: { points: [[0.1, 0.1], [0.3, 0.3]] } }, an);
    await svc.create('F1', { kind: 'rect', page: 1, layer: 'electrical walk', data: { points: [[0.2, 0.2], [0.4, 0.4]] } }, ed);
    await svc.create('F1', { kind: 'pen', page: 1, data: { points: [[0.1, 0.1], [0.2, 0.2]] } }, an);
    expect(rows.map((r) => r.layer)).toEqual(['Electrical walk', 'electrical walk', null]);
    expect(await svc.renameLayer('F1', { from: 'Electrical walk', to: 'Electrical — level 1' }, an)).toEqual({ layer: 'Electrical — level 1', updated: 2 });
    // Andrea's own unnamed layer is hers (or an admin's) to name.
    await expect(svc.renameLayer('F1', { from: null, authorId: 'U-2', to: 'Mine' }, { ...ed, roleKey: 'staff' })).rejects.toThrow(/owner/);
    expect((await svc.renameLayer('F1', { from: null, to: 'Andrea notes' }, an)).updated).toBe(1);
    await expect(svc.renameLayer('F1', { from: 'Andrea notes', to: '  ' }, an)).rejects.toThrow(/name/);
    expect((await svc.flatten('F1', an, undefined, [layerKey({ layer: 'Andrea notes' })])).count).toBe(1);
    expect((await svc.flatten('F1', an)).count).toBe(3);
  });

  it('links go to a page of the drawing or a file in the same project, and stay clickable in the PDF', async () => {
    const rows: any[] = [];
    const repo = { find: async () => rows, findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null, create: (x: any) => x, save: async (x: any) => { rows.push(x); return x; }, delete: async () => undefined };
    const fileRows: Record<string, any> = { F1: { id: 'F1', name: 'A-201.pdf', projectId: 3 }, F5: { id: 'F5', name: 'Card 3.pdf', projectId: 3 }, F8: { id: 'F8', name: 'Other.pdf', projectId: 4 } };
    const files = { findOneBy: async (w: any) => fileRows[w.id] || null };
    const svc = new MarkupsService(repo as any, files as any, {} as any);
    const box = [[0.1, 0.1], [0.3, 0.2]];
    await expect(svc.create('F1', { kind: 'link', page: 1, data: { points: box } }, an)).rejects.toThrow(/Pick the page or file/);
    await expect(svc.create('F1', { kind: 'link', page: 1, data: { points: box, target: { type: 'file', fileId: 'F8', name: 'Other.pdf' } } }, an)).rejects.toThrow(/this project/);
    const toFile = await svc.create('F1', { kind: 'link', page: 1, data: { points: box, target: { type: 'file', fileId: 'F5', name: 'Card 3.pdf', page: 2 } } }, an);
    expect((toFile.data as any).target).toEqual({ type: 'file', fileId: 'F5', name: 'Card 3.pdf', page: 2 });
    expect(linkLabel({ type: 'page', page: 5 })).toBe('→ p. 5');
    expect(linkLabel((toFile.data as any).target)).toBe('→ Card 3.pdf, p. 2');

    const out = await flattenPdf(await twoPages(), [
      { page: 1, kind: 'link', data: { points: box, color: '#1D4ED8', width: 1, target: { type: 'page', page: 2 } } },
      { page: 1, kind: 'link', data: { points: [[0.5, 0.5], [0.6, 0.6]], color: '#1D4ED8', width: 1, target: { type: 'file', fileId: 'F5', name: 'Card 3.pdf' } } },
    ] as any[], { fileUrl: (id) => `https://app.example/planroom?file=${id}` });
    const doc = await PDFDocument.load(out);
    const annots = doc.getPages()[0].node.Annots()!;
    expect(annots.size()).toBe(2);
    const dicts = annots.asArray().map((r) => doc.context.lookup(r) as any);
    expect(dicts.map((d) => d.get(PDFName.of('Subtype')).toString())).toEqual(['/Link', '/Link']);
    expect(dicts[0].get(PDFName.of('Dest')).toString()).toContain('/Fit');
    expect(dicts[1].get(PDFName.of('A')).get(PDFName.of('URI')).decodeText()).toBe('https://app.example/planroom?file=F5');
  });

  it('keeps a note on any markup, tidied, line breaks kept (it stays in the list, not on the sheet)', () => {
    const m = cleanMarkup({ kind: 'cloud', page: 1, data: { points: [[0.1, 0.1], [0.2, 0.2]], color: '#FFFFFF', note: '  Patch   drywall \n here ' } });
    expect(m.data.note).toBe('Patch drywall\nhere');
    expect(cleanMarkup({ kind: 'rect', page: 1, data: { points: [[0.1, 0.1], [0.2, 0.2]], note: 'x'.repeat(1500) } }).data.note).toHaveLength(1000);
    expect(m.data.color).toBe('#FFFFFF');
    expect(cleanMarkup({ kind: 'rect', page: 1, data: { points: [[0.1, 0.1], [0.2, 0.2]], note: '   ' } }).data.note).toBeUndefined();
  });

  it('takes the new shapes (Oct 31): polyline, path length, triangle, polyshape, fills and wrapping text', async () => {
    expect(() => cleanMarkup({ kind: 'polygon', page: 1, data: { points: [[0, 0], [1, 1]] } })).toThrow(/no shape/);
    const poly = cleanMarkup({ kind: 'polygon', page: 1, data: { points: [[0, 0], [1, 0], [1, 1]], fill: true } });
    expect(poly.data.fill).toBe(true);
    expect(cleanMarkup({ kind: 'line', page: 1, data: { points: [[0, 0], [1, 1]], fill: true } }).data.fill).toBeUndefined();
    expect(cleanMarkup({ kind: 'text', page: 1, data: { points: [[0.1, 0.1]], text: 'Hi', boxW: 5 } }).data.boxW).toBe(1);
    expect(trianglePts([0.4, 0.2], [0.2, 0.6])[1]).toEqual([0.4, 0.6]);
    expect(wrapLines('the quick brown fox', 10, (s) => s.length)).toEqual(['the quick', 'brown fox']);
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create(); doc.addPage([600, 400]);
    const out = await flattenPdf(await doc.save(), [
      { page: 1, kind: 'polyline', data: { points: [[0.1, 0.1], [0.2, 0.3], [0.4, 0.2]], color: '#1D4ED8', width: 2 } },
      { page: 1, kind: 'measure_path', data: { points: [[0.1, 0.5], [0.3, 0.5], [0.3, 0.7]], color: '#1D4ED8', width: 2, label: `20'-0"` } },
      { page: 1, kind: 'triangle', data: { points: [[0.5, 0.1], [0.7, 0.3]], color: '#047857', width: 2, fill: true } },
      { page: 1, kind: 'polygon', data: { points: [[0.6, 0.5], [0.8, 0.5], [0.7, 0.8]], color: '#7C3AED', width: 2, fill: true } },
      { page: 1, kind: 'text', data: { points: [[0.1, 0.8]], color: '#111827', width: 1, size: 12, boxW: 0.2, text: 'A long note that has to wrap inside its box on the drawing' } },
    ]);
    expect(out.byteLength).toBeGreaterThan(1000);
  });

  it('keeps sheet names by page (Oct 31): merged, cleared, cleaned; links show them', async () => {
    expect(cleanSheetNames({ 1: ' A100 ', 2: '', x: 'E1', 0: 'Z', 3: 'A-201 Floor plan level two extra long name' })).toEqual({ 1: 'A100', 3: 'A-201 Floor plan level two extra long name' });
    expect(linkLabel({ type: 'page', page: 2 }, (n) => (n === 2 ? 'A501' : undefined))).toBe('→ A501');
    expect(linkLabel({ type: 'page', page: 3 }, () => undefined)).toBe('→ p. 3');
    const { svc } = setup();
    await expect(svc.setSheetNames('F1', { names: { 1: 'A100' } }, client)).rejects.toThrow(/team and consultants/);
    expect(await svc.setSheetNames('F1', { names: { 1: 'A100', 2: 'A101' } }, an)).toEqual({ 1: 'A100', 2: 'A101' });
    expect(await svc.setSheetNames('F1', { names: { 2: 'A102', 1: '' } }, an)).toEqual({ 2: 'A102' });
    expect(await svc.sheetNames('F1')).toEqual({ 2: 'A102' });
  });

  it('marks up photos too (Oct 31): JPG and PNG become a one-page PDF sized like the viewer', async () => {
    expect(isMarkable({ name: 'site.JPG' })).toBe(true);
    expect(isMarkable({ name: 'x.docx' })).toBe(false);
    expect(photoPageSize(4000, 3000)).toEqual([1200, 900]);
    const { PDFDocument } = await import('pdf-lib');
    // A 1x1 PNG.
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    const pdf = await PDFDocument.load(await photoToPdf(png, 'a.png'));
    expect(pdf.getPage(0).getSize()).toEqual({ width: 1200, height: 1200 });
    await expect(photoToPdf(new Uint8Array([1, 2, 3]), 'b.gif')).rejects.toThrow(/JPG and PNG/);
  });

  it('keeps a symbol library admins look after, and places symbols like pins (Oct 31)', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const { svc } = setup();
    await expect(svc.addSymbol({ name: 'Fire extinguisher', image: png }, an)).rejects.toThrow(/Only admins/);
    await expect(svc.addSymbol({ name: '', image: png }, ed)).rejects.toThrow(/name/);
    await expect(svc.addSymbol({ name: 'X', image: 'data:image/gif;base64,AAAA' }, ed)).rejects.toThrow(/PNG, JPG or SVG/);
    const s = await svc.addSymbol({ name: '  Fire   extinguisher ', image: png }, ed);
    expect(s.name).toBe('Fire extinguisher');
    expect((await svc.renameSymbol(s.id, { name: 'FE' }, ed)).name).toBe('FE');
    expect((await svc.symbols()).map((x) => x.name)).toEqual(['FE']);
    await expect(svc.create('F1', { kind: 'symbol', page: 1, data: { points: [[0.1, 0.1], [0.15, 0.15]] } }, an)).rejects.toThrow(/Pick a symbol/);
    const m = await svc.create('F1', { kind: 'symbol', page: 1, data: { points: [[0.1, 0.1], [0.15, 0.15]], symbolId: s.id, label: 'FE' } }, an);
    expect(m.data).toMatchObject({ symbolId: s.id, label: 'FE' });
    const { pdf } = await svc.flatten('F1', an);
    expect(pdf.length).toBeGreaterThan(1000);
    await svc.removeSymbol(s.id, ed);
    expect(await svc.symbols()).toEqual([]);
    // A deleted symbol still draws, as a labelled box.
    expect((await svc.flatten('F1', an)).pdf.length).toBeGreaterThan(1000);
  });
});
