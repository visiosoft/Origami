import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { useCsiCodes } from '../CsiSelect';
import { autoStrategy, computeEstimate, explainTotal, FORMULAS, money, NOTE_LABEL, type EstSettings, type FormulaId } from '../../data/estimateCalc';
import { evaluateRow, formulaProblem, type Value } from '../../data/estimateFormula';
import {
  BANDS, cellText, columnDefs, COLUMN_TYPES, customKey, effectiveColumns, History, insertStatements, LINE_COLS, lineNumbers, moveLine, newGr, newLine, newScope, parseTsv, pasteBlock, setCell, toTsv,
  type Band, type ColumnDef, type EstGr, type EstLine, type EstScope, type GridCol, type Sheet,
} from '../../data/estimateGrid';
import { SourcePicker } from './SourcePicker';
import { StatementPicker } from './StatementPicker';
import './EstimateGrid.css';

export interface EstimateHeader {
  id: string; projectId: number; number: string; rev: number; title?: string | null; status: string; version: number;
  grPct: number; profitPct: number; contingencyPct: number; showGrDetail: boolean; discount?: number | null; showDiscount: boolean;
  designCost?: number | null; showDesignCost: boolean; estimateDate?: string | null; updatedBy?: string | null; sentAt?: string | null;
  payments?: { id: string; label: string; mode: 'pct' | 'amt'; value: number; trigger?: string }[] | null;
  columns?: ColumnDef[] | null;
  isTemplate?: boolean;
  isDefaultTemplate?: boolean;
}

const BANDS_KEY = 'origami.estimate.hiddenBands';
const loadHidden = (): Band[] => { try { return JSON.parse(localStorage.getItem(BANDS_KEY) || '[]'); } catch { return []; } };
const SAVE_DELAY = 900;

type Sel = { lineId: string; col: number };
type Tip = { text: string; x: number; y: number } | null;

/** The (i) next to a figure: the formula in words, with this estimate's numbers. */
function Info({ text, onTip }: { text: string; onTip: (t: Tip) => void }) {
  const show = (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onTip({ text, x: Math.min(r.left, window.innerWidth - 380), y: r.bottom + 6 });
  };
  return <button type="button" className="eg-info" aria-label={text} onMouseEnter={show} onFocus={show} onClick={show} onMouseLeave={() => onTip(null)} onBlur={() => onTip(null)}>i</button>;
}

/**
 * The estimate, edited like the team's spreadsheet: one table per scope (a CSI
 * code) with its lines and its Details / Inclusions / Exclusions / A&C rows,
 * the precon, subcontractor and markup columns beside them, and General
 * Requirements, profit and contingency below the line. Keys work as in Excel;
 * blocks paste in from Excel; every total explains its formula.
 */
export function EstimateGrid({ projectId, estimateId, onChanged, controlRef }: {
  projectId: number; estimateId: string; onChanged?: (header: EstimateHeader) => void;
  /** Lets the page save any pending edits first (before marking the estimate sent). */
  controlRef?: React.MutableRefObject<{ flush: () => Promise<unknown> } | null>;
}) {
  const { toast } = useApp();
  const csi = useCsiCodes();
  const [head, setHead] = useState<EstimateHeader | null>(null);
  const [sheet, setSheetState] = useState<Sheet>({ scopes: [], lines: [], gr: [] });
  const [locked, setLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState('');
  const [hidden, setHidden] = useState<Band[]>(loadHidden);
  const [sel, setSel] = useState<Sel | null>(null);
  const [anchor, setAnchor] = useState<Sel | null>(null);
  const [editing, setEditing] = useState<{ sel: Sel; value: string } | null>(null);
  const [menu, setMenu] = useState<{ lineId?: string; scopeId?: string; x: number; y: number } | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  const [contractors, setContractors] = useState<{ id: string; companyName: string }[]>([]);
  const [picking, setPicking] = useState(false);
  const [colMenu, setColMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [colEdit, setColEdit] = useState<{ def: GridCol & { hidden?: boolean }; isNew: boolean; afterKey?: string } | null>(null);
  const [showCols, setShowCols] = useState(false);

  const history = useRef(new History<Sheet>());
  const sheetRef = useRef(sheet);
  const versionRef = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<number | null>(null);
  const dirty = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const editable = canEdit && !locked;
  /** projectId 0 is a company template: same grid, template endpoints. */
  const isTemplate = projectId === 0;
  const remote = useMemo(() => (isTemplate ? {
    load: () => api.finance.estimateTemplate(estimateId),
    sheet: (d: unknown) => api.finance.saveEstimateTemplateSheet(estimateId, d),
    settings: (d: unknown) => api.finance.saveEstimateTemplate(estimateId, d),
  } : {
    load: () => api.finance.estimate(projectId, estimateId),
    sheet: (d: unknown) => api.finance.saveEstimateSheet(projectId, estimateId, d),
    settings: (d: unknown) => api.finance.saveEstimate(projectId, estimateId, d),
  }), [isTemplate, projectId, estimateId]);
  const [viewW, setViewW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  });

  // ------------------------------------------------------------------ load
  const take = useCallback((r: any) => {
    setHead(r.estimate);
    versionRef.current = r.estimate.version;
    setLocked(!!r.locked);
    setCanEdit(!!r.rights?.edit);
    onChanged?.(r.estimate);
  }, [onChanged]);
  useEffect(() => {
    let live = true;
    remote.load().then((r: any) => {
      if (!live) return;
      take(r);
      const s = { scopes: r.scopes, lines: r.lines, gr: r.gr };
      sheetRef.current = s; setSheetState(s);
      history.current = new History<Sheet>();
    }).catch((e: any) => toast(e?.message || 'Could not open the estimate.'));
    (api.contractors.list() as Promise<any>).then((l) => live && setContractors(Array.isArray(l) ? l : [])).catch(() => undefined);
    return () => { live = false; };
  }, [remote, take, toast]);

  // ------------------------------------------------------------------ saving (one at a time, on the latest version)
  const enqueue = useCallback(<T,>(job: () => Promise<T>) => {
    const p = queue.current.then(job, job);
    queue.current = p.catch(() => undefined);
    return p;
  }, []);
  const saveSheetNow = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const mark = dirty.current;
    setSaveState('saving');
    return enqueue(async () => {
      const s = sheetRef.current;
      try {
        const r = await remote.sheet({ version: versionRef.current, ...s });
        take(r);
        setSaveError('');
        setSaveState(dirty.current === mark ? 'saved' : 'pending');
      } catch (e: any) {
        setSaveState('error');
        setSaveError(e?.message || 'Not saved.');
      }
    });
  }, [enqueue, remote, take]);
  const commit = useCallback((next: Sheet, opts: { history?: boolean } = {}) => {
    if (opts.history !== false) history.current.push(sheetRef.current);
    sheetRef.current = next;
    setSheetState(next);
    dirty.current++;
    setSaveState('pending');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void saveSheetNow(); }, SAVE_DELAY);
  }, [saveSheetNow]);
  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); void saveSheetNow(); } }, [saveSheetNow]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (timer.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const saveHead = useCallback((patch: Partial<EstimateHeader>) => {
    if (!editable) return;
    setHead((h) => (h ? { ...h, ...patch } : h));
    setSaveState('saving');
    void enqueue(async () => {
      try {
        const r = await remote.settings({ version: versionRef.current, ...patch });
        take(r);
        setSaveState(timer.current ? 'pending' : 'saved');
      } catch (e: any) { setSaveState('error'); setSaveError(e?.message || 'Not saved.'); }
    });
  }, [editable, enqueue, remote, take]);

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { flush: () => (timer.current ? saveSheetNow() : queue.current) };
    return () => { controlRef.current = null; };
  }, [controlRef, saveSheetNow]);

  // An open edit box (with its statement list) is scrolled into view inside the sheet.
  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(() => wrapRef.current?.querySelector('.eg-editor')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 250);
    return () => window.clearTimeout(t);
  }, [editing?.sel.lineId, editing?.sel.col]); // eslint-disable-line react-hooks/exhaustive-deps

  /** "+ Scopes from…": save what's pending, then copy the chosen scopes on the server and show the result. */
  const copyScopesFrom = async (fromId: string, scopeIds: string[]) => {
    if (timer.current) await saveSheetNow(); else await queue.current;
    try {
      const r = await enqueue(() => api.finance.copyEstimateScopes(projectId, estimateId, { version: versionRef.current, fromId, scopeIds }));
      history.current.push(sheetRef.current);
      take(r);
      const s = { scopes: r.scopes, lines: r.lines, gr: r.gr };
      sheetRef.current = s; setSheetState(s);
      setPicking(false);
      toast(`Copied ${scopeIds.length} scope${scopeIds.length === 1 ? '' : 's'}.`);
    } catch (e: any) { toast(e?.message || 'Could not copy the scopes.'); }
  };

  const undo = () => { const p = history.current.undo(sheetRef.current); if (p) commit(p, { history: false }); };
  const redo = () => { const p = history.current.redo(sheetRef.current); if (p) commit(p, { history: false }); };

  // ------------------------------------------------------------------ figures
  const settings: EstSettings = head ? { grPct: head.grPct, profitPct: head.profitPct, contingencyPct: head.contingencyPct, discount: head.discount, designCost: head.designCost } : { grPct: 0, profitPct: 0, contingencyPct: 0 };
  const result = useMemo(() => computeEstimate({
    settings,
    scopes: sheet.scopes.map((s) => ({ id: s.id, factor: s.factor })),
    lines: sheet.lines,
    gr: sheet.gr,
    payments: head?.payments || [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sheet, head?.grPct, head?.profitPct, head?.contingencyPct, head?.discount, head?.designCost, head?.payments]);
  const lineOut = useMemo(() => new Map(result.lines.map((l) => [l.id, l])), [result]);
  const scopeOut = useMemo(() => new Map(result.scopes.map((s) => [s.id, s])), [result]);
  const nums = useMemo(() => lineNumbers(sheet), [sheet]);

  const explain = (id: FormulaId) => explainTotal(id, result, settings);

  // ------------------------------------------------------------------ columns and the rows on screen
  const allCols = useMemo(() => effectiveColumns(head?.columns), [head?.columns]);
  const cols = useMemo(() => allCols.filter((c) => !c.hidden && !hidden.includes(c.band)), [allCols, hidden]);
  const saveCols = (next: (GridCol & { hidden?: boolean })[]) => saveHead({ columns: columnDefs(next) });
  const moveCol = (key: string, dir: -1 | 1) => {
    const vis = cols.map((c) => c.key); const i = vis.indexOf(key); const j = i + dir;
    if (j < 0 || j >= vis.length) return;
    const a = allCols.findIndex((c) => c.key === key); const b = allCols.findIndex((c) => c.key === vis[j]);
    const next = [...allCols]; [next[a], next[b]] = [next[b], next[a]];
    // a column takes the group of where it lands, so the group headers stay together
    next[b] = { ...next[b], band: next[a].band === next[b].band ? next[b].band : (next[b].custom ? next[a].band : next[b].band) };
    saveCols(next);
  };
  /** Formula columns, worked out per line in dependency order. */
  const formulaCols = useMemo(() => allCols.filter((c) => c.custom && c.kind === 'calc' && c.formula).map((c) => ({ key: c.key, label: c.label, formula: c.formula! })), [allCols]);
  const baseValue = useCallback((l: EstLine, name: string): Value | undefined => {
    const k = name.trim().toLowerCase();
    const col = allCols.find((c) => c.label.trim().toLowerCase() === k || c.key.toLowerCase() === k) || LINE_COLS.find((c) => c.label.toLowerCase() === k);
    if (!col) return undefined;
    const out = lineOut.get(l.id);
    switch (col.key) {
      case 'cost': return out ? out.cost / 100 : 0;
      case 'markupAmt': return out ? out.markup / 100 : 0;
      case 'markupPct': return out?.markupPct ?? 0;
      case 'price': return out ? out.countedPrice / 100 : 0;
      case 'high': return out ? out.high / 100 : 0;
      case 'durationDays': return l.durationDays ?? 0;
      default:
        if (col.custom) { const v = l.custom?.[col.key]; return v == null ? (col.kind === 'text' || col.kind === 'choice' ? '' : 0) : (v as Value); }
        return cellText(l, col);
    }
  }, [allCols, lineOut]);
  const formulaValues = useMemo(() => {
    const m = new Map<string, Record<string, { value: Value } | { error: string }>>();
    if (!formulaCols.length) return m;
    for (const l of sheet.lines) if (l.kind === 'item') m.set(l.id, evaluateRow(formulaCols, (name) => baseValue(l, name)));
    return m;
  }, [formulaCols, sheet.lines, baseValue]);
  const fmtValue = (v: Value) => {
    if (v === null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return String(v);
  };

  const visibleLines = useMemo(() => {
    const collapsed = new Set(sheet.scopes.filter((s) => s.collapsed).map((s) => s.id));
    const order = new Map(sheet.scopes.map((s, i) => [s.id, i]));
    return sheet.lines.filter((l) => !collapsed.has(l.scopeId)).sort((a, b) => (order.get(a.scopeId)! - order.get(b.scopeId)!) || (sheet.lines.indexOf(a) - sheet.lines.indexOf(b)));
  }, [sheet]);
  const rowIndex = useMemo(() => new Map(visibleLines.map((l, i) => [l.id, i])), [visibleLines]);
  const toggleBand = (b: Band) => setHidden((h) => { const n = h.includes(b) ? h.filter((x) => x !== b) : [...h, b]; try { localStorage.setItem(BANDS_KEY, JSON.stringify(n)); } catch { /* private mode */ } return n; });

  const inRange = (lineId: string, col: number) => {
    if (!sel) return false;
    const a = anchor || sel;
    const r = rowIndex.get(lineId) ?? -1;
    const [r1, r2] = [rowIndex.get(a.lineId) ?? -1, rowIndex.get(sel.lineId) ?? -1].sort((x, y) => x - y);
    const [c1, c2] = [a.col, sel.col].sort((x, y) => x - y);
    return r >= r1 && r <= r2 && col >= c1 && col <= c2;
  };
  const rangeLines = () => {
    if (!sel) return [];
    const a = anchor || sel;
    const [r1, r2] = [rowIndex.get(a.lineId)!, rowIndex.get(sel.lineId)!].sort((x, y) => x - y);
    return visibleLines.slice(r1, r2 + 1);
  };
  const rangeCols = () => { if (!sel) return []; const a = anchor || sel; const [c1, c2] = [a.col, sel.col].sort((x, y) => x - y); return cols.slice(c1, c2 + 1); };

  // ------------------------------------------------------------------ edits
  const updateLines = (fn: (lines: EstLine[]) => EstLine[]) => commit({ ...sheetRef.current, lines: fn(sheetRef.current.lines) });
  const updateScope = (id: string, patch: Partial<EstScope>, history = true) => commit({ ...sheetRef.current, scopes: sheetRef.current.scopes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }, { history });
  const writeCell = (lineId: string, col: GridCol, raw: string) => {
    const line = sheetRef.current.lines.find((l) => l.id === lineId);
    if (!line) return;
    const r = setCell(line, col, raw);
    if ('error' in r) { toast(r.error); return; }
    let next = r.line;
    if (col.key === 'description' && line.kind !== 'item' && next.description !== line.description) next = { ...next, statementId: null };
    if (col.key === 'subName') {
      const hit = contractors.find((c) => c.companyName?.toLowerCase() === raw.trim().toLowerCase());
      next = { ...next, contractorId: hit ? hit.id : null };
    }
    if (col.key === 'subName' && next.kind === 'item') next = { ...next, strategy: autoStrategy(next) };
    updateLines((ls) => ls.map((l) => (l.id === lineId ? next : l)));
  };
  const insertLine = (scopeId: string, kind = 'item', afterId?: string | null, before = false) => {
    const l = newLine(scopeId, kind);
    updateLines((ls) => {
      const out = [...ls];
      if (afterId) { const i = out.findIndex((x) => x.id === afterId); out.splice(before ? i : i + 1, 0, l); return out; }
      const last = out.map((x) => x.scopeId).lastIndexOf(scopeId);
      out.splice(last >= 0 ? last + 1 : out.length, 0, l);
      return out;
    });
    setSel({ lineId: l.id, col: 0 }); setAnchor(null);
    return l;
  };
  const deleteLines = (ids: string[]) => {
    if (!ids.length) return;
    updateLines((ls) => ls.filter((l) => !ids.includes(l.id)));
    setSel(null); setAnchor(null);
  };
  const duplicateLine = (id: string) => updateLines((ls) => { const i = ls.findIndex((l) => l.id === id); const c = { ...ls[i], id: newLine(ls[i].scopeId).id }; const out = [...ls]; out.splice(i + 1, 0, c); return out; });
  const addScope = () => { const s = newScope(); commit({ ...sheetRef.current, scopes: [...sheetRef.current.scopes, s], lines: [...sheetRef.current.lines, newLine(s.id)] }); };
  const moveScope = (id: string, dir: -1 | 1) => {
    const ss = [...sheetRef.current.scopes]; const i = ss.findIndex((s) => s.id === id); const j = i + dir;
    if (j < 0 || j >= ss.length) return;
    [ss[i], ss[j]] = [ss[j], ss[i]];
    commit({ ...sheetRef.current, scopes: ss });
  };
  const deleteScope = (id: string) => {
    const n = sheetRef.current.lines.filter((l) => l.scopeId === id && (l.description || l.cost)).length;
    if (n && !window.confirm(`Delete this scope and its ${n} filled line${n === 1 ? '' : 's'}? (Undo brings it back.)`)) return;
    commit({ ...sheetRef.current, scopes: sheetRef.current.scopes.filter((s) => s.id !== id), lines: sheetRef.current.lines.filter((l) => l.scopeId !== id) });
  };
  const updateGr = (id: string, patch: Partial<EstGr>) => commit({ ...sheetRef.current, gr: sheetRef.current.gr.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  // ------------------------------------------------------------------ keyboard, copy, paste
  const move = (dr: number, dc: number, extend = false) => {
    if (!sel) { if (visibleLines[0]) setSel({ lineId: visibleLines[0].id, col: 0 }); return; }
    const r = Math.max(0, Math.min(visibleLines.length - 1, (rowIndex.get(sel.lineId) ?? 0) + dr));
    const c = Math.max(0, Math.min(cols.length - 1, sel.col + dc));
    if (extend) { if (!anchor) setAnchor(sel); } else setAnchor(null);
    setSel({ lineId: visibleLines[r].id, col: c });
  };
  const startEdit = (s: Sel, initial?: string) => {
    if (!editable) return;
    const line = sheetRef.current.lines.find((l) => l.id === s.lineId);
    const col = cols[s.col];
    if (!line || !col || col.kind === 'calc' || (line.kind !== 'item' && !col.notes)) return;
    if (col.kind === 'check') { writeCell(line.id, col, line.custom?.[col.key] === true ? '' : 'yes'); return; }
    setEditing({ sel: s, value: initial ?? cellText(line, col) });
  };
  const finishEdit = (save: boolean, then?: [number, number]) => {
    if (editing && save) writeCell(editing.sel.lineId, cols[editing.sel.col], editing.value);
    setEditing(null);
    if (then) move(then[0], then[1]);
    window.setTimeout(() => wrapRef.current?.focus(), 0);
  };
  const copy = (e?: ClipboardEvent | React.ClipboardEvent) => {
    const ls = rangeLines(); const cs = rangeCols();
    if (!ls.length) return;
    const tsv = toTsv(ls.map((l) => cs.map((c) => {
      if (c.key === 'price') return (lineOut.get(l.id)?.price ?? 0) / 100;
      if (c.key === 'high') return (lineOut.get(l.id)?.high ?? 0) / 100;
      if (c.key === 'markupPct') return lineOut.get(l.id)?.markupPct ?? '';
      if (c.key === 'markupAmt') return (lineOut.get(l.id)?.markup ?? 0) / 100;
      if (c.custom && c.kind === 'calc') { const r = formulaValues.get(l.id)?.[c.key]; return r && 'value' in r ? (r.value as any) ?? '' : ''; }
      return cellText(l, c);
    })));
    if (e && 'clipboardData' in e && e.clipboardData) { e.clipboardData.setData('text/plain', tsv); e.preventDefault(); }
    else void navigator.clipboard?.writeText(tsv).catch(() => undefined);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || !editable) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const block = parseTsv(text);
    const target = sel ? sheetRef.current.lines.find((l) => l.id === sel.lineId) : null;
    const scopeId = target?.scopeId || sheetRef.current.scopes[sheetRef.current.scopes.length - 1]?.id;
    if (!scopeId) { toast('Add a scope first, then paste its lines.'); return; }
    const r = pasteBlock(sheetRef.current.lines, scopeId, target?.id || null, cols, sel?.col ?? 0, block);
    commit({ ...sheetRef.current, lines: r.lines });
    if (r.touched.length) { setAnchor({ lineId: r.touched[0], col: sel?.col ?? 0 }); setSel({ lineId: r.touched[r.touched.length - 1], col: Math.min(cols.length - 1, (sel?.col ?? 0) + Math.max(...block.map((b) => b.length)) - 1) }); }
    if (r.errors.length) toast(`${r.errors.length} cell${r.errors.length === 1 ? '' : 's'} not pasted — ${r.errors[0]}`);
  };
  const fillDown = () => {
    const ls = rangeLines(); const cs = rangeCols();
    if (ls.length < 2) return;
    const top = ls[0];
    updateLines((all) => all.map((l) => {
      if (!ls.slice(1).some((x) => x.id === l.id)) return l;
      let out = l;
      for (const c of cs) { const r = setCell(out, c, cellText(top, c)); if (!('error' in r)) out = r.line; }
      return out;
    }));
  };
  const clearRange = () => {
    const ls = rangeLines(); const cs = rangeCols();
    updateLines((all) => all.map((l) => {
      if (!ls.some((x) => x.id === l.id)) return l;
      let out = l;
      for (const c of cs) { const r = setCell(out, c, ''); if (!('error' in r)) out = r.line; }
      return out;
    }));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (editable) fillDown(); return; }
    if (mod && e.key.toLowerCase() === 'c') { copy(); return; }
    if (!sel) { if (e.key.startsWith('Arrow')) { e.preventDefault(); move(0, 0); } return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); if (editable) updateLines((ls) => moveLine(ls, sel.lineId, e.key === 'ArrowUp' ? -1 : 1)); return; }
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(-1, 0, e.shiftKey); return;
      case 'ArrowDown': e.preventDefault(); move(1, 0, e.shiftKey); return;
      case 'ArrowLeft': e.preventDefault(); move(0, -1, e.shiftKey); return;
      case 'ArrowRight': e.preventDefault(); move(0, 1, e.shiftKey); return;
      case 'Tab': e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return;
      case 'Enter': case 'F2': e.preventDefault(); startEdit(sel); return;
      case 'Delete': case 'Backspace': e.preventDefault(); if (editable) clearRange(); return;
      case 'Escape': setAnchor(null); return;
      default:
        if (e.key.length === 1 && !mod && !e.altKey) { e.preventDefault(); startEdit(sel, e.key); }
    }
  };

  // ------------------------------------------------------------------ render helpers
  const cellBox = (l: EstLine, c: GridCol, ci: number) => {
    const out = lineOut.get(l.id);
    const isNote = l.kind !== 'item';
    const off = isNote && !c.notes;
    let text: React.ReactNode = '';
    let cls = 'eg-cell';
    if (isNote && c.key === 'costTypes') { text = <span className="eg-kind">« {NOTE_LABEL[l.kind as keyof typeof NOTE_LABEL] || l.kind}</span>; }
    else if (off) cls += ' is-off';
    else if (c.custom) {
      if (c.kind === 'calc') {
        const r = formulaValues.get(l.id)?.[c.key];
        cls += ' is-num is-calc';
        if (r && 'error' in r) { text = <span style={{ color: 'var(--eg-err)' }} title={r.error}>#ERR</span>; }
        else if (r) text = fmtValue(r.value);
      } else if (c.kind === 'check') { text = l.custom?.[c.key] === true ? '✓' : ''; cls += ' is-num'; }
      else if (c.kind === 'money') { const v = l.custom?.[c.key]; text = v == null ? '' : money(Math.round(Number(v) * 100)); cls += ' is-num'; }
      else if (c.kind === 'pct') { const v = l.custom?.[c.key]; text = v == null ? '' : `${v}%`; cls += ' is-num'; }
      else if (c.kind === 'number') { text = (l.custom?.[c.key] as any) ?? ''; cls += ' is-num'; }
      else text = cellText(l, c);
    }
    else if (c.key === 'price') { text = out ? money(out.counted ? out.price : 0) : ''; cls += ' is-num is-calc'; if (out && !out.counted) { text = <span title={`Not In Scope — ${money(out.price)} is not counted`}>$0.00</span>; } }
    else if (c.key === 'high') { text = out ? money(out.counted ? out.high : 0) : ''; cls += ' is-num is-calc'; }
    else if (c.key === 'markupAmt') { text = out ? money(out.markup) : ''; cls += ' is-num'; if (l.markupMode === 'pct') cls += ' is-placeholder'; }
    else if (c.key === 'markupPct') { text = out?.markupPct == null ? '' : `${Math.round(out.markupPct * 100) / 100}%`; cls += ' is-num'; if (l.markupMode !== 'pct') cls += ' is-placeholder'; }
    else if (c.kind === 'money') { text = money(Math.round(((l as any)[c.key] || 0) * 100)); cls += ' is-num'; }
    else if (c.kind === 'number') { text = (l as any)[c.key] ?? ''; cls += ' is-num'; }
    else text = cellText(l, c);
    if (!isNote && l.pricing === 'nis' && c.key === 'description') cls += ' is-dim';
    if (isNote && c.key === 'description' && !l.description) { text = 'Type, or press Enter to pick a standard statement'; cls += ' is-placeholder'; }
    const isSel = sel?.lineId === l.id && sel.col === ci;
    const sticky = ci === 0 ? ' eg-sticky eg-desc' : '';
    return (
      <td key={c.key} className={`eg-b-${c.band}${ci > 0 && cols[ci - 1].band !== c.band ? ' eg-b-start' : ''}${isSel ? ' is-sel' : ''}${inRange(l.id, ci) && (anchor ? true : false) ? ' is-range' : ''}${sticky}`} style={{ width: c.width, minWidth: c.width, maxWidth: c.width }}
        data-line={l.id} data-col={ci}
        onMouseDown={(e) => { if (e.button !== 0) return; if (e.shiftKey && sel) { if (!anchor) setAnchor(sel); } else setAnchor(null); setSel({ lineId: l.id, col: ci }); }}
        onDoubleClick={() => startEdit({ lineId: l.id, col: ci })}>
        <div className={cls}>{text}</div>
      </td>
    );
  };

  const editorFor = () => {
    if (!editing) return null;
    const td = wrapRef.current?.querySelector<HTMLElement>(`td[data-line="${editing.sel.lineId}"][data-col="${editing.sel.col}"]`);
    if (!td || !wrapRef.current) return null;
    const col = cols[editing.sel.col];
    const box = { left: td.offsetLeft, top: td.offsetTop, width: Math.max(td.offsetWidth, col.kind === 'longtext' ? 340 : 0), minHeight: td.offsetHeight };
    const keyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
      else if (e.key === 'Tab') { e.preventDefault(); finishEdit(true, [0, e.shiftKey ? -1 : 1]); }
      else if (e.key === 'Enter' && !(col.kind === 'longtext' && (e.altKey || e.shiftKey))) { e.preventDefault(); finishEdit(true, [1, 0]); }
    };
    const set = (value: string) => setEditing((x) => (x ? { ...x, value } : x));
    let input: React.ReactNode;
    if (col.kind === 'choice') {
      const opts = col.options || [];
      const typed = editing.value.toLowerCase();
      const current = opts.find(([k, lbl]) => lbl === editing.value || k === editing.value)?.[0]
        ?? (typed.length === 1 ? opts.find(([, lbl]) => lbl.toLowerCase().startsWith(typed))?.[0] : undefined) ?? '';
      const commitChoice = (key: string, then?: [number, number]) => {
        const lbl = opts.find(([k]) => k === key)?.[1] ?? '';
        writeCell(editing.sel.lineId, col, lbl || key);
        setEditing(null);
        if (then) move(then[0], then[1]);
        window.setTimeout(() => wrapRef.current?.focus(), 0);
      };
      input = <select autoFocus defaultValue={current} onChange={(e) => commitChoice(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitChoice(e.currentTarget.value, e.key === 'Enter' ? [1, 0] : [0, e.shiftKey ? -1 : 1]); } else keyDown(e); }}
        onBlur={() => finishEdit(false)}>
        {col.key !== 'subPricing' && col.key !== 'pricing' && <option value="">—</option>}
        {(col.options || []).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
      </select>;
    } else if (col.kind === 'tags') {
      const chosen = editing.value.split(',').map((x) => x.trim()).filter(Boolean);
      input = <div className="eg-tags" onKeyDown={keyDown} tabIndex={-1}>
        {(col.options || []).map(([k]) => <label key={k}><input type="checkbox" checked={chosen.includes(k)} onChange={(e) => set((e.target.checked ? [...chosen, k] : chosen.filter((x) => x !== k)).join(', '))} />{k}</label>)}
        <button type="button" className="eg-btn" autoFocus onClick={() => finishEdit(true)}>Done</button>
      </div>;
    } else if (col.kind === 'longtext') {
      input = <textarea autoFocus value={editing.value} onChange={(e) => set(e.target.value)} onKeyDown={keyDown} onBlur={() => finishEdit(true)} onFocus={(e) => { const v = e.currentTarget.value; e.currentTarget.setSelectionRange(v.length, v.length); }} />;
      const line = sheetRef.current.lines.find((l) => l.id === editing.sel.lineId);
      if (line && line.kind !== 'item' && col.key === 'description') {
        const scope = sheetRef.current.scopes.find((x) => x.id === line.scopeId);
        input = <>{input}<StatementPicker csiCodeId={scope?.csiCodeId || null} kind={line.kind} text={editing.value} canSave={canEdit}
          onPick={(picks) => {
            updateLines((ls) => insertStatements(ls, line.id, picks));
            setEditing(null);
            window.setTimeout(() => wrapRef.current?.focus(), 0);
          }} /></>;
      }
    } else {
      input = <input autoFocus type={col.kind === 'date' ? 'date' : 'text'} inputMode={col.kind === 'money' || col.kind === 'pct' || col.kind === 'number' ? 'decimal' : undefined}
        list={col.key === 'subName' ? 'eg-contractors' : undefined} value={editing.value} onChange={(e) => set(e.target.value)} onKeyDown={keyDown} onBlur={() => finishEdit(true)} />;
    }
    return <div className="eg-editor" style={box}>{input}</div>;
  };

  if (!head) return <div style={{ padding: 20, color: 'var(--muted)' }}>Opening the estimate…</div>;
  const t = result.totals;
  const bandSpans: { key: Band; label: string; n: number; first: boolean }[] = [];
  cols.forEach((c, i) => {
    const last = bandSpans[bandSpans.length - 1];
    if (last && last.key === c.band) last.n++;
    else bandSpans.push({ key: c.band, label: BANDS.find((b) => b.key === c.band)?.label || '', n: 1, first: i === 0 });
  });
  const menuLine = menu?.lineId ? sheet.lines.find((l) => l.id === menu.lineId) : null;

  return (
    <div className="eg" onClick={() => { if (menu) setMenu(null); if (colMenu) setColMenu(null); if (showCols) setShowCols(false); }}>
      <div className="eg-bar">
        <input className="eg-title" aria-label="Estimate title" disabled={!editable} defaultValue={head.title || ''} key={head.id} onBlur={(e) => e.target.value !== (head.title || '') && saveHead({ title: e.target.value })} />
        {isTemplate ? <span className="eg-chip">Template</span> : <span className={`eg-chip is-${head.status}`}>{head.number} · Rev {head.rev} · {head.status}</span>}
        <span className={`eg-save${saveState === 'error' ? ' is-error' : ''}`} role="status">
          {saveState === 'saving' ? 'Saving…' : saveState === 'pending' ? 'Unsaved' : saveState === 'error' ? saveError : locked ? 'Frozen' : 'Saved'}
        </span>
        {saveState === 'error' && <button type="button" className="eg-btn" onClick={() => void saveSheetNow()}>Try again</button>}
        <button type="button" className="eg-btn" disabled={!editable || !history.current.canUndo} onClick={undo} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button type="button" className="eg-btn" disabled={!editable || !history.current.canRedo} onClick={redo} title="Redo (Ctrl+Y)">↷ Redo</button>
        {isTemplate && <label className="eg-btn" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} title="A blank estimate starts with this template’s columns, General Requirements, percentages, payments and letter text (not its scopes)">
          <input type="checkbox" disabled={!editable} checked={!!head.isDefaultTemplate} onChange={(e) => saveHead({ isDefaultTemplate: e.target.checked })} /> Company default for blank estimates
        </label>}
        <button type="button" className={`eg-btn${showCols ? ' is-on' : ''}`} onClick={(e) => { e.stopPropagation(); setShowCols((v) => !v); }}>Columns ▾</button>
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }} aria-label="Column groups">
          {BANDS.filter((b) => b.key !== 'prime').map((b) => (
            <button key={b.key} type="button" className={`eg-btn${hidden.includes(b.key) ? '' : ' is-on'}`} aria-pressed={!hidden.includes(b.key)} onClick={() => toggleBand(b.key)}>{b.label}</button>
          ))}
        </span>
      </div>
      {locked && <div className="eg-locked">{head.number} Rev {head.rev} was {head.status}{head.sentAt ? ` on ${new Date(head.sentAt).toLocaleDateString()}` : ''} and is frozen. Make a new revision to change it.</div>}
      {!locked && !canEdit && <div className="eg-locked">You can view this estimate; your role doesn’t allow editing it.</div>}

      <datalist id="eg-contractors">{contractors.map((c) => <option key={c.id} value={c.companyName} />)}</datalist>

      <div className="eg-wrap" ref={wrapRef} style={viewW ? ({ '--eg-vw': `${viewW}px` } as React.CSSProperties) : undefined} tabIndex={0} role="grid" aria-label="Estimate lines" onKeyDown={onKey} onPaste={onPaste} onCopy={(e) => { if (!editing) copy(e); }}>
        <table className="eg-table" style={{ width: 56 + cols.reduce((a, c) => a + c.width, 0) }}>
          <colgroup>
            <col style={{ width: 56 }} />
            {cols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr className="eg-bands">
              <th className="eg-sticky eg-num" />
              {bandSpans.map((b, i) => <th key={`${b.key}-${i}`} colSpan={b.n} className={`eg-band-${b.key}${b.first ? ' eg-sticky eg-desc' : ''}`}>{b.label}</th>)}
            </tr>
            <tr className="eg-cols">
              <th className="eg-sticky eg-num">#</th>
              {cols.map((c, i) => (
                <th key={c.key} className={`eg-band-${c.band}${i > 0 && cols[i - 1].band !== c.band ? ' eg-b-start' : ''}${i === 0 ? ' eg-sticky eg-desc' : ''}`} style={{ width: c.width, minWidth: c.width, maxWidth: c.width, textAlign: c.kind === 'money' || c.kind === 'calc' || c.kind === 'pct' || c.kind === 'number' ? 'right' : 'left', cursor: editable ? 'pointer' : undefined }}
                  title={editable ? 'Column options' : undefined}
                  onClick={(e) => { if (!editable) return; e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setColMenu({ key: c.key, x: Math.min(r.left, window.innerWidth - 230), y: r.bottom + 2 }); }}>
                  {c.label}{c.custom && !c.showClient && <span title="Internal only" style={{ marginLeft: 4 }}>🔒</span>}{c.hint && <Info text={c.hint} onTip={setTip} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.scopes.map((s, si) => {
              const so = scopeOut.get(s.id);
              const mine = sheet.lines.filter((l) => l.scopeId === s.id);
              return [
                <tr key={`s-${s.id}`} className="eg-scope">
                  <td colSpan={cols.length + 1}>
                    <div className="eg-scope-row">
                      <button type="button" className="eg-btn" style={{ padding: '3px 8px' }} aria-label={s.collapsed ? 'Expand scope' : 'Collapse scope'} onClick={() => updateScope(s.id, { collapsed: !s.collapsed }, false)}>{s.collapsed ? '▸' : '▾'}</button>
                      <span className="eg-scope-num">{si + 1}</span>
                      <select aria-label="CSI code" disabled={!editable} value={s.csiCodeId || ''} onChange={(e) => {
                        const c = csi.find((x) => x.id === e.target.value);
                        updateScope(s.id, { csiCodeId: e.target.value || null, title: s.title || (c ? `${c.code}. ${c.division}` : s.title) });
                      }} style={{ maxWidth: 220 }}>
                        <option value="">CSI code…</option>
                        {csi.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
                      </select>
                      <input className="eg-scope-title" aria-label="Scope name" disabled={!editable} defaultValue={s.title || ''} key={`t-${s.id}-${s.title}`} placeholder="Scope name" onBlur={(e) => e.target.value !== (s.title || '') && updateScope(s.id, { title: e.target.value })} />
                      {!hidden.includes('precon') && <label className="eg-scope-fig">Factor <input aria-label="Precon factor" disabled={!editable} style={{ width: 64 }} inputMode="decimal" defaultValue={s.factor ?? ''} key={`f-${s.id}-${s.factor}`} placeholder="1.00" onBlur={(e) => { const v = e.target.value.trim(); const n = v ? Number(v) : null; if (n != null && (!Number.isFinite(n) || n <= 0)) { toast('The factor is a multiplier, like 1.15.'); return; } if (n !== (s.factor ?? null)) updateScope(s.id, { factor: n }); }} /><Info text={FORMULAS.F4.text} onTip={setTip} /></label>}
                      <span className="eg-scope-fig">Sub cost <b>{money(so?.cost ?? 0)}</b></span>
                      <span className="eg-scope-fig">Markup <b>{money(so?.markup ?? 0)}</b>{so?.profitPct != null && <> · <b>{Math.round(so.profitPct * 10) / 10}%</b></>}<Info text={`${FORMULAS.F6.label} = ${FORMULAS.F6.text}`} onTip={setTip} /></span>
                      {!hidden.includes('precon') && (s.factor ?? 1) !== 1 && <span className="eg-scope-fig">Higher end <b>{money(so?.high ?? 0)}</b></span>}
                      <span className="eg-scope-fig">Scope total <b>{money(so?.total ?? 0)}</b><Info text={`${FORMULAS.F5.label} = ${FORMULAS.F5.text}`} onTip={setTip} /></span>
                      {editable && <button type="button" className="eg-btn" aria-label="Scope actions" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ scopeId: s.id, x: Math.min(r.left, window.innerWidth - 220), y: r.bottom + 4 }); }}>⋯</button>}
                    </div>
                  </td>
                </tr>,
                ...(s.collapsed ? [] : mine.map((l) => (
                  <tr key={l.id} className={l.kind === 'item' ? '' : 'eg-note'}>
                    <td className="eg-sticky eg-num" title="Row actions" onClick={(e) => { e.stopPropagation(); setSel({ lineId: l.id, col: 0 }); setAnchor(null); if (!editable) return; const r = e.currentTarget.getBoundingClientRect(); setMenu({ lineId: l.id, x: r.right + 4, y: Math.min(r.top, window.innerHeight - 360) }); }}>
                      <span style={{ paddingLeft: (l.indent || 0) * 8 }}>{nums.get(l.id)}</span>
                    </td>
                    {cols.map((c, ci) => cellBox(l, c, ci))}
                  </tr>
                ))),
                ...(s.collapsed || !editable ? [] : [
                  <tr key={`a-${s.id}`} className="eg-add">
                    <td colSpan={cols.length + 1}>
                      <div className="eg-add-row">
                        <button type="button" onClick={() => insertLine(s.id)}>+ Line</button>
                        {Object.entries(NOTE_LABEL).map(([k, lbl]) => <button key={k} type="button" onClick={() => insertLine(s.id, k)}>+ {lbl.replace(' (A&C)', '')}</button>)}
                      </div>
                    </td>
                  </tr>,
                ]),
              ];
            })}
            {editable && (
              <tr className="eg-add"><td colSpan={cols.length + 1}><div className="eg-add-row"><button type="button" onClick={addScope}>+ New scope</button><button type="button" onClick={() => setPicking(true)}>+ Scopes from a template or estimate…</button><span style={{ fontSize: 11.5, color: 'var(--muted)', alignSelf: 'center' }}>Tip: copy rows in Excel and paste them on a cell here.</span></div></td></tr>
            )}
            <tr className="eg-subtotal">
              <td className="eg-sticky eg-num" />
              <td colSpan={cols.length}>
                <div className="eg-scope-row">
                  <span>Subtotal <b>{money(t.subtotal)}</b><Info text={explain('F8')} onTip={setTip} /></span>
                  <span className="eg-scope-fig">Subcontracted total <b>{money(t.subcontracted)}</b><Info text={explain('F7')} onTip={setTip} /></span>
                  <span className="eg-scope-fig">Markup total <b>{money(t.markup)}</b></span>
                  {!hidden.includes('precon') && <span className="eg-scope-fig">Higher end <b>{money(t.high)}</b></span>}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        {editorFor()}
      </div>

      <BelowTheLine head={head} sheet={sheet} result={result} editable={editable} explain={explain} onTip={setTip} saveHead={saveHead} updateGr={updateGr}
        addGr={() => commit({ ...sheetRef.current, gr: [...sheetRef.current.gr, newGr()] })}
        removeGr={(id) => commit({ ...sheetRef.current, gr: sheetRef.current.gr.filter((g) => g.id !== id) })} />

      {createPortal(
        <div className="eg-portal">
      {menu && (
        <div className="eg-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} role="menu">
          {menuLine && <>
            <button type="button" onClick={() => { insertLine(menuLine.scopeId, 'item', menuLine.id, true); setMenu(null); }}>Insert line above</button>
            <button type="button" onClick={() => { insertLine(menuLine.scopeId, 'item', menuLine.id); setMenu(null); }}>Insert line below</button>
            {Object.entries(NOTE_LABEL).map(([k, lbl]) => <button key={k} type="button" onClick={() => { insertLine(menuLine.scopeId, k, menuLine.id); setMenu(null); }}>Insert « {lbl} below</button>)}
            <hr />
            <button type="button" onClick={() => { duplicateLine(menuLine.id); setMenu(null); }}>Duplicate</button>
            <button type="button" onClick={() => { updateLines((ls) => moveLine(ls, menuLine.id, -1)); setMenu(null); }}>Move up (Alt+↑)</button>
            <button type="button" onClick={() => { updateLines((ls) => moveLine(ls, menuLine.id, 1)); setMenu(null); }}>Move down (Alt+↓)</button>
            <button type="button" onClick={() => { updateLines((ls) => ls.map((l) => (l.id === menuLine.id ? { ...l, indent: Math.min(3, (l.indent || 0) + 1) } : l))); setMenu(null); }}>Indent</button>
            <button type="button" onClick={() => { updateLines((ls) => ls.map((l) => (l.id === menuLine.id ? { ...l, indent: Math.max(0, (l.indent || 0) - 1) } : l))); setMenu(null); }}>Outdent</button>
            <hr />
            <button type="button" style={{ color: 'var(--eg-err)' }} onClick={() => { deleteLines(anchor ? rangeLines().map((l) => l.id) : [menuLine.id]); setMenu(null); }}>Delete {anchor && rangeLines().length > 1 ? `${rangeLines().length} rows` : 'row'}</button>
          </>}
          {menu.scopeId && <>
            <button type="button" onClick={() => { insertLine(menu.scopeId!); setMenu(null); }}>Add a line</button>
            <button type="button" onClick={() => { moveScope(menu.scopeId!, -1); setMenu(null); }}>Move scope up</button>
            <button type="button" onClick={() => { moveScope(menu.scopeId!, 1); setMenu(null); }}>Move scope down</button>
            <hr />
            <button type="button" style={{ color: 'var(--eg-err)' }} onClick={() => { deleteScope(menu.scopeId!); setMenu(null); }}>Delete scope</button>
          </>}
        </div>
      )}
      {colMenu && (() => {
        const c = allCols.find((x) => x.key === colMenu.key);
        if (!c) return null;
        const close = () => setColMenu(null);
        const idx = allCols.findIndex((x) => x.key === c.key);
        return (
          <div className="eg-menu" style={{ left: colMenu.x, top: colMenu.y }} onClick={(e) => e.stopPropagation()} role="menu">
            <button type="button" onClick={() => { setColEdit({ def: c, isNew: false }); close(); }}>{c.custom ? 'Edit column…' : 'Rename…'}</button>
            <button type="button" onClick={() => { setColEdit({ def: { key: customKey(), label: '', band: c.band, kind: 'text', width: 140, custom: true, type: 'text' }, isNew: true, afterKey: c.key }); close(); }}>Insert column to the right…</button>
            <hr />
            <button type="button" onClick={() => { moveCol(c.key, -1); close(); }}>Move left</button>
            <button type="button" onClick={() => { moveCol(c.key, 1); close(); }}>Move right</button>
            <button type="button" onClick={() => { saveCols(allCols.map((x, i) => (i === idx ? { ...x, width: Math.min(800, x.width + 40) } : x))); close(); }}>Wider</button>
            <button type="button" onClick={() => { saveCols(allCols.map((x, i) => (i === idx ? { ...x, width: Math.max(60, x.width - 40) } : x))); close(); }}>Narrower</button>
            {c.key !== 'description' && <button type="button" onClick={() => { saveCols(allCols.map((x, i) => (i === idx ? { ...x, hidden: true } : x))); close(); }}>Hide column</button>}
            {c.custom && <><hr /><button type="button" style={{ color: 'var(--eg-err)' }} onClick={() => {
              const used = sheet.lines.filter((l) => l.custom?.[c.key] != null).length;
              if (used && !window.confirm(`Delete the column “${c.label}” and what’s typed in it on ${used} line${used === 1 ? '' : 's'}?`)) return;
              saveCols(allCols.filter((x) => x.key !== c.key));
              if (used) commit({ ...sheetRef.current, lines: sheetRef.current.lines.map((l) => { if (l.custom?.[c.key] == null) return l; const cu = { ...l.custom }; delete cu[c.key]; return { ...l, custom: Object.keys(cu).length ? cu : null }; }) });
              close();
            }}>Delete column</button></>}
          </div>
        );
      })()}
      {showCols && (
        <div className="eg-menu" style={{ right: 24, top: (wrapRef.current?.getBoundingClientRect().top ?? 200) - 4, left: 'auto', maxHeight: '70vh', overflowY: 'auto', minWidth: 260 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', padding: '4px 10px' }}>Show columns</div>
          {allCols.map((c, i) => (
            <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', fontSize: 13, cursor: editable ? 'pointer' : 'default', opacity: hidden.includes(c.band) ? 0.5 : 1 }}>
              <input type="checkbox" disabled={!editable || c.key === 'description'} checked={!c.hidden} onChange={(e) => saveCols(allCols.map((x, j) => (j === i ? { ...x, hidden: !e.target.checked } : x)))} />
              <span style={{ flex: 1 }}>{c.label}{c.custom ? <span style={{ color: 'var(--muted)' }}> · {COLUMN_TYPES.find(([k]) => k === c.type)?.[1]}</span> : null}</span>
            </label>
          ))}
          {editable && <><hr /><button type="button" onClick={() => { setColEdit({ def: { key: customKey(), label: '', band: 'notes', kind: 'text', width: 140, custom: true, type: 'text' }, isNew: true }); setShowCols(false); }}>+ Add a column…</button></>}
        </div>
      )}
      {colEdit && <ColumnDialog edit={colEdit} known={allCols.filter((c) => c.key !== colEdit.def.key).map((c) => c.label).concat(LINE_COLS.map((c) => c.label))} onClose={() => setColEdit(null)} onSave={(def) => {
        let next: (GridCol & { hidden?: boolean })[];
        if (colEdit.isNew) {
          const at = colEdit.afterKey ? allCols.findIndex((c) => c.key === colEdit.afterKey) + 1 : allCols.length;
          next = [...allCols]; next.splice(at, 0, def);
        } else {
          const before = allCols.find((c) => c.key === def.key);
          next = allCols.map((c) => (c.key === def.key ? def : c));
          // A renamed column: formulas that named it follow the new name.
          if (before && before.label !== def.label) {
            const re = new RegExp(`\\[\\s*${before.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\]`, 'gi');
            next = next.map((c) => {
              const f = c.formula?.replace(re, `[${def.label}]`);
              return f && f !== c.formula ? { ...c, formula: f, hint: `Formula: ${f}` } : c;
            });
          }
        }
        saveCols(next);
        setColEdit(null);
      }} />}
      {picking && <SourcePicker mode="scopes" excludeId={estimateId} onClose={() => setPicking(false)} onPick={(fromId, o) => copyScopesFrom(fromId, o.scopeIds || [])} />}
      {tip && <div className="eg-tip" style={{ left: Math.max(8, tip.x), top: Math.min(tip.y, window.innerHeight - 120) }}>{tip.text}</div>}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** General Requirements, profit, contingency, discount, design cost and the payment rows -- every figure with its formula. */
function BelowTheLine({ head, sheet, result, editable, explain, onTip, saveHead, updateGr, addGr, removeGr }: {
  head: EstimateHeader; sheet: Sheet; result: ReturnType<typeof computeEstimate>; editable: boolean; explain: (id: FormulaId) => string; onTip: (t: Tip) => void;
  saveHead: (p: Partial<EstimateHeader>) => void; updateGr: (id: string, p: Partial<EstGr>) => void; addGr: () => void; removeGr: (id: string) => void;
}) {
  const t = result.totals;
  const grOut = new Map(result.gr.map((g) => [g.id, g]));
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[$,%\s]/g, '')));
  const pctInput = (key: 'grPct' | 'profitPct' | 'contingencyPct') => (
    <input aria-label={key} className="is-num" disabled={!editable} defaultValue={head[key]} key={`${key}-${head[key]}`} inputMode="decimal"
      onBlur={(e) => { const n = num(e.target.value); if (n == null || !Number.isFinite(n) || n < 0 || n >= 100) { e.target.value = String(head[key]); return; } if (n !== head[key]) saveHead({ [key]: n } as Partial<EstimateHeader>); }} />
  );
  const moneyInput = (key: 'discount' | 'designCost', label: string) => (
    <input aria-label={label} className="is-num" disabled={!editable} defaultValue={head[key] ?? ''} key={`${key}-${head[key]}`} inputMode="decimal" placeholder="$0.00"
      onBlur={(e) => { const n = num(e.target.value); if (n != null && (!Number.isFinite(n) || n < 0)) { e.target.value = String(head[key] ?? ''); return; } if ((n ?? null) !== (head[key] ?? null)) saveHead({ [key]: n } as Partial<EstimateHeader>); }} />
  );
  const row = (label: React.ReactNode, f: FormulaId | null, value: number, mid?: React.ReactNode, cls = '') => (
    <div className={`eg-trow ${cls}`}>
      <span className="lbl">{label}{f && <Info text={explain(f)} onTip={onTip} />}</span>
      <span>{mid}</span>
      <span className="val">{money(value)}</span>
    </div>
  );
  const payments = head.payments || [];
  const setPayments = (p: typeof payments) => saveHead({ payments: p });
  return (
    <div className="eg-below">
      <div className="eg-card">
        <h3>General Requirements <span className="eg-scope-fig">Below the line</span>
          <label className="eg-scope-fig" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" disabled={!editable} checked={head.showGrDetail} onChange={(e) => saveHead({ showGrDetail: e.target.checked })} /> Show detail costs in prime
          </label>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="eg-gr" style={{ minWidth: 690 }}>
            <thead><tr><th style={{ width: 40 }}>#</th><th style={{ minWidth: 170 }}>General requirement</th><th style={{ width: 104 }}>In / out</th><th style={{ width: 92, textAlign: 'right' }}>Base</th><th style={{ width: 84 }}>Unit</th><th style={{ width: 56, textAlign: 'right' }}>Qty</th><th style={{ width: 112, textAlign: 'right' }}>Cost<Info text={`${FORMULAS.F9.label} = ${FORMULAS.F9.text}`} onTip={onTip} /></th>{editable && <th style={{ width: 28 }} />}</tr></thead>
            <tbody>
              {sheet.gr.map((g, i) => (
                <tr key={g.id} className={g.included ? '' : 'is-out'}>
                  <td style={{ color: 'var(--muted)' }}>{`${sheet.scopes.length + 1}.${String(i + 1).padStart(2, '0')}`}</td>
                  <td><input aria-label="General requirement" disabled={!editable} defaultValue={g.title} key={`t-${g.id}-${g.title}`} onBlur={(e) => e.target.value !== g.title && updateGr(g.id, { title: e.target.value })} /></td>
                  <td><select aria-label="Included" disabled={!editable} value={g.included ? 'in' : 'out'} onChange={(e) => updateGr(g.id, { included: e.target.value === 'in' })}><option value="in">Included</option><option value="out">Excluded</option></select></td>
                  <td><input aria-label="Base amount" className="is-num" disabled={!editable} inputMode="decimal" defaultValue={g.base || ''} key={`b-${g.id}-${g.base}`} placeholder="0" onBlur={(e) => { const n = num(e.target.value) ?? 0; if (Number.isFinite(n) && n >= 0 && n !== g.base) updateGr(g.id, { base: n }); }} /></td>
                  <td><input aria-label="Unit" disabled={!editable} list="eg-units" defaultValue={g.unit} key={`u-${g.id}-${g.unit}`} onBlur={(e) => e.target.value !== g.unit && updateGr(g.id, { unit: e.target.value || 'LS' })} /></td>
                  <td><input aria-label="Quantity" className="is-num" disabled={!editable} inputMode="decimal" defaultValue={g.qty} key={`q-${g.id}-${g.qty}`} onBlur={(e) => { const n = num(e.target.value) ?? 0; if (Number.isFinite(n) && n >= 0 && n !== g.qty) updateGr(g.id, { qty: n }); }} /></td>
                  <td className="is-num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{money(grOut.get(g.id)?.amount ?? 0)}</td>
                  {editable && <td><button type="button" className="eg-btn is-danger" style={{ padding: '2px 8px' }} aria-label={`Delete ${g.title}`} onClick={() => removeGr(g.id)}>×</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="eg-units">{['LS', 'Monthly', 'Weekly', 'Daily', 'Each', 'Hour', 'SF'].map((u) => <option key={u} value={u} />)}</datalist>
        </div>
        {editable && <div className="eg-add-row" style={{ position: 'static', paddingLeft: 0 }}><button type="button" onClick={addGr}>+ General requirement</button></div>}
      </div>

      <div className="eg-card">
        <h3>Totals</h3>
        {t.error && <div className="eg-error">{t.error}</div>}
        <div className="eg-totals">
          {row('Subtotal', 'F8', t.subtotal)}
          {row('General Requirements total', 'F10', t.grTotal, t.effectiveGrPct != null ? <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{Math.round(t.effectiveGrPct * 10) / 10}%</span> : null)}
          <div className="eg-trow">
            <span className="lbl">Suggested GR max<Info text={explain('F11')} onTip={onTip} /></span>
            <span>{pctInput('grPct')}</span>
            <span className="val">{money(t.grSuggested)}</span>
          </div>
          <div className="eg-trow">
            <span className="lbl">GR balance left<Info text={explain('F12')} onTip={onTip} /></span><span />
            <span className={`val${t.grBalance < 0 ? ' warn' : ''}`}>{t.grBalance < 0 ? `over by ${money(-t.grBalance)}` : money(t.grBalance)}</span>
          </div>
          {row('Profit', 'F14', t.profit, pctInput('profitPct'))}
          {row('Contractor contingency', 'F15', t.contingency, pctInput('contingencyPct'))}
          {row('Total build cost', 'F13', t.totalBuild, null, 'is-big')}
          <div className="eg-trow">
            <span className="lbl">Discounts, credits<label className="show"><input type="checkbox" disabled={!editable} checked={head.showDiscount} onChange={(e) => saveHead({ showDiscount: e.target.checked })} />show client</label></span>
            <span>{moneyInput('discount', 'Discounts and credits')}</span>
            <span className="val">{t.discount ? `−${money(t.discount)}` : money(0)}</span>
          </div>
          {row('Total build cost (revised)', 'F16', t.revisedBuild)}
          <div className="eg-trow">
            <span className="lbl">Total design cost<label className="show"><input type="checkbox" disabled={!editable} checked={head.showDesignCost} onChange={(e) => saveHead({ showDesignCost: e.target.checked })} />show client</label></span>
            <span>{moneyInput('designCost', 'Design cost')}</span>
            <span className="val">{money(t.designCost)}</span>
          </div>
          {row('Total project cost', 'F17', t.totalProject, null, 'is-big')}
        </div>
        <div className="eg-split" aria-label="Cost split">
          <span>Fixed <b>{money(t.split.fixed)}</b></span><span>Allowances <b>{money(t.split.allowance)}</b></span><span>T&amp;M <b>{money(t.split.tm)}</b></span><span>Contingency <b>{money(t.split.contingency)}</b></span><span>Soft cost <b>{money(t.split.soft)}</b></span>
        </div>

        <h3 style={{ marginTop: 16 }}>Payment schedule <span className="eg-scope-fig">{t.unscheduled !== 0 && payments.length ? <>Not scheduled <b>{money(t.unscheduled)}</b></> : null}</span></h3>
        <div className="eg-totals">
          {payments.map((p, i) => (
            <div key={p.id} className="eg-trow" style={{ gridTemplateColumns: 'minmax(0,1fr) 70px 64px 110px 28px' }}>
              <input aria-label="Payment label" disabled={!editable} defaultValue={p.label} key={`l-${p.id}-${p.label}`} onBlur={(e) => e.target.value !== p.label && setPayments(payments.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <select aria-label="Percent or amount" disabled={!editable} value={p.mode} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, mode: e.target.value as 'pct' | 'amt' } : x)))}><option value="pct">%</option><option value="amt">$</option></select>
              <input aria-label="Payment value" className="is-num" disabled={!editable} inputMode="decimal" defaultValue={p.value} key={`v-${p.id}-${p.value}`} onBlur={(e) => { const n = num(e.target.value) ?? 0; if (Number.isFinite(n) && n >= 0 && n !== p.value) setPayments(payments.map((x, j) => (j === i ? { ...x, value: n } : x))); }} />
              <span className="val">{money(result.payments[i]?.amount ?? 0)}</span>
              {editable ? <button type="button" className="eg-btn is-danger" style={{ padding: '2px 8px' }} aria-label={`Delete ${p.label}`} onClick={() => setPayments(payments.filter((_, j) => j !== i))}>×</button> : <span />}
            </div>
          ))}
        </div>
        {editable && <div className="eg-add-row" style={{ position: 'static', paddingLeft: 0 }}><button type="button" onClick={() => setPayments([...payments, { id: `p${Date.now().toString(36)}`, label: `Pmt ${payments.length + 1}`, mode: 'pct', value: 0 }])}>+ Payment</button></div>}
      </div>
    </div>
  );
}

/** Add or change a column: name, type, formula (checked as you type), choices, who sees it. */
function ColumnDialog({ edit, known, onClose, onSave }: {
  edit: { def: GridCol & { hidden?: boolean }; isNew: boolean }; known: string[]; onClose: () => void; onSave: (def: GridCol & { hidden?: boolean }) => void;
}) {
  const d = edit.def;
  const [label, setLabel] = useState(d.label);
  const [type, setType] = useState(d.type || 'text');
  const [formula, setFormula] = useState(d.formula || '=');
  const [choices, setChoices] = useState((d.options || []).map((o) => o[0]).join(', '));
  const [showClient, setShowClient] = useState(!!d.showClient);
  const [showSub, setShowSub] = useState(!!d.showSub);
  const problem = d.custom && type === 'formula' ? formulaProblem(formula, known) : null;
  const clash = known.some((k) => k.trim().toLowerCase() === label.trim().toLowerCase());
  const ok = label.trim() && !clash && !problem;
  const save = () => {
    if (!ok) return;
    if (!d.custom) { onSave({ ...d, label: label.trim() }); return; }
    const kind = ({ text: 'text', number: 'number', money: 'money', pct: 'pct', date: 'date', choice: 'choice', checkbox: 'check', formula: 'calc' } as const)[type as 'text'] || 'text';
    onSave({
      ...d, label: label.trim(), type, kind, formula: type === 'formula' ? formula : undefined, showClient, showSub,
      options: type === 'choice' ? choices.split(',').map((x) => x.trim()).filter(Boolean).map((x) => [x, x] as [string, string]) : undefined,
      hint: type === 'formula' ? `Formula: ${formula}` : undefined,
    });
  };
  const field = { padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16, background: 'var(--surface)', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' } as const;
  return createPortal(
    <div className="eg-portal">
    <div role="dialog" aria-modal="true" aria-label="Column" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="eg-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', display: 'grid', gap: 10, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <h3 style={{ margin: 0 }}>{edit.isNew ? 'Add a column' : d.custom ? 'Edit column' : 'Rename column'}</h3>
        <label style={{ display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>Name
          <input autoFocus style={field} value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="e.g. Waste %" />
          {clash && <span style={{ color: 'var(--eg-err)' }}>Another column already has this name.</span>}
        </label>
        {d.custom && <>
          <label style={{ display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>Type
            <select style={field} value={type} onChange={(e) => setType(e.target.value)}>{COLUMN_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          {type === 'formula' && <label style={{ display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>Formula
            <input style={{ ...field, fontFamily: 'ui-monospace, Menlo, monospace' }} value={formula} onChange={(e) => setFormula(e.target.value)} spellCheck={false} />
            <span style={{ color: problem ? 'var(--eg-err)' : 'var(--muted)' }}>{problem || 'Name columns in [brackets]: =[Sub cost]*1.1 · =IF([Performing strategy]="OFCI",0,[Line item total]) · SUM, MIN, MAX, AVERAGE, ROUND, ABS, IF, AND, OR, NOT'}</span>
          </label>}
          {type === 'choice' && <label style={{ display: 'grid', gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>Choices, separated by commas
            <input style={field} value={choices} onChange={(e) => setChoices(e.target.value)} placeholder="Ordered, Delivered, Installed" />
          </label>}
          <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Who sees it — staff on the estimate always do</span>
            <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={showClient} onChange={(e) => setShowClient(e.target.checked)} /> Show to clients</label>
            <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={showSub} onChange={(e) => setShowSub(e.target.checked)} /> Show to subs (on their own lines)</label>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Columns you add don’t change the estimate’s totals — sub cost, markup and the totals keep their own formulas.</div>
        </>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="eg-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="eg-btn is-primary" disabled={!ok} onClick={save}>{edit.isNew ? 'Add column' : 'Save'}</button>
        </div>
      </div>
    </div>
    </div>,
    document.body,
  );
}
