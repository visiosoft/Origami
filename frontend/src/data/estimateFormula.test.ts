import { describe, expect, it } from 'vitest';
import { evaluate, evaluateRow, formulaProblem } from './estimateFormula';

const row: Record<string, number | string | null> = { 'sub cost': 2000, 'markup $': 640, strategy: 'Owner', 'duration (days)': 4, empty: null };
const get = (name: string) => { const v = row[name.toLowerCase()]; if (v === undefined) throw new Error(`no ${name}`); return v; };

describe('estimate formulas', () => {
  it('arithmetic with precedence, percent literals and column names', () => {
    expect(evaluate('=[Sub cost]*1.1', get)).toBeCloseTo(2200);
    expect(evaluate('=[Sub cost]+[Markup $]*2-10/2', get)).toBe(3275);
    expect(evaluate('=2^3^1', get)).toBe(8);
    expect(evaluate('=-[Markup $]+10%', get)).toBeCloseTo(-639.9);
    expect(evaluate('=([Sub cost]+[Markup $])/[Duration (days)]', get)).toBe(660);
  });

  it('functions, comparisons and text', () => {
    expect(evaluate('=IF([Strategy]="owner",0,[Sub cost])', get)).toBe(0);
    expect(evaluate('=IF(AND([Sub cost]>1000,[Markup $]<=640),"big","small")', get)).toBe('big');
    expect(evaluate('=ROUND([Markup $]/[Sub cost]*100,1)', get)).toBe(32);
    expect(evaluate('=SUM(1,2,[Sub cost])+MAX(1,5)+MIN(3,2)+ABS(-1)', get)).toBe(2011);
    expect(evaluate('="Sub: "&[Strategy]', get)).toBe('Sub: Owner');
    expect(evaluate('=[Empty]+1', get)).toBe(1);
  });

  it('clear errors instead of crashing', () => {
    expect(() => evaluate('=[Sub cost]/0', get)).toThrow('Divides by zero.');
    expect(() => evaluate('=[Sub cost]*', get)).toThrow(/ends too early/);
    expect(() => evaluate('=FETCH("x")', get)).toThrow(/Unknown function/);
    expect(() => evaluate('=Sub cost', get)).toThrow(/brackets/);
    expect(() => evaluate('=alert(1)', get)).toThrow(/Unknown function/);
    expect(() => evaluate('=[Strategy]*2', get)).toThrow(/isn’t a number/);
    expect(formulaProblem('=[Nope]+1', ['Sub cost'])).toMatch(/no column called \[Nope\]/);
    expect(formulaProblem('=[sub COST]+1', ['Sub cost'])).toBeNull();
  });

  it('formula columns can use each other; loops are reported', () => {
    const out = evaluateRow([
      { key: 'a', label: 'With waste', formula: '=[Sub cost]*1.1' },
      { key: 'b', label: 'Per day', formula: '=[With waste]/[Duration (days)]' },
      { key: 'c', label: 'Loop 1', formula: '=[Loop 2]+1' },
      { key: 'd', label: 'Loop 2', formula: '=[Loop 1]+1' },
      { key: 'e', label: 'Bad ref', formula: '=[Missing]' },
    ], (name) => row[name.toLowerCase()] ?? undefined);
    expect((out.b as any).value).toBeCloseTo(550);
    expect(out.c).toEqual({ error: 'Circular reference.' });
    expect(out.d).toEqual({ error: 'Circular reference.' });
    expect(out.e).toEqual({ error: 'There’s no column called [Missing].' });
  });
});
