import { catchUp, cleanRepeat, nextRepeat, repeatLabel, repeatsOn } from './task-repeat';

describe('Nov 27: repeating tasks', () => {
  it('cleans what was sent', () => {
    expect(cleanRepeat(null)).toBeNull();
    expect(cleanRepeat({ every: 'yearly' })).toBeNull();
    expect(cleanRepeat({ every: 'week', days: [5, 1, 1, 9] })).toEqual({ every: 'week', days: [1, 5] });
    expect(cleanRepeat({ every: 'day', until: '2026-12-31', days: [1] })).toEqual({ every: 'day', until: '2026-12-31' });
    expect(cleanRepeat({ every: 'month', anchor: '2026-01-31' })).toEqual({ every: 'month', anchor: '2026-01-31' });
  });
  it('finds the next day it is due', () => {
    // 2026-11-27 is a Friday.
    expect(nextRepeat('2026-11-27', { every: 'day' })).toBe('2026-11-28');
    expect(nextRepeat('2026-11-27', { every: 'weekdays' })).toBe('2026-11-30');
    expect(nextRepeat('2026-11-27', { every: 'week', days: [1, 3] })).toBe('2026-11-30');
    expect(nextRepeat('2026-11-27', { every: 'week' })).toBe('2026-12-04');
    expect(nextRepeat('2026-01-31', { every: 'month' })).toBe('2026-02-28');
    expect(nextRepeat('2026-02-28', { every: 'month' }, '2026-01-31')).toBe('2026-03-31');
    expect(nextRepeat('2026-02-28', { every: 'month', anchor: '2026-01-31' })).toBe('2026-03-31');
    expect(nextRepeat('2026-11-27', { every: 'day', until: '2026-11-27' })).toBeNull();
  });
  it('a missed day rolls forward to today (or the next day it repeats)', () => {
    expect(catchUp('2026-11-24', '2026-11-27', { every: 'day' })).toBe('2026-11-27');
    expect(catchUp('2026-11-24', '2026-11-28', { every: 'weekdays' })).toBe('2026-11-30');
    expect(catchUp('2026-11-30', '2026-11-27', { every: 'day' })).toBe('2026-11-30');
    expect(repeatsOn('2026-11-29', { every: 'weekdays' }, '2026-11-27')).toBe(false);
  });
  it('says it in words', () => {
    expect(repeatLabel({ every: 'week', days: [1, 3] })).toBe('Weekly on Mon, Wed');
    expect(repeatLabel({ every: 'month' }, '2026-11-27')).toBe('Monthly on day 27');
    expect(repeatLabel({ every: 'weekdays', until: '2026-12-31' })).toBe('Every weekday until 2026-12-31');
  });
});
