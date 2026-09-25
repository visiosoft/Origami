import type { CSSProperties, ReactNode } from 'react';

/** Google Maps with a pin on this address -- opens the Maps app on a phone. No API key needed. */
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const Pin = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx={12} cy={10} r={3} />
  </svg>
);

/**
 * An address you can tap to get directions. Clicks don't reach the card or
 * row underneath, so opening Maps never also opens the record.
 */
export function MapLink({ address, children, style, pin = true, iconSize }: { address?: string | null; children?: ReactNode; style?: CSSProperties; pin?: boolean; iconSize?: number }) {
  const a = (address || '').trim();
  if (!a) return null;
  return (
    <a href={mapsUrl(a)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open in Google Maps"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted currentColor', minWidth: 0, ...style }}>
      {pin && <Pin size={iconSize} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{children ?? a}</span>
    </a>
  );
}

/** A phone number you can tap to call (and long-press to text). */
export function PhoneLink({ phone, style }: { phone?: string | null; style?: CSSProperties }) {
  const p = (phone || '').trim();
  if (!p || p === '—') return <>{p || '—'}</>;
  const dial = p.replace(/[^\d+]/g, '');
  if (dial.replace('+', '').length < 7) return <>{p}</>;
  return <a href={`tel:${dial}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted currentColor', ...style }}>{p}</a>;
}

/** An email address that opens a new message. */
export function EmailLink({ email, style }: { email?: string | null; style?: CSSProperties }) {
  const m = (email || '').trim();
  if (!m || m === '—' || !m.includes('@')) return <>{m || '—'}</>;
  return <a href={`mailto:${m}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted currentColor', ...style }}>{m}</a>;
}
