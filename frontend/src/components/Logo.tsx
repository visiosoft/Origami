// Self-contained Origami brand mark (folded-paper crane) + wordmark lockup.
// Replaces the design's external assets/origami-logo.png with an inline SVG so
// there is no missing-asset dependency.

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

/** Full lockup: mark + "Origami" wordmark + "Design + Build" subtitle. */
export function Logo({ markSize = 30 }: { markSize?: number }) {
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
