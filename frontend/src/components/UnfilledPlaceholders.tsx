import { labelOf, unfilled } from '../data/placeholders';

/**
 * Under a compose box: the merge fields still unfilled, so nothing goes out
 * reading "Hi {client_name}". The server refuses such a send too.
 */
export function UnfilledPlaceholders({ texts }: { texts: (string | null | undefined)[] }) {
  const left = unfilled(...texts);
  if (!left.length) return null;
  return (
    <div role="alert" style={{ margin: '8px 0', padding: '8px 12px', borderRadius: 8, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.2)', fontSize: 12, color: '#8E2E0A', lineHeight: 1.5 }}>
      <b>Fill in before sending:</b> {[...new Set(left.map(labelOf))].join(', ')}
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, marginTop: 2 }}>{left.map((p) => p.raw).join('  ')}</div>
    </div>
  );
}
