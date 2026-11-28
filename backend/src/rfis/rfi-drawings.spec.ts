import { PDFDocument } from 'pdf-lib';
import { appendDrawings, appendReport, cropAround, pdfSafe, tocPageCount, tocRows } from './rfi-drawings';

describe('RFI PDF with its drawings (Nov 19)', () => {
  it('crops to the area around the markups, with room around them', () => {
    const box = cropAround([{ data: { points: [[0.5, 0.5], [0.55, 0.52]] } as any }], 2592, 1728, 0);
    expect(box.x).toBeGreaterThan(0); expect(box.width).toBeLessThan(2592);
    expect(box.x).toBeLessThan(0.5 * 2592); expect(box.x + box.width).toBeGreaterThan(0.55 * 2592);
    // No markups: the whole sheet.
    expect(cropAround([], 100, 50, 0)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('adds one cropped, labelled page per sheet after the form', async () => {
    const form = await PDFDocument.create(); form.addPage([612, 792]);
    const sheet = await PDFDocument.create(); sheet.addPage([2592, 1728]); sheet.addPage([2592, 1728]);
    const out = await appendDrawings(await form.save(), [{ bytes: await sheet.save(), page: 2, title: 'A2.01 — Floor Plan · p. 2', marks: [{ page: 2, kind: 'rect', data: { points: [[0.4, 0.4], [0.6, 0.6]], color: '#e00', width: 2 } as any }] }]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    const crop = doc.getPage(1).getCropBox();
    expect(crop.width).toBeLessThan(2592);
    expect(crop.width).toBeGreaterThan(0.2 * 2592);
  });

  it('Nov 27: the report lists each item with its page, then one page per item', async () => {
    expect(tocPageCount(0)).toBe(0); expect(tocPageCount(26)).toBe(1); expect(tocPageCount(27)).toBe(2);
    const rows = tocRows([{ n: 1, kind: 'Cloud', label: 'Toilet change', sheet: 'A2.01 p. 2', origin: 'Ehsan', status: 'On the set' }, { n: 2, kind: 'Pen', label: '', sheet: 'A2.01 p. 2', origin: 'Ehsan', status: 'Draft (our team)' }], 2);
    expect(rows.map((r) => r.pdfPage)).toEqual([4, 5]);
    expect(pdfSafe('Toilet ✎ change — ok')).toBe('Toilet  change — ok');

    const form = await PDFDocument.create(); form.addPage([612, 792]);
    const sheet = await PDFDocument.create(); sheet.addPage([2592, 1728]); sheet.addPage([2592, 1728]);
    const bytes = await sheet.save();
    const mark = (x: number) => ({ page: 2, kind: 'cloud', data: { points: [[x, 0.4], [x + 0.1, 0.5]], color: '#e00', width: 2 } as any });
    const items = [1, 2].map((n) => ({ n, kind: 'Cloud', label: `Item ${n}`, sheet: 'A2.01 p. 2', origin: 'Ehsan', status: 'On the set', bytes, page: 2, mark: mark(n * 0.3), context: [mark(0.3), mark(0.6)], cacheKey: 'F|2' }));
    const out = await PDFDocument.load(await appendReport(await form.save(), { number: 'RFI-012', question: 'Can the toilet move 300mm to the east wall? '.repeat(6), items }));
    expect(out.getPageCount()).toBe(4); // form + contents + 2 items
    expect(out.getPage(2).getCropBox().width).toBeLessThan(2592);
    expect(out.getPage(2).getCropBox().x).not.toBe(out.getPage(3).getCropBox().x);
  });
});
