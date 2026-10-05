import { useEffect, useState } from 'react';

/**
 * The app's look. "coterie" is the warm cream/yellow design; "classic" is the
 * original green Origami look. The choice is per browser and is applied as
 * <html data-theme="...">; every colour, radius and font reads from the CSS
 * variables in styles/global.css, which each theme sets.
 */
export type Theme = 'coterie' | 'classic';
export const THEMES: { key: Theme; label: string }[] = [
  { key: 'coterie', label: 'New' },
  { key: 'classic', label: 'Classic' },
];

const KEY = 'origami.theme';
const DEFAULT: Theme = 'coterie';
const EVENT = 'origami-theme';

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'coterie' || t === 'classic') return t;
  } catch { /* storage blocked */ }
  return DEFAULT;
}

export function applyTheme(t: Theme = getTheme()) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'coterie' ? '#F3EFE6' : '#0F2417');
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* still switch for this visit */ }
  applyTheme(t);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(getTheme);
  useEffect(() => {
    const on = (e: Event) => set((e as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [theme, setTheme];
}

/**
 * A colour at a given opacity, written like a two-digit hex alpha ("22", "2E").
 * Works for plain hex and for theme variables like "var(--forest)".
 */
export function tint(color: string, alphaHex: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color + alphaHex;
  const pct = Math.round((parseInt(alphaHex, 16) / 255) * 1000) / 10;
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
