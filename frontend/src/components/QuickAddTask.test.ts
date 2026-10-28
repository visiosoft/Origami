import { describe, expect, it } from 'vitest';
import { quickTaskFields } from './QuickAddTask';

describe('quickTaskFields', () => {
  it('passes the assignee and details that were filled in', () => {
    expect(quickTaskFields({ title: 'Order tile', description: ' Grey 12x24 ', assigneeId: 'u1', assignee: 'Edward' }))
      .toEqual({ description: 'Grey 12x24', assigneeId: 'u1', assignee: 'Edward' });
  });
  it('leaves blanks out so "My tasks" still assigns it to you', () => {
    expect(quickTaskFields({ title: 'Order tile', description: '  ', assignee: '' })).toEqual({});
  });
});
