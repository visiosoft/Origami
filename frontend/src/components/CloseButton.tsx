/**
 * The one close button for drawers and panels (Oct 27 sync: "standardize close
 * actions"): top right, the same size everywhere, a real button with a label.
 * Closing keeps your edits -- an open draft saves as the panel closes.
 */
export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
    </button>
  );
}
