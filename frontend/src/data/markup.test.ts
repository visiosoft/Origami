import { describe, expect, it } from 'vitest';
import { FILLABLE, sheetNameFrom, sheetNameFromLines, sheetNumberOf, dedupePoints, pathLengthPts, trianglePts, wrapLines, labelLayout } from './markup';
import { areaPts, cloudPath, feetInches, lengthPts, measureLabel, parseLength, scaleFrom } from './markup';
import { MAX_RENDER_PIXELS, capRenderScale, layerKey, layersOf, linkLabel, markupLink, nextSize, pasteCopy, overlayPixels, pickCompareDefault, textMatches } from './markup';

describe('markup measuring', () => {
  it('reads lengths as people type them', () => {
    expect(parseLength(`12'-6"`, 'ft')).toBe(12.5);
    expect(parseLength(`12' 6"`, 'ft')).toBe(12.5);
    expect(parseLength(`12.5'`, 'ft')).toBe(12.5);
    expect(parseLength(`150"`, 'ft')).toBe(12.5);
    expect(parseLength('12.5', 'ft')).toBe(12.5);
    expect(parseLength('3.81 m', 'm')).toBe(3.81);
    expect(parseLength('381cm', 'm')).toBe(3.81);
    expect(parseLength('abc', 'ft')).toBeNull();
  });
  it('formats feet and inches to the nearest quarter inch', () => {
    expect(feetInches(12.5)).toBe(`12'-6"`);
    expect(feetInches(10 + 3.25 / 12)).toBe(`10'-3¼"`);
    expect(feetInches(0.5)).toBe(`0'-6"`);
  });
  it('measures from the page scale: a 12\'-6" line sets it, then lengths and areas follow', () => {
    // 1000 x 500 pt page; the scale line spans 250 pt.
    const scale = scaleFrom({ data: { points: [[0, 0], [0.25, 0]], real: 12.5, unit: 'ft', color: '#000000', width: 1 } }, 1000, 500)!;
    expect(lengthPts([0, 0], [0.25, 0], 1000, 500)).toBe(250);
    expect(measureLabel('measure_len', [[0, 0], [0.5, 0]], 1000, 500, scale)).toBe(`25'-0"`);
    // 0.25 x 0.5 of the page = 250 x 250 pt = 12.5 x 12.5 ft.
    expect(areaPts([[0, 0], [0.25, 0], [0.25, 0.5], [0, 0.5]], 1000, 500)).toBe(62500);
    expect(measureLabel('measure_area', [[0, 0], [0.25, 0], [0.25, 0.5], [0, 0.5]], 1000, 500, scale)).toBe('156.3 sq ft');
  });
  it('a cloud is a closed path of scallops', () => {
    const d = cloudPath([0, 0], [100, 50], 10);
    expect(d.startsWith('M 0 0') && d.endsWith('Z')).toBe(true);
  });
});

describe('named layers', () => {
  it('groups markups by named layer (any case), else one layer per author; named first', () => {
    const marks = [
      { layer: 'Electrical walk', authorId: 'U-1', authorName: 'Edward' },
      { layer: 'electrical WALK', authorId: 'U-2', authorName: 'Andrea' },
      { layer: null, authorId: 'U-2', authorName: 'Andrea' },
      { layer: null, authorId: 'U-1', authorName: 'Edward' },
    ];
    const ls = layersOf(marks, 'U-1');
    expect(ls.map((l) => [l.name, l.count, l.named])).toEqual([['Electrical walk', 2, true], ['Andrea', 1, false], ['Edward (you)', 1, false]]);
    expect(layerKey(marks[1])).toBe(ls[0].key);
    expect(ls[1].authorId).toBe('U-2');
  });
});

describe('markup quick fixes', () => {
  it('steps text sizes and stops at both ends', () => {
    expect(nextSize(12, 1)).toBe(14);
    expect(nextSize(12, -1)).toBe(10);
    expect(nextSize(36, 1)).toBe(36);
    expect(nextSize(8, -1)).toBe(8);
    expect(nextSize(13, 1)).toBe(14);
  });
  it('finds text case-insensitively, boxed to the match', () => {
    const hits = textMatches([{ str: 'SHEET A-201 FLOOR PLAN', x0: 0.1, y0: 0.1, x1: 0.32, y1: 0.12 }], 'floor plan');
    expect(hits).toHaveLength(1);
    expect(hits[0].box.x0).toBeCloseTo(0.1 + 0.22 * 12 / 22);
    expect(hits[0].box.x1).toBeCloseTo(0.32);
    expect(textMatches([{ str: 'aa aa', x0: 0, y0: 0, x1: 1, y1: 1 }], 'AA')).toHaveLength(2);
    expect(textMatches([{ str: 'x', x0: 0, y0: 0, x1: 1, y1: 1 }], '  ')).toEqual([]);
  });
  it('keeps the rendered page within the canvas limits', () => {
    expect(capRenderScale(612, 792, 1, 2)).toBe(2);
    const s = capRenderScale(1224, 792, 8, 2);
    expect(1224 * s * 792 * s).toBeLessThanOrEqual(MAX_RENDER_PIXELS + 1);
    expect(1224 * s).toBeLessThanOrEqual(16_000);
  });
});

describe('links', () => {
  it('labels page and file links like the downloaded PDF does', () => {
    expect(linkLabel({ type: 'page', page: 5 })).toBe('→ p. 5');
    expect(linkLabel({ type: 'file', fileId: 'F5', name: 'Card 3.pdf', page: 2 })).toBe('→ Card 3.pdf, p. 2');
    expect(linkLabel({ type: 'file', fileId: 'F6', name: 'IMG.jpg' })).toBe('→ IMG.jpg');
  });
});

describe('comparing revisions', () => {
  const px = (...rgb: number[][]) => new Uint8ClampedArray(rgb.flatMap((c) => [...c, 255]));
  it('shows removed in red, added in blue, unchanged in black', () => {
    const W = [255, 255, 255], K = [0, 0, 0];
    const older = px(W, K, W, K), newer = px(W, W, K, K);
    const out = overlayPixels(older, newer, new Uint8ClampedArray(16));
    expect(Array.from(out.slice(0, 4))).toEqual([255, 255, 255, 255]);
    expect(Array.from(out.slice(4, 8))).toEqual([255, 0, 0, 255]);
    expect(Array.from(out.slice(8, 12))).toEqual([0, 0, 255, 255]);
    expect(Array.from(out.slice(12, 16))).toEqual([0, 0, 0, 255]);
    const newerOnly = overlayPixels(older, newer, new Uint8ClampedArray(16), 'newer');
    expect(Array.from(newerOnly.slice(4, 8))).toEqual([255, 255, 255, 255]);
    expect(Array.from(newerOnly.slice(8, 12))).toEqual([0, 0, 0, 255]);
  });
  it('compares with the previous revision, or the next for the oldest', () => {
    const revs = [{ id: 'a', name: 'A', updatedAt: '2026-10-01' }, { id: 'b', name: 'A', updatedAt: '2026-10-12' }, { id: 'c', name: 'A', updatedAt: '2026-10-28' }];
    expect(pickCompareDefault('c', revs)?.id).toBe('b');
    expect(pickCompareDefault('a', revs)?.id).toBe('b');
    expect(pickCompareDefault('x', [revs[0]])?.id).toBe('a');
  });
});

describe('markupLink', () => {
  it('links each kind made from a markup to its page', () => {
    expect(markupLink('co', 'CO 1')).toEqual({ label: 'change order', href: '/changeorders?co=CO%201' });
    expect(markupLink('record', 'T-3')).toEqual({ label: 'FOR RECORD item', href: '/observations?item=T-3' });
    expect(markupLink('rfi', 'R1')?.href).toBe('/rfis?rfi=R1');
    expect(markupLink('task', 'T1')?.href).toBe('/tasks?task=T1&type=log');
    expect(markupLink('invoice', 'X')).toBeNull();
    expect(markupLink('co', null)).toBeNull();
  });
});

describe('pasteCopy', () => {
  const m = { kind: 'pin' as const, page: 2, data: { points: [[0.5, 0.995]] as [number, number][], color: '#E0321B', width: 1, note: 'Crack', photos: [{ fileId: 'P1', name: 'a.jpg' }] } };
  it('nudges a copy on the same page, keeps it in place on another, and leaves the photos behind', () => {
    expect(pasteCopy(m, 2).points).toEqual([[0.515, 1]]);
    expect(pasteCopy(m, 3).points).toEqual([[0.5, 0.995]]);
    expect(pasteCopy(m, 2).photos).toBeUndefined();
    expect(pasteCopy(m, 2).note).toBe('Crack');
  });
});

describe('new shapes and wrapping (Oct 31)', () => {
  it('adds up a path and labels it with the scale', () => {
    expect(pathLengthPts([[0, 0], [0.5, 0], [0.5, 0.5]], 100, 100)).toBe(100);
    expect(measureLabel('measure_path', [[0, 0], [0.5, 0], [0.5, 0.5]], 100, 100, { perPt: 0.1, unit: 'ft' })).toBe(measureLabel('measure_len', [[0, 0], [1, 0]], 100, 100, { perPt: 0.1, unit: 'ft' }));
  });
  it('puts a triangle in its box and drops double-click duplicates', () => {
    expect(trianglePts([0.4, 0.2], [0.2, 0.6])).toEqual([[0.30000000000000004, 0.2], [0.4, 0.6], [0.2, 0.6]]);
    expect(dedupePoints([[0, 0], [0.5, 0.5], [0.5001, 0.5], [0.5, 0.5]])).toEqual([[0, 0], [0.5, 0.5]]);
    expect(FILLABLE).toContain('polygon');
  });
  it('wraps words to the width, and breaks a word too long for a line', () => {
    const m = (s: string) => s.length; // one unit a letter
    expect(wrapLines('the quick brown fox', 10, m)).toEqual(['the quick', 'brown fox']);
    expect(wrapLines('one\ntwo three', 7, m)).toEqual(['one', 'two', 'three']);
    expect(wrapLines('abcdefghij kl', 4, m)).toEqual(['abcd', 'efgh', 'ij', 'kl']);
  });
});

describe('sheetNameFrom', () => {
  const run = (str: string, x0: number, y0: number, hgt = 0.01) => ({ str, x0, y0, x1: x0 + 0.05, y1: y0 + hgt });
  it('reads the biggest sheet number in the title block', () => {
    expect(sheetNameFrom([run('A100', 0.1, 0.1, 0.03), run('A-201', 0.9, 0.92, 0.03), run('A201', 0.85, 0.8, 0.01), run('SHEET', 0.9, 0.88)])).toBe('A-201');
    expect(sheetNameFrom([run('E103', 0.92, 0.2, 0.02)])).toBe('E103');
    expect(sheetNameFrom([run('S2.1', 0.7, 0.7)])).toBe('S2.1');
  });
  it('adds the sheet title from the same title block (Nov 3 sync)', () => {
    const block = [run('ORIGAMI DESIGN + BUILD', 0.8, 0.8, 0.011), run('COLE VALLEY RESIDENCE', 0.8, 0.82, 0.011), run('FLOOR PLAN', 0.8, 0.86, 0.018), run('SCALE', 0.8, 0.9), run('1/4" = 1\'-0"', 0.85, 0.9), run('A-201', 0.8, 0.93, 0.035), run('NOTES', 0.1, 0.1, 0.03)];
    expect(sheetNameFrom(block)).toBe('A-201 — FLOOR PLAN');
    expect(sheetNumberOf('A-201 — FLOOR PLAN')).toBe('A-201');
    expect(linkLabel({ type: 'page', page: 2 }, () => 'A-201 — FLOOR PLAN')).toBe('→ A-201');
  });
  it('reads a scanned title block (OCR text)', () => {
    expect(sheetNameFromLines('ORIGAMI DESIGN + BUILD\nPROJECT: COLE VALLEY\nROOF PLAN\nSCALE: 1/8" = 1\'-0"\nDATE 10/12/2026\nSHEET\nA-501\n')).toBe('A-501 — ROOF PLAN');
    expect(sheetNameFromLines('nothing useful here')).toBeNull();
  });
  it('finds nothing in a page without one', () => {
    expect(sheetNameFrom([run('FLOOR PLAN', 0.8, 0.9), run('1/4" = 1\'-0"', 0.8, 0.95), run('2026', 0.9, 0.9)])).toBeNull();
    expect(sheetNameFrom([])).toBeNull();
  });
});

describe('phones and tablets (Nov 4)', async () => {
  const { TOOL_GROUPS, groupOfTool, isDoubleTap, capRenderScale, PHONE_RENDER_PIXELS } = await import('./markup');
  const ALL = ['select', 'pan', 'pen', 'highlight', 'text', 'pin', 'link', 'line', 'polyline', 'arrow', 'rect', 'ellipse', 'triangle', 'polygon', 'cloud', 'symbol', 'stamp', 'scale', 'measure_len', 'measure_path', 'measure_area'];
  it('puts every tool in exactly one group', () => {
    const listed = TOOL_GROUPS.flatMap((g) => g.tools);
    expect([...listed].sort()).toEqual([...ALL].sort());
    expect(new Set(listed).size).toBe(listed.length);
    expect(groupOfTool('measure_area')).toBe('measure');
  });
  it('knows a double tap', () => {
    expect(isDoubleTap({ t: 1000, x: 100, y: 100 }, { t: 1250, x: 110, y: 105 })).toBe(true);
    expect(isDoubleTap({ t: 1000, x: 100, y: 100 }, { t: 1500, x: 100, y: 100 })).toBe(false);
    expect(isDoubleTap({ t: 1000, x: 100, y: 100 }, { t: 1100, x: 200, y: 100 })).toBe(false);
    expect(isDoubleTap(null, { t: 1, x: 0, y: 0 })).toBe(false);
  });
  it('keeps a phone’s page picture smaller', () => {
    const s = capRenderScale(3456, 2592, 8, 3, PHONE_RENDER_PIXELS);
    expect(3456 * s * 2592 * s).toBeLessThanOrEqual(PHONE_RENDER_PIXELS + 1);
  });
});

describe('labelLayout (Nov 10: labels on phones)', () => {
  const measure = (fs: number) => (s: string) => s.length * fs * 0.5;
  it('keeps the same size on screen at any zoom', () => {
    expect(labelLayout('12 ft', [100, 100], { w: 800, h: 600 }, 2, measure).fs).toBe(6);
    expect(labelLayout('12 ft', [100, 100], { w: 800, h: 600 }, 0.5, measure).fs).toBe(24);
  });
  it('wraps a long label and moves it back inside the page', () => {
    const out = labelLayout('Area: 1,234.5 sq ft (living room and hallway, measured from plans)', [780, 5], { w: 800, h: 600 }, 1, measure);
    expect(out.lines.length).toBeGreaterThan(1);
    expect(out.x + out.w).toBeLessThanOrEqual(800);
    expect(out.y - out.fs).toBeGreaterThanOrEqual(0);
  });
});
