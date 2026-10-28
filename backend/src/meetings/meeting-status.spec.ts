import { isActionDone, normalizeMeetingStatus, settleMeetingStatus } from './meeting-status';

describe('meeting statuses', () => {
  it('maps older and loose values onto the new set', () => {
    expect(normalizeMeetingStatus('held')).toBe('occurred');
    expect(normalizeMeetingStatus('Held')).toBe('occurred');
    expect(normalizeMeetingStatus('scheduled')).toBe('scheduled');
    expect(normalizeMeetingStatus('cancelled')).toBe('cancelled');
    expect(normalizeMeetingStatus('Canceled')).toBe('cancelled');
    expect(normalizeMeetingStatus('Reviewed')).toBe('reviewed');
    expect(normalizeMeetingStatus('rescheduled')).toBe('rescheduled');
    expect(normalizeMeetingStatus('')).toBe('scheduled');
    expect(normalizeMeetingStatus(undefined)).toBe('scheduled');
    expect(normalizeMeetingStatus('nonsense')).toBe('scheduled');
  });

  it('knows when an action is done', () => {
    expect(isActionDone({ kind: 'task', status: 'Closed' })).toBe(true);
    expect(isActionDone({ kind: 'task', status: 'Done (client)' }, ['Done (client)'])).toBe(true);
    expect(isActionDone({ kind: 'task', status: 'Cancelled' })).toBe(true);
    expect(isActionDone({ kind: 'task', status: 'Archived' })).toBe(true);
    expect(isActionDone({ kind: 'task', status: 'In Progress' })).toBe(false);
    expect(isActionDone({ kind: 'rfi', status: 'void' })).toBe(true);
    expect(isActionDone({ kind: 'rfi', status: 'answered' })).toBe(false);
    expect(isActionDone({ kind: 'changeOrder', status: 'approved' })).toBe(true);
    expect(isActionDone({ kind: 'changeOrder', status: 'submitted' })).toBe(false);
  });

  it('completes a reviewed meeting once every captured action is done, and reopens it', () => {
    const done = [{ kind: 'task' as const, status: 'Closed' }, { kind: 'rfi' as const, status: 'closed' }, { kind: 'changeOrder' as const, status: 'cancelled' }];
    expect(settleMeetingStatus('reviewed', done)).toBe('complete');
    expect(settleMeetingStatus('reviewed', [...done, { kind: 'task', status: 'Open' }])).toBe('reviewed');
    expect(settleMeetingStatus('complete', [...done, { kind: 'task', status: 'Open' }])).toBe('reviewed');
  });

  it('never completes a meeting no one has reviewed, nor changes one with nothing captured', () => {
    const done = [{ kind: 'task' as const, status: 'Closed' }];
    expect(settleMeetingStatus('occurred', done)).toBe('occurred');
    expect(settleMeetingStatus('held', done)).toBe('occurred');
    expect(settleMeetingStatus('scheduled', done)).toBe('scheduled');
    expect(settleMeetingStatus('reviewed', [])).toBe('reviewed');
    expect(settleMeetingStatus('complete', [])).toBe('complete');
  });
});
