import { describe, expect, it } from 'vitest';
import { History, LINE_COLS, lineNumbers, matchChoice, moveLine, newLine, parseDate, parseMoney, parsePct, parseTsv, pasteBlock, PRICING_OPTIONS, setCell, toTsv, type EstLine } from './estimateGrid';

const col = (k: string) => LINE_COLS.find((c) => c.key === k)!;
const L = (id: string, scopeId: string, kind = 'item'): EstLine => ({ ...newLine(scopeId, kind), id });

describe('estimate grid', () => {
  it('numbers rows like the sheet: scope, then items and notes together', () => {
    const n = lineNumbers({ scopes: [{ id: 'a' }, { id: 'b' }], lines: [L('1', 'a'), L('2', 'b'), L('3', 'b', 'inclusion'), L('4', 'a')] });
    expect([...n.entries()]).toEqual([['1', '1.01'], ['4', '1.02'], ['2', '2.01'], ['3', '2.02']]);
  });

  it('reads Excel clipboard text, quoted cells with tabs and newlines included', () => {
    expect(parseTsv('a\tb\n"x\ny"\t"say ""hi"""\n')).toEqual([['a', 'b'], ['x\ny', 'say "hi"']]);
    expect(parseTsv(toTsv([['1\t2', 'ok'], ['', '"q"']]))).toEqual([['1\t2', 'ok'], ['', '"q"']]);
  });

  it('reads money, percentages, dates and choices as Excel shows them', () => {
    expect(parseMoney('$2,640.00')).toBe(2640);
    expect(parseMoney('(200)')).toBe(-200);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNaN();
    expect(parsePct('32%')).toBe(32);
    expect(parseDate('11/4/2026')).toBe('2026-11-04');
    expect(matchChoice('Self Perform', col('strategy').options!)).toBe('self_perform');
    expect(matchChoice('T&M', PRICING_OPTIONS)).toBe('tm');
    expect(matchChoice('cheap', PRICING_OPTIONS)).toBeUndefined();
  });

  it('typing a markup % switches the line to % mode; typing $ switches back', () => {
    let l = L('1', 'a');
    l = (setCell(l, col('markupPct'), '15%') as any).line;
    expect(l).toMatchObject({ markupMode: 'pct', markupPct: 15 });
    l = (setCell(l, col('markupAmt'), '$640') as any).line;
    expect(l).toMatchObject({ markupMode: 'amt', markupAmt: 640 });
    expect(setCell(l, col('cost'), '-5')).toEqual({ error: 'Sub cost can’t be negative.' });
  });

  it('note rows keep their text but ignore money', () => {
    const n = L('n', 'a', 'exclusion');
    expect((setCell(n, col('cost'), '999') as any).line.cost).toBe(0);
    expect((setCell(n, col('description'), 'No HVAC') as any).line.description).toBe('No HVAC');
  });

  it('pasting a block fills across columns and adds lines past the end of the scope', () => {
    const lines = [L('1', 'a'), L('2', 'b')];
    const block = parseTsv('Demolish\tRough Labor , Rough Materials\tFC\nInstall valve\tFinish Labor\tT&M\nTile\t\tNope');
    const r = pasteBlock(lines, 'a', '1', LINE_COLS, 0, block);
    expect(r.lines.map((l) => l.scopeId)).toEqual(['a', 'a', 'a', 'b']);
    expect(r.lines[0]).toMatchObject({ id: '1', description: 'Demolish', costTypes: ['Rough Labor', 'Rough Materials'], pricing: 'fc' });
    expect(r.lines[1]).toMatchObject({ description: 'Install valve', pricing: 'tm' });
    expect(r.errors).toHaveLength(1);
    expect(r.touched).toHaveLength(3);
  });

  it('moves a line within its own scope only', () => {
    const lines = [L('1', 'a'), L('2', 'b'), L('3', 'a')];
    expect(moveLine(lines, '3', -1).map((l) => l.id)).toEqual(['3', '2', '1']);
    expect(moveLine(lines, '1', -1)).toBe(lines);
  });

  it('undo and redo', () => {
    const h = new History<number>(3);
    h.push(1); h.push(2);
    expect(h.undo(3)).toBe(2);
    expect(h.redo(2)).toBe(3);
    expect(h.canUndo).toBe(true);
  });
});
