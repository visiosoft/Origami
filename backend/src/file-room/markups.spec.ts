import { PDFDocument, degrees } from 'pdf-lib';
import { canEditMarkup, cleanMarkup, cloudPath, flattenPdf, toPage, visibleTo } from './markups';
import { MarkupsService } from './markups.service';

const twoPages = async (rotate = 0) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 2; i++) { const p = doc.addPage([792, 612]); p.setRotation(degrees(rotate)); }
  return Buffer.from(await doc.save());
};

describe('PDF markup rules', () => {
  it('cleans a markup: clamps points, defaults colour and width, needs a shape', () => {
    const m = cleanMarkup({ kind: 'rect', page: 2, data: { points: [[-1, 0.2], [0.5, 9]], color: 'red', width: 900 } });
    expect(m).toEqual({ kind: 'rect', page: 2, private: false, data: { points: [[0, 0.2], [0.5, 1]], color: '#E0321B', width: 40 } });
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
    const files = { findOneBy: async () => ({ id: 'F1', name: 'A-201.pdf', projectId: 3, folderPath: ['Drawings'] }) };
    const uploads: any[] = [];
    const fileRoom = {
      content: async () => ({ file: { id: 'F1', name: 'A-201.pdf', projectId: 3, folderPath: ['Drawings'] }, body: new Blob([await twoPages()]).stream() }),
      upload: async (...a: any[]) => { uploads.push(a); return [{ id: 'F2', name: a[2][0].originalname }]; },
    };
    return { svc: new MarkupsService(repo as any, files as any, fileRoom as any), rows, uploads };
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
    expect(await svc.list('F1', ed)).toHaveLength(0);
    expect(await svc.list('F1', an)).toHaveLength(1);
    await svc.update(m.id, { private: false }, an);
    await expect(svc.update(m.id, { data: { points: [[0, 0], [1, 1]] } }, { ...ed, roleKey: 'staff' })).rejects.toThrow(/Only whoever drew it/);
    expect((await svc.update(m.id, { linkType: 'rfi', linkId: 'RFI-7' }, { ...ed, roleKey: 'staff' })).linkId).toBe('RFI-7');
  });

  it('saves a marked-up copy beside the drawing, named so the drawing stays Current', async () => {
    const { svc, uploads } = setup();
    await svc.create('F1', { kind: 'rect', page: 1, data: { points: [[0.1, 0.1], [0.3, 0.3]] } }, an);
    await svc.saveCopy('F1', an);
    expect(uploads[0][0]).toBe(3);
    expect(uploads[0][1]).toEqual(['Drawings']);
    expect(uploads[0][2][0].originalname).toMatch(/^A-201 — markup \d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
