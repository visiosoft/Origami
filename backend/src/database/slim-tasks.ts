import type { Repository } from 'typeorm';

/**
 * Task lists (the board, the Special Actions Log) don't need each task's full
 * comment thread, history or queued emails -- the drawer loads those when a
 * task is opened. Leaving them out keeps the lists small to read and send.
 */
export const HEAVY_TASK_COLUMNS = ['comments', 'activity', 'pendingNotices', 'derivedRefs'];

/** A `select` of every column but the heavy ones (undefined when the repository has no metadata, e.g. in tests). */
export function slimSelect(repo: Repository<any>): Record<string, true> | undefined {
  const cols = (repo as any).metadata?.columns?.map((c: { propertyName: string }) => c.propertyName) as string[] | undefined;
  return cols?.length ? Object.fromEntries(cols.filter((c) => !HEAVY_TASK_COLUMNS.includes(c)).map((c) => [c, true])) : undefined;
}

/** A hydrated task without the heavy fields; `rawComments` is the row's own comments, when they were read. */
export function slimTask<T extends Record<string, any>>(task: T, rawComments?: unknown) {
  const { comments: _c, activity: _a, pendingNotices: _p, derivedRefs: _d, ...rest } = task;
  const commentCount: number | null = task.commentCount ?? (Array.isArray(rawComments) ? rawComments.length : null);
  return { ...rest, commentCount };
}

/** Comment counts for tasks saved before the count was kept (read once, at start-up). */
export async function backfillCommentCounts(repo: Repository<any>, log?: { log: (m: string) => void }) {
  const { IsNull } = await import('typeorm');
  const rows: { id: string; comments: unknown }[] = await repo.find({ where: { commentCount: IsNull() }, select: { id: true, comments: true } });
  for (const r of rows) await repo.update({ id: r.id }, { commentCount: Array.isArray(r.comments) ? r.comments.length : 0 });
  if (rows.length) log?.log(`Counted comments on ${rows.length} tasks`);
}

/**
 * Who created each board task, for tasks saved before that was kept in its own
 * column: read from the "created" event in its history (once, at start-up), so
 * the "From me" filter works on slim lists, which leave the history out.
 */
export async function backfillCreatedBy(repo: Repository<any>, log?: { log: (m: string) => void }) {
  const { IsNull } = await import('typeorm');
  const rows: { id: string; activity: unknown }[] = await repo.find({ where: { createdById: IsNull() }, select: { id: true, activity: true } });
  for (const r of rows) {
    const created = Array.isArray(r.activity) ? (r.activity as { type?: string; byId?: string; actorId?: string; by?: string }[]).find((e) => e?.type === 'created') : undefined;
    // '' marks "looked, nobody recorded" so the row isn't read again next start.
    await repo.update({ id: r.id }, { createdById: created?.actorId || created?.byId || '', ...(created?.by ? { createdByName: created.by } : {}) });
  }
  if (rows.length) log?.log(`Recorded who created ${rows.length} tasks`);
}
