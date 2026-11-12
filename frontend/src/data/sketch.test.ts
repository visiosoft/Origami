import { describe, expect, it } from 'vitest';
import { blankSketchPdf, sketchFile, sketchTitle } from './sketch';

describe('sketch sheet (Nov 10 sync)', () => {
  it('is a one-page PDF whose cross-reference table points at each object', () => {
    const txt = new TextDecoder().decode(blankSketchPdf('Sketch (kitchen) \\ test'));
    expect(txt.startsWith('%PDF-1.4')).toBe(true);
    expect(txt).toContain('/MediaBox [0 0 1224 792]');
    expect(txt).toContain('(Sketch \\(kitchen\\) \\\\ test)');
    const start = Number(txt.match(/startxref\n(\d+)/)![1]);
    expect(txt.slice(start, start + 4)).toBe('xref');
    const offs = [...txt.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offs).toHaveLength(6);
    offs.forEach((o, i) => expect(txt.slice(o, o + 8)).toBe(`${i + 1} 0 obj\n`));
    const len = Number(txt.match(/\/Length (\d+)/)![1]);
    const s = txt.indexOf('stream\n') + 7;
    expect(txt.slice(s + len, s + len + 9)).toBe('endstream');
  });
  it('names the file by time and the sheet by project and date', () => {
    const when = new Date(2026, 10, 12, 9, 5);
    expect(sketchTitle('Catherine bathrooms', when)).toBe('SK-0905 Sketch - Catherine bathrooms - Nov 12, 2026');
    expect(sketchFile('X', when).name).toBe('Sketch 2026-11-12 0905.pdf');
  });
});
