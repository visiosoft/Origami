/** The round ↗ button that opens the page behind a dashboard card. */
export const Arrow = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" className="do-arrow" onClick={onClick} aria-label={label} title={label}>
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'currentColor' }}><path d="M7 17 17 7M8 7h9v9" /></svg>
  </button>
);
