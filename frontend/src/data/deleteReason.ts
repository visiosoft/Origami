/**
 * Nov 27 (Weekly Sync, decision): no quick delete -- a task is deleted only
 * from inside it, and only after saying why. The reason goes into the
 * project's audit trail. Returns the reason, or null when cancelled.
 */
export function askDeleteReason(title: string, subtasks = 0, ask: (msg: string) => string | null = (m) => window.prompt(m)): string | null {
  const extra = subtasks ? ` Its ${subtasks} subtask${subtasks === 1 ? '' : 's'} go${subtasks === 1 ? 'es' : ''} too.` : '';
  for (;;) {
    const r = ask(`Delete “${title || 'this task'}”?${extra}\n\nWhy is it being deleted? (required — it’s kept in the audit trail)`);
    if (r === null) return null;
    if (r.trim()) return r.trim().slice(0, 500);
  }
}
