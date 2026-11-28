/**
 * Nov 17 sync (Edward): markups for an RFI stay off the main drawing set until
 * the RFI is vetted, so trades aren't confused by live edits. They go on the
 * RFI's own layer, seen by our team only; once the RFI is answered or closed
 * "Publish to set" moves them onto a normal layer everyone on the drawing sees.
 */
export const rfiDraftLayer = (number: string) => `${number} draft`.replace(/[\s,]+/g, ' ').trim().slice(0, 60);
export const rfiPublishedLayer = (number: string) => `${number}`.replace(/[\s,]+/g, ' ').trim().slice(0, 60);

/** The RFI's callouts, numbered 1, 2, 3 in the order they were drawn. */
export function numberCallouts<T extends { createdAt: string; id: string }>(rows: T[]): (T & { n: number })[] {
  return [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map((m, i) => ({ ...m, n: i + 1 }));
}

/** Publishing waits until the RFI has an answer (or is closed). */
export const canPublish = (status: string) => status === 'answered' || status === 'closed';

/**
 * Nov 27 (Weekly Sync): each callout on an RFI has a short named label (25
 * characters) -- "1 · Pen · Toilet change" -- set on the RFI, falling back
 * to the markup's own note or text.
 */
export const CALLOUT_LABEL_MAX = 25;
export const cleanCalloutLabel = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, CALLOUT_LABEL_MAX);
export function calloutLabel(data: any): string {
  return cleanCalloutLabel(data?.label) || cleanCalloutLabel(data?.note) || cleanCalloutLabel(data?.text);
}
export const KIND_NAMES: Record<string, string> = { pen: 'Pen', ink: 'Pen', highlighter: 'Highlighter', cloud: 'Cloud', rect: 'Box', ellipse: 'Ellipse', arrow: 'Arrow', line: 'Line', text: 'Text', note: 'Note', stamp: 'Stamp', symbol: 'Symbol', measure: 'Measure', area: 'Area', callout: 'Callout', polygon: 'Polygon' };
export const kindName = (k: string) => KIND_NAMES[k] || (k ? k[0].toUpperCase() + k.slice(1) : 'Markup');
