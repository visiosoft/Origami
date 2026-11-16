/**
 * Quo tasks (D6, Nov 15): what Quo's versioned API (2026-03-30) sends and
 * how a Quo task becomes an ODIN Request Log task. Pure, so it can be tested.
 *
 *   GET   https://api.quo.com/tasks?limit=&after=      list (cursor paging)
 *   GET   https://api.quo.com/tasks/{taskId}            one task
 *   PATCH https://api.quo.com/tasks/{taskId}/status     { status: 'open' | 'completed' }
 *   POST  https://api.quo.com/webhooks                  { url, events: ['task.*'] } → { data: { id, key } }
 *   Headers: Authorization: <API key>, Quo-Api-Version: 2026-03-30
 */
export const QUO_API = 'https://api.quo.com';
export const QUO_VERSION = '2026-03-30';
export const QUO_TASK_EVENTS = [
  'task.created', 'task.updated', 'task.completed', 'task.reopened', 'task.deleted',
  'task.assigned', 'task.unassigned', 'task.duedate.updated', 'task.duedate.removed',
] as const;
/** The ODIN-side actor for changes that came from Quo, so they aren't sent back. */
export const QUO_ACTOR = { id: 'quo-sync', name: 'Quo' };

export interface QuoTask {
  taskId: string; status: 'open' | 'completed' | 'deleted'; title?: string | null; description?: string | null;
  dueDate?: string | null; assignedTo?: string | null; createdBy?: string | null; createdAt?: string | null;
  completedAt?: string | null; conversationId?: string | null; activityId?: string | null; phoneNumberId?: string | null; revision?: number;
}
/** What the task came from, if it was made on a text or a call. */
export interface QuoOrigin { kind: 'text' | 'call'; from: string; to: string; at: string | null; text?: string | null }

/** The task id in a webhook delivery, whatever shape it came in. */
export function taskIdOf(payload: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (v: any, depth: number): string | null => {
    if (!v || typeof v !== 'object' || depth > 6 || seen.has(v)) return null;
    seen.add(v);
    if (typeof v.taskId === 'string' && v.taskId) return v.taskId;
    for (const k of ['data', 'object']) { const hit = walk(v[k], depth + 1); if (hit) return hit; }
    for (const x of Object.values(v)) { const hit = walk(x, depth + 1); if (hit) return hit; }
    return null;
  };
  return walk(payload, 0);
}

export const eventTypeOf = (payload: any): string => String(payload?.type || payload?.object?.type || payload?.event || '');

const when = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(+d) ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : '';
};

/** "Quo, text from Alton HVAC to Edward on Oct 21, 2026, 1:09 PM" -- or who made it in Quo. */
export function originLabel(o: QuoOrigin | null, createdByName: string | null, createdAt: string | null | undefined) {
  if (o) return `Quo, ${o.kind} from ${o.from || 'unknown'} to ${o.to || 'us'}${o.at ? ` on ${when(o.at)}` : ''}`;
  return `Quo task${createdByName ? ` by ${createdByName}` : ''}${createdAt ? ` on ${when(createdAt)}` : ''}`;
}

/** The ODIN task's fields from a Quo task. */
export function toLogTask(t: QuoTask, o: { origin: QuoOrigin | null; assigneeId: string | null; createdByName: string | null }) {
  const label = originLabel(o.origin, o.createdByName, t.createdAt);
  const body = [String(t.description || '').trim(), o.origin?.text ? `${o.origin.kind === 'call' ? 'Call' : 'Text'}: “${String(o.origin.text).trim().slice(0, 1000)}”` : '', `From ${label}.`].filter(Boolean).join('\n\n');
  return {
    subject: String(t.title || '').trim().slice(0, 250) || (o.origin?.text ? String(o.origin.text).trim().slice(0, 80) : 'Quo task'),
    description: body,
    dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : '',
    assignedToId: o.assigneeId || undefined,
    topicType: 'Task',
    originator: o.createdByName || 'Quo',
    sourceType: 'quo', sourceId: t.taskId, sourceLabel: label,
  };
}

/** US numbers read as (650) 761-4661; others as given. */
export function prettyPhone(p: string | null | undefined) {
  const d = String(p || '').replace(/\D/g, '');
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : String(p || '');
}
export const phoneKey = (p: string | null | undefined) => String(p || '').replace(/\D/g, '').slice(-10);
