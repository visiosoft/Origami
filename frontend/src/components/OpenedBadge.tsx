/** When something we sent was opened (Oct 27 backlog item 12). */
export interface Opened { firstOpenedAt?: string | null; lastOpenedAt?: string | null; opens?: number | null }

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * "Opened Oct 28, 2:14 PM · 3 views" in green, or "Not opened yet". Counts
 * people only -- mail scanners that fetch every link are left out.
 */
export function OpenedBadge({ opened, compact }: { opened?: Opened | null; compact?: boolean }) {
  const n = opened?.opens || 0;
  const first = opened?.firstOpenedAt;
  const style = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: compact ? '1px 8px' : '2px 9px', borderRadius: 999, fontSize: compact ? 11 : 11.5, fontWeight: 700, whiteSpace: 'nowrap' as const };
  if (!first) return <span title="No one has opened it yet" style={{ ...style, background: 'var(--panel)', color: 'var(--muted)' }}>Not opened yet</span>;
  const last = opened?.lastOpenedAt && opened.lastOpenedAt !== first ? ` · last ${when(opened.lastOpenedAt)}` : '';
  return (
    <span title={`First opened ${when(first)}${last}`} style={{ ...style, background: 'var(--c-d2ead3)', color: 'var(--c-1e6b36)' }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 99, background: 'currentColor' }} />
      Opened {when(first)}{n > 1 ? ` · ${n} views` : ''}
    </span>
  );
}
