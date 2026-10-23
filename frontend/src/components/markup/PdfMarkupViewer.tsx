import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import {
  KIND_LABEL, MARKUP_COLORS, arrowHead, boundsOf, cloudPath, measureLabel, parseLength, scaleFrom,
  type Markup, type MarkupData, type MarkupKind, type Pt,
} from '../../data/markup';
import './PdfMarkupViewer.css';

type Tool = 'select' | 'pan' | Exclude<MarkupKind, never>;
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> };

/**
 * pdf.js is big: loaded the first time someone opens a drawing to mark up. The
 * "legacy" build carries its own polyfills, so older iPads and browsers work too.
 */
let pdfjsOnce: Promise<any> | null = null;
const loadPdfjs = () => (pdfjsOnce ??= Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}));

const TOOLS: { key: Tool; label: string; icon: string; group: 'nav' | 'draw' | 'measure' }[] = [
  { key: 'select', label: 'Select / move', icon: '↖', group: 'nav' },
  { key: 'pan', label: 'Pan (or hold Space)', icon: '✋', group: 'nav' },
  { key: 'pen', label: 'Pen', icon: '✎', group: 'draw' },
  { key: 'highlight', label: 'Highlighter', icon: '▮', group: 'draw' },
  { key: 'text', label: 'Text', icon: 'T', group: 'draw' },
  { key: 'line', label: 'Line', icon: '╱', group: 'draw' },
  { key: 'arrow', label: 'Arrow', icon: '↗', group: 'draw' },
  { key: 'rect', label: 'Box', icon: '▭', group: 'draw' },
  { key: 'ellipse', label: 'Ellipse', icon: '◯', group: 'draw' },
  { key: 'cloud', label: 'Revision cloud', icon: '☁', group: 'draw' },
  { key: 'scale', label: 'Set scale (draw over a known dimension)', icon: '⇔', group: 'measure' },
  { key: 'measure_len', label: 'Measure length', icon: '📏', group: 'measure' },
  { key: 'measure_area', label: 'Measure area (click points, double-click to finish)', icon: '⬠', group: 'measure' },
];
const TWO_POINT: MarkupKind[] = ['line', 'arrow', 'rect', 'ellipse', 'cloud', 'scale', 'measure_len'];

type Ask =
  | { kind: 'text'; at: Pt; value: string }
  | { kind: 'scale'; points: Pt[]; value: string; unit: 'ft' | 'm' }
  | { kind: 'rfi' | 'task'; markup: Markup; value: string };

/**
 * Mark up a PDF in the File Room (Oct 2026). The drawing never changes: each
 * person's markups are a layer over it, saved one by one as they're drawn.
 * Team-visible by default; "Private draft" keeps new ones to yourself.
 */
export function PdfMarkupViewer({ file, projectId, projectName, focusMarkupId, onClose, onSavedCopy }: {
  file: { id: string; name: string; isLatest?: boolean };
  projectId?: number | null;
  projectName?: string | null;
  focusMarkupId?: string | null;
  onClose: () => void;
  onSavedCopy?: () => void;
}) {
  const { toast, currentUser, authUser } = useApp();
  const navigate = useNavigate();
  const me = authUser?.id || currentUser?.id || '';
  const isAdmin = authUser?.roleKey === 'admin';
  const canDraw = (authUser?.tier || currentUser?.tier) !== 'client';

  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [fitScale, setFitScale] = useState(1);
  const scale = zoom === 'fit' ? fitScale : zoom;

  const [marks, setMarks] = useState<Markup[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tool, setTool] = useState<Tool>(canDraw ? 'pen' : 'select');
  const [color, setColor] = useState(MARKUP_COLORS[0]);
  const [width, setWidth] = useState(2);
  const [privateDraft, setPrivateDraft] = useState(false);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusMarkupId || null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [listAll, setListAll] = useState(false);
  // The list starts open on a desk, closed on a phone (it would cover the drawing).
  const [panel, setPanel] = useState(() => window.innerWidth > 720);
  const undo = useRef<{ type: 'add' | 'remove' | 'edit'; before?: Markup; after?: Markup }[]>([]);
  const redo = useRef<typeof undo.current>([]);

  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; from: Pt; orig: Pt[] } | null>(null);
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  // ---------------------------------------------------------------- load
  useEffect(() => {
    let live = true;
    let loading: { destroy: () => Promise<void> } | null = null;
    Promise.all([loadPdfjs(), api.fileRoom.bytes(file.id), api.fileRoom.markups(file.id)])
      .then(async ([lib, bytes, list]) => {
        const task = lib.getDocument({ data: new Uint8Array(bytes) });
        loading = task;
        const d = await task.promise;
        if (!live) return;
        setDoc(d);
        setMarks(list);
        const focus = focusMarkupId ? list.find((m) => m.id === focusMarkupId) : null;
        if (focus) setPageNo(focus.page);
      })
      .catch((e: Error) => { if (live) setError(e.message || 'Couldn’t open this PDF.'); });
    return () => { live = false; void loading?.destroy().catch(() => undefined); };
  }, [file.id, focusMarkupId]);

  // ---------------------------------------------------------------- render the page
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      if (cancelled) return;
      setSize({ w: base.width, h: base.height });
      const box = scroller.current?.getBoundingClientRect();
      const fit = box ? Math.max(0.1, Math.min((box.width - 32) / base.width, (box.height - 32) / base.height)) : 1;
      setFitScale(fit);
      const s = zoom === 'fit' ? fit : zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: s * dpr });
      const c = canvas.current;
      if (!c) return;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      c.style.width = `${Math.floor(base.width * s)}px`;
      c.style.height = `${Math.floor(base.height * s)}px`;
      task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp });
      await task!.promise.catch(() => undefined);
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, pageNo, zoom]);

  // ---------------------------------------------------------------- helpers
  const authors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const m of marks) {
      const id = m.authorId || m.authorName;
      const a = map.get(id) || { id, name: m.authorName, count: 0 };
      a.count++;
      map.set(id, a);
    }
    return [...map.values()];
  }, [marks]);
  const shownMarks = marks.filter((m) => !hidden.has(m.authorId || m.authorName));
  const onPage = shownMarks.filter((m) => m.page === pageNo);
  const pageScale = useMemo(() => {
    const s = marks.filter((m) => m.page === pageNo && m.kind === 'scale').pop();
    return s && size ? scaleFrom(s, size.w, size.h) : null;
  }, [marks, pageNo, size]);
  const selected = marks.find((m) => m.id === selectedId) || null;
  const mine = (m: Markup) => isAdmin || (!!me && m.authorId === me);

  /** A pointer event as a page-relative point. */
  const at = (e: { clientX: number; clientY: number }): Pt => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const save = useCallback(async (kind: MarkupKind, data: MarkupData, page = pageNo) => {
    try {
      const m = await api.fileRoom.addMarkup(file.id, { kind, page, data, private: privateDraft });
      setMarks((prev) => [...prev, m]);
      undo.current.push({ type: 'add', after: m });
      redo.current = [];
      return m;
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Markup not saved')); return null; }
  }, [file.id, pageNo, privateDraft, toast]);

  const replace = (m: Markup) => setMarks((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  const editMarkup = async (m: Markup, patch: Partial<Pick<Markup, 'data' | 'private'>>, record = true) => {
    try {
      const saved = await api.fileRoom.editMarkup(m.id, patch);
      replace(saved);
      if (record) { undo.current.push({ type: 'edit', before: m, after: saved }); redo.current = []; }
      return saved;
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); replace(m); return null; }
  };
  const removeMarkup = async (m: Markup, record = true) => {
    try {
      await api.fileRoom.removeMarkup(m.id);
      setMarks((prev) => prev.filter((x) => x.id !== m.id));
      if (selectedId === m.id) setSelectedId(null);
      if (record) { undo.current.push({ type: 'remove', before: m }); redo.current = []; }
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not deleted')); }
  };

  /** Undo / redo this session's own changes (adds come back as new markups). */
  const step = async (back: boolean) => {
    const from = back ? undo.current : redo.current;
    const to = back ? redo.current : undo.current;
    const a = from.pop();
    if (!a) return;
    if ((a.type === 'add') === back) {
      const m = (a.after || a.before)!;
      await removeMarkup(marks.find((x) => x.id === m.id) || m, false);
      to.push(a);
    } else if (a.type === 'add' || a.type === 'remove') {
      const m = (a.after || a.before)!;
      const again = await api.fileRoom.addMarkup(file.id, { kind: m.kind, page: m.page, data: m.data, private: m.private }).catch(() => null);
      if (again) { setMarks((prev) => [...prev, again]); to.push(a.type === 'add' ? { type: 'add', after: again } : { type: 'remove', before: again }); }
    } else {
      const target = back ? a.before! : a.after!;
      const cur = marks.find((x) => x.id === target.id);
      if (cur) await editMarkup(cur, { data: target.data, private: target.private }, false);
      to.push(a);
    }
  };

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select');
      if (typing) return;
      if (e.key === ' ') { setSpaceDown(true); e.preventDefault(); }
      if (e.key === 'Escape') { if (draft) setDraft(null); else if (ask) setAsk(null); else onClose(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && mine(selected)) { e.preventDefault(); void removeMarkup(selected); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); void step(!e.shiftKey); }
      if (e.key === 'Enter' && draft && tool === 'measure_area') finishArea();
      if (e.key === 'PageDown' || e.key === 'ArrowRight') setPageNo((p) => Math.min(doc?.numPages || 1, p + 1));
      if (e.key === 'PageUp' || e.key === 'ArrowLeft') setPageNo((p) => Math.max(1, p - 1));
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ') setSpaceDown(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  // ---------------------------------------------------------------- drawing
  const hit = (p: Pt): Markup | null => {
    if (!size) return null;
    const tol = 8 / (size.w * scale);
    for (const m of [...onPage].reverse()) {
      const b = boundsOf(m, 120 / size.w, 16 / size.h);
      if (p[0] >= b.x0 - tol && p[0] <= b.x1 + tol && p[1] >= b.y0 - tol && p[1] <= b.y1 + tol) return m;
    }
    return null;
  };

  const finishArea = () => {
    if (!draft || draft.length < 3 || !size) { setDraft(null); return; }
    if (!pageScale) { toast('Set the scale on this page first (⇔), then measure.'); setDraft(null); return; }
    void save('measure_area', { points: draft, color, width, label: measureLabel('measure_area', draft, size.w, size.h, pageScale) });
    setDraft(null);
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = at(e);
    if (tool === 'pan' || spaceDown) {
      const s = scroller.current!;
      pan.current = { x: e.clientX, y: e.clientY, sl: s.scrollLeft, st: s.scrollTop };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === 'select') {
      const m = hit(p);
      setSelectedId(m?.id || null);
      if (m && mine(m)) { drag.current = { id: m.id, from: p, orig: m.data.points }; (e.target as Element).setPointerCapture?.(e.pointerId); }
      return;
    }
    if (!canDraw) return;
    if (tool === 'text') { setAsk({ kind: 'text', at: p, value: '' }); return; }
    if (tool === 'measure_area') { setDraft((d) => [...(d || []), p]); return; }
    if ((tool === 'measure_len') && !pageScale) { toast('Set the scale on this page first (⇔): draw over a dimension you know.'); return; }
    setDraft([p, p]);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (pan.current) {
      const s = scroller.current!;
      s.scrollLeft = pan.current.sl - (e.clientX - pan.current.x);
      s.scrollTop = pan.current.st - (e.clientY - pan.current.y);
      return;
    }
    const p = at(e);
    if (drag.current) {
      const d = drag.current;
      const dx = p[0] - d.from[0], dy = p[1] - d.from[1];
      setMarks((prev) => prev.map((m) => (m.id === d.id ? { ...m, data: { ...m.data, points: d.orig.map(([x, y]) => [x + dx, y + dy] as Pt) } } : m)));
      return;
    }
    if (!draft || tool === 'measure_area') return;
    if (tool === 'pen' || tool === 'highlight') {
      const last = draft[draft.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.0015) setDraft([...draft, p]);
    } else setDraft([draft[0], p]);
  };

  const onUp = () => {
    if (pan.current) { pan.current = null; return; }
    if (drag.current) {
      const d = drag.current;
      drag.current = null;
      const m = marks.find((x) => x.id === d.id);
      const before = m && { ...m, data: { ...m.data, points: d.orig } };
      if (m && before && m.data.points.some((pt, i) => pt[0] !== d.orig[i][0] || pt[1] !== d.orig[i][1])) void editMarkup(before, { data: m.data });
      return;
    }
    if (!draft || tool === 'measure_area' || !size) return;
    const pts = draft;
    setDraft(null);
    const kind = tool as MarkupKind;
    if (TWO_POINT.includes(kind) && Math.hypot((pts[1][0] - pts[0][0]) * size.w, (pts[1][1] - pts[0][1]) * size.h) < 4) return;
    if (kind === 'scale') { setAsk({ kind: 'scale', points: pts, value: '', unit: pageScale?.unit || 'ft' }); return; }
    const data: MarkupData = { points: pts, color: kind === 'highlight' && color === MARKUP_COLORS[0] ? '#FACC15' : color, width: kind === 'highlight' ? Math.max(8, width * 5) : width };
    if (kind === 'measure_len' && pageScale) data.label = measureLabel('measure_len', pts, size.w, size.h, pageScale);
    void save(kind, data);
  };

  // ---------------------------------------------------------------- asks
  const answer = async () => {
    if (!ask || !size) return;
    if (ask.kind === 'text') {
      if (ask.value.trim()) await save('text', { points: [ask.at], color, width: 1, text: ask.value.trim(), size: 12 });
    } else if (ask.kind === 'scale') {
      const real = parseLength(ask.value, ask.unit);
      if (!real) { toast(ask.unit === 'ft' ? 'Type a length like 12\'-6" or 12.5' : 'Type a length like 3.81'); return; }
      await save('scale', { points: ask.points, color: '#7C3AED', width: 1.5, real, unit: ask.unit });
      toast('Scale set for this page — measure away');
    } else {
      const m = ask.markup;
      const subject = ask.value.trim() || `${KIND_LABEL[m.kind]} on ${file.name}, p. ${m.page}`;
      const link = `/planroom?file=${encodeURIComponent(file.id)}&markup=${encodeURIComponent(m.id)}`;
      setBusy(true);
      try {
        if (ask.kind === 'rfi') {
          if (!projectId) throw new Error('This file isn’t in a project.');
          const rfi = await api.rfis.create({
            projectId, subject, question: m.data.text || '',
            drawingRef: `${file.name}, p. ${m.page}`,
            drawings: [{ fileId: file.id, name: file.name, markupId: m.id, page: m.page }],
          });
          replace(await api.fileRoom.editMarkup(m.id, { linkType: 'rfi', linkId: rfi.id }));
          toast(`RFI ${rfi.number ? '#' + rfi.number + ' ' : ''}drafted — opening it`);
          navigate(`/rfis?rfi=${encodeURIComponent(rfi.id)}`);
        } else {
          const t: any = await api.tasks.create({
            subject, project: projectName || '',
            description: `${m.data.text ? m.data.text + '\n\n' : ''}From a markup on ${file.name}, page ${m.page}: ${window.location.origin}${link}`,
          });
          replace(await api.fileRoom.editMarkup(m.id, { linkType: 'task', linkId: t.id }));
          toast('Task created — opening it');
          navigate(`/tasks?task=${encodeURIComponent(t.id)}&type=log`);
        }
        onClose();
      } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not created')); }
      finally { setBusy(false); }
    }
    setAsk(null);
  };

  // ---------------------------------------------------------------- exports
  const visibleAuthorIds = authors.filter((a) => !hidden.has(a.id)).map((a) => a.id);
  const download = async () => {
    setBusy(true);
    try {
      const bytes = await api.fileRoom.markedUpPdf(file.id, hidden.size ? visibleAuthorIds : undefined);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = file.name.replace(/\.pdf$/i, '') + ' (marked up).pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Download failed')); }
    finally { setBusy(false); }
  };
  const saveCopy = async () => {
    setBusy(true);
    try {
      const f = await api.fileRoom.saveMarkedUpCopy(file.id, hidden.size ? visibleAuthorIds : undefined);
      toast(`Saved “${f.name}” beside the drawing`);
      onSavedCopy?.();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };

  // ---------------------------------------------------------------- drawing a markup
  const render = (m: { kind: MarkupKind; data: MarkupData; id?: string }, ghost = false) => {
    if (!size) return null;
    const P = (p: Pt): Pt => [p[0] * size.w, p[1] * size.h];
    const pts = m.data.points.map(P);
    const stroke = m.data.color;
    const sw = m.data.width;
    const common = { fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, opacity: ghost ? 0.7 : 1 };
    const poly = (list: Pt[]) => list.map((p) => p.join(',')).join(' ');
    const tag = (text: string, p: Pt, color = stroke) => (
      <text x={p[0] + 4} y={p[1] - 4} fontSize={11} fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke" fontFamily="Helvetica, Arial, sans-serif">{text}</text>
    );
    switch (m.kind) {
      case 'pen': return <polyline points={poly(pts)} {...common} />;
      case 'highlight': return <polyline points={poly(pts)} {...common} opacity={0.35} strokeLinecap="butt" />;
      case 'line': return <line x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} {...common} />;
      case 'arrow': {
        const [l, r] = arrowHead(pts[0], pts[1], Math.max(8, sw * 4));
        return <g {...common}><line x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} /><polyline points={poly([l, pts[1], r])} /></g>;
      }
      case 'rect': return <rect x={Math.min(pts[0][0], pts[1][0])} y={Math.min(pts[0][1], pts[1][1])} width={Math.abs(pts[1][0] - pts[0][0])} height={Math.abs(pts[1][1] - pts[0][1])} {...common} />;
      case 'ellipse': return <ellipse cx={(pts[0][0] + pts[1][0]) / 2} cy={(pts[0][1] + pts[1][1]) / 2} rx={Math.abs(pts[1][0] - pts[0][0]) / 2} ry={Math.abs(pts[1][1] - pts[0][1]) / 2} {...common} />;
      case 'cloud': return <path d={cloudPath(pts[0], pts[1], Math.max(10, Math.min(size.w, size.h) / 60))} {...common} />;
      case 'scale': case 'measure_len': {
        const mid: Pt = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
        const text = m.kind === 'scale' ? (m.data.real ? `Scale: ${m.data.real} ${m.data.unit}` : 'Scale') : m.data.label || '';
        return <g><line x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} {...common} strokeDasharray={m.kind === 'scale' ? '6 4' : undefined} />{pts.slice(0, 2).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={stroke} />)}{text && tag(text, mid)}</g>;
      }
      case 'measure_area': {
        const c: Pt = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
        return <g><polygon points={poly(pts)} {...common} fill={stroke} fillOpacity={0.12} />{m.data.label && tag(m.data.label, c)}</g>;
      }
      case 'text': {
        const fs = m.data.size || 12;
        return <text x={pts[0][0]} y={pts[0][1] + fs} fontSize={fs} fill={stroke} fontFamily="Helvetica, Arial, sans-serif" style={{ whiteSpace: 'pre' }}>
          {(m.data.text || '').split('\n').map((line, i) => <tspan key={i} x={pts[0][0]} dy={i ? fs * 1.2 : 0}>{line}</tspan>)}
        </text>;
      }
    }
    return null;
  };

  const draftShape = draft && size ? (() => {
    if (tool === 'measure_area') return <polyline points={draft.map((p) => [p[0] * size.w, p[1] * size.h].join(',')).join(' ')} fill="none" stroke={color} strokeWidth={width} strokeDasharray="5 4" />;
    const kind = tool as MarkupKind;
    const data: MarkupData = { points: draft, color: kind === 'highlight' && color === MARKUP_COLORS[0] ? '#FACC15' : color, width: kind === 'highlight' ? Math.max(8, width * 5) : width };
    if (kind === 'measure_len' && pageScale) data.label = measureLabel('measure_len', draft, size.w, size.h, pageScale);
    return render({ kind, data }, true);
  })() : null;

  const selBox = selected && selected.page === pageNo && size ? boundsOf(selected, 120 / size.w, 16 / size.h) : null;
  const cursor = tool === 'pan' || spaceDown ? (pan.current ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
  const pages = doc?.numPages || 0;
  const listed = (listAll ? shownMarks : onPage).slice().sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));

  return createPortal(
    <div className="mk-shell" role="dialog" aria-label={`Mark up ${file.name}`}>
      <header className="mk-top">
        <button type="button" className="mk-btn" onClick={onClose} aria-label="Close">✕</button>
        <div className="mk-title" title={file.name}>{file.name}{file.isLatest === false && <span className="mk-old">older revision — these markups belong to it</span>}</div>
        <div className="mk-pages">
          <button type="button" className="mk-btn" disabled={pageNo <= 1} onClick={() => setPageNo(pageNo - 1)} aria-label="Previous page">‹</button>
          <span>Page <input aria-label="Page" value={pageNo} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= pages) setPageNo(n); }} /> of {pages || '…'}</span>
          <button type="button" className="mk-btn" disabled={pageNo >= pages} onClick={() => setPageNo(pageNo + 1)} aria-label="Next page">›</button>
        </div>
        <div className="mk-zoom">
          <button type="button" className="mk-btn" onClick={() => setZoom(Math.max(0.1, scale / 1.25))} aria-label="Zoom out">−</button>
          <button type="button" className="mk-btn is-text" onClick={() => setZoom('fit')}>{zoom === 'fit' ? 'Fit' : `${Math.round(scale * 100)}%`}</button>
          <button type="button" className="mk-btn" onClick={() => setZoom(Math.min(8, scale * 1.25))} aria-label="Zoom in">+</button>
        </div>
        <span className="mk-spacer" />
        <button type="button" className="mk-btn is-text" disabled={busy || !marks.length} onClick={download} title="The PDF with the layers you’re showing drawn in">Download marked-up PDF</button>
        {canDraw && <button type="button" className="mk-btn is-text is-dark" disabled={busy || !marks.length} onClick={saveCopy} title="Keeps a marked-up copy beside the drawing; the drawing stays Current">Save marked-up copy</button>}
        <button type="button" className="mk-btn" onClick={() => setPanel(!panel)} aria-label="Markup list" aria-pressed={panel}>☰</button>
      </header>

      <div className="mk-body">
        <nav className="mk-tools" aria-label="Markup tools">
          {TOOLS.filter((t) => canDraw || t.group === 'nav').map((t, i, arr) => (
            <span key={t.key} style={{ display: 'contents' }}>
              {i > 0 && arr[i - 1].group !== t.group && <i className="mk-sep" />}
              <button type="button" className={'mk-tool' + (tool === t.key ? ' is-on' : '')} title={t.label} aria-label={t.label} aria-pressed={tool === t.key}
                onClick={() => { setTool(t.key); setDraft(null); }}>{t.icon}</button>
            </span>
          ))}
          {canDraw && <>
            <i className="mk-sep" />
            {MARKUP_COLORS.map((c) => <button key={c} type="button" className={'mk-swatch' + (color === c ? ' is-on' : '')} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => setColor(c)} />)}
            <i className="mk-sep" />
            <select aria-label="Thickness (points)" title="Thickness (points)" value={width} onChange={(e) => setWidth(Number(e.target.value))}>
              {[1, 2, 3, 5, 8].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <label className="mk-private" title="Only you see markups drawn while this is on, until you share them">
              <input type="checkbox" checked={privateDraft} onChange={(e) => setPrivateDraft(e.target.checked)} /> Private
            </label>
            <i className="mk-sep" />
            <button type="button" className="mk-tool" title="Undo (Ctrl+Z)" aria-label="Undo" onClick={() => void step(true)}>↶</button>
            <button type="button" className="mk-tool" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onClick={() => void step(false)}>↷</button>
          </>}
          {pageScale && <span className="mk-scale" title="This page’s scale">⇔ set</span>}
        </nav>

        <div className="mk-stage" ref={scroller}
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(Math.min(8, Math.max(0.1, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))); } }}>
          {error && <div className="mk-msg">{error}</div>}
          {!doc && !error && <div className="mk-msg">Opening the drawing…</div>}
          <div className="mk-page" style={{ width: size ? size.w * scale : undefined, height: size ? size.h * scale : undefined, display: doc ? 'block' : 'none' }}>
            <canvas ref={canvas} />
            {size && (
              <svg ref={svg} viewBox={`0 0 ${size.w} ${size.h}`} style={{ cursor, touchAction: 'none' }} aria-label="Markup layer"
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                onDoubleClick={() => { if (tool === 'measure_area') finishArea(); }}>
                {onPage.map((m) => <g key={m.id} data-markup={m.id} opacity={m.private ? 0.75 : 1}>{render(m)}</g>)}
                {draftShape}
                {selBox && <rect x={selBox.x0 * size.w - 4} y={selBox.y0 * size.h - 4} width={(selBox.x1 - selBox.x0) * size.w + 8} height={(selBox.y1 - selBox.y0) * size.h + 8} fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="4 3" />}
              </svg>
            )}
          </div>
        </div>

        {panel && (
          <aside className="mk-side" aria-label="Markups">
            <button type="button" className="mk-btn mk-side-close" onClick={() => setPanel(false)} aria-label="Close the list">✕</button>
            <section>
              <h4>Layers</h4>
              {!authors.length && <p className="mk-muted">No markups yet{canDraw ? ' — pick a tool and draw.' : '.'}</p>}
              {authors.map((a) => (
                <label key={a.id} className="mk-layer">
                  <input type="checkbox" checked={!hidden.has(a.id)} onChange={() => { const n = new Set(hidden); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); setHidden(n); }} />
                  <span>{a.id === me ? `${a.name} (you)` : a.name}</span><small>{a.count}</small>
                </label>
              ))}
            </section>

            {selected && (
              <section className="mk-selected">
                <h4>{KIND_LABEL[selected.kind]} · p. {selected.page}</h4>
                <p className="mk-muted">{selected.authorName} · {new Date(selected.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{selected.private ? ' · private draft' : ''}</p>
                {selected.data.text && <p className="mk-quote">{selected.data.text}</p>}
                {selected.data.label && <p className="mk-quote">{selected.data.label}</p>}
                {selected.linkType && <p><a href={selected.linkType === 'rfi' ? `/rfis?rfi=${encodeURIComponent(selected.linkId || '')}` : `/tasks?task=${encodeURIComponent(selected.linkId || '')}&type=log`}>Open the {selected.linkType === 'rfi' ? 'RFI' : 'task'} made from it →</a></p>}
                <div className="mk-actions">
                  {canDraw && !selected.linkType && selected.kind !== 'scale' && <>
                    <button type="button" className="mk-btn is-text" disabled={busy || !projectId} title={projectId ? '' : 'Only for files in a project'} onClick={() => setAsk({ kind: 'rfi', markup: selected, value: selected.data.text ? selected.data.text.split('\n')[0].slice(0, 120) : '' })}>Create RFI</button>
                    <button type="button" className="mk-btn is-text" disabled={busy} onClick={() => setAsk({ kind: 'task', markup: selected, value: selected.data.text ? selected.data.text.split('\n')[0].slice(0, 120) : '' })}>Create task</button>
                  </>}
                  {mine(selected) && <>
                    {selected.kind === 'text' && <button type="button" className="mk-btn is-text" onClick={() => { const t = window.prompt('Edit the text', selected.data.text || ''); if (t !== null && t.trim()) void editMarkup(selected, { data: { ...selected.data, text: t.trim() } }); }}>Edit text</button>}
                    <button type="button" className="mk-btn is-text" onClick={() => void editMarkup(selected, { private: !selected.private })}>{selected.private ? 'Share with the team' : 'Make private'}</button>
                    <button type="button" className="mk-btn is-text is-danger" onClick={() => void removeMarkup(selected)}>Delete</button>
                  </>}
                </div>
              </section>
            )}

            <section>
              <h4>
                Markups
                <span className="mk-seg">
                  <button type="button" className={listAll ? '' : 'is-on'} onClick={() => setListAll(false)}>This page</button>
                  <button type="button" className={listAll ? 'is-on' : ''} onClick={() => setListAll(true)}>All</button>
                </span>
              </h4>
              {!listed.length && <p className="mk-muted">None {listAll ? 'shown' : 'on this page'}.</p>}
              <ul className="mk-list">
                {listed.map((m) => (
                  <li key={m.id} className={m.id === selectedId ? 'is-on' : ''} onClick={() => { setSelectedId(m.id); setPageNo(m.page); setTool('select'); }}>
                    <i style={{ background: m.data.color }} />
                    <span><b>{KIND_LABEL[m.kind]}</b>{m.data.text ? ` — ${m.data.text.split('\n')[0]}` : m.data.label ? ` — ${m.data.label}` : ''}<small>{m.authorName}{listAll ? ` · p. ${m.page}` : ''}{m.private ? ' · private' : ''}{m.linkType ? ` · ${m.linkType === 'rfi' ? 'RFI' : 'task'}` : ''}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>

      {ask && (
        <div className="mk-ask-bg" onClick={() => setAsk(null)}>
          <form className="mk-ask" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void answer(); }}>
            <h4>{ask.kind === 'text' ? 'Add text' : ask.kind === 'scale' ? 'How long is the line you drew?' : ask.kind === 'rfi' ? 'Create an RFI from this markup' : 'Create a task from this markup'}</h4>
            {ask.kind === 'text' && <textarea autoFocus rows={3} value={ask.value} onChange={(e) => setAsk({ ...ask, value: e.target.value })} placeholder="e.g. Verify beam size with structural" />}
            {ask.kind === 'scale' && <>
              <p className="mk-muted">Draw over a dimension you know (a dimension string or a scale bar), then type its real length. Every length and area on this page measures from it.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input autoFocus value={ask.value} onChange={(e) => setAsk({ ...ask, value: e.target.value })} placeholder={ask.unit === 'ft' ? `12'-6"` : '3.81'} aria-label="Real length" />
                <select value={ask.unit} onChange={(e) => setAsk({ ...ask, unit: e.target.value as 'ft' | 'm' })} aria-label="Unit"><option value="ft">feet / inches</option><option value="m">metres</option></select>
              </div>
            </>}
            {(ask.kind === 'rfi' || ask.kind === 'task') && <>
              <input autoFocus value={ask.value} onChange={(e) => setAsk({ ...ask, value: e.target.value })} placeholder={ask.kind === 'rfi' ? 'RFI subject' : 'Task subject'} aria-label="Subject" />
              <p className="mk-muted">{ask.kind === 'rfi' ? 'A draft RFI is made with this drawing and page linked; finish it in the RFI log.' : 'A Request Log task is made with a link back to this spot on the drawing.'}</p>
            </>}
            <div className="mk-ask-row">
              <button type="button" className="mk-btn is-text" onClick={() => setAsk(null)}>Cancel</button>
              <button type="submit" className="mk-btn is-text is-dark" disabled={busy}>{ask.kind === 'text' ? 'Add' : ask.kind === 'scale' ? 'Set scale' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>,
    document.body,
  );
}
