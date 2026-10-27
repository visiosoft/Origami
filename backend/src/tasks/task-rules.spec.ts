import { holdReasonMissing, startDue } from './task-rules';

describe('task rules', () => {
  it('a reason is needed to put a task on hold, and to keep it there', () => {
    expect(holdReasonMissing({ status: 'In progress' }, { status: 'On hold' })).toBe(true);
    expect(holdReasonMissing({ status: 'In progress' }, { status: 'On hold', holdReason: '  ' })).toBe(true);
    expect(holdReasonMissing({ status: 'In progress' }, { status: 'On hold', holdReason: 'Waiting on the city' })).toBe(false);
    expect(holdReasonMissing({ status: 'On hold', holdReason: 'Waiting' }, { dueDate: '2026-11-01' } as any)).toBe(false);
    expect(holdReasonMissing({ status: 'On hold', holdReason: 'Waiting' }, { holdReason: '' })).toBe(true);
    expect(holdReasonMissing({ status: 'On hold', holdReason: '' }, { status: 'In progress' })).toBe(false);
    expect(holdReasonMissing({ status: 'Open' }, { status: 'on-hold' })).toBe(true);
  });
  it('start dates', () => {
    expect(startDue('2026-10-01', true, '2026-10-27')).toBe(true);
    expect(startDue('2026-10-01', false, '2026-10-27')).toBe(false);
  });
});
