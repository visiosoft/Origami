import { cleanMarkup } from './markups';

/** Big sheets need big text (Nov 16): a 36x24 drawing is ~2,592 pt wide. */
describe('markup text size', () => {
  const text = (size: unknown) => cleanMarkup({ kind: 'text', page: 1, data: { points: [[0.1, 0.1]], text: 'Verify beam', size } }).data.size;
  it('keeps large sizes up to 400 pt and small ones down to 4 pt', () => {
    expect(text(36)).toBe(36);
    expect(text(150)).toBe(150);
    expect(text(1000)).toBe(400);
    expect(text(2)).toBe(4);
    expect(text(37.6)).toBe(38);
  });
});
