import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

/** What's being drawn right now: a function that draws it, or nothing. */
export type LiveDraw = (() => ReactNode) | null;
export interface LiveApi { show: (draw: LiveDraw) => void }

/**
 * The stroke or shape under the pen while it's drawn (Nov 12: faster drawing).
 * Only this small layer redraws as the pointer moves, at most once a frame;
 * the sheet, its markups and the side panel stay as they are until the pen lifts.
 */
export const LiveLayer = memo(forwardRef<LiveApi>(function LiveLayer(_, ref) {
  const [draw, setDraw] = useState<{ fn: LiveDraw }>({ fn: null });
  const next = useRef<LiveDraw>(null);
  const frame = useRef(0);
  useImperativeHandle(ref, () => ({
    show(fn) {
      next.current = fn;
      // Clearing is immediate (the markup it became is drawn in the same frame); drawing waits for the next frame.
      if (!fn) { cancelAnimationFrame(frame.current); frame.current = 0; setDraw({ fn: null }); return; }
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => { frame.current = 0; setDraw({ fn: next.current }); });
    },
  }), []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return <g className="mk-live" pointerEvents="none">{draw.fn?.()}</g>;
}));
