import { describe, expect, it } from 'vitest';
import { sheetNameFromAreaText, sheetNameInAreas } from './markup';

describe('sheet number and title from picked areas (Nov 19)', () => {
  const runs = [
    { str: 'A2.01', x0: 0.92, y0: 0.9, x1: 0.97, y1: 0.95 },
    { str: 'Floor Plan -', x0: 0.85, y0: 0.6, x1: 0.95, y1: 0.62 },
    { str: 'Existing & Proposed', x0: 0.85, y0: 0.63, x1: 0.97, y1: 0.65 },
    { str: 'A9.99', x0: 0.1, y0: 0.1, x1: 0.15, y1: 0.12 },
  ];
  it('reads only what is inside the boxes', () => {
    const name = sheetNameInAreas(runs, { num: { x0: 0.9, y0: 0.88, x1: 1, y1: 1 }, title: { x0: 0.83, y0: 0.58, x1: 1, y1: 0.67 } });
    expect(name).toContain('A2.01');
    expect(name).toContain('Floor Plan - Existing & Proposed');
    expect(sheetNameInAreas(runs, {})).toBeNull();
  });
  it('reads OCR text of the two areas', () => {
    expect(sheetNameFromAreaText('SHEET NO.\nA3.01', 'HALLWAYS\nACCESSING BEDROOMS')).toContain('A3.01');
    expect(sheetNameFromAreaText('', 'x')).toBeNull();
  });
});
