import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * SQL Server stores simple-json columns as ntext, and refuses ntext in
 * LOWER(), UPPER(), =, ORDER BY and DISTINCT ("Argument data type ntext is
 * invalid for argument 1 of lower function" took staging's sign-in down).
 * A hand-written query must CAST such a column to NVARCHAR(MAX) first.
 */
const SRC = join(__dirname, '..');
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(n) && !/\.spec\.ts$/.test(n) ? [p] : [];
});

const entities = readFileSync(join(SRC, 'database', 'entities.ts'), 'utf8');
const jsonCols = new Set(Array.from(entities.matchAll(/@Column\(\s*(?:\{[^}]*type:\s*)?'simple-json'[^)]*\)\s*(\w+)!/g)).map((m) => m[1]));

describe('queries on simple-json (ntext) columns', () => {
  it('finds the simple-json columns', () => {
    expect(jsonCols.has('altEmails')).toBe(true);
  });

  it('never applies LOWER/UPPER/LTRIM/RTRIM to one without a CAST', () => {
    const bad: string[] = [];
    for (const f of files(SRC)) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/\b(LOWER|UPPER|LTRIM|RTRIM|TRIM)\(\s*(\w+)\.(\w+)\s*\)/gi)) {
        if (jsonCols.has(m[3])) bad.push(`${f.slice(SRC.length + 1)}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
