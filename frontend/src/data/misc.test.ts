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

import { logTaskDetails, logTaskTitle } from './tasks';

describe('request log task subject', () => {
  it('uses the subject as the name and the whole description as the details', () => {
    const t = { id: 'T1', subject: 'Order windows', description: 'From Milgard\nby Friday' };
    expect(logTaskTitle(t)).toBe('Order windows');
    expect(logTaskDetails(t)).toBe('From Milgard\nby Friday');
  });
  it('falls back to the first description line for older tasks without a subject', () => {
    const t = { id: 'T2', description: 'Order windows\nFrom Milgard' };
    expect(logTaskTitle(t)).toBe('Order windows');
    expect(logTaskDetails(t)).toBe('From Milgard');
  });
  it('has a name even with nothing written', () => {
    expect(logTaskTitle({ id: 'T3', subject: '  ', description: '' })).toBe('T3');
    expect(logTaskDetails({ subject: 'Call city', description: '' })).toBe('');
  });
});

import { assignedByOf, assignedByText } from './projectTasks';

describe('who assigned a task', () => {
  const created = { id: 'e1', type: 'created' as const, by: 'Sara R.', at: '2026-10-01T10:00:00Z', text: 'created this task' };
  it('is whoever created it already assigned', () => {
    const t = { assignedTo: 'Noor K.', activity: [created] };
    expect(assignedByOf(t)).toEqual({ by: 'Sara R.', at: '2026-10-01T10:00:00Z' });
    expect(assignedByText(t)).toBe('Assigned by Sara R. · Oct 1');
  });
  it('is the latest reassignment when there was one', () => {
    const t = { assignee: 'Noor K.', activity: [created, { id: 'e2', type: 'assign' as const, by: 'Edward M.', at: '2026-10-04T09:00:00Z', field: 'assignee', from: 'Alejandra P.', to: 'Noor K.' }] };
    expect(assignedByText(t)).toBe('Assigned by Edward M. · Oct 4');
  });
  it('says self-assigned, and nothing when nobody is assigned', () => {
    expect(assignedByText({ assignedTo: 'Sara R.', activity: [created] })).toBe('Self-assigned · Oct 1');
    expect(assignedByOf({ assignedTo: '', activity: [created] })).toBeNull();
    expect(assignedByOf({ assignedTo: 'Noor K.' })).toBeNull();
  });
});
