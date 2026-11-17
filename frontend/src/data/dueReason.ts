import { todayISO } from './localDate';

/**
 * Nov 17 sync (Astrid): moving or clearing an overdue task's due date needs a
 * reason. The server enforces it too (task-rules.ts dueChangeReasonMissing);
 * this asks before saving instead of after a refusal.
 */
export const DUE_REASONS = ['Client hold', 'Waiting on others', 'Scope change', 'Weather', 'Other'] as const;

export function dueReasonNeeded(was: string | null | undefined, next: string | null | undefined, open: boolean, today = todayISO()): boolean {
  if (!open) return false;
  const a = String(was || '').slice(0, 10);
  const b = String(next || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(a) && a < today && a !== b;
}

/** "Client hold — waiting on tile pick" from the picked reason and the note. */
export const dueReasonText = (r: { choice: string; note: string }) => (r.note.trim() ? (r.choice === 'Other' ? r.note.trim() : `${r.choice} — ${r.note.trim()}`) : r.choice);
