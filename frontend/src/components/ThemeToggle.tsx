import { THEMES, useTheme, type Theme } from '../theme';

/** Top-bar button that switches between the New and Classic looks. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === 'coterie' ? 'classic' : 'coterie';
  const nextLabel = THEMES.find((t) => t.key === next)!.label;

  const flip = () => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    setTheme(next);
    window.setTimeout(() => root.classList.remove('theme-switching'), 450);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={flip}
      title={`Switch to the ${nextLabel} look`}
      aria-label={`Switch to the ${nextLabel} look`}
      style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0 }}
    >
      {theme === 'coterie' ? (
        // sun: the New look
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" style={{ stroke: 'var(--body)' }}>
          <circle cx={12} cy={12} r={4} />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // leaf: the Classic green look
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--body)' }}>
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
          <path d="M2 21c0-3 1.9-5.4 5.2-6.1" />
        </svg>
      )}
    </button>
  );
}
