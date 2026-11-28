/** Nov 27 (Weekly Sync): the drawing-set tabs, worked out on the server (drawing-sets.ts drawingTab). */
export type DrawingTab = 'approved' | 'review' | 'city' | 'other';
export const DRAWING_TAB_LABEL: Record<DrawingTab, string> = {
  approved: 'Approved — work from this',
  review: 'Under review',
  city: 'Not city-approved, in use',
  other: 'Other files',
};
/** The chip in the viewer: what the open drawing is, in a word or two. */
export const DRAWING_TAB_CHIP: Record<DrawingTab, { text: string; short: string; bg: string; c: string } | null> = {
  approved: { text: '✓ Approved set — work from this', short: '✓ Approved set', bg: '#DCEBDD', c: '#2F6B3A' },
  review: { text: 'Under review — not for construction', short: 'Under review', bg: '#FBEFD5', c: '#7A4B00' },
  city: { text: '⚠ Not city-approved — in use for early work', short: '⚠ Not city-approved', bg: '#FBE3D6', c: '#8E2E0A' },
  other: null,
};
export const TAB_STORE = 'fileRoom.drawingTab';
export function savedTab(): DrawingTab | 'all' {
  try { const v = localStorage.getItem(TAB_STORE); return v === 'approved' || v === 'review' || v === 'city' || v === 'other' ? v : 'all'; } catch { return 'all'; }
}
export function saveTab(v: DrawingTab | 'all') { try { localStorage.setItem(TAB_STORE, v); } catch { /* private window */ } }
/** The tabs to show, with counts; "All" first for managers. Nothing when the folder holds no drawings. */
export function tabOptions(tabs: DrawingTab[] | undefined, counts: Partial<Record<DrawingTab, number>> | undefined, manage: boolean): [DrawingTab | 'all', string, number?][] {
  const list = tabs || [];
  const c = counts || {};
  const drawings = (c.approved || 0) + (c.review || 0) + (c.city || 0);
  if (!drawings) return [];
  const total = list.reduce((n, t) => n + (c[t] || 0), 0);
  return [...(manage ? [['all', 'All', total] as [DrawingTab | 'all', string, number?]] : []), ...list.map((t) => [t, DRAWING_TAB_LABEL[t], c[t] || 0] as [DrawingTab | 'all', string, number?])];
}
