import { DEFAULT_LOG_STATUSES, isClosedStatus, parseLogStatuses } from './log-statuses';
import { isHoldSection, normalizeTaskStatus } from '../database/task.types';

describe('Request Log statuses', () => {
  it('defaults to Open, In Progress, On hold, Closed (closed)', () => {
    expect(parseLogStatuses(null).map((s) => s.name)).toEqual(['Open', 'In Progress', 'On hold', 'Closed']);
    expect(isClosedStatus(DEFAULT_LOG_STATUSES, 'Closed')).toBe(true);
    expect(isClosedStatus(DEFAULT_LOG_STATUSES, 'On hold')).toBe(false);
  });

  it('keeps an admin list, cleaned: unique, trimmed, colours checked', () => {
    const out = parseLogStatuses([
      { name: 'Open' }, { name: '  Waiting on client ', color: '#93520f' }, { name: 'waiting on client' },
      { name: 'Cancelled', closed: true, color: 'red' }, { name: '' },
    ]);
    expect(out).toEqual([{ name: 'Open' }, { name: 'Waiting on client', color: '#93520f' }, { name: 'Cancelled', closed: true }]);
  });

  it('always has Open and something closed', () => {
    expect(parseLogStatuses([{ name: 'Doing' }]).map((s) => [s.name, !!s.closed])).toEqual([['Open', false], ['Doing', false], ['Closed', true]]);
    expect(parseLogStatuses('[{"name":"Open"},{"name":"Closed"}]').find((s) => s.name === 'Closed')?.closed).toBe(true);
    expect(parseLogStatuses('not json')).toBe(DEFAULT_LOG_STATUSES);
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
