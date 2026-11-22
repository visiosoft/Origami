import { PDFDocument } from 'pdf-lib';
import { appendDrawings, cropAround } from './rfi-drawings';

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
});
