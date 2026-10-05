import { useEffect, useRef, useState } from 'react';

/**
 * Counts the first number in a value up from zero when it first appears or
 * changes ("$1,240", "37", "88%", "6.6 h"), keeping the value's own format.
 */
export function CountUp({ value, duration = 900 }: { value: string | number; duration?: number }) {
  const text = String(value ?? '');
  const m = text.match(/-?\d[\d,]*(\.\d+)?/);
  const [shown, setShown] = useState(m && document.documentElement.dataset.theme !== 'classic' ? text.replace(m[0], format(0, m[0])) : text);
  const raf = useRef(0);

  useEffect(() => {
    if (!m || document.documentElement.dataset.theme === 'classic' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(text); return; }
    const target = parseFloat(m[0].replace(/,/g, ''));
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(t >= 1 ? text : text.replace(m[0], format(target * eased, m[0])));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, duration]);

  return <>{shown}</>;
}

function format(n: number, like: string) {
  const decimals = (like.split('.')[1] || '').length;
  const s = n.toFixed(decimals);
  if (!like.includes(',')) return s;
  const [int, dec] = s.split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : '');
}
