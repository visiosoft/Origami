import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localISO, weekStartISO } from './localDate';

describe('local dates (Nov 17: reports showed the next day)', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 9 pm on Nov 9 local is already Nov 10 in UTC west of Greenwich.
    expect(localISO(new Date(2026, 10, 9, 21, 30))).toBe('2026-11-09');
  });
  it('finds the Monday of the week', () => {
    expect(weekStartISO(new Date(2026, 10, 15, 23))).toBe('2026-11-09'); // Sunday
    expect(weekStartISO(new Date(2026, 10, 16, 1))).toBe('2026-11-16'); // Monday
  });
  it('no screen takes "today" from toISOString()', () => {
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\./.test(f) && f !== 'prequal.ts' /* mirrors the server copy word for word */ && /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(readFileSync(p, 'utf8'))) bad.push(p);
      }
    };
    walk(join(__dirname, '..'));
    expect(bad).toEqual([]);
  });
});
