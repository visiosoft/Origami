import { useEffect, useRef, useState } from 'react';

/**
 * An image that asks for its picture only when it comes near the screen (Nov 5:
 * File Room thumbnails). The box keeps its size meanwhile, so nothing jumps.
 * The browser's own loading="lazy" starts far too early (1,250-2,500 px ahead),
 * so a whole page of 50 photos was fetched at once.
 */
export function LazyThumb({ src, alt = '', style, margin = '300px', fallback }: { src: string; alt?: string; style?: React.CSSProperties; margin?: string; /** Tried once if `src` fails. */ fallback?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return (
    <img ref={ref} src={near ? src : undefined} alt={alt} decoding="async" onLoad={() => setLoaded(true)}
      onError={fallback ? (e) => { const img = e.currentTarget; if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = fallback; } } : undefined}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 160ms ease' }} />
  );
}
