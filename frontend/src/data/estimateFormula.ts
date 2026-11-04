/**
 * Formulas in estimate columns people add (financial tab): Excel-style, small
 * and safe. `=[Sub cost]*1.1`, `=IF([Strategy]="Owner",0,[Line item total])`,
 * `=ROUND([Markup $]/[Duration (days)],2)`. Columns are named in [brackets]
 * by their header. No access to anything but the row's own values.
 *
 * Grammar: comparison := concat (( = | <> | < | > | <= | >= ) concat)*
 *          concat := sum (& sum)*,  sum := term ((+|-) term)*,
 *          term := power ((*|/) power)*,  power := unary (^ unary)*,
 *          unary := (-|+) unary | primary,
 *          primary := number | "text" | [Column] | NAME(args) | TRUE | FALSE | (comparison)
 */

export type Value = number | string | boolean | null;
export class FormulaError extends Error {}

type Tok = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'ref'; v: string } | { t: 'name'; v: string } | { t: 'op'; v: string } | { t: '(' } | { t: ')' } | { t: ',' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/^\s*=/, '');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?/i);
      if (!m) throw new FormulaError(`Can’t read the number at “${s.slice(i, i + 8)}”.`);
      let v = Number(m[0].replace('%', ''));
      if (m[0].endsWith('%')) v /= 100;
      out.push({ t: 'num', v }); i += m[0].length; continue;
    }
    if (c === '"') {
      let j = i + 1; let v = '';
      while (j < s.length) { if (s[j] === '"' && s[j + 1] === '"') { v += '"'; j += 2; continue; } if (s[j] === '"') break; v += s[j++]; }
      if (j >= s.length) throw new FormulaError('A "text" is missing its closing quote.');
      out.push({ t: 'str', v }); i = j + 1; continue;
    }
    if (c === '[') {
      const j = s.indexOf(']', i);
      if (j < 0) throw new FormulaError('A [column] is missing its closing ].');
      out.push({ t: 'ref', v: s.slice(i + 1, j).trim() }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_.]*/)!;
      out.push({ t: 'name', v: m[0].toUpperCase() }); i += m[0].length; continue;
    }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '<>'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&=<>'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')' }); i++; continue; }
    if (c === ',' || c === ';') { out.push({ t: ',' }); i++; continue; }
    throw new FormulaError(`“${c}” isn’t allowed in a formula.`);
  }
  return out;
}

type Node =
  | { k: 'lit'; v: Value } | { k: 'ref'; name: string } | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node } | { k: 'call'; fn: string; args: Node[] };

function parse(toks: Tok[]): Node {
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...ops: string[]) => { const t = peek(); return t?.t === 'op' && ops.includes(t.v); };
  const bin = (next: () => Node, ...ops: string[]) => () => { let a = next(); while (isOp(...ops)) { const op = (toks[p++] as any).v; a = { k: 'bin', op, a, b: next() }; } return a; };
  const primary = (): Node => {
    const t = toks[p++];
    if (!t) throw new FormulaError('The formula ends too early.');
    if (t.t === 'num' || t.t === 'str') return { k: 'lit', v: t.v };
    if (t.t === 'ref') return { k: 'ref', name: t.v };
    if (t.t === '(') { const e = comparison(); if (toks[p++]?.t !== ')') throw new FormulaError('A “(” is missing its “)”.'); return e; }
    if (t.t === 'name') {
      if (t.v === 'TRUE' || t.v === 'FALSE') return { k: 'lit', v: t.v === 'TRUE' };
      if (peek()?.t !== '(') throw new FormulaError(`“${t.v}” — put column names in [brackets].`);
      p++;
      const args: Node[] = [];
      if (peek()?.t !== ')') { for (;;) { args.push(comparison()); if (peek()?.t === ',') { p++; continue; } break; } }
      if (toks[p++]?.t !== ')') throw new FormulaError(`${t.v}( is missing its “)”.`);
      if (!FUNCTIONS[t.v]) throw new FormulaError(`Unknown function ${t.v}. Use ${Object.keys(FUNCTIONS).join(', ')}.`);
      return { k: 'call', fn: t.v, args };
    }
    if (t.t === 'op' && (t.v === '-' || t.v === '+')) { const a = unary(); return t.v === '-' ? { k: 'neg', a } : a; }
    throw new FormulaError('Something is missing in the formula.');
  };
  const unary = (): Node => (isOp('-', '+') ? (toks[p++] as any).v === '-' ? { k: 'neg', a: unary() } : unary() : primary());
  const power = bin(unary, '^');
  const term = bin(power, '*', '/');
  const sum = bin(term, '+', '-');
  const concat = bin(sum, '&');
  const comparison = bin(concat, '=', '<>', '<', '>', '<=', '>=');
  const out = comparison();
  if (p < toks.length) throw new FormulaError('There’s something extra at the end of the formula.');
  return out;
}

const n = (v: Value): number => {
  if (v === null || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const x = typeof v === 'number' ? v : Number(String(v).replace(/[$,%\s]/g, ''));
  if (!Number.isFinite(x)) throw new FormulaError(`“${v}” isn’t a number.`);
  return x;
};
const truthy = (v: Value) => (typeof v === 'string' ? v !== '' : !!v);
const nums = (args: Value[]) => args.flat().map(n);

const FUNCTIONS: Record<string, (args: Value[]) => Value> = {
  SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
  MIN: (a) => (a.length ? Math.min(...nums(a)) : 0),
  MAX: (a) => (a.length ? Math.max(...nums(a)) : 0),
  AVERAGE: (a) => (a.length ? nums(a).reduce((x, y) => x + y, 0) / a.length : 0),
  ROUND: (a) => { const f = 10 ** Math.trunc(n(a[1] ?? 0)); return Math.round(n(a[0]) * f) / f; },
  ABS: (a) => Math.abs(n(a[0])),
  IF: (a) => (truthy(a[0]) ? a[1] ?? true : a[2] ?? false),
  AND: (a) => a.every(truthy),
  OR: (a) => a.some(truthy),
  NOT: (a) => !truthy(a[0]),
};

export interface Compiled { node: Node; refs: string[] }
const cache = new Map<string, Compiled | FormulaError>();
export function compile(formula: string): Compiled {
  const hit = cache.get(formula);
  if (hit instanceof FormulaError) throw hit;
  if (hit) return hit;
  try {
    const node = parse(tokenize(formula));
    const refs: string[] = [];
    const walk = (x: Node) => { if (x.k === 'ref') refs.push(x.name); else if (x.k === 'neg') walk(x.a); else if (x.k === 'bin') { walk(x.a); walk(x.b); } else if (x.k === 'call') x.args.forEach(walk); };
    walk(node);
    const out = { node, refs };
    if (cache.size > 500) cache.clear();
    cache.set(formula, out);
    return out;
  } catch (e) {
    const err = e instanceof FormulaError ? e : new FormulaError(String((e as Error)?.message || e));
    cache.set(formula, err);
    throw err;
  }
}

/** Evaluate against a row; `get` returns a column's value by its name (case-insensitive) or throws for an unknown one. */
export function evaluate(formula: string, get: (name: string) => Value): Value {
  const run = (x: Node): Value => {
    switch (x.k) {
      case 'lit': return x.v;
      case 'ref': return get(x.name);
      case 'neg': return -n(run(x.a));
      case 'call': return FUNCTIONS[x.fn](x.args.map(run));
      case 'bin': {
        const a = run(x.a); const b = run(x.b);
        switch (x.op) {
          case '+': return n(a) + n(b);
          case '-': return n(a) - n(b);
          case '*': return n(a) * n(b);
          case '/': { const d = n(b); if (d === 0) throw new FormulaError('Divides by zero.'); return n(a) / d; }
          case '^': return n(a) ** n(b);
          case '&': return `${a ?? ''}${b ?? ''}`;
          default: {
            const cmp = typeof a === 'string' || typeof b === 'string' ? String(a ?? '').toLowerCase().localeCompare(String(b ?? '').toLowerCase()) : n(a) - n(b);
            return x.op === '=' ? cmp === 0 : x.op === '<>' ? cmp !== 0 : x.op === '<' ? cmp < 0 : x.op === '>' ? cmp > 0 : x.op === '<=' ? cmp <= 0 : cmp >= 0;
          }
        }
      }
    }
  };
  const v = run(compile(formula).node);
  if (typeof v === 'number' && !Number.isFinite(v)) throw new FormulaError('The result isn’t a number.');
  return v;
}

/**
 * Evaluate every formula column of one row, in dependency order. A column
 * that refers to itself through others gets "Circular reference".
 */
export function evaluateRow(
  formulas: { key: string; label: string; formula: string }[],
  base: (name: string) => Value | undefined,
): Record<string, { value: Value } | { error: string }> {
  const out: Record<string, { value: Value } | { error: string }> = {};
  const byName = new Map(formulas.map((f) => [f.label.trim().toLowerCase(), f]));
  const visiting = new Set<string>();
  const calc = (f: { key: string; label: string; formula: string }): Value => {
    const done = out[f.key];
    if (done) { if ('error' in done) throw new FormulaError(done.error); return done.value; }
    if (visiting.has(f.key)) throw new FormulaError('Circular reference.');
    visiting.add(f.key);
    try {
      const value = evaluate(f.formula, (name) => {
        const other = byName.get(name.trim().toLowerCase());
        if (other) return calc(other);
        const v = base(name);
        if (v === undefined) throw new FormulaError(`There’s no column called [${name}].`);
        return v;
      });
      out[f.key] = { value };
      return value;
    } catch (e) {
      const msg = e instanceof FormulaError ? e.message : 'The formula couldn’t be worked out.';
      out[f.key] = { error: msg };
      throw new FormulaError(msg);
    } finally { visiting.delete(f.key); }
  };
  for (const f of formulas) { try { calc(f); } catch { /* recorded */ } }
  return out;
}

/** Check a formula as it's typed: null when fine, else the problem. */
export function formulaProblem(formula: string, known: string[]): string | null {
  try {
    const c = compile(formula);
    const names = new Set(known.map((k) => k.trim().toLowerCase()));
    const missing = c.refs.find((r) => !names.has(r.trim().toLowerCase()));
    return missing ? `There’s no column called [${missing}].` : null;
  } catch (e) { return (e as Error).message; }
}
