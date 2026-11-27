import { describe, expect, it } from 'vitest';
import { askDeleteReason } from './deleteReason';

describe('askDeleteReason (Nov 27)', () => {
  it('keeps asking until a reason is given; cancel returns null', () => {
    const answers = ['', '  ', 'Duplicate of T-12'];
    const seen: string[] = [];
    expect(askDeleteReason('Call Jose', 2, (m) => { seen.push(m); return answers.shift() ?? null; })).toBe('Duplicate of T-12');
    expect(seen).toHaveLength(3);
    expect(seen[0]).toMatch(/Its 2 subtasks go too/);
    expect(askDeleteReason('Call Jose', 0, () => null)).toBeNull();
  });
});
