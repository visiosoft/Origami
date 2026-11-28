/** Nov 27 (Weekly Sync): same rule as the server's rfi-label.ts -- "RFI-012 · Toilet change". */
export const RFI_LABEL_MAX = 25;
export function shortNameOf(text: string | null | undefined, max = RFI_LABEL_MAX): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const word = cut.lastIndexOf(' ');
  return (word > max * 0.5 ? cut.slice(0, word) : cut).trim() + '…';
}
export function rfiLabelOf(r: { number?: string; shortLabel?: string | null; subject?: string | null }): string {
  const name = shortNameOf(r.shortLabel || r.subject);
  return name ? `${r.number || ''} · ${name}`.replace(/^ · /, '') : (r.number || '');
}
