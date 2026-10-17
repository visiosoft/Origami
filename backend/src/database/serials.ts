/**
 * Serial numbers on special actions (Oct 16): one sequence per kind, per
 * project, per year -- T-2026-0142 (tasks), FR-2026-0031 (FOR RECORD),
 * MTG-2026-0012 (meetings). RFIs and change orders keep RFI-004 / CO-003.
 */
export type SerialKind = 'task' | 'record' | 'meeting';
export const SERIAL_PREFIX: Record<SerialKind, string> = { task: 'T', record: 'FR', meeting: 'MTG' };
const FOR_RECORD = ['FYI', 'Observation', 'Decision'];

/** A Request Log entry is a task unless its topic is a FOR RECORD one. */
export const logSerialKind = (topicType?: string | null): SerialKind => (FOR_RECORD.includes(String(topicType || '')) ? 'record' : 'task');

/** The year a record counts in: from its created date, else this year. */
export function serialYear(date?: string | null): number {
  const y = Number(String(date || '').slice(0, 4));
  return y >= 2000 && y < 3000 ? y : new Date().getFullYear();
}

/** The next serial after the ones already taken in the same project. */
export function nextSerial(taken: (string | null | undefined)[], kind: SerialKind, year: number): string {
  const head = `${SERIAL_PREFIX[kind]}-${year}-`;
  const max = taken.reduce((m, s) => (s && s.startsWith(head) ? Math.max(m, parseInt(s.slice(head.length), 10) || 0) : m), 0);
  return head + String(max + 1).padStart(4, '0');
}

/**
 * Number records that have none yet, oldest first, each in its own scope
 * (project) and year. Returns [id, serial] pairs to save.
 */
export function backfillSerials<R extends { id: string; serial?: string | null }>(
  rows: R[], scope: (r: R) => string, kind: (r: R) => SerialKind, created: (r: R) => string | null | undefined,
): [string, string][] {
  const taken = new Map<string, string[]>();
  for (const r of rows) if (r.serial) { const k = scope(r); taken.set(k, [...(taken.get(k) || []), r.serial]); }
  const out: [string, string][] = [];
  const todo = rows.filter((r) => !r.serial).sort((a, b) => String(created(a) || '').localeCompare(String(created(b) || '')) || String(a.id).localeCompare(String(b.id)));
  for (const r of todo) {
    const k = scope(r);
    const list = taken.get(k) || [];
    const s = nextSerial(list, kind(r), serialYear(created(r)));
    list.push(s); taken.set(k, list); out.push([r.id, s]);
  }
  return out;
}
