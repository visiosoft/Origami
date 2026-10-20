/**
 * Task emails wait for Save (Oct 2026): while a task is being edited (autosave),
 * who-was-assigned / who-was-added / it's-done notices are held on the task and
 * go out when the person presses Save -- or by themselves 15 minutes later, so
 * none is lost if the page is just closed.
 */
export interface PendingNotice {
  kind: 'assigned' | 'added' | 'done' | 'status';
  /** assigned: [the assignee]; added: the new collaborators; done / status: unused (everyone on the task). */
  ids: string[];
  /** status: the status it moved to. */
  status?: string;
  actor: { id?: string; name: string };
  at: string;
}
export const PENDING_GRACE_MS = 15 * 60 * 1000;

/** Add notices to what's held: a newer assignment replaces an older one; collaborators add up. */
export function holdNotices(held: PendingNotice[] | null | undefined, add: PendingNotice[]): PendingNotice[] | null {
  let out = [...(held || [])];
  for (const n of add) {
    if (n.kind === 'assigned') out = [...out.filter((x) => x.kind !== 'assigned'), n];
    else if (n.kind === 'added') {
      const prev = out.find((x) => x.kind === 'added');
      if (prev) prev.ids = Array.from(new Set([...prev.ids, ...n.ids]));
      else out.push({ ...n, ids: [...n.ids] });
    } else if (n.kind === 'status') out = [...out.filter((x) => x.kind !== 'status'), n];
    else if (!out.some((x) => x.kind === 'done')) out.push(n);
  }
  return out.length ? out : null;
}

/** Held notices that still hold true for the task as it is now. */
export function stillTrue(held: PendingNotice[] | null | undefined, now: { assigneeId?: string | null; collaboratorIds: string[]; done: boolean; status?: string | null }): PendingNotice[] {
  return (held || []).flatMap((n) => {
    if (n.kind === 'status') return !now.done && n.status === now.status ? [n] : [];
    if (n.kind === 'assigned') return n.ids[0] && n.ids[0] === now.assigneeId ? [n] : [];
    if (n.kind === 'added') { const ids = n.ids.filter((id) => now.collaboratorIds.includes(id)); return ids.length ? [{ ...n, ids }] : []; }
    return now.done ? [n] : [];
  });
}

export const overdue = (held: PendingNotice[] | null | undefined, nowMs = Date.now()) =>
  (held || []).some((n) => nowMs - Date.parse(n.at) >= PENDING_GRACE_MS);
