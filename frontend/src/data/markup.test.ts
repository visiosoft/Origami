import { describe, expect, it } from 'vitest';
import { areaPts, cloudPath, feetInches, lengthPts, measureLabel, parseLength, scaleFrom } from './markup';

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
