import { describe, expect, it } from 'vitest';
import { taskNo } from './taskNumbers';

describe('task numbers', () => {
  it('carry the project code, GEN for none', () => {
    expect(taskNo('T-2026-0007', 'NARV')).toBe('NARV-T-2026-0007');
    expect(taskNo('T-2026-0003', null)).toBe('GEN-T-2026-0003');
    expect(taskNo(null, 'NARV')).toBe('');
  });
});
