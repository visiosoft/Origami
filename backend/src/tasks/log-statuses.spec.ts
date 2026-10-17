import { DEFAULT_LOG_STATUSES, bucketOf, isClosedStatus, parseLogStatuses, withBuckets } from './log-statuses';
import { isHoldSection, normalizeTaskStatus } from '../database/task.types';

describe('Request Log statuses', () => {
  const BUCKETS = ['To Do', 'Assigned', 'In Progress', 'On hold', 'Complete', 'Confirmed'];
  it('defaults to the six task buckets; Complete and Confirmed close a task', () => {
    expect(parseLogStatuses(null).map((s) => s.name)).toEqual(BUCKETS);
    expect(isClosedStatus(DEFAULT_LOG_STATUSES, 'Complete')).toBe(true);
    expect(isClosedStatus(DEFAULT_LOG_STATUSES, 'Confirmed')).toBe(true);
    expect(isClosedStatus(DEFAULT_LOG_STATUSES, 'On hold')).toBe(false);
  });

  it('keeps an admin’s own statuses (cleaned) alongside the buckets, before Complete', () => {
    const out = parseLogStatuses([
      { name: 'To Do', color: '#8e2e0a' }, { name: '  Waiting on client ', color: '#93520f' }, { name: 'waiting on client' },
      { name: 'Cancelled', closed: true, color: 'red' }, { name: '' },
    ]);
    expect(out.map((s) => s.name)).toEqual(['To Do', 'Assigned', 'In Progress', 'On hold', 'Waiting on client', 'Cancelled', 'Complete', 'Confirmed']);
    expect(out[0].color).toBe('#8e2e0a');
    expect(out.find((s) => s.name === 'Cancelled')).toEqual({ name: 'Cancelled', closed: true });
  });

  it('brings a list from before the buckets onto them', () => {
    expect(withBuckets([{ name: 'Open' }, { name: 'In Progress' }, { name: 'On hold' }, { name: 'Closed', closed: true }]).map((s) => s.name)).toEqual(BUCKETS);
    expect(parseLogStatuses('not json')).toBe(DEFAULT_LOG_STATUSES);
  });

  it('maps the old status names onto the buckets', () => {
    expect(bucketOf('Open', false)).toBe('To Do');
    expect(bucketOf('Open', true)).toBe('Assigned');
    expect(bucketOf('Closed', true)).toBe('Complete');
    expect(bucketOf('In Progress', true)).toBe('In Progress');
  });
});

describe('board task status', () => {
  it('"Blocked" and "On hold" are one status', () => {
    expect(['Blocked', 'on hold', 'On-Hold', 'hold'].map(normalizeTaskStatus)).toEqual(['On hold', 'On hold', 'On hold', 'On hold']);
    expect(normalizeTaskStatus('In progress')).toBe('In progress');
    expect(normalizeTaskStatus(undefined)).toBeUndefined();
  });

  it('recognises an "On hold" board column', () => {
    expect(['On Hold', 'on-hold', 'Blocked'].every(isHoldSection)).toBe(true);
    expect(isHoldSection('In Progress')).toBe(false);
  });
});
