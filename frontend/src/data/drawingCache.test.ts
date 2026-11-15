import { describe, expect, it } from 'vitest';
import { drawingKey, toEvict } from './drawingCache';

describe('drawings kept in the browser (Nov 10)', () => {
  it('keys a drawing by its version; no version, no caching', () => {
    expect(drawingKey('fr1', { size: 12, updatedAt: '2026-11-10T10:00:00Z' })).toBe('fr1:12:2026-11-10T10:00:00Z');
    expect(drawingKey('fr1', {})).toBeNull();
    expect(drawingKey('fr1', null)).toBeNull();
  });
  it('drops older versions of the same drawing, then the least recently opened past the limits', () => {
    const ix = {
      'a:1:x': { id: 'a', at: 1, bytes: 50 },
      'a:2:y': { id: 'a', at: 5, bytes: 50 },
      'b:1:x': { id: 'b', at: 2, bytes: 50 },
      'c:1:x': { id: 'c', at: 3, bytes: 50 },
    };
    expect(toEvict(ix, 'a:2:y', { items: 10, bytes: 1000 })).toEqual(['a:1:x']);
    expect(toEvict(ix, 'a:2:y', { items: 2, bytes: 1000 })).toEqual(['a:1:x', 'b:1:x']);
    expect(toEvict(ix, 'a:2:y', { items: 10, bytes: 100 })).toEqual(['a:1:x', 'b:1:x']);
  });
});
