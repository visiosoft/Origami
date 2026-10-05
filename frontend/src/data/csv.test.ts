import { describe, expect, it } from 'vitest';
import { csvToObjects, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('splits rows and cells', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps commas, doubled quotes and line breaks inside quotes', () => {
    expect(parseCsv('"Smith, J","He said ""hi""","two\nlines"')).toEqual([['Smith, J', 'He said "hi"', 'two\nlines']]);
  });
  it('accepts Windows line endings and a byte-order mark', () => {
    expect(parseCsv('﻿name,age\r\nAna,30\r\n')).toEqual([['name', 'age'], ['Ana', '30']]);
  });
  it('drops blank rows', () => {
    expect(parseCsv('a\n\n , \nb')).toEqual([['a'], ['b']]);
  });
});

describe('csvToObjects', () => {
  it('keys each row by the trimmed header row', () => {
    expect(csvToObjects(' Name ,Trade\nAna, Electrician \nBo')).toEqual([
      { Name: 'Ana', Trade: 'Electrician' },
      { Name: 'Bo', Trade: '' },
    ]);
  });
  it('returns nothing for empty text', () => {
    expect(csvToObjects('')).toEqual([]);
  });
});

describe('toCsv', () => {
  it('quotes only cells that need it and round-trips', () => {
    const rows = [['Name', 'Note'], ['Ana', 'says "hi", twice'], ['Bo', 42]];
    const text = toCsv(rows);
    expect(text).toBe('Name,Note\r\nAna,"says ""hi"", twice"\r\nBo,42');
    expect(parseCsv(text)).toEqual(rows.map((r) => r.map(String)));
  });
});
