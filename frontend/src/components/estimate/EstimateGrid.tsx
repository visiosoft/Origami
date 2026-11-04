import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { useCsiCodes } from '../CsiSelect';
import { computeEstimate, explainTotal, FORMULAS, money, NOTE_LABEL, type EstSettings, type FormulaId } from '../../data/estimateCalc';
import {
  BANDS, cellText, History, LINE_COLS, lineNumbers, moveLine, newGr, newLine, newScope, parseTsv, pasteBlock, setCell, toTsv,
  type Band, type EstGr, type EstLine, type EstScope, type GridCol, type Sheet,
} from '../../data/estimateGrid';
import './EstimateGrid.css';

export interface EstimateHeader {
  id: string; projectId: number; number: string; rev: number; title?: string | null; status: string; version: number;
  grPct: number; profitPct: number; contingencyPct: number; showGrDetail: boolean; discount?: number | null; showDiscount: boolean;
  designCost?: number | null; showDesignCost: boolean; estimateDate?: string | null; updatedBy?: string | null; sentAt?: string | null;
  payments?: { id: string; label: string; mode: 'pct' | 'amt'; value: number; trigger?: string }[] | null;
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

  const history = useRef(new History<Sheet>());
  const sheetRef = useRef(sheet);
  const versionRef = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<number | null>(null);
  const dirty = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const editable = canEdit && !locked;
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
    api.finance.estimate(projectId, estimateId).then((r: any) => {
      if (!live) return;
      take(r);
      const s = { scopes: r.scopes, lines: r.lines, gr: r.gr };
      sheetRef.current = s; setSheetState(s);
      history.current = new History<Sheet>();
    }).catch((e: any) => toast(e?.message || 'Could not open the estimate.'));
    (api.contractors.list() as Promise<any>).then((l) => live && setContractors(Array.isArray(l) ? l : [])).catch(() => undefined);
    return () => { live = false; };
  }, [projectId, estimateId, take, toast]);

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
        const r = await api.finance.saveEstimateSheet(projectId, estimateId, { version: versionRef.current, ...s });
        take(r);
        setSaveError('');
        setSaveState(dirty.current === mark ? 'saved' : 'pending');
      } catch (e: any) {
        setSaveState('error');
        setSaveError(e?.message || 'Not saved.');
      }
    });
  }, [enqueue, estimateId, projectId, take]);
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
        const r = await api.finance.saveEstimate(projectId, estimateId, { version: versionRef.current, ...patch });
        take(r);
        setSaveState(timer.current ? 'pending' : 'saved');
      } catch (e: any) { setSaveState('error'); setSaveError(e?.message || 'Not saved.'); }
    });
  }, [editable, enqueue, estimateId, projectId, take]);

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { flush: () => (timer.current ? saveSheetNow() : queue.current) };
    return () => { controlRef.current = null; };
  }, [controlRef, saveSheetNow]);

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
  const cols = useMemo(() => LINE_COLS.filter((c) => !hidden.includes(c.band)), [hidden]);
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
    if (col.key === 'subName') {
      const hit = contractors.find((c) => c.companyName?.toLowerCase() === raw.trim().toLowerCase());
      next = { ...next, contractorId: hit ? hit.id : null };
    }
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
    else if (c.key === 'price') { text = out ? money(out.counted ? out.price : 0) : ''; cls += ' is-num is-calc'; if (out && !out.counted) { text = <span title={`Not In Scope — ${money(out.price)} is not counted`}>$0.00</span>; } }
    else if (c.key === 'high') { text = out ? money(out.counted ? out.high : 0) : ''; cls += ' is-num is-calc'; }
    else if (c.key === 'markupAmt') { text = out ? money(out.markup) : ''; cls += ' is-num'; if (l.markupMode === 'pct') cls += ' is-placeholder'; }
    else if (c.key === 'markupPct') { text = out?.markupPct == null ? '' : `${Math.round(out.markupPct * 100) / 100}%`; cls += ' is-num'; if (l.markupMode !== 'pct') cls += ' is-placeholder'; }
    else if (c.kind === 'money') { text = money(Math.round(((l as any)[c.key] || 0) * 100)); cls += ' is-num'; }
    else if (c.kind === 'number') { text = (l as any)[c.key] ?? ''; cls += ' is-num'; }
    else text = cellText(l, c);
    if (!isNote && l.pricing === 'nis' && c.key === 'description') cls += ' is-dim';
    if (isNote && c.key === 'description' && !l.description) { text = 'Type, or leave for a standard statement'; cls += ' is-placeholder'; }
    const isSel = sel?.lineId === l.id && sel.col === ci;
    const sticky = ci === 0 ? ' eg-sticky eg-desc' : '';
    return (
      <td key={c.key} className={`${isSel ? 'is-sel' : ''}${inRange(l.id, ci) && (anchor ? true : false) ? ' is-range' : ''}${sticky}`} style={{ width: c.width, minWidth: c.width, maxWidth: c.width }}
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
      input = <select autoFocus value={(col.options || []).find(([, lbl]) => lbl === editing.value)?.[0] ?? (col.options || []).find(([k]) => k === editing.value)?.[0] ?? ''} onChange={(e) => { const lbl = (col.options || []).find(([k]) => k === e.target.value)?.[1] ?? ''; writeCell(editing.sel.lineId, col, lbl || e.target.value); setEditing(null); window.setTimeout(() => wrapRef.current?.focus(), 0); }} onKeyDown={keyDown} onBlur={() => finishEdit(false)}>
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
    } else {
      input = <input autoFocus type={col.kind === 'date' ? 'date' : 'text'} inputMode={col.kind === 'money' || col.kind === 'pct' || col.kind === 'number' ? 'decimal' : undefined}
        list={col.key === 'subName' ? 'eg-contractors' : undefined} value={editing.value} onChange={(e) => set(e.target.value)} onKeyDown={keyDown} onBlur={() => finishEdit(true)} />;
    }
    return <div className="eg-editor" style={box}>{input}</div>;
  };

  if (!head) return <div style={{ padding: 20, color: 'var(--muted)' }}>Opening the estimate…</div>;
  const t = result.totals;
  const bandSpans = BANDS.map((b) => ({ ...b, n: cols.filter((c) => c.band === b.key).length })).filter((b) => b.n);
  const menuLine = menu?.lineId ? sheet.lines.find((l) => l.id === menu.lineId) : null;

  return (
    <div className="eg" onClick={() => menu && setMenu(null)}>
      <div className="eg-bar">
        <input className="eg-title" aria-label="Estimate title" disabled={!editable} defaultValue={head.title || ''} key={head.id} onBlur={(e) => e.target.value !== (head.title || '') && saveHead({ title: e.target.value })} />
        <span className={`eg-chip is-${head.status}`}>{head.number} · Rev {head.rev} · {head.status}</span>
        <span className={`eg-save${saveState === 'error' ? ' is-error' : ''}`} role="status">
          {saveState === 'saving' ? 'Saving…' : saveState === 'pending' ? 'Unsaved' : saveState === 'error' ? saveError : locked ? 'Frozen' : 'Saved'}
        </span>
        {saveState === 'error' && <button type="button" className="eg-btn" onClick={() => void saveSheetNow()}>Try again</button>}
        <button type="button" className="eg-btn" disabled={!editable || !history.current.canUndo} onClick={undo} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button type="button" className="eg-btn" disabled={!editable || !history.current.canRedo} onClick={redo} title="Redo (Ctrl+Y)">↷ Redo</button>
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
              {bandSpans.map((b) => <th key={b.key} colSpan={b.n} className={`eg-band-${b.key}${b.key === 'prime' ? ' eg-sticky eg-desc' : ''}`}>{b.label}</th>)}
            </tr>
            <tr className="eg-cols">
              <th className="eg-sticky eg-num">#</th>
              {cols.map((c, i) => (
                <th key={c.key} className={`eg-band-${c.band}${i === 0 ? ' eg-sticky eg-desc' : ''}`} style={{ width: c.width, minWidth: c.width, maxWidth: c.width, textAlign: c.kind === 'money' || c.kind === 'calc' || c.kind === 'pct' || c.kind === 'number' ? 'right' : 'left' }}>
                  {c.label}{c.hint && <Info text={c.hint} onTip={setTip} />}
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
              <tr className="eg-add"><td colSpan={cols.length + 1}><div className="eg-add-row"><button type="button" onClick={addScope}>+ New scope</button><span style={{ fontSize: 11.5, color: 'var(--muted)', alignSelf: 'center' }}>Tip: copy rows in Excel and paste them on a cell here.</span></div></td></tr>
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
      {tip && <div className="eg-tip" style={{ left: Math.max(8, tip.x), top: Math.min(tip.y, window.innerHeight - 120) }}>{tip.text}</div>}
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
          <table className="eg-gr" style={{ minWidth: 660 }}>
            <thead><tr><th style={{ width: 40 }}>#</th><th style={{ minWidth: 170 }}>General requirement</th><th style={{ width: 104 }}>In / out</th><th style={{ width: 92, textAlign: 'right' }}>Base</th><th style={{ width: 84 }}>Unit</th><th style={{ width: 56, textAlign: 'right' }}>Qty</th><th style={{ width: 100, textAlign: 'right' }}>Cost<Info text={`${FORMULAS.F9.label} = ${FORMULAS.F9.text}`} onTip={onTip} /></th>{editable && <th style={{ width: 28 }} />}</tr></thead>
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
