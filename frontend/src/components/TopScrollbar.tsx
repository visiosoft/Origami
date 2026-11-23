import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Nov 23: a sideways scrollbar above a wide table, kept in step with the
 * table's own one at the bottom -- so people don't have to scroll to the end
 * of the list to move across. Hidden when nothing is wider than the box.
 */
export function TopScrollbar({ target }: { target: RefObject<HTMLElement | null> }) {
  const bar = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [client, setClient] = useState(0);
  useEffect(() => {
    const el = target.current; const b = bar.current;
    if (!el || !b) return;
    const measure = () => { setW(el.scrollWidth); setClient(el.clientWidth); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    const fromEl = () => { if (b.scrollLeft !== el.scrollLeft) b.scrollLeft = el.scrollLeft; };
    const fromBar = () => { if (el.scrollLeft !== b.scrollLeft) el.scrollLeft = b.scrollLeft; };
    el.addEventListener('scroll', fromEl, { passive: true });
    b.addEventListener('scroll', fromBar, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', fromEl); b.removeEventListener('scroll', fromBar); };
  }, [target]);
  const needed = w > client + 1;
  return (
    <div ref={bar} className="top-scrollbar" aria-hidden
      style={{ overflowX: 'auto', overflowY: 'hidden', height: needed ? 14 : 0, visibility: needed ? 'visible' : 'hidden' }}>
      <div style={{ width: w, height: 1 }} />
    </div>
  );
}
