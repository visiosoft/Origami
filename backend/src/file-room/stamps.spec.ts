import { PDFDocument } from 'pdf-lib';
import { cleanMarkup, flattenPdf } from './markups';
import { STAMP_KEYS, stampStrokes } from './stamps';

describe('drawing stamps', () => {
  it('a stamp is an icon in a box; an unknown icon becomes a check', () => {
    const m = cleanMarkup({ kind: 'stamp', page: 1, data: { points: [[0.1, 0.1], [0.14, 0.15]], icon: 'north' } });
    expect(m.data).toMatchObject({ icon: 'north', points: [[0.1, 0.1], [0.14, 0.15]] });
    expect(cleanMarkup({ kind: 'stamp', page: 1, data: { points: [[0.1, 0.1], [0.2, 0.2]], icon: 'skull' } }).data.icon).toBe('check');
    expect(() => cleanMarkup({ kind: 'stamp', page: 1, data: { points: [[0.1, 0.1]] } })).toThrow(/shape/);
    expect(STAMP_KEYS).toEqual(['check', 'cross', 'warning', 'question', 'north', 'section', 'detail']);
  });

  it('scales its strokes to the box, so it grows and shrinks with the drawing', () => {
    const [line] = stampStrokes('cross', [0.5, 0.5], [0.74, 0.74]);
    expect(line[0][0]).toBeCloseTo(0.55);
    expect(line[1][1]).toBeCloseTo(0.69);
  });

  it('prints into the downloaded PDF', async () => {
    const doc = await PDFDocument.create(); doc.addPage([600, 400]);
    const src = Buffer.from(await doc.save());
    const out = await flattenPdf(src, [{ page: 1, kind: 'stamp', data: { points: [[0.1, 0.1], [0.2, 0.25]], color: '#E0321B', width: 2, icon: 'warning' } }]);
    expect(out.length).toBeGreaterThan(src.length);
  });
});
