import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * Long text shown as its first few lines, with "Show more" to open it --
 * so a pasted email doesn't push every other note off the screen. The toggle
 * only appears when there's actually more to show.
 */
export function ClampText({ text, lines = 2, style }: { text: string; lines?: number; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, lines, open]);

  return (
    <div>
      <div
        ref={ref}
        style={{
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...style,
          ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
        }}
      >
        {text}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ marginTop: 4, padding: 0, border: 0, background: 'none', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
