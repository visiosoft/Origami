import { describe, expect, it } from 'vitest';
import { cellText, columnDefs, effectiveColumns, History, LINE_COLS, lineNumbers, matchChoice, moveLine, newLine, parseDate, parseMoney, parsePct, parseTsv, pasteBlock, PRICING_OPTIONS, setCell, toTsv, type EstLine } from './estimateGrid';

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

  it('saved columns: built-ins keep name, width and place; added columns sit where they were put', () => {
    const cols = effectiveColumns([
      { key: 'cost', label: 'Sub cost (bid)', type: 'text', table: 'lines', builtIn: true, width: 130 },
      { key: 'c_w', label: 'Waste %', type: 'pct', table: 'lines', band: 'sub', showClient: true },
      { key: 'description', label: 'Line item', type: 'text', table: 'lines', builtIn: true, hidden: false },
    ]);
    const at = (k: string) => cols.findIndex((c) => c.key === k);
    expect(at('cost')).toBe(0);
    expect(at('cost') < at('c_w') && at('c_w') < at('description')).toBe(true);
    expect(cols[0].label).toBe('Sub cost (bid)');
    expect(cols).toHaveLength(LINE_COLS.length + 1);
    expect(cols.find((c) => c.key === 'c_w')).toMatchObject({ custom: true, kind: 'pct', band: 'sub', showClient: true });
    const back = columnDefs(cols);
    expect(back.find((d) => d.key === 'c_w')).toMatchObject({ type: 'pct', band: 'sub', showClient: true });
    expect(back.find((d) => d.key === 'cost')).toMatchObject({ builtIn: true, label: 'Sub cost (bid)', width: 130 });
    expect(effectiveColumns(null).map((c) => c.key)).toEqual(LINE_COLS.map((c) => c.key));
  });

  it('values in added columns live in line.custom and paste like any other', () => {
    const [money, check, choice] = effectiveColumns([
      { key: 'c_m', label: 'Allowance', type: 'money', table: 'lines' },
      { key: 'c_k', label: 'Bid in', type: 'checkbox', table: 'lines' },
      { key: 'c_s', label: 'Status', type: 'choice', table: 'lines', choices: ['Bid', 'Awarded'] },
    ]);
    let l = L('1', 'a');
    l = (setCell(l, money, '$1,200') as any).line;
    l = (setCell(l, check, 'yes') as any).line;
    l = (setCell(l, choice, 'awarded') as any).line;
    expect(l.custom).toEqual({ c_m: 1200, c_k: true, c_s: 'Awarded' });
    expect([cellText(l, money), cellText(l, check), cellText(l, choice)]).toEqual(['1200', 'Yes', 'Awarded']);
    expect(setCell(l, choice, 'Lost')).toEqual({ error: '“Lost” isn’t one of: Bid, Awarded' });
    expect((setCell(l, money, '') as any).line.custom).toEqual({ c_k: true, c_s: 'Awarded' });
  });
});
