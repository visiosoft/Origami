import { randomBytes } from 'crypto';
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

// ------------------------------------------------------------------ ids and project codes (Oct 27 backlog)

/** A board task's id: unique even when two are made in the same millisecond (the old 'T-' + Date.now() could collide). */
export function newTaskId(): string {
  // 48 random bits: a short suffix (4 base-36 chars) still collided, by the birthday odds, when many were made at once.
  return `T-${Date.now().toString(36)}${randomBytes(6).toString('hex')}`;
}

/** "Narvaes Residence (91-1062 Kuhina St)" -> "NARV"; numbers kept, so "1311 Countryside" -> "1311". */
export function baseProjectCode(name: string): string {
  const words = String(name || '').replace(/\(.*?\)/g, ' ').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const first = words.find((w) => !['THE', 'A', 'AN'].includes(w)) || words[0] || 'PRJ';
  return first.slice(0, 4).padEnd(3, 'X');
}

/** A clean, typed code (2-8 letters or digits), or '' when it can't be one. */
export const cleanProjectCode = (v: unknown) => {
  const c = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length >= 2 ? c.slice(0, 8) : '';
};

/**
 * Every project's code: the one set on it, else made from its name; a clash
 * gets a number (NARV, NARV2), oldest project first so codes don't shift.
 */
export function projectCodes(projects: { id: number; name: string; code?: string | null }[]): Map<number, string> {
  const out = new Map<number, string>();
  const used = new Set<string>();
  const sorted = [...projects].sort((a, b) => a.id - b.id);
  for (const p of sorted) { const c = cleanProjectCode(p.code); if (c) { out.set(p.id, c); used.add(c); } }
  for (const p of sorted) {
    if (out.has(p.id)) continue;
    const base = baseProjectCode(p.name);
    let c = base;
    for (let n = 2; used.has(c); n++) c = `${base}${n}`;
    out.set(p.id, c);
    used.add(c);
  }
  return out;
}

/** Tasks on no project. */
export const GENERAL_CODE = 'GEN';
/** "NARV-T-2026-0007" */
export const taskNumber = (serial: string | null | undefined, code: string | null | undefined) => (serial ? `${code || GENERAL_CODE}-${serial}` : '');
