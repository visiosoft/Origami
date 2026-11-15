// Origami brand lockup. Prefers the supplied raster logo at /origami-logo.webp
// (place the file in frontend/public/). If that asset is missing it falls back
// to a self-contained inline SVG lockup so the UI never renders broken.

import { useEffect, useState } from 'react';

/** The workspace's own branding (Settings -> Branding), for the app and the sign-in screen (Nov 10). */
export interface AppBrand { companyName: string; tagline: string | null; logoDataUrl: string | null; accentColor: string }
let brandCache: Promise<AppBrand | null> | null = null;
export function loadBrand(): Promise<AppBrand | null> {
  if (!brandCache) brandCache = fetch('/api/brand').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return brandCache;
}
/** After Settings -> Branding is saved: show the new logo and name without a reload. */
export function refreshBrand() { brandCache = null; window.dispatchEvent(new Event('brand-changed')); }
export function useBrand(): AppBrand | null {
  const [b, setB] = useState<AppBrand | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => void loadBrand().then((x) => { if (live) setB(x); });
    load();
    window.addEventListener('brand-changed', load);
    return () => { live = false; window.removeEventListener('brand-changed', load); };
  }, []);
  return b;
}

const BG = "'Bricolage Grotesque', serif";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      {/* folded-paper crane in the brand palette */}
      <path d="M5 9 L20 20 L5 31 Z" fill="#173326" />
      <path d="M20 20 L35 8 L35 23 Z" fill="#2F7D4A" />
      <path d="M20 20 L35 23 L17 35 Z" fill="#D2822E" />
      <path d="M5 9 L20 20 L14 8 Z" fill="#245C3A" />
    </svg>
  );
}

function FallbackLockup({ markSize = 30 }: { markSize?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <LogoMark size={markSize} />
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', color: '#173326' }}>Origami</div>
        <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#7E9B93' }}>Design + Build</div>
      </div>
    </div>
  );
}

/** Full lockup: the supplied raster logo, or the inline SVG fallback. */
export function Logo({ markSize = 30 }: { markSize?: number }) {
  const [failed, setFailed] = useState(false);
  const brand = useBrand();
  // The logo uploaded in Settings -> Branding wins; then the bundled one; then the drawn lockup.
  if (brand?.logoDataUrl) {
    return <img src={brand.logoDataUrl} alt={brand.companyName} style={{ height: Math.round(markSize * 1.5), width: 'auto', maxWidth: '100%', display: 'block', objectFit: 'contain' }} />;
  }
  if (failed) return <FallbackLockup markSize={markSize} />;
  return (
    <img
      src="/origami-logo.webp"
      alt="Origami Design + Build"
      onError={() => setFailed(true)}
      style={{ height: Math.round(markSize * 1.5), width: 'auto', maxWidth: '100%', display: 'block', objectFit: 'contain' }}
    />
  );
}
