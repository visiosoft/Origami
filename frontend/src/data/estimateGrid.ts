/**
 * The estimate grid's plain logic (financial tab): row numbering, the columns,
 * reading values typed or pasted from Excel, and copy back out. The React grid
 * in components/estimate only wires these to the screen.
 */
import { COST_TYPES, NOTE_LABEL, PRICING_LABEL, STRATEGY_LABEL } from './estimateCalc';

export interface EstScope { id: string; csiCodeId?: string | null; title?: string | null; factor?: number | null; privateNotes?: string | null; collapsed?: boolean; custom?: Record<string, unknown> | null }
export interface EstLine {
  id: string; scopeId: string; kind: string; indent?: number; description?: string | null; costTypes?: string[] | null;
  pricing: string; subPricing?: string | null; strategy?: string | null; contractorId?: string | null; subName?: string | null;
  durationDays?: number | null; startDate?: string | null; cost: number; markupMode: string; markupAmt: number; markupPct?: number | null;
  subNotes?: string | null; privateNotes?: string | null; statementId?: string | null; custom?: Record<string, unknown> | null;
}
export interface EstGr { id: string; title: string; included: boolean; base: number; unit: string; qty: number; notes?: string | null; custom?: Record<string, unknown> | null }
export interface Sheet { scopes: EstScope[]; lines: EstLine[]; gr: EstGr[] }

export type ColKind = 'text' | 'longtext' | 'money' | 'pct' | 'number' | 'date' | 'choice' | 'tags' | 'calc';
export type Band = 'prime' | 'precon' | 'sub' | 'markup' | 'notes';
export interface GridCol { key: string; label: string; band: Band; kind: ColKind; width: number; options?: [string, string][]; /** Shown on note rows too. */ notes?: boolean; hint?: string }

export const BANDS: { key: Band; label: string }[] = [
  { key: 'prime', label: 'Prime contract' },
  { key: 'precon', label: 'Precon range' },
  { key: 'sub', label: 'Subcontractor' },
  { key: 'markup', label: 'Markup' },
  { key: 'notes', label: 'Notes' },
];

export const NOTE_KIND_OPTIONS: [string, string][] = Object.entries(NOTE_LABEL);
export const PRICING_OPTIONS: [string, string][] = Object.entries(PRICING_LABEL).map(([k, v]) => [k, v.replace(/^.*\((\w+&?\w*)\)$/, '$1').replace('Allowance', 'Allowance')]);
export const STRATEGY_OPTIONS: [string, string][] = Object.entries(STRATEGY_LABEL);

/** The built-in line columns, in the sheet's order. */
export const LINE_COLS: GridCol[] = [
  { key: 'description', label: 'Line item / notes for subline items', band: 'prime', kind: 'longtext', width: 320, notes: true },
  { key: 'costTypes', label: 'Labor / material', band: 'prime', kind: 'tags', width: 170, options: COST_TYPES.map((c) => [c, c]) },
  { key: 'pricing', label: 'Pricing', band: 'prime', kind: 'choice', width: 92, options: PRICING_OPTIONS, hint: 'FC, T&M, NTE, Allowance, OFCI or NIS. Not In Scope lines count $0.' },
  { key: 'price', label: 'Line item total', band: 'prime', kind: 'calc', width: 116, hint: 'F2: Sub cost + Markup $' },
  { key: 'high', label: 'Higher end', band: 'precon', kind: 'calc', width: 108, hint: 'F4: Line price × the scope’s factor — not added to totals' },
  { key: 'strategy', label: 'Performing strategy', band: 'sub', kind: 'choice', width: 140, options: STRATEGY_OPTIONS },
  { key: 'subName', label: 'Performing sub', band: 'sub', kind: 'text', width: 170 },
  { key: 'subPricing', label: 'Sub pricing', band: 'sub', kind: 'choice', width: 92, options: [['', 'Same'], ...PRICING_OPTIONS] },
  { key: 'durationDays', label: 'Duration (days)', band: 'sub', kind: 'number', width: 92 },
  { key: 'startDate', label: 'Est. start', band: 'sub', kind: 'date', width: 120 },
  { key: 'cost', label: 'Sub cost', band: 'sub', kind: 'money', width: 110 },
  { key: 'markupAmt', label: 'Markup $', band: 'markup', kind: 'money', width: 104, hint: 'Type dollars, or type a % in the next column' },
  { key: 'markupPct', label: 'Markup %', band: 'markup', kind: 'pct', width: 84, hint: 'F1: Markup $ ÷ Sub cost' },
  { key: 'privateNotes', label: 'Private notes', band: 'notes', kind: 'longtext', width: 220, notes: true },
];

const pad = (n: number) => String(n).padStart(2, '0');
/** "2.03": scope number, then the row's place among the scope's rows (items and notes alike, as in the sheet). */
export function lineNumbers(sheet: Pick<Sheet, 'scopes' | 'lines'>): Map<string, string> {
  const out = new Map<string, string>();
  sheet.scopes.forEach((s, i) => {
    let k = 0;
    for (const l of sheet.lines) if (l.scopeId === s.id) out.set(l.id, `${i + 1}.${pad(++k)}`);
  });
  return out;
}

let seq = 0;
export const tempId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newLine = (scopeId: string, kind = 'item'): EstLine => ({ id: tempId('eln'), scopeId, kind, pricing: 'fc', cost: 0, markupMode: 'amt', markupAmt: 0, markupPct: null, description: '' });
export const newScope = (): EstScope => ({ id: tempId('esc'), title: '', csiCodeId: null, factor: null });
export const newGr = (): EstGr => ({ id: tempId('egr'), title: '', included: true, base: 0, unit: 'LS', qty: 1 });

/**
 * Excel's clipboard text: tab-separated, one row per line, a cell with a tab,
 * newline or quote wrapped in quotes ("" for a quote inside).
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let quoted = false;
  const t = text.replace(/\r\n?/g, '\n');
  while (i < t.length) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (ch === '"') { quoted = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === '') { quoted = true; i++; continue; }
    if (ch === '\t') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
    cell += ch; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export function toTsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join('\t')).join('\n');
}

/** "$1,234.50", "(200)", "1 234" -> number; '' -> null; anything else -> NaN. */
export function parseMoney(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-|−/.test(s);
  const n = Number(s.replace(/[()$,\s−-]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}
/** "32%" -> 32, "32" -> 32, "0.32" -> 0.32 (points, as typed). */
export function parsePct(v: string): number | null {
  const s = v.trim().replace('%', '');
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}
/** A choice by its key or label, ignoring case ("Self Perform", "self_perform", "FC"). */
export function matchChoice(v: string, options: [string, string][]): string | null | undefined {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const hit = options.find(([k, l]) => k.toLowerCase() === s || l.toLowerCase() === s || l.toLowerCase().replace(/[^a-z]/g, '') === s.replace(/[^a-z]/g, ''));
  return hit ? hit[0] : undefined;
}
/** "Rough Labor , Rough Materials" -> the known cost types, in order typed. */
export function parseTags(v: string): string[] {
  return v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).map((x) => (COST_TYPES as readonly string[]).find((c) => c.toLowerCase() === x.toLowerCase()) || x).slice(0, 10);
}
/** Dates as Excel shows them (11/4/2026) or ISO. */
export function parseDate(v: string): string | null | undefined {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return undefined;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`;
}

/**
 * One typed or pasted value into a line. Returns the changed line, or an
 * error message when the value doesn't fit the column. Calculated columns and
 * money on note rows are left alone.
 */
export function setCell(line: EstLine, col: GridCol, raw: string): { line: EstLine } | { error: string } {
  if (col.kind === 'calc') return { line };
  if (line.kind !== 'item' && !col.notes) return { line };
  const l = { ...line };
  switch (col.kind) {
    case 'text': case 'longtext': (l as any)[col.key] = raw; break;
    case 'tags': l.costTypes = parseTags(raw); break;
    case 'choice': {
      const c = matchChoice(raw, col.options || []);
      if (c === undefined) return { error: `“${raw}” isn’t one of: ${(col.options || []).map((o) => o[1]).filter(Boolean).join(', ')}` };
      (l as any)[col.key] = col.key === 'pricing' ? c || 'fc' : c;
      break;
    }
    case 'money': {
      const n = parseMoney(raw);
      if (Number.isNaN(n)) return { error: `“${raw}” isn’t an amount.` };
      if (col.key === 'cost' && (n ?? 0) < 0) return { error: 'Sub cost can’t be negative.' };
      (l as any)[col.key] = n ?? 0;
      if (col.key === 'markupAmt') l.markupMode = 'amt';
      break;
    }
    case 'pct': {
      const n = parsePct(raw);
      if (Number.isNaN(n)) return { error: `“${raw}” isn’t a percentage.` };
      l.markupPct = n; l.markupMode = n == null ? 'amt' : 'pct';
      if (n == null) l.markupAmt = 0;
      break;
    }
    case 'number': {
      if (!raw.trim()) { (l as any)[col.key] = null; break; }
      const n = Number(raw.replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0) return { error: `“${raw}” isn’t a number.` };
      (l as any)[col.key] = Math.round(n);
      break;
    }
    case 'date': {
      const d = parseDate(raw);
      if (d === undefined) return { error: `“${raw}” isn’t a date.` };
      (l as any)[col.key] = d;
      break;
    }
  }
  return { line: l };
}

/** A line's value as text, for copying out and for the edit box. */
export function cellText(line: EstLine, col: GridCol): string {
  const v = (line as any)[col.key];
  if (col.kind === 'tags') return (line.costTypes || []).join(', ');
  if (col.kind === 'choice') return (col.options || []).find(([k]) => k === (v ?? ''))?.[1] ?? '';
  if (col.key === 'markupPct') return line.markupPct == null ? '' : String(line.markupPct);
  return v == null ? '' : String(v);
}

/**
 * Paste a block at (row, col) of a scope's line list: values go across the
 * visible editable columns from `colIndex`; rows past the end of the scope
 * become new item lines. Returns the new line list and any cells refused.
 */
export function pasteBlock(lines: EstLine[], scopeId: string, startLineId: string | null, cols: GridCol[], colIndex: number, block: string[][]): { lines: EstLine[]; errors: string[]; touched: string[] } {
  const out = [...lines];
  const errors: string[] = [];
  const touched: string[] = [];
  const inScope = () => out.filter((l) => l.scopeId === scopeId);
  let pos = startLineId ? inScope().findIndex((l) => l.id === startLineId) : inScope().length;
  if (pos < 0) pos = inScope().length;
  for (const row of block) {
    let target = inScope()[pos];
    if (!target) {
      target = newLine(scopeId);
      const lastIdx = out.map((l) => l.scopeId).lastIndexOf(scopeId);
      out.splice(lastIdx + 1, 0, target);
    }
    let l = target;
    row.forEach((raw, j) => {
      const col = cols[colIndex + j];
      if (!col) return;
      const r = setCell(l, col, raw);
      if ('error' in r) errors.push(r.error); else l = r.line;
    });
    out[out.findIndex((x) => x.id === target.id)] = l;
    touched.push(l.id);
    pos++;
  }
  return { lines: out, errors, touched };
}

/** Move a line up or down within its scope. */
export function moveLine(lines: EstLine[], id: string, dir: -1 | 1): EstLine[] {
  const i = lines.findIndex((l) => l.id === id);
  if (i < 0) return lines;
  let j = i + dir;
  while (j >= 0 && j < lines.length && lines[j].scopeId !== lines[i].scopeId) j += dir;
  if (j < 0 || j >= lines.length) return lines;
  const out = [...lines];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** A bounded undo history of whole sheets. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private readonly limit = 100) {}
  push(s: T) { this.past.push(s); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  undo(current: T): T | null { const p = this.past.pop(); if (p === undefined) return null; this.future.push(current); return p; }
  redo(current: T): T | null { const f = this.future.pop(); if (f === undefined) return null; this.past.push(current); return f; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
