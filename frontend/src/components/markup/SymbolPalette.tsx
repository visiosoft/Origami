import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MarkupSymbol } from '../../data/markup';

/**
 * Nov 23 ("the symbol placement is not good"): the ◆ tool's ▾ opens the
 * library as pictures. Picking one puts it on the drawing (in the middle of
 * what you're looking at, ready to drag or resize) and keeps it as the symbol
 * a click on the drawing drops. Admins add and manage symbols from here too.
 */
export function SymbolPalette({ anchor, symbols, selectedId, canKeep, onPick, onAdd, onManage, onClose }: {
  anchor: HTMLElement | null;
  symbols: MarkupSymbol[];
  selectedId: string;
  canKeep: boolean;
  onPick: (id: string) => void;
  onAdd: (f?: File) => void;
  onManage: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? symbols.filter((s) => s.name.toLowerCase().includes(t)) : symbols;
  }, [symbols, q]);

  useLayoutEffect(() => {
    const place = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const w = Math.min(360, W - 24), h = Math.min(460, H - 24);
      const r = anchor?.getBoundingClientRect();
      if (!r) { setPos({ top: Math.max(12, H - h - 76), left: 12 }); return; } // phones: above the tool bar at the bottom
      // Beside the tool (to its right); on a narrow screen, under it.
      const left = W < 520 ? 12 : Math.min(r.right + 20, W - w - 12);
      const top = W < 520 ? Math.min(r.bottom + 8, H - h - 12) : Math.max(12, Math.min(r.top - 8, H - h - 12));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);
  useEffect(() => { search.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const down = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('touchstart', down);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down); window.removeEventListener('keydown', key, true); };
  }, [anchor, onClose]);

  if (!pos) return null;
  return createPortal(
    <div ref={box} className="mk-palette" role="dialog" aria-label="Symbols" style={{ top: pos.top, left: pos.left }}>
      <div className="mk-palette-head">
        <b>Symbols</b>
        <input ref={search} type="search" placeholder="Find a symbol…" aria-label="Find a symbol" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="mk-palette-x" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {!symbols.length ? (
        <div className="mk-palette-empty">{canKeep ? 'No symbols yet. Add the starter set in Plan & File Room → Drawing sets, or add your own below.' : 'No symbols yet — an admin adds them.'}</div>
      ) : !shown.length ? (
        <div className="mk-palette-empty">No symbol called “{q}”.</div>
      ) : (
        <div className="mk-palette-grid" role="listbox" aria-label="Pick a symbol">
          {shown.map((s) => (
            <button key={s.id} type="button" role="option" aria-selected={s.id === selectedId} className={'mk-palette-item' + (s.id === selectedId ? ' is-on' : '')}
              title={`${s.name} — puts it on the drawing`} onClick={() => onPick(s.id)}>
              <img src={s.image} alt="" />
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mk-palette-foot">
        <span>Pick one to put it on the drawing; then click the drawing to add more.</span>
        {canKeep && (
          <span className="mk-palette-admin">
            <label className="mk-palette-btn" title="Add a symbol (PNG, JPG or SVG)">＋ Add<input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={(e) => { onAdd(e.target.files?.[0]); e.target.value = ''; }} /></label>
            {symbols.length > 0 && <button type="button" className="mk-palette-btn" onClick={onManage}>Manage</button>}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
