import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import {
  KIND_LABEL, MARKUP_COLORS, TEXT_SIZES, arrowHead, capRenderScale, nextSize, textMatches, boundsOf, cloudPath, layerKey, layersOf, measureLabel, parseLength, scaleFrom,
  linkLabel, overlayPixels, pickCompareDefault, type CompareShow, type LinkTarget, type Revision, type Markup, type MarkupData, type MarkupKind, type Pt, type TextRun,
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
  { key: 'pin', label: 'Pin — a note and site photos on a spot', icon: '📌', group: 'draw' },
  { key: 'link', label: 'Link — a box that goes to another page or file', icon: '🔗', group: 'draw' },
  { key: 'line', label: 'Line', icon: '╱', group: 'draw' },
  { key: 'arrow', label: 'Arrow', icon: '↗', group: 'draw' },
  { key: 'rect', label: 'Box', icon: '▭', group: 'draw' },
  { key: 'ellipse', label: 'Ellipse', icon: '◯', group: 'draw' },
  { key: 'cloud', label: 'Revision cloud', icon: '☁', group: 'draw' },
  { key: 'scale', label: 'Set scale (draw over a known dimension)', icon: '⇔', group: 'measure' },
  { key: 'measure_len', label: 'Measure length', icon: '📏', group: 'measure' },
  { key: 'measure_area', label: 'Measure area (click points, double-click to finish)', icon: '⬠', group: 'measure' },
];
const TWO_POINT: MarkupKind[] = ['line', 'arrow', 'rect', 'ellipse', 'cloud', 'scale', 'measure_len', 'link'];

export interface LinkableFile { id: string; name: string; mimeType?: string; folderPath?: string[] }
const isPdfFile = (f: { name: string; mimeType?: string }) => /\.pdf$/i.test(f.name) || f.mimeType === 'application/pdf';

type Hit = { page: number; box: { x0: number; y0: number; x1: number; y1: number }; context: string; markupId?: string };

type Ask =
  | { kind: 'text'; at: Pt; value: string }
  | { kind: 'pin'; at: Pt; value: string }
  | { kind: 'link'; points: Pt[]; to: 'page' | 'file'; page: string; fileId: string; filePage: string; value: string }
  | { kind: 'scale'; points: Pt[]; value: string; unit: 'ft' | 'm' }
  | { kind: 'rfi' | 'task'; markup: Markup; value: string };

/**
 * Mark up a PDF in the File Room (Oct 2026). The drawing never changes: each
 * person's markups are a layer over it, saved one by one as they're drawn.
 * Team-visible by default; "Private draft" keeps new ones to yourself.
 */
export function PdfMarkupViewer({ file, projectId, projectName, focusMarkupId, initialPage, projectFiles, onOpenFile, back, onClose, onSavedCopy, onUploaded, revisions }: {
  file: { id: string; name: string; isLatest?: boolean; folderPath?: string[] };
  projectId?: number | null;
  projectName?: string | null;
  focusMarkupId?: string | null;
  /** Open on this page (a link from another drawing). */
  initialPage?: number | null;
  /** The project's other files, for links. */
  projectFiles?: LinkableFile[];
  /** Follow a link to another PDF in the File Room. */
  onOpenFile?: (fileId: string, page?: number, fromPage?: number) => void;
  /** "← Back to A-201" after following a link here from another drawing. */
  back?: { label: string; go: () => void } | null;
  onClose: () => void;
  onSavedCopy?: () => void;
  onUploaded?: () => void;
  /** Every revision of this drawing (this one included), for comparing. */
  revisions?: Revision[];
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
  /** The named layer new markups go on ('' = your own layer). */
  const [layer, setLayer] = useState('');
  const [photoView, setPhotoView] = useState<{ url: string; name: string } | null>(null);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusMarkupId || null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [textSize, setTextSize] = useState<number>(() => { try { return Number(localStorage.getItem('origami.markup.textSize')) || 12; } catch { return 12; } });
  const pickTextSize = (n: number) => { setTextSize(n); try { localStorage.setItem('origami.markup.textSize', String(n)); } catch { /* private window */ } };
  // Searching the drawing's own text (and the markups' notes).
  const [search, setSearch] = useState<{ q: string; hits: Hit[]; at: number; busy: boolean; noText: boolean } | null>(null);
  const pageText = useRef(new Map<number, TextRun[]>());
  /** Files uploaded from the link dialog, until the File Room list catches up. */
  const extraFiles = useRef<LinkableFile[]>([]);
  const extraFilesList = () => extraFiles.current;
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
        else if (initialPage && initialPage >= 1 && initialPage <= d.numPages) setPageNo(initialPage);
      })
      .catch((e: Error) => { if (live) setError(e.message || 'Couldn’t open this PDF.'); });
    return () => { live = false; void loading?.destroy().catch(() => undefined); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, focusMarkupId]);

  // ---------------------------------------------------------------- comparing revisions
  type Compare = { rev: Revision; doc: PdfDoc | null; show: CompareShow; dx: number; dy: number; error?: string };
  const [compare, setCompare] = useState<Compare | null>(null);
  const [comparePick, setComparePick] = useState(false);
  const [compareMissing, setCompareMissing] = useState(false);
  const otherRevisions = (revisions || []).filter((r) => r.id !== file.id);
  const thisRev = (revisions || []).find((r) => r.id === file.id);
  /** The other revision is the older one when it was uploaded first. */
  const otherIsOlder = !!compare && (compare.rev.updatedAt || '') <= (thisRev?.updatedAt || '');
  const revLabel = (r?: Revision) => (r?.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'this revision') + (r?.isLatest ? ' (current)' : '');
  const startCompare = (rev: Revision) => {
    setComparePick(false);
    setCompare({ rev, doc: null, show: 'both', dx: 0, dy: 0 });
    Promise.all([loadPdfjs(), api.fileRoom.bytes(rev.id)])
      .then(([lib, bytes]) => lib.getDocument({ data: new Uint8Array(bytes) }).promise)
      .then((d: PdfDoc) => setCompare((c) => (c && c.rev.id === rev.id ? { ...c, doc: d } : c)))
      .catch((e: Error) => { toast('⚠ ' + (e.message || 'Couldn’t open that revision')); setCompare(null); });
  };

  // ---------------------------------------------------------------- render the page
  // The last few pages drawn, kept as canvases so flipping back is instant.
  const rendered = useRef(new Map<string, HTMLCanvasElement>());
  const lastPage = useRef(0);
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    // A new page draws at once; zooming waits for the zooming to stop (the page just stretches meanwhile).
    const wait = lastPage.current === pageNo ? 150 : 0;
    lastPage.current = pageNo;
    const timer = window.setTimeout(async () => {
      const page = await doc.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      if (cancelled) return;
      setSize({ w: base.width, h: base.height });
      const box = scroller.current?.getBoundingClientRect();
      const fit = box ? Math.max(0.1, Math.min((box.width - 32) / base.width, (box.height - 32) / base.height)) : 1;
      setFitScale(fit);
      const s = zoom === 'fit' ? fit : zoom;
      const rs = capRenderScale(base.width, base.height, s, Math.min(window.devicePixelRatio || 1, 2));
      const c = canvas.current;
      if (!c) return;
      const key = `${file.id}:${pageNo}@${rs.toFixed(4)}`;
      const show = (src: HTMLCanvasElement) => {
        c.width = src.width; c.height = src.height;
        c.getContext('2d')!.drawImage(src, 0, 0);
      };
      /** A page rendered to a canvas of exactly w x h pixels (cached). */
      const renderTo = async (pg: any, k: string, w: number, h: number) => {
        const hit = rendered.current.get(k);
        if (hit) return hit;
        const b = pg.getViewport({ scale: 1 });
        const vp = pg.getViewport({ scale: Math.min(w / b.width, h / b.height) });
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const ctx = off.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        task = pg.render({ canvasContext: ctx, viewport: vp });
        const ok = await task!.promise.then(() => true, () => false);
        if (!ok || cancelled) return null;
        rendered.current.set(k, off);
        while (rendered.current.size > 6) rendered.current.delete(rendered.current.keys().next().value!);
        return off;
      };
      const vp = page.getViewport({ scale: rs });
      const W = Math.floor(vp.width), H = Math.floor(vp.height);
      const ours = await renderTo(page, key, W, H);
      if (!ours || cancelled) return;
      const cdoc = compare?.doc;
      if (!compare || !cdoc) { setCompareMissing(false); show(ours); }
      else if (pageNo > cdoc.numPages) { setCompareMissing(true); show(ours); }
      else {
        setCompareMissing(false);
        const theirs = await renderTo(await cdoc.getPage(pageNo), `${compare.rev.id}:${pageNo}@${W}x${H}`, W, H);
        if (!theirs || cancelled) return;
        // Nudge (page points) moves the other revision to line up a scan.
        const shifted = document.createElement('canvas');
        shifted.width = W; shifted.height = H;
        const sc = shifted.getContext('2d')!;
        sc.fillStyle = '#fff'; sc.fillRect(0, 0, W, H);
        sc.drawImage(theirs, compare.dx * rs, compare.dy * rs);
        const a = ours.getContext('2d')!.getImageData(0, 0, W, H).data;
        const bpx = sc.getImageData(0, 0, W, H).data;
        c.width = W; c.height = H;
        const cc = c.getContext('2d')!;
        const out = cc.createImageData(W, H);
        const older = otherIsOlder ? bpx : a, newer = otherIsOlder ? a : bpx;
        overlayPixels(older, newer, out.data, compare.show);
        cc.putImageData(out, 0, 0);
      }
      // Have the next page ready to go.
      if (pageNo < doc.numPages) void doc.getPage(pageNo + 1).catch(() => undefined);
    }, wait);
    return () => { cancelled = true; window.clearTimeout(timer); task?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageNo, zoom, file.id, compare?.doc, compare?.show, compare?.dx, compare?.dy]);

  // ---------------------------------------------------------------- helpers
  const layers = useMemo(() => layersOf(marks, me), [marks, me]);
  const namedLayers = layers.filter((l) => l.named).map((l) => l.name);
  const shownMarks = marks.filter((m) => !hidden.has(layerKey(m)));
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
      const m = await api.fileRoom.addMarkup(file.id, { kind, page, data, private: privateDraft, layer: layer || null });
      setMarks((prev) => [...prev, m]);
      undo.current.push({ type: 'add', after: m });
      redo.current = [];
      return m;
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Markup not saved')); return null; }
  }, [file.id, pageNo, privateDraft, layer, toast]);

  const replace = (m: Markup) => setMarks((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  const editMarkup = async (m: Markup, patch: Partial<Pick<Markup, 'data' | 'private' | 'layer'>>, record = true) => {
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
      const again = await api.fileRoom.addMarkup(file.id, { kind: m.kind, page: m.page, data: m.data, private: m.private, layer: m.layer ?? null }).catch(() => null);
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openSearch(); return; }
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select');
      if (typing) return;
      if (e.key === ' ') { setSpaceDown(true); e.preventDefault(); }
      // Esc backs out one step at a time; it never closes the drawing.
      if (e.key === 'Escape') { if (photoView) setPhotoView(null); else if (ask) setAsk(null); else if (draft) setDraft(null); else if (comparePick) setComparePick(false); else if (compare) setCompare(null); else if (search) setSearch(null); else if (selectedId) setSelectedId(null); }
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
      // Someone else's link (or any link, for a viewer) goes where it points; your own is picked up to move.
      if (m?.kind === 'link' && !mine(m)) { follow(m); return; }
      setSelectedId(m?.id || null);
      if (m && mine(m)) { drag.current = { id: m.id, from: p, orig: m.data.points }; (e.target as Element).setPointerCapture?.(e.pointerId); }
      return;
    }
    if (!canDraw) return;
    if (tool === 'text' || tool === 'pin') { setAsk(tool === 'pin' ? { kind: 'pin', at: p, value: '' } : { kind: 'text', at: p, value: '' }); return; }
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
    if (kind === 'link') { setAsk({ kind: 'link', points: pts, to: 'page', page: String(Math.min(pageNo + 1, doc?.numPages || 1)), fileId: '', filePage: '', value: '' }); return; }
    const data: MarkupData = { points: pts, color: kind === 'highlight' && color === MARKUP_COLORS[0] ? '#FACC15' : color, width: kind === 'highlight' ? Math.max(8, width * 5) : width };
    if (kind === 'measure_len' && pageScale) data.label = measureLabel('measure_len', pts, size.w, size.h, pageScale);
    void save(kind, data);
  };

  // ---------------------------------------------------------------- asks
  const answer = async () => {
    if (!ask || !size) return;
    if (ask.kind === 'text') {
      if (ask.value.trim()) await save('text', { points: [ask.at], color, width: 1, text: ask.value.trim(), size: textSize });
    } else if (ask.kind === 'link') {
      let target: LinkTarget | null = null;
      if (ask.to === 'page') {
        const n = Math.floor(Number(ask.page));
        if (!(n >= 1 && n <= (doc?.numPages || 1))) { toast(`Pick a page from 1 to ${doc?.numPages || 1}`); return; }
        target = { type: 'page', page: n };
      } else {
        const f = otherFiles.find((x) => x.id === ask.fileId);
        if (!f) { toast('Pick the file to link to'); return; }
        const n = Math.floor(Number(ask.filePage));
        target = { type: 'file', fileId: f.id, name: f.name, ...(isPdfFile(f) && n >= 1 ? { page: n } : {}) };
      }
      await save('link', { points: ask.points, color: '#1D4ED8', width: 1.5, target });
    } else if (ask.kind === 'pin') {
      // Selected straight away, so photos can go on it.
      const m = await save('pin', { points: [ask.at], color, width: 1, ...(ask.value.trim() ? { text: ask.value.trim() } : {}) });
      if (m) { setSelectedId(m.id); setPanel(true); }
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
  const visibleLayers = layers.filter((l) => !hidden.has(l.key)).map((l) => l.key);
  const download = async () => {
    setBusy(true);
    try {
      const bytes = await api.fileRoom.markedUpPdf(file.id, hidden.size ? visibleLayers : undefined);
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
      const f = await api.fileRoom.saveMarkedUpCopy(file.id, hidden.size ? visibleLayers : undefined);
      toast(`Saved “${f.name}” beside the drawing`);
      onSavedCopy?.();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };

  // ---------------------------------------------------------------- links
  const otherFiles = [...(projectFiles || []), ...extraFilesList()].filter((f, i, all) => f.id !== file.id && all.findIndex((x) => x.id === f.id) === i).sort((a, b) => a.name.localeCompare(b.name));
  /** Pages visited by following links on this drawing, for "← Back to p. 2". */
  const [pageTrail, setPageTrail] = useState<number[]>([]);
  const follow = (m: Markup) => {
    const t = m.data.target;
    if (!t) return;
    if (t.type === 'page') {
      if (t.page > (doc?.numPages || 0)) { toast(`This drawing has no page ${t.page}`); return; }
      setPageTrail((tr) => [...tr, pageNo]);
      setPageNo(t.page);
      setSelectedId(null);
      return;
    }
    const f = (projectFiles || []).find((x) => x.id === t.fileId);
    if (projectFiles && !f) { toast('That file is no longer in the File Room.'); return; }
    if (isPdfFile(f || { name: t.name }) && onOpenFile) onOpenFile(t.fileId, t.page, pageNo);
    else window.open(api.fileRoom.previewUrl(t.fileId), '_blank', 'noopener');
  };
  const goBack = () => { const tr = [...pageTrail]; const p = tr.pop(); setPageTrail(tr); if (p) setPageNo(p); };
  const uploadTarget = async (fl: FileList | null) => {
    if (!fl?.length || !projectId || ask?.kind !== 'link') return;
    setBusy(true);
    try {
      const folder = file.folderPath || (projectFiles || []).find((f) => f.id === file.id)?.folderPath || [];
      const saved = await api.fileRoom.upload(projectId, folder, fl) as any;
      const f = Array.isArray(saved) ? saved[0] : saved?.files?.[0];
      if (!f?.id) throw new Error('Upload failed');
      onUploaded?.();
      setAsk({ ...ask, to: 'file', fileId: f.id, filePage: '' });
      extraFiles.current.push({ id: f.id, name: f.name, mimeType: f.mimeType, folderPath: folder });
      toast(`Uploaded “${f.name}”`);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Upload failed')); }
    finally { setBusy(false); }
  };

  // ---------------------------------------------------------------- closing
  /** Markups save as they're drawn; only a half-drawn area or a typed-in dialog would be lost. */
  const close = () => {
    const unfinished = (draft && tool === 'measure_area' && draft.length > 0) || (ask && 'value' in ask && ask.value.trim());
    if (unfinished && !window.confirm('Discard what you’re drawing?')) return;
    onClose();
  };

  // ---------------------------------------------------------------- search
  const openSearch = () => setSearch((cur) => cur || { q: '', hits: [], at: 0, busy: false, noText: false });
  /** A page's text runs, as boxes in page-relative coordinates (read once). */
  const runsOf = async (n: number): Promise<TextRun[]> => {
    const have = pageText.current.get(n);
    if (have) return have;
    const page = await doc!.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const runs: TextRun[] = [];
    for (const it of tc.items as any[]) {
      if (!it.str?.trim()) continue;
      const [, , c, d, e, f] = it.transform;
      const fh = Math.hypot(c, d) || it.height || 10;
      const a = vp.convertToViewportPoint(e, f);
      const b = vp.convertToViewportPoint(e + (it.width || 0), f + fh);
      runs.push({ str: it.str, x0: Math.min(a[0], b[0]) / vp.width, x1: Math.max(a[0], b[0]) / vp.width, y0: Math.min(a[1], b[1]) / vp.height, y1: Math.max(a[1], b[1]) / vp.height });
    }
    pageText.current.set(n, runs);
    return runs;
  };
  const searchSeq = useRef(0);
  const runSearch = async (q: string) => {
    const seq = ++searchSeq.current;
    setSearch({ q, hits: [], at: 0, busy: !!q.trim(), noText: false });
    if (!q.trim() || !doc) return;
    const hits: Hit[] = [];
    let anyText = false;
    for (let n = 1; n <= doc.numPages; n++) {
      const runs = await runsOf(n).catch(() => []);
      if (seq !== searchSeq.current) return;
      if (runs.length) anyText = true;
      for (const h of textMatches(runs, q)) hits.push({ page: n, ...h });
    }
    const ql = q.trim().toLowerCase();
    for (const m of shownMarks) {
      const note = m.data.text || m.data.label || (m.kind === 'link' ? linkLabel(m.data.target) : '');
      if (note.toLowerCase().includes(ql)) hits.push({ page: m.page, markupId: m.id, box: boundsOf(m, 0.02, 0.02), context: `${KIND_LABEL[m.kind]}: ${note.split('\n')[0].slice(0, 70)}` });
    }
    hits.sort((a, b) => a.page - b.page || a.box.y0 - b.box.y0);
    setSearch({ q, hits, at: 0, busy: false, noText: !anyText });
    if (hits[0]) goToHit(hits[0]);
  };
  const goToHit = (h: Hit) => {
    setPageNo(h.page);
    if (h.markupId) setSelectedId(h.markupId);
    // Bring it into view once the page is drawn at this size.
    window.setTimeout(() => {
      const st = scroller.current, pg = svg.current;
      if (!st || !pg) return;
      const r = pg.getBoundingClientRect(), sr = st.getBoundingClientRect();
      st.scrollLeft += r.left - sr.left + h.box.x0 * r.width - sr.width / 2;
      st.scrollTop += r.top - sr.top + h.box.y0 * r.height - sr.height / 2;
    }, 60);
  };
  const stepHit = (dir: 1 | -1) => {
    if (!search?.hits.length) return;
    const at = (search.at + dir + search.hits.length) % search.hits.length;
    setSearch({ ...search, at });
    goToHit(search.hits[at]);
  };
  const searchTimer = useRef<number>(0);

  // ---------------------------------------------------------------- layers and pins
  const canRename = (l: { named: boolean; authorId: string | null }) => canDraw && (l.named || isAdmin || (!!me && l.authorId === me));
  const renameLayer = async (l: { key: string; name: string; named: boolean; authorId: string | null }) => {
    const to = window.prompt(l.named ? 'Rename the layer' : 'Name this layer (e.g. “Electrical walk”)', l.named ? l.name : '');
    if (to === null || !to.trim() || to.trim() === l.name) return;
    try {
      const r = await api.fileRoom.renameLayer(file.id, l.named ? l.name : null, to.trim(), l.authorId);
      setMarks((prev) => prev.map((m) => (layerKey(m) === l.key ? { ...m, layer: r.layer } : m)));
      if (l.named && layer.toLowerCase() === l.name.toLowerCase()) setLayer(r.layer);
      if (hidden.has(l.key)) { const n = new Set(hidden); n.delete(l.key); n.add(layerKey({ layer: r.layer })); setHidden(n); }
      toast(`Layer renamed “${r.layer}”`);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not renamed')); }
  };
  const pickLayer = (v: string) => {
    if (v !== '__new') { setLayer(v); return; }
    const name = window.prompt('New layer name (e.g. “Electrical walk”, “Owner comments”)', '');
    if (name && name.trim()) { setLayer(name.trim().replace(/[\s,]+/g, ' ').slice(0, 60)); toast('New markups go on “' + name.trim() + '”'); }
  };
  const addPhotos = async (m: Markup, files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { replace(await api.fileRoom.addPinPhotos(m.id, files)); toast(files.length === 1 ? 'Photo pinned' : `${files.length} photos pinned`); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Photo not added')); }
    finally { setBusy(false); }
  };
  const removePhoto = async (m: Markup, fileId: string) => {
    try { replace(await api.fileRoom.removePinPhoto(m.id, fileId)); } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not removed')); }
  };

  // ---------------------------------------------------------------- drawing a markup
  const render = (m: { kind: MarkupKind; data: MarkupData }, ghost = false) => (size ? shapeOf(m, size, scale, ghost) : null);

  const draftShape = draft && size ? (() => {
    if (tool === 'measure_area') return <polyline points={draft.map((p) => [p[0] * size.w, p[1] * size.h].join(',')).join(' ')} fill="none" stroke={color} strokeWidth={width} strokeDasharray="5 4" />;
    const kind = tool as MarkupKind;
    const data: MarkupData = { points: draft, color: kind === 'highlight' && color === MARKUP_COLORS[0] ? '#FACC15' : color, width: kind === 'highlight' ? Math.max(8, width * 5) : width };
    if (kind === 'measure_len' && pageScale) data.label = measureLabel('measure_len', draft, size.w, size.h, pageScale);
    return render({ kind, data }, true);
  })() : null;

  const selBox = selected && selected.page === pageNo && size ? boundsOf(selected, 120 / size.w, 16 / size.h) : null;
  const cursor = tool === 'pan' || spaceDown ? (pan.current ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : tool === 'text' ? 'text' : tool === 'pin' ? 'copy' : 'crosshair';
  const pages = doc?.numPages || 0;
  const listed = (listAll ? shownMarks : onPage).slice().sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt));

  return createPortal(
    <div className="mk-shell" role="dialog" aria-label={`Mark up ${file.name}`}>
      <header className="mk-top">
        <button type="button" className="mk-btn is-text mk-close" onClick={close} aria-label="Close drawing" title="Close the drawing (your markups are already saved)">✕<span> Close drawing</span></button>
        <div className="mk-title" title={file.name}>{file.name}{file.isLatest === false && <span className="mk-old">older revision — these markups belong to it</span>}</div>
        {canDraw && marks.length > 0 && <span className="mk-saved" title="Each markup is saved as soon as it’s drawn">✓ Saved</span>}
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
        <button type="button" className={'mk-btn' + (search ? ' is-on' : '')} onClick={() => (search ? setSearch(null) : openSearch())} aria-label="Search the drawing" title="Search the drawing’s text and markup notes (Ctrl+F)" aria-pressed={!!search}>🔍</button>
        {otherRevisions.length > 0 && (
          <span className="mk-compare-wrap">
            <button type="button" className={'mk-btn is-text' + (compare ? ' is-on' : '')} aria-pressed={!!compare} title="Compare with another revision: removed in red, added in blue"
              onClick={() => { if (compare) setCompare(null); else if (otherRevisions.length === 1) startCompare(otherRevisions[0]); else setComparePick(!comparePick); }}>⇄ {compare ? 'Stop comparing' : 'Compare'}</button>
            {comparePick && (
              <div className="mk-compare-pick" role="menu">
                <b>Compare with…</b>
                {[...otherRevisions].sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || '')).map((r) => (
                  <button key={r.id} type="button" role="menuitem" className={pickCompareDefault(file.id, revisions || [])?.id === r.id ? 'is-default' : ''} onClick={() => startCompare(r)}>Rev. {revLabel(r)}</button>
                ))}
              </div>
            )}
          </span>
        )}
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
          {canDraw && tool === 'text' && <>
            <i className="mk-sep" />
            <select aria-label="Text size (points)" title="Text size (points)" value={textSize} onChange={(e) => pickTextSize(Number(e.target.value))}>
              {TEXT_SIZES.map((n) => <option key={n} value={n}>{n} pt</option>)}
            </select>
          </>}
          {pageScale && <span className="mk-scale" title="This page’s scale">⇔ set</span>}
        </nav>

        <div className="mk-stage" ref={scroller}
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(Math.min(8, Math.max(0.1, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))); } }}>
          {search && (
            <div className="mk-search" role="search">
              <input autoFocus value={search.q} placeholder="Search this drawing — room names, notes…" aria-label="Search the drawing"
                onChange={(e) => { const q = e.target.value; setSearch({ ...search, q }); window.clearTimeout(searchTimer.current); searchTimer.current = window.setTimeout(() => void runSearch(q), 250); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); stepHit(e.shiftKey ? -1 : 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); stepHit(-1); } else if (e.key === 'Escape') setSearch(null); }} />
              <span className="mk-search-count">{search.busy ? 'Searching…' : search.q.trim() ? (search.hits.length ? `${search.at + 1} of ${search.hits.length}` : 'No matches') : ''}</span>
              <button type="button" className="mk-btn" onClick={() => stepHit(-1)} disabled={!search.hits.length} aria-label="Previous match">↑</button>
              <button type="button" className="mk-btn" onClick={() => stepHit(1)} disabled={!search.hits.length} aria-label="Next match">↓</button>
              <button type="button" className="mk-btn" onClick={() => setSearch(null)} aria-label="Close search">✕</button>
              {search.noText && !search.busy && search.q.trim() && <p className="mk-muted">This PDF has no searchable text (it may be a scan) — only markup notes were searched.</p>}
              {search.hits.length > 1 && (
                <ul className="mk-search-list">
                  {search.hits.slice(0, 50).map((h, i) => (
                    <li key={i} className={i === search.at ? 'is-on' : ''} onClick={() => { setSearch({ ...search, at: i }); goToHit(h); }}><b>p. {h.page}</b> {h.context}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {compare && (
            <div className="mk-compare-bar" role="status">
              <span>{compare.doc ? <>Comparing with Rev. {revLabel(compare.rev)}</> : 'Opening the other revision…'}</span>
              {compare.doc && <>
                <span className="mk-key"><i style={{ background: '#E11D1D' }} /> removed (only in {otherIsOlder ? revLabel(compare.rev) : revLabel(thisRev)})</span>
                <span className="mk-key"><i style={{ background: '#1D4ED8' }} /> added (only in {otherIsOlder ? revLabel(thisRev) : revLabel(compare.rev)})</span>
                <span className="mk-key"><i style={{ background: '#111' }} /> unchanged</span>
                <span className="mk-seg">
                  {(['both', 'older', 'newer'] as CompareShow[]).map((v) => <button key={v} type="button" className={compare.show === v ? 'is-on' : ''} onClick={() => setCompare({ ...compare, show: v })}>{v === 'both' ? 'Both' : v === 'older' ? 'Older only' : 'Newer only'}</button>)}
                </span>
                <span className="mk-nudge" title="Move the other revision to line it up (scans)">
                  Nudge
                  <button type="button" aria-label="Nudge left" onClick={() => setCompare({ ...compare, dx: compare.dx - 1 })}>←</button>
                  <button type="button" aria-label="Nudge right" onClick={() => setCompare({ ...compare, dx: compare.dx + 1 })}>→</button>
                  <button type="button" aria-label="Nudge up" onClick={() => setCompare({ ...compare, dy: compare.dy - 1 })}>↑</button>
                  <button type="button" aria-label="Nudge down" onClick={() => setCompare({ ...compare, dy: compare.dy + 1 })}>↓</button>
                  {(compare.dx || compare.dy) ? <button type="button" onClick={() => setCompare({ ...compare, dx: 0, dy: 0 })}>Reset</button> : null}
                </span>
              </>}
              {compareMissing && compare.doc && <span className="mk-muted">Page {pageNo} isn’t in Rev. {revLabel(compare.rev)} — showing this one alone.</span>}
            </div>
          )}
          {(pageTrail.length > 0 || back) && (
            <div className="mk-back">
              {pageTrail.length > 0 && <button type="button" className="mk-btn is-text" onClick={goBack}>← Back to p. {pageTrail[pageTrail.length - 1]}</button>}
              {!pageTrail.length && back && <button type="button" className="mk-btn is-text" onClick={back.go}>← Back to {back.label}</button>}
            </div>
          )}
          {error && <div className="mk-msg">{error}</div>}
          {!doc && !error && <div className="mk-msg">Opening the drawing…</div>}
          <div className="mk-page" style={{ width: size ? size.w * scale : undefined, height: size ? size.h * scale : undefined, display: doc ? 'block' : 'none' }}>
            <canvas ref={canvas} />
            {size && (
              <svg ref={svg} viewBox={`0 0 ${size.w} ${size.h}`} style={{ cursor, touchAction: 'none' }} aria-label="Markup layer"
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                onDoubleClick={(e) => { if (tool === 'measure_area') { finishArea(); return; } if (tool === 'select') { const m = hit(at(e)); if (m?.kind === 'link') follow(m); } }}>
                {onPage.map((m) => <g key={m.id} data-markup={m.id} opacity={m.private ? 0.75 : 1}><MarkupShape m={m} w={size.w} h={size.h} scale={scale} /></g>)}
                {draftShape}
                {search?.hits[search.at]?.page === pageNo && (() => { const b = search.hits[search.at].box; return <rect className="mk-hit" x={b.x0 * size.w - 2} y={b.y0 * size.h - 2} width={(b.x1 - b.x0) * size.w + 4} height={(b.y1 - b.y0) * size.h + 4} />; })()}
                {selBox && <rect x={selBox.x0 * size.w - 4} y={selBox.y0 * size.h - 4} width={(selBox.x1 - selBox.x0) * size.w + 8} height={(selBox.y1 - selBox.y0) * size.h + 8} fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="4 3" />}
              </svg>
            )}
          </div>
        </div>

        {panel && (
          <aside className="mk-side" aria-label="Markups">
            <button type="button" className="mk-btn is-text mk-side-close" onClick={() => setPanel(false)} aria-label="Hide the list">Hide list ›</button>
            <section>
              <h4>Layers</h4>
              {canDraw && (
                <label className="mk-move">Draw on
                  <select aria-label="Draw on layer" title="The layer new markups go on" value={layer} onChange={(e) => pickLayer(e.target.value)}>
                    <option value="">My own layer</option>
                    {[...new Set([...namedLayers, ...(layer ? [layer] : [])])].map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value="__new">+ New layer…</option>
                  </select>
                </label>
              )}
              {!layers.length && <p className="mk-muted">No markups yet{canDraw ? ' — pick a tool and draw.' : '.'}</p>}
              {layers.map((l) => (
                <div key={l.key} className="mk-layer">
                  <label>
                    <input type="checkbox" checked={!hidden.has(l.key)} onChange={() => { const n = new Set(hidden); if (n.has(l.key)) n.delete(l.key); else n.add(l.key); setHidden(n); }} />
                    <span>{l.named ? l.name : <>{l.name} <em>own layer</em></>}</span>
                  </label>
                  <small>{l.count}</small>
                  {canRename(l) && <button type="button" className="mk-layer-edit" onClick={() => void renameLayer(l)} aria-label={`Rename ${l.name}`} title={l.named ? 'Rename for everyone' : 'Name this layer'}>✎</button>}
                </div>
              ))}
            </section>

            {selected && (
              <section className="mk-selected">
                <h4>{KIND_LABEL[selected.kind]} · p. {selected.page}</h4>
                <p className="mk-muted">{selected.authorName} · {new Date(selected.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{selected.private ? ' · private draft' : ''}</p>
                {selected.data.text && <p className="mk-quote">{selected.data.text}</p>}
                {selected.kind === 'pin' && <PinPhotos markup={selected} canAdd={canDraw} busy={busy} onAdd={(f) => void addPhotos(selected, f)} onRemove={mine(selected) ? (id) => void removePhoto(selected, id) : undefined} onOpen={setPhotoView} />}
                {mine(selected) && (
                  <label className="mk-move">Layer
                    <select value={selected.layer || ''} onChange={(e) => void editMarkup(selected, { layer: e.target.value || null })}>
                      <option value="">{selected.authorName}’s own</option>
                      {[...new Set([...namedLayers, ...(layer ? [layer] : [])])].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                )}
                {selected.data.label && <p className="mk-quote">{selected.data.label}</p>}
                {selected.kind === 'link' && selected.data.target && <p><button type="button" className="mk-btn is-text is-dark" onClick={() => follow(selected)}>{selected.data.target.type === 'page' ? `Go to page ${selected.data.target.page}` : `Open ${selected.data.target.name}${selected.data.target.page ? `, p. ${selected.data.target.page}` : ''}`}</button></p>}
                {selected.linkType && <p><a href={selected.linkType === 'rfi' ? `/rfis?rfi=${encodeURIComponent(selected.linkId || '')}` : `/tasks?task=${encodeURIComponent(selected.linkId || '')}&type=log`}>Open the {selected.linkType === 'rfi' ? 'RFI' : 'task'} made from it →</a></p>}
                <div className="mk-actions">
                  {canDraw && !selected.linkType && selected.kind !== 'scale' && <>
                    <button type="button" className="mk-btn is-text" disabled={busy || !projectId} title={projectId ? '' : 'Only for files in a project'} onClick={() => setAsk({ kind: 'rfi', markup: selected, value: selected.data.text ? selected.data.text.split('\n')[0].slice(0, 120) : '' })}>Create RFI</button>
                    <button type="button" className="mk-btn is-text" disabled={busy} onClick={() => setAsk({ kind: 'task', markup: selected, value: selected.data.text ? selected.data.text.split('\n')[0].slice(0, 120) : '' })}>Create task</button>
                  </>}
                  {mine(selected) && <>
                    {selected.kind === 'text' && <button type="button" className="mk-btn is-text" onClick={() => { const t = window.prompt('Edit the text', selected.data.text || ''); if (t !== null && t.trim()) void editMarkup(selected, { data: { ...selected.data, text: t.trim() } }); }}>Edit text</button>}
                    {selected.kind === 'text' && <span className="mk-size">
                      <button type="button" className="mk-btn" aria-label="Smaller text" title="Smaller" disabled={(selected.data.size || 12) <= TEXT_SIZES[0]} onClick={() => void editMarkup(selected, { data: { ...selected.data, size: nextSize(selected.data.size || 12, -1) } })}>A−</button>
                      <span>{selected.data.size || 12} pt</span>
                      <button type="button" className="mk-btn" aria-label="Larger text" title="Larger" disabled={(selected.data.size || 12) >= TEXT_SIZES[TEXT_SIZES.length - 1]} onClick={() => void editMarkup(selected, { data: { ...selected.data, size: nextSize(selected.data.size || 12, 1) } })}>A+</button>
                    </span>}
                    {selected.kind === 'pin' && <button type="button" className="mk-btn is-text" onClick={() => { const t = window.prompt('The pin’s note', selected.data.text || ''); if (t !== null) { const data: MarkupData = { ...selected.data, text: t.trim() }; if (!data.text) delete data.text; void editMarkup(selected, { data }); } }}>{selected.data.text ? 'Edit note' : 'Add note'}</button>}
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
                    <span><b>{KIND_LABEL[m.kind]}</b>{m.data.text ? ` — ${m.data.text.split('\n')[0]}` : m.data.label ? ` — ${m.data.label}` : m.kind === 'link' ? ` ${linkLabel(m.data.target)}` : ''}<small>{m.authorName}{listAll ? ` · p. ${m.page}` : ''}{m.private ? ' · private' : ''}{m.linkType ? ` · ${m.linkType === 'rfi' ? 'RFI' : 'task'}` : ''}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>

      {photoView && (
        <div className="mk-photo-bg" onClick={() => setPhotoView(null)} role="dialog" aria-label={photoView.name}>
          <img src={photoView.url} alt={photoView.name} />
          <button type="button" className="mk-btn" onClick={() => setPhotoView(null)} aria-label="Close the photo">✕</button>
        </div>
      )}

      {ask && (
        <div className="mk-ask-bg" onClick={() => setAsk(null)}>
          <form className="mk-ask" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void answer(); }}>
            <h4>{ask.kind === 'text' ? 'Add text' : ask.kind === 'pin' ? 'Drop a pin' : ask.kind === 'link' ? 'Link to…' : ask.kind === 'scale' ? 'How long is the line you drew?' : ask.kind === 'rfi' ? 'Create an RFI from this markup' : 'Create a task from this markup'}</h4>
            {ask.kind === 'text' && <textarea autoFocus rows={3} value={ask.value} onChange={(e) => setAsk({ ...ask, value: e.target.value })} placeholder="e.g. Verify beam size with structural" />}
            {ask.kind === 'pin' && <>
              <textarea autoFocus rows={2} value={ask.value} onChange={(e) => setAsk({ ...ask, value: e.target.value })} placeholder="A note (optional) — e.g. Crack at the footing, NE corner" aria-label="Pin note" />
              <p className="mk-muted">Next, add site photos to the pin, or make an RFI or task from it.</p>
            </>}
            {ask.kind === 'scale' && <>
              <p className="mk-muted">Draw over a dimension you know (a dimension string or a scale bar), then type its real length. Every length and area on this page measures from it.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input autoFocus value={ask.value} onChange={(e) => setAsk({ ...ask, value: e.target.value })} placeholder={ask.unit === 'ft' ? `12'-6"` : '3.81'} aria-label="Real length" />
                <select value={ask.unit} onChange={(e) => setAsk({ ...ask, unit: e.target.value as 'ft' | 'm' })} aria-label="Unit"><option value="ft">feet / inches</option><option value="m">metres</option></select>
              </div>
            </>}
            {ask.kind === 'link' && <>
              <div className="mk-seg mk-link-to" role="radiogroup" aria-label="Link to">
                <button type="button" role="radio" aria-checked={ask.to === 'page'} className={ask.to === 'page' ? 'is-on' : ''} onClick={() => setAsk({ ...ask, to: 'page' })}>A page of this drawing</button>
                <button type="button" role="radio" aria-checked={ask.to === 'file'} className={ask.to === 'file' ? 'is-on' : ''} onClick={() => setAsk({ ...ask, to: 'file' })}>Another file</button>
              </div>
              {ask.to === 'page' ? (
                <label className="mk-move">Page
                  <input autoFocus type="number" min={1} max={pages || 1} value={ask.page} onChange={(e) => setAsk({ ...ask, page: e.target.value })} aria-label="Page to link to" style={{ width: 90 }} />
                  <span className="mk-muted">of {pages || 1}</span>
                </label>
              ) : <>
                <select value={ask.fileId} onChange={(e) => setAsk({ ...ask, fileId: e.target.value, filePage: '' })} aria-label="File to link to">
                  <option value="">{otherFiles.length ? 'Pick a file in this project…' : 'No other files in this project yet'}</option>
                  {otherFiles.map((f) => <option key={f.id} value={f.id}>{(f.folderPath?.length ? f.folderPath.join(' / ') + ' / ' : '') + f.name}</option>)}
                </select>
                {(() => { const f = otherFiles.find((x) => x.id === ask.fileId); return f && isPdfFile(f) ? (
                  <label className="mk-move">Open at page <input type="number" min={1} value={ask.filePage} onChange={(e) => setAsk({ ...ask, filePage: e.target.value })} placeholder="1" aria-label="Page of that file" style={{ width: 90 }} /></label>
                ) : null; })()}
                {projectId && (
                  <label className={'mk-btn is-text mk-photo-add' + (busy ? ' is-busy' : '')}>
                    {busy ? 'Uploading…' : '+ Upload a file (e.g. an inspection card)'}
                    <input type="file" disabled={busy} onChange={(e) => { void uploadTarget(e.target.files); e.target.value = ''; }} hidden />
                  </label>
                )}
              </>}
            </>}
            {(ask.kind === 'rfi' || ask.kind === 'task') && <>
              <input autoFocus value={ask.value} onChange={(e) => setAsk({ ...ask, value: e.target.value })} placeholder={ask.kind === 'rfi' ? 'RFI subject' : 'Task subject'} aria-label="Subject" />
              <p className="mk-muted">{ask.kind === 'rfi' ? 'A draft RFI is made with this drawing and page linked; finish it in the RFI log.' : 'A Special Actions Log task is made with a link back to this spot on the drawing.'}</p>
            </>}
            <div className="mk-ask-row">
              <button type="button" className="mk-btn is-text" onClick={() => setAsk(null)}>Cancel</button>
              <button type="submit" className="mk-btn is-text is-dark" disabled={busy}>{ask.kind === 'text' ? 'Add' : ask.kind === 'pin' ? 'Drop pin' : ask.kind === 'link' ? 'Make link' : ask.kind === 'scale' ? 'Set scale' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** A pin's photos: thumbnails (loaded signed in), add from the camera or files, open full size. */
function PinPhotos({ markup, canAdd, busy, onAdd, onRemove, onOpen }: {
  markup: Markup; canAdd: boolean; busy: boolean;
  onAdd: (files: FileList | null) => void; onRemove?: (fileId: string) => void; onOpen: (p: { url: string; name: string }) => void;
}) {
  const photos = markup.data.photos || [];
  const [urls, setUrls] = useState<Record<string, string>>({});
  const ids = photos.map((p) => p.fileId).join(',');
  useEffect(() => {
    let live = true;
    const made: string[] = [];
    for (const p of photos) {
      api.fileRoom.bytes(p.fileId).then((b) => {
        const u = URL.createObjectURL(new Blob([b]));
        made.push(u);
        if (live) setUrls((prev) => ({ ...prev, [p.fileId]: u })); else URL.revokeObjectURL(u);
      }).catch(() => undefined);
    }
    return () => { live = false; made.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return (
    <div className="mk-photos">
      {photos.length > 0 && (
        <div className="mk-photo-grid">
          {photos.map((p) => (
            <figure key={p.fileId}>
              <button type="button" onClick={() => urls[p.fileId] && onOpen({ url: urls[p.fileId], name: p.name })} title={p.name} aria-label={`Open ${p.name}`}>
                {urls[p.fileId] ? <img src={urls[p.fileId]} alt={p.name} /> : <span>…</span>}
              </button>
              {onRemove && <button type="button" className="mk-photo-x" onClick={() => onRemove(p.fileId)} aria-label={`Take ${p.name} off the pin`}>✕</button>}
            </figure>
          ))}
        </div>
      )}
      {canAdd && (
        <label className={'mk-btn is-text mk-photo-add' + (busy ? ' is-busy' : '')}>
          {busy ? 'Adding…' : photos.length ? '+ More photos' : '+ Add site photos'}
          <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { onAdd(e.target.files); e.target.value = ''; }} hidden />
        </label>
      )}
      {!photos.length && !canAdd && <p className="mk-muted">No photos on this pin.</p>}
    </div>
  );
}

/** How one markup looks, in page points (size = the page as shown, in points). */
function shapeOf(m: { kind: MarkupKind; data: MarkupData }, size: { w: number; h: number }, scale: number, ghost = false) {
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
    case 'pin': {
      // A map pin whose tip is the spot; it keeps its size on screen at any zoom.
      const [x, y] = pts[0];
      const k = 1 / scale;
      const n = m.data.photos?.length || 0;
      return <g transform={`translate(${x} ${y}) scale(${k})`}>
        <path d="M0 0 L-7 -12 A9 9 0 1 1 7 -12 Z" fill={stroke} stroke="#fff" strokeWidth={1.5} opacity={ghost ? 0.7 : 1} />
        <circle cx={0} cy={-18} r={3.5} fill="#fff" />
        {n > 0 && <g transform="translate(9 -28)"><circle r={7} fill="#111827" stroke="#fff" strokeWidth={1.2} /><text y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" fontFamily="Helvetica, Arial, sans-serif">{n}</text></g>}
      </g>;
    }
    case 'link': {
      const [a, b] = pts;
      const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
      return <g className="mk-link-shape">
        <rect x={x} y={y} width={Math.abs(b[0] - a[0])} height={Math.abs(b[1] - a[1])} fill={stroke} fillOpacity={0.06} stroke={stroke} strokeWidth={sw} strokeDasharray="5 3" />
        <text x={x} y={y - 4} fontSize={10 / scale} fill={stroke} stroke="#fff" strokeWidth={3 / scale} paintOrder="stroke" fontFamily="Helvetica, Arial, sans-serif" fontWeight={700}>{linkLabel(m.data.target)}</text>
      </g>;
    }
    case 'text': {
      const fs = m.data.size || 12;
      return <text x={pts[0][0]} y={pts[0][1] + fs} fontSize={fs} fill={stroke} fontFamily="Helvetica, Arial, sans-serif" style={{ whiteSpace: 'pre' }}>
        {(m.data.text || '').split('\n').map((line, i) => <tspan key={i} x={pts[0][0]} dy={i ? fs * 1.2 : 0}>{line}</tspan>)}
      </text>;
    }
  }
  return null;
}

/** One markup on the page; redrawn only when it (or the zoom) changes. */
const MarkupShape = memo(function MarkupShape({ m, w, h, scale }: { m: Markup; w: number; h: number; scale: number }) {
  return shapeOf(m, { w, h }, scale);
});
