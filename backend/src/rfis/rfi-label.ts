/**
 * Nov 27 (Weekly Sync, Edward): an RFI's label is its number and a short
 * name of no more than 25 characters -- "RFI-012 · Toilet change" -- with the
 * detail kept in notes and updates rather than a long description. Without a
 * short label, the subject is cut to fit.
 */
export const RFI_LABEL_MAX = 25;
export function shortName(text: string | null | undefined, max = RFI_LABEL_MAX): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const word = cut.lastIndexOf(' ');
  return (word > max * 0.5 ? cut.slice(0, word) : cut).trim() + '…';
}
export function rfiLabel(r: { number: string; shortLabel?: string | null; subject?: string | null }): string {
  const name = shortName(r.shortLabel || r.subject);
  return name ? `${r.number} · ${name}` : r.number;
}
