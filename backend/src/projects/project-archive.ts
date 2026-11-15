/**
 * Closed-out and cancelled projects move to the archive on their own (Nov 13
 * sync): 10 calendar days after they reached that stage. Archived projects
 * leave lists, boards and pickers but are kept, and can be restored.
 */
export const ARCHIVE_AFTER_DAYS = 10;
const DAY = 86_400_000;

export const isArchiveStage = (stage: unknown) => /^(closeout|close-out|closed|cancell?ed)$/i.test(String(stage ?? '').trim());

type P = { id: number; name: string; stage: string; stageChangedAt?: string | null; archivedAt?: string | null };

/** When it will be archived (ISO), or null when it isn't on its way there. */
export function archiveOn(p: P): string | null {
  if (p.archivedAt || !isArchiveStage(p.stage) || !p.stageChangedAt) return null;
  const t = Date.parse(p.stageChangedAt);
  return Number.isFinite(t) ? new Date(t + ARCHIVE_AFTER_DAYS * DAY).toISOString() : null;
}

export const archiveDue = (p: P, now = Date.now()) => { const on = archiveOn(p); return !!on && Date.parse(on) <= now; };

/**
 * What switching it on would do: archive the due ones now; the closed /
 * cancelled ones without a date start counting from today.
 */
export function archivePlan(rows: P[], now = Date.now()) {
  const due = rows.filter((p) => archiveDue(p, now)).map((p) => ({ id: p.id, name: p.name, stage: p.stage, since: p.stageChangedAt! }));
  const waiting = rows.filter((p) => !archiveDue(p, now) && archiveOn(p)).map((p) => ({ id: p.id, name: p.name, stage: p.stage, on: archiveOn(p)! }));
  const undated = rows.filter((p) => !p.archivedAt && isArchiveStage(p.stage) && !p.stageChangedAt)
    .map((p) => ({ id: p.id, name: p.name, stage: p.stage, on: new Date(now + ARCHIVE_AFTER_DAYS * DAY).toISOString() }));
  return { due, waiting, undated };
}
