import { describe, expect, it } from 'vitest';
import { areaPts, cloudPath, feetInches, lengthPts, measureLabel, parseLength, scaleFrom } from './markup';
import { MAX_RENDER_PIXELS, capRenderScale, layerKey, layersOf, linkLabel, nextSize, overlayPixels, pickCompareDefault, textMatches } from './markup';

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
