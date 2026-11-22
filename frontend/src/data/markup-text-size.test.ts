import { describe, expect, it } from 'vitest';
import { TEXT_FREE_MAX, TEXT_FREE_MIN, draggedSize, nextSize, sheetTextScale } from './markup';

describe('markup text size on big sheets', () => {
  it('scales with the sheet: letter 1x, ARCH D about 3x, ARCH E 4x', () => {
    expect(sheetTextScale(612)).toBe(1);
    expect(sheetTextScale(792)).toBe(1);
    expect(sheetTextScale(2592)).toBe(3);
    expect(sheetTextScale(3456)).toBe(4);
    expect(sheetTextScale(null)).toBe(1);
  });
  it('steps through the sizes on the sheet', () => {
    expect(nextSize(12, 1)).toBe(14);
    expect(nextSize(36, 1, 3)).toBe(42);
    expect(nextSize(36, -1, 3)).toBe(30);
    expect(nextSize(216, 1, 3)).toBe(216);
  });
  it('a corner drag sizes the letters freely, within limits', () => {
    expect(draggedSize(36, 2)).toBe(72);
    expect(draggedSize(36, 0.5)).toBe(18);
    expect(draggedSize(36, 100)).toBe(TEXT_FREE_MAX);
    expect(draggedSize(36, 0.01)).toBe(TEXT_FREE_MIN);
  });
});
