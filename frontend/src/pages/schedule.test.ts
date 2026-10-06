import { describe, expect, it } from 'vitest';
import { parseDuration, parseStart } from './Schedule';

describe('Schedule: reading the estimated start and duration typed on a project card', () => {
  it('reads the ways people type a start', () => {
    expect(parseStart('2026-03-01')).toBe('2026-03-01');
    expect(parseStart('01-08-2026')).toBe('2026-01-08');
    expect(parseStart('Sep 2025')).toBe('2025-09-01');
    expect(parseStart('November 2025')).toBe('2025-11-01');
    expect(parseStart('2025')).toBe('2025-01-01');
    expect(parseStart('Ongoing')).toBeNull();
    expect(parseStart('Ready to Start')).toBeNull();
    expect(parseStart('')).toBeNull();
  });
  it('reads durations in days, weeks, months and years', () => {
    expect(parseDuration('10 mos')).toBe(304);
    expect(parseDuration('4 months')).toBe(122);
    expect(parseDuration('2 years')).toBe(730);
    expect(parseDuration('6 weeks')).toBe(42);
    expect(parseDuration('Rolling')).toBeNull();
  });
});
