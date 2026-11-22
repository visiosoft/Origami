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

import { dueChangeReasonMissing, dueChangeNote } from './task-rules';

describe('due date on an overdue task (Nov 17)', () => {
  const today = '2026-11-17';
  it('needs a reason to move or clear an overdue date', () => {
    expect(dueChangeReasonMissing({ dueDate: '2026-11-10' }, { dueDate: '2026-11-24' }, true, today)).toBe(true);
    expect(dueChangeReasonMissing({ dueDate: '2026-11-10' }, { dueDate: '' }, true, today)).toBe(true);
    expect(dueChangeReasonMissing({ dueDate: '2026-11-10' }, { dueDate: '2026-11-24', dueReason: 'Client hold' }, true, today)).toBe(false);
  });
  it('leaves other changes alone', () => {
    expect(dueChangeReasonMissing({ dueDate: '2026-11-20' }, { dueDate: '2026-11-24' }, true, today)).toBe(false); // not overdue
    expect(dueChangeReasonMissing({ dueDate: '2026-11-17' }, { dueDate: '2026-11-24' }, true, today)).toBe(false); // due today
    expect(dueChangeReasonMissing({ dueDate: '2026-11-10' }, { dueDate: '2026-11-10' }, true, today)).toBe(false); // unchanged
    expect(dueChangeReasonMissing({ dueDate: '2026-11-10' }, { title: 'x' } as any, true, today)).toBe(false);
    expect(dueChangeReasonMissing({ dueDate: '2026-11-10' }, { dueDate: '2026-11-24' }, false, today)).toBe(false); // finished
    expect(dueChangeReasonMissing({ dueDate: null }, { dueDate: '2026-11-24' }, true, today)).toBe(false);
  });
  it('writes the history line', () => {
    expect(dueChangeNote('2026-11-10', '2026-11-24', ' Client hold ')).toBe('Due date 2026-11-10 → 2026-11-24. Reason: Client hold');
    expect(dueChangeNote('2026-11-10', '', 'Weather')).toBe('Due date 2026-11-10 → none. Reason: Weather');
  });
});
