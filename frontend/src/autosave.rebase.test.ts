import { describe, expect, it } from 'vitest';
import { rebase } from './autosave';

describe('an open editor follows outside changes (Nov 10)', () => {
  const fields = ['status', 'title', 'dueDate'] as const;
  it('takes the new status after a board drag when the person didn’t touch it', () => {
    const before = { id: 'T1', status: 'Assigned', title: 'Tile', dueDate: '', sectionId: 'a' };
    const draft = { ...before };
    const after = { ...before, status: 'In progress', sectionId: 'b' };
    expect(rebase(draft, before, after, fields as any)).toEqual(after);
  });
  it('keeps what the person is typing, takes the rest', () => {
    const before = { id: 'T1', status: 'Assigned', title: 'Tile', dueDate: '' };
    const draft = { ...before, title: 'Tile floor' };
    const after = { ...before, status: 'In progress', dueDate: '2026-11-20' };
    expect(rebase(draft, before, after, fields as any)).toEqual({ id: 'T1', status: 'In progress', title: 'Tile floor', dueDate: '2026-11-20' });
  });
});
