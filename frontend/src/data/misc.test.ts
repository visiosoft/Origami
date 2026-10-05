import { afterEach, describe, expect, it, vi } from 'vitest';
import { taskHeadline } from './tasks';
import { expiryState } from './personProfile';
import { isLogClosed, setLogStatuses } from './logStatuses';

describe('taskHeadline', () => {
  it('uses the first line as the title and the rest as details', () => {
    expect(taskHeadline('Order windows\r\nFrom Milgard\nby Friday')).toEqual({ title: 'Order windows', details: 'From Milgard\nby Friday' });
    expect(taskHeadline(undefined)).toEqual({ title: '', details: '' });
  });
  it('cuts one very long line at a word near 110 characters', () => {
    const long = 'word '.repeat(40).trim();
    const h = taskHeadline(long);
    expect(h.title.endsWith('…')).toBe(true);
    expect(h.title.length).toBeLessThanOrEqual(111);
    expect(h.details.startsWith('…')).toBe(true);
    expect((h.title + h.details).replace(/…/g, ' ').replace(/\s+/g, ' ').trim()).toBe(long);
  });
});

describe('expiryState', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('flags expired, within 60 days, and fine', () => {
    vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-10-05T00:00:00Z'));
    expect(expiryState('2026-10-01')).toBe('expired');
    expect(expiryState('2026-11-15')).toBe('soon');
    expect(expiryState('2027-06-01')).toBe('ok');
    expect(expiryState('')).toBeNull();
    expect(expiryState('someday')).toBeNull();
  });
});

describe('isLogClosed', () => {
  it('treats Closed and any status marked closed as done', () => {
    setLogStatuses([{ name: 'Open' }, { name: 'Resolved', closed: true }, { name: 'Closed', closed: true }] as never);
    expect(isLogClosed('Closed')).toBe(true);
    expect(isLogClosed('Resolved')).toBe(true);
    expect(isLogClosed('Open')).toBe(false);
    expect(isLogClosed(null)).toBe(false);
  });
});
