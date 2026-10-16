import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import type { User } from '../data/users';

const KEY = 'origami.taskScope';

/** Whether a task belongs to this person — by id, falling back to the name. */
export function isMine(
  task: { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string; collaborators?: { id: string }[] },
  user?: User,
  /** Count tasks this person collaborates on too (the "My tasks" filter does; reminders about your own work don't). */
  includeCollaborating = false,
): boolean {
  if (!user) return false;
  if (includeCollaborating && (task.collaborators || []).some((c) => c.id === user.id)) return true;
  const id = task.assigneeId ?? task.assignedToId;
  if (id) return id === user.id;
  const name = task.assignee ?? task.assignedTo;
  return !!name && name.trim().toLowerCase() === user.name.trim().toLowerCase();
}

/** Whether this person raised the task (the "created" entry in its activity). */
export function raisedBy(task: { activity?: { type: string; byId?: string }[] }, userId?: string): boolean {
  if (!userId) return false;
  const created = (task.activity || []).find((a) => a.type === 'created');
  return !!created && created.byId === userId;
}

/** Raised by this person and handed to someone else -- "From me". */
export function fromMe(
  task: { createdById?: string; activity?: { type: string; byId?: string }[]; originator?: string; assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string },
  user?: User,
): boolean {
  if (!user) return false;
  const mine = task.createdById === user.id || raisedBy(task, user.id)
    || (!!task.originator && task.originator.trim().toLowerCase() === user.name.trim().toLowerCase());
  return mine && !isMine(task, user);
}

export type TaskScope = 'all' | 'mine' | 'fromMe' | 'assigned';
const SCOPES: TaskScope[] = ['all', 'mine', 'fromMe', 'assigned'];

/**
 * Whose tasks to show -- Everyone (the default), My tasks, From me (what I
 * handed to others), or Assigned to a chosen person. Shared by every task
 * surface and remembered between visits.
 *
 * Clients and consultants never get a choice: the server only sends them their
 * own tasks, so the toggle is hidden rather than offering something that can't
 * happen.
 */
export function useTaskScope() {
  const { currentUser, tier, users } = useApp();
  const restricted = tier === 'client' || tier === 'consultant';
  // When looking at everyone's work, optionally narrow to one person.
  const [person, setPerson] = useState('');

  const [scope, setScopeState] = useState<TaskScope>(() => {
    try { const v = localStorage.getItem(KEY) as TaskScope; return SCOPES.includes(v) ? v : 'all'; } catch { return 'all'; }
  });

  const setScope = useCallback((next: TaskScope) => {
    setScopeState(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (restricted && scope !== 'mine') setScope('mine'); }, [restricted, scope, setScope]);

  const filter = useCallback(
    <T extends { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string }>(tasks: T[]): T[] => {
      if (restricted) return tasks;              // the server already scoped these
      if (scope === 'mine') return tasks.filter((t) => isMine(t, currentUser, true));
      if (scope === 'fromMe') return tasks.filter((t) => fromMe(t as never, currentUser));
      if (scope === 'assigned') {
        const who = person ? users.find((u) => u.id === person) : undefined;
        return who ? tasks.filter((t) => isMine(t, who)) : tasks.filter((t) => !!(t.assigneeId || t.assignedToId || (t.assignee || t.assignedTo || '').trim()));
      }
      return tasks;
    },
    [scope, person, restricted, currentUser, users],
  );

  /** How many tasks each scope would show -- for the counts on the toggle. */
  const counts = useCallback(
    <T extends { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string }>(tasks: T[]) => ({
      all: tasks.length,
      mine: tasks.filter((t) => isMine(t, currentUser, true)).length,
      fromMe: tasks.filter((t) => fromMe(t as never, currentUser)).length,
      assigned: tasks.filter((t) => !!(t.assigneeId || t.assignedToId || (t.assignee || t.assignedTo || '').trim())).length,
    }),
    [currentUser],
  );

  return { scope, setScope, filter, restricted, currentUser, person, setPerson, users, counts };
}

/** Narrow "Everyone" down to one person's work. */
export function PersonFilter({ person, setPerson, users, visible }: {
  person: string;
  setPerson: (id: string) => void;
  users: User[];
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <select
      value={person}
      onChange={(e) => setPerson(e.target.value)}
      title="Show one person's tasks"
      style={{
        padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)',
        background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        color: person ? 'var(--ink)' : 'var(--muted)', outline: 'none', maxWidth: 190,
      }}
    >
      <option value="">Anyone assigned</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}

/** Free-text filter over task titles and descriptions. */
export function TaskSearch({ value, onChange, placeholder = 'Search tasks…' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" strokeWidth={2.2} strokeLinecap="round"
           style={{ stroke: 'var(--c-9aa39d)', position: 'absolute', left: 11, pointerEvents: 'none' }}>
        <circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '7px 28px 7px 30px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)',
          background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)', outline: 'none', width: 190,
        }}
      />
      {value && (
        <span onClick={() => onChange('')} title="Clear"
              style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--c-9aa39d)', fontSize: 14, lineHeight: 1 }}>×</span>
      )}
    </div>
  );
}

/** Does a task match a free-text query? */
export function matchesQuery(
  task: { title?: string; description?: string; assignee?: string; assignedTo?: string; labels?: string[] },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [task.title, task.description, task.assignee, task.assignedTo, ...(task.labels ?? [])]
    .filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

/** Segmented Everyone / My tasks / From me / Assigned control. Renders nothing for restricted tiers. */
export function TaskScopeToggle({ scope, setScope, restricted, mineCount, allCount, counts }: {
  scope: TaskScope;
  setScope: (s: TaskScope) => void;
  restricted: boolean;
  mineCount: number;
  allCount: number;
  counts?: Partial<Record<TaskScope, number>>;
}) {
  if (restricted) return null;
  const opt = (value: TaskScope, label: string, count?: number) => (
    <div
      key={value}
      onClick={() => setScope(value)}
      style={{
        padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        background: scope === value ? 'var(--seg-on)' : 'transparent',
        color: scope === value ? 'var(--ink)' : 'var(--muted)',
        boxShadow: scope === value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}{count != null && <span style={{ opacity: 0.6 }}> {count}</span>}
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--c-efede8)', padding: 3, borderRadius: 999 }}>
      {opt('all', 'Everyone', counts?.all ?? allCount)}
      {opt('mine', 'My tasks', counts?.mine ?? mineCount)}
      {opt('fromMe', 'From me', counts?.fromMe)}
      {opt('assigned', 'Assigned', counts?.assigned)}
    </div>
  );
}
