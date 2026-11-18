import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Nov 18: side panels (task panels) widen or narrow by dragging their left
 * edge. The width is remembered per kind of panel in this browser.
 * Phones keep the full-width panel.
 */
const MIN = 380;
const read = (key: string, fallback: number) => {
  try { const n = Number(localStorage.getItem('origami.panelWidth.' + key)); return Number.isFinite(n) && n >= MIN ? n : fallback; } catch { return fallback; }
};

export function usePanelWidth(key: string, fallback: number) {
  const [width, setWidth] = useState(() => read(key, fallback));
  const save = useCallback((w: number) => { try { localStorage.setItem('origami.panelWidth.' + key, String(Math.round(w))); } catch { /* private window */ } }, [key]);
  return { width, setWidth, save, reset: () => { setWidth(fallback); save(fallback); } };
}

/** The drag handle on the panel's left edge (the panel sits on the right of the screen). */
export function PanelResizeHandle({ width, setWidth, save, reset }: ReturnType<typeof usePanelWidth>) {
  const [dragging, setDragging] = useState(false);
  const last = useRef(width);
  last.current = width;
  useEffect(() => {
    if (!dragging) return;
    const max = () => Math.max(MIN, window.innerWidth - 40);
    const move = (e: PointerEvent) => { e.preventDefault(); setWidth(Math.min(max(), Math.max(MIN, window.innerWidth - e.clientX))); };
    const up = () => {
      setDragging(false); save(last.current);
      // Letting go over the dimmed background must not count as a click that closes the panel.
      const eat = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 0);
    };
    const prev = document.body.style.userSelect; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.userSelect = prev; };
  }, [dragging, setWidth, save]);
  const nudge = (d: number) => { const w = Math.min(Math.max(MIN, window.innerWidth - 40), Math.max(MIN, width + d)); setWidth(w); save(w); };
  return (
    <div
      className="panel-resize"
      role="separator" aria-orientation="vertical" aria-label="Drag to resize the panel" tabIndex={0}
      title="Drag to make the panel wider or narrower · double-click to reset"
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => { e.stopPropagation(); reset(); }}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') nudge(40); if (e.key === 'ArrowRight') nudge(-40); }}
      style={{ position: 'fixed', top: 0, bottom: 0, right: `min(${width}px, 96vw)`, width: 12, marginRight: -6, cursor: 'col-resize', zIndex: 3, display: 'grid', placeItems: 'center', touchAction: 'none' }}
    >
      <span aria-hidden style={{ width: 4, height: 44, borderRadius: 4, background: dragging ? 'var(--forest)' : 'rgba(var(--rgb-shade), .28)', boxShadow: '0 0 0 2px var(--surface)' }} />
    </div>
  );
}
