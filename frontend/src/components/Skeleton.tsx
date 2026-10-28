import { useEffect, useState, type CSSProperties } from 'react';
import { markBusy, onBusy } from '../api';

/**
 * Shimmering placeholders shown while data is on the way, so a page never sits
 * blank or reads as empty before its answer arrives. `label` is read out to
 * screen readers ("Loading tasks…").
 */
export function Skeleton({ rows = 3, label = 'Loading…', height = 12, style }: { rows?: number; label?: string; height?: number; style?: CSSProperties }) {
  return (
    <div role="status" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0', ...style }}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="sk-bar" style={{ height, width: `${[92, 78, 64, 85, 70][i % 5]}%` }} />
      ))}
    </div>
  );
}

/** A whole page on its way: a title, a row of cards and a few list lines. */
export function PageSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ padding: '8px 0', animation: 'fadeIn 0.2s ease' }}>
      <span className="sk-bar" style={{ height: 22, width: 220, marginBottom: 10 }} />
      <span className="sk-bar" style={{ height: 12, width: 340, maxWidth: '80%', marginBottom: 22 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk-card"><span className="sk-bar" style={{ height: 10, width: '50%', marginBottom: 12 }} /><span className="sk-bar" style={{ height: 22, width: '35%' }} /></div>
        ))}
      </div>
      <div className="sk-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[88, 72, 80, 64, 76].map((w, i) => <span key={i} className="sk-bar" style={{ height: 12, width: `${w}%` }} />)}
      </div>
    </div>
  );
}

/** The thin bar along the top while any page code or data read is in flight (after a short pause, so quick answers don't flash it). */
export function TopProgress() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let t: number | undefined;
    const off = onBusy((n) => {
      window.clearTimeout(t);
      if (n > 0) t = window.setTimeout(() => setBusy(true), 150);
      else setBusy(false);
    });
    return () => { window.clearTimeout(t); off(); };
  }, []);
  return busy ? <div className="top-progress" role="progressbar" aria-label="Loading" /> : null;
}

/** Marks a page's code as loading for the top bar while a Suspense fallback is on screen. */
export function BusyWhileMounted() {
  useEffect(() => markBusy(), []);
  return null;
}
