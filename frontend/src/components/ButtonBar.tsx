import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './ActionKit.css';

/**
 * Nov 23 ("organize buttons"): a page's actions as one tidy row -- the main
 * button(s) shown, everything else under "More ▾". Used for page headers and
 * panel tops on computers and phones alike. With only one other action it is
 * shown as a button; with none, just the main button.
 */
export interface BarItem {
  label: string;
  onClick: () => void;
  /** Shown as the item's tooltip and under its label in the menu. */
  title?: string;
  disabled?: boolean;
  /** Left out entirely (e.g. no rights). */
  hidden?: boolean;
  danger?: boolean;
}

const pill = { display: 'inline-flex', alignItems: 'center', gap: 6 } as const;

export function ButtonBar({ primary, items, label = 'More actions', className, size }: {
  primary?: ReactNode; items: BarItem[]; label?: string; className?: string;
  /** 'sm' matches the small pill buttons on toolbars such as the File Room's. */
  size?: 'sm';
}) {
  const shown = items.filter((x) => !x.hidden);
  const [open, setOpen] = useState(false);
  /** Where the menu sits (fixed, drawn on the page itself so cards and panels never cover it). */
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const place = () => {
    // Under the button, towards the side with room, so it never runs off a phone screen.
    const r = moreBtn.current?.getBoundingClientRect();
    if (!r) return;
    const W = window.innerWidth;
    if (W < 520) { setPos({ top: r.bottom + 6, left: 12, right: 12 }); return; } // phones: across the screen
    setPos(r.right - 240 > 8 ? { top: r.bottom + 6, right: Math.max(8, W - r.right) } : { top: r.bottom + 6, left: Math.min(Math.max(8, r.left), W - 248) });
  };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (wrap.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    // The page scrolling or resizing moves the menu with its button.
    const follow = (e: Event) => { if (menu.current && e.target instanceof Node && menu.current.contains(e.target)) return; place(); };
    window.addEventListener('resize', follow);
    document.addEventListener('scroll', follow, true);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', down);
    document.addEventListener('touchstart', down);
    window.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down); window.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', follow); document.removeEventListener('scroll', follow, true);
    };
  }, [open]);
  const toggle = () => { place(); setOpen((v) => !v); };

  const plain = shown.filter((x) => !x.danger);
  const danger = shown.filter((x) => x.danger);
  const row = (x: BarItem) => (
    <button key={x.label} type="button" role="menuitem" disabled={x.disabled} title={x.title}
      onClick={() => { setOpen(false); x.onClick(); }} className={'bb-item' + (x.danger ? ' is-danger' : '')}>
      {x.label}
    </button>
  );
  return (
    <div ref={wrap} className={'bb' + (size === 'sm' ? ' is-sm' : '') + (className ? ' ' + className : '')}>
      {shown.length === 1 && (
        <button type="button" className={'ak-btn' + (shown[0].danger ? ' is-danger' : '')} disabled={shown[0].disabled} title={shown[0].title} onClick={shown[0].onClick}>{shown[0].label}</button>
      )}
      {shown.length > 1 && (
        <span style={pill}>
          <button ref={moreBtn} type="button" className="ak-btn bb-more" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={toggle}>More ▾</button>
          {open && pos && createPortal(
            <div ref={menu} role="menu" aria-label={label} className="bb-menu" style={{ position: 'fixed', ...pos }}>
              {plain.map(row)}
              {danger.length > 0 && plain.length > 0 && <div className="bb-sep" />}
              {danger.map(row)}
            </div>,
            document.body,
          )}
        </span>
      )}
      {primary}
    </div>
  );
}
