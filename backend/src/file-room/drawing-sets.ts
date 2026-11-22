/**
 * Nov 20 Weekly Sync -- drawing sets. Edward: "base drawings are controlled
 * solely by the team; user inputs start as private markups visible only to
 * internal staff (X1, X2, I1, I2); revisions are reviewed, modified or deleted
 * before being published to base drawings. Architect revisions before the
 * decimal (1.0), our markup revisions after it, 01 to 05 (1.02)."
 *
 * Pure helpers; the service (drawing-sets.service.ts) does the saving.
 */
import { MARKUP_LEADS } from './markups';

/** A drawing set: anything in the build set's folders, or under a "Base sets" folder. */
export function isBaseArea(folderPath: string[] | null | undefined, buildSet: string[]): boolean {
  const path = (folderPath || []).map((p) => String(p).trim().toLowerCase());
  if (!path.length) return false;
  if (buildSet.some((b) => b.trim().toLowerCase() === path[0])) return true;
  return path.includes('base sets');
}

/** Who may put base drawings in: admin and principal (i-1, i-2), and the people named in Settings. */
export function canUploadBase(claims: { sub?: string; roleKey?: string | null } | null | undefined, allowed: string[]): boolean {
  if (!claims) return false;
  if (MARKUP_LEADS.includes(String(claims.roleKey || ''))) return true;
  return !!claims.sub && allowed.includes(claims.sub);
}

export const MAX_MINOR = 5;

/** "Rev 0", "Rev 0.01", "Rev 1", "Rev 1.02" (Nov 22: as Edward writes them). */
export function revLabel(major?: number | null, minor?: number | null): string {
  if (major == null) return '';
  return minor ? `Rev ${major}.${String(minor).padStart(2, '0')}` : `Rev ${major}`;
}

type RevFile = { id: string; revMajor?: number | null; revMinor?: number | null; updatedAt?: string | null };

/**
 * A new upload of a document already in the set is the architect's next
 * revision: one more before the decimal, nothing after. Nov 22: the original
 * is Rev 0 (Edward's "Base Dwg"), then Rev 1, Rev 2. Older revisions with no
 * number yet count by how many there are.
 */
export function nextUploadRev(others: RevFile[]): { revMajor: number; revMinor: number } {
  const majors = others.map((f) => f.revMajor).filter((n): n is number => n != null);
  const top = majors.length ? Math.max(...majors) : others.length - 1;
  return { revMajor: top + 1, revMinor: 0 };
}

/** Publishing the team's markups: the next number after the decimal on that architect revision, up to .05. */
export function nextMinor(group: RevFile[], major: number): number {
  const minors = group.filter((f) => f.revMajor === major).map((f) => f.revMinor || 0);
  const next = (minors.length ? Math.max(...minors) : 0) + 1;
  if (next > MAX_MINOR) throw new Error(`Rev ${major}.${String(MAX_MINOR).padStart(2, '0')} is the last markup revision on this architect revision — upload the architect’s next revision first.`);
  return next;
}

/**
 * Numbers for drawings already in the set (a preview, then Apply): each
 * document's revisions by date, oldest Rev 0. Documents with no number yet are
 * numbered; documents numbered the earlier way (first one Rev 1, Nov 20) move
 * one lower so they start at Rev 0.
 */
export function backfillPlan<T extends RevFile & { groupId?: string | null; name: string; folderPath?: string[] | null }>(files: T[]): { id: string; name: string; rev: string; revMajor: number; revMinor: number }[] {
  const groups = new Map<string, T[]>();
  for (const f of files) {
    const k = f.groupId || 'solo:' + f.id;
    groups.set(k, [...(groups.get(k) || []), f]);
  }
  const out: { id: string; name: string; rev: string; revMajor: number; revMinor: number }[] = [];
  for (const g of groups.values()) {
    if (g.some((f) => f.revMajor != null)) {
      const majors = g.map((f) => f.revMajor).filter((n): n is number => n != null);
      if (Math.min(...majors) >= 1 && g.every((f) => f.revMajor != null)) {
        for (const f of g) out.push({ id: f.id, name: f.name, rev: `${revLabel(f.revMajor, f.revMinor)} → ${revLabel(f.revMajor! - 1, f.revMinor)}`, revMajor: f.revMajor! - 1, revMinor: f.revMinor || 0 });
      }
      continue;
    }
    g.sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
    g.forEach((f, i) => out.push({ id: f.id, name: f.name, rev: revLabel(i, 0), revMajor: i, revMinor: 0 }));
  }
  return out;
}

/** A review layer's code: I for our team, X for outside (consultants, subs). */
export const LAYER_CODE = /^([IX])(\d{1,3})$/;

/** The next free code for a new reviewer on this drawing ("I3", "X1"). */
export function nextLayerCode(existing: (string | null | undefined)[], outside: boolean): string {
  const prefix = outside ? 'X' : 'I';
  const used = existing.map((l) => LAYER_CODE.exec(String(l || ''))).filter((m) => m && m[1] === prefix).map((m) => Number(m![2]));
  return `${prefix}${(used.length ? Math.max(...used) : 0) + 1}`;
}

export interface DrawingEvent { at: string; by: string; kind: string; text: string; layer?: string | null }

/** Append to a drawing's log, keeping the newest 300. */
export function logEvent(log: DrawingEvent[] | null | undefined, e: DrawingEvent): DrawingEvent[] {
  return [...(log || []), e].slice(-300);
}

/**
 * A drawing's history, newest first: its revisions, what was logged on each
 * (approvals, publishes, flags), the review layers started on it and the RFIs
 * raised from it, and when it was emailed.
 */
export function drawingHistory(input: {
  revisions: { id: string; name: string; revMajor?: number | null; revMinor?: number | null; uploadedBy?: string | null; updatedAt?: string | null; drawingLog?: DrawingEvent[] | null }[];
  markups: { fileId: string; layer?: string | null; authorName?: string | null; createdAt: string; linkType?: string | null; linkId?: string | null }[];
  shares?: { fileId: string; at: string; by?: string | null; to?: string | null }[];
}): DrawingEvent[] {
  const rev = new Map(input.revisions.map((r) => [r.id, revLabel(r.revMajor, r.revMinor) || r.name]));
  const out: DrawingEvent[] = [];
  for (const r of input.revisions) {
    out.push({ at: r.updatedAt || '', by: r.uploadedBy || 'Someone', kind: 'upload', text: `${revLabel(r.revMajor, r.revMinor) || 'A revision'} put in` });
    for (const e of r.drawingLog || []) if (e.kind !== 'upload') out.push({ ...e, text: `${rev.get(r.id)}: ${e.text}` });
  }
  const firstOfLayer = new Map<string, (typeof input.markups)[number]>();
  for (const m of [...input.markups].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const k = `${m.fileId}|${m.layer || 'own:' + (m.authorName || '')}`;
    if (!firstOfLayer.has(k)) firstOfLayer.set(k, m);
    if (m.linkType === 'rfi' && m.linkId) out.push({ at: m.createdAt, by: m.authorName || 'Someone', kind: 'rfi', text: `${rev.get(m.fileId)}: markup linked to an RFI`, layer: m.layer || null });
  }
  for (const m of firstOfLayer.values()) out.push({ at: m.createdAt, by: m.authorName || 'Someone', kind: 'layer', text: `${rev.get(m.fileId)}: started ${m.layer ? `layer ${m.layer}` : 'their own layer'}`, layer: m.layer || null });
  for (const s of input.shares || []) out.push({ at: s.at, by: s.by || 'Someone', kind: 'share', text: `${rev.get(s.fileId)}: emailed${s.to ? ` to ${s.to}` : ''}` });
  // De-duplicate RFI lines (several markups, one RFI) and sort newest first.
  const seen = new Set<string>();
  return out.filter((e) => { const k = `${e.kind}|${e.text}|${e.at.slice(0, 16)}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------- review layer states (Nov 22, Edward p5-8)
export const LAYER_STATES = ['private', 'routed', 'hold', 'approved', 'rejected', 'modified'] as const;
export type LayerState = typeof LAYER_STATES[number];
export const LAYER_STATE_LABEL: Record<LayerState, string> = { private: 'Private', routed: 'Routed', hold: 'Hold', approved: 'Approved', rejected: 'Rejected', modified: 'Modified Approved' };

/**
 * Who may move a layer to a state. Its owner asks to publish (Routed) or takes
 * it back (Private); i-1 / i-2 do everything, including routing on the owner's
 * behalf. A Modified Approved layer is only ever made by copying ("Modify").
 */
export function mayMoveLayer(to: string, o: { lead: boolean; owner: boolean; from?: string | null }): boolean {
  if (!(LAYER_STATES as readonly string[]).includes(to) || to === 'modified') return false;
  if (o.lead) return true;
  if (!o.owner) return false;
  if (to === 'routed') return !o.from || ['private', 'hold', 'rejected'].includes(o.from);
  if (to === 'private') return o.from === 'routed';
  return false;
}

/** Published layers: approved, or i-1 / i-2's modified copies. */
export const isPublishedState = (s?: string | null) => s === 'approved' || s === 'modified';
