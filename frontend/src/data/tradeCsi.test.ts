import { describe, expect, it } from 'vitest';
import { tradeCsi, tradeLabel } from './tradeCsi';

describe('CSI divisions for trades (Nov 17)', () => {
  it('matches the common trades', () => {
    expect(tradeCsi('Electrician')).toBe('26');
    expect(tradeCsi('Plumber')).toBe('22');
    expect(tradeCsi('Mason')).toBe('04');
    expect(tradeCsi('Steel Fixer')).toBe('03');
    expect(tradeCsi('Welder')).toBe('05');
    expect(tradeCsi('Painter')).toBe('09');
    expect(tradeCsi('Asbestos Abatement')).toBe('02');
    expect(tradeCsi('Low Voltage Systems')).toBe('27');
    expect(tradeCsi('Helper')).toBeNull();
  });
  it('labels with the division first', () => {
    expect(tradeLabel('Electrician')).toBe('26 · Electrician');
    expect(tradeLabel('Driver')).toBe('Driver');
  });
});
