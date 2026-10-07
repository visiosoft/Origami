/**
 * Parent / child marker on a task card: a link symbol with P (and how many
 * subtasks are done) or C (and, on hover, which task it belongs to).
 */
export function TaskLinkBadge({ kind, text, title, onClick }: { kind: 'P' | 'C'; text?: string; title: string; onClick?: () => void }) {
  const parent = kind === 'P';
  return (
    <span
      title={title}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, height: 20, padding: '0 7px', borderRadius: 999, flexShrink: 0,
        fontSize: 10.5, fontWeight: 700, lineHeight: 1, cursor: onClick ? 'pointer' : 'default',
        background: parent ? 'rgba(245, 196, 67, 0.22)' : 'rgba(29, 29, 27, 0.07)', color: parent ? '#7A5A06' : 'var(--body)',
      }}
    >
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {kind}{text ? <span style={{ fontWeight: 600 }}>&nbsp;{text}</span> : null}
    </span>
  );
}
