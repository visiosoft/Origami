import { useCallback, useEffect, useId, useState } from 'react';
import { useApp } from '../AppContext';
import type { User } from '../data/users';

const KEY = 'origami.taskScope';
const PARTS_KEY = 'origami.taskScope.mine';
const PARTS_EVENT = 'origami:mineParts';

/** What "My tasks" covers: assigned to me, ones I collaborate on, ones I originated -- any mix. */
export interface MineParts { assigned: boolean; collab: boolean; originated: boolean }
const ALL_PARTS: MineParts = { assigned: true, collab: true, originated: true };
function readParts(): MineParts {
  try { const v = JSON.parse(localStorage.getItem(PARTS_KEY) || 'null'); return v && typeof v === 'object' ? { ...ALL_PARTS, ...v } : ALL_PARTS; } catch { return ALL_PARTS; }
}
/** Shared by the filter and its toggle (and remembered between visits). */
export function useMineParts(): [MineParts, (p: MineParts) => void] {
  const [parts, setParts] = useState<MineParts>(readParts);
  useEffect(() => {
    const on = () => setParts(readParts());
    window.addEventListener(PARTS_EVENT, on);
    return () => window.removeEventListener(PARTS_EVENT, on);
  }, []);
  const set = useCallback((p: MineParts) => {
    // At least one stays on -- none would hide everything.
    const next = p.assigned || p.collab || p.originated ? p : ALL_PARTS;
    try { localStorage.setItem(PARTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setParts(next);
    window.dispatchEvent(new Event(PARTS_EVENT));
  }, []);
  return [parts, set];
}

/** Is this task "mine" under the chosen parts? */
export function mineByParts(
  task: { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string; collaborators?: { id: string }[]; createdById?: string; activity?: { type: string; byId?: string }[]; originator?: string },
  user: User | undefined, parts: MineParts,
): boolean {
  if (!user) return false;
  return (parts.assigned && isMine(task, user))
    || (parts.collab && (task.collaborators || []).some((c) => c.id === user.id))
    || (parts.originated && raisedByUser(task, user));
}

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

/** Whether this person raised (originated) the task, whoever it's assigned to. */
export function raisedByUser(
  task: { createdById?: string; activity?: { type: string; byId?: string }[]; originator?: string },
  user?: Pick<User, 'id' | 'name'>,
): boolean {
  if (!user) return false;
  return task.createdById === user.id || raisedBy(task, user.id)
    || (!!task.originator && task.originator.trim().toLowerCase() === user.name.trim().toLowerCase());
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

/** Everyone, My tasks, From me, Assigned (to a person), From (a person). */
export type TaskScope = 'all' | 'mine' | 'fromMe' | 'assigned' | 'from';
const SCOPES: TaskScope[] = ['all', 'mine', 'fromMe', 'assigned', 'from'];
const SCOPE_EVENT = 'origami:task-scope';

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
  const [parts] = useMineParts();
  // When looking at everyone's work, optionally narrow to one person.
  const [person, setPerson] = useState('');

  const [scope, setScopeState] = useState<TaskScope>(() => {
    try { const v = localStorage.getItem(KEY) as TaskScope; return SCOPES.includes(v) ? v : 'all'; } catch { return 'all'; }
  });

  const setScope = useCallback((next: TaskScope) => {
    setScopeState(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    // Every task surface on the page follows (the Task page and its board share one choice).
    window.dispatchEvent(new CustomEvent(SCOPE_EVENT, { detail: next }));
  }, []);
  useEffect(() => {
    const on = (e: Event) => { const v = (e as CustomEvent<TaskScope>).detail; if (SCOPES.includes(v)) setScopeState(v); };
    window.addEventListener(SCOPE_EVENT, on);
    return () => window.removeEventListener(SCOPE_EVENT, on);
  }, []);

  useEffect(() => { if (restricted && scope !== 'mine') setScope('mine'); }, [restricted, scope, setScope]);

  const filter = useCallback(
    <T extends { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string }>(tasks: T[]): T[] => {
      if (restricted) return tasks;              // the server already scoped these
      if (scope === 'mine') return tasks.filter((t) => mineByParts(t as never, currentUser, parts));
      if (scope === 'fromMe') return tasks.filter((t) => fromMe(t as never, currentUser));
      if (scope === 'assigned') {
        const who = person ? users.find((u) => u.id === person) : undefined;
        return who ? tasks.filter((t) => isMine(t, who)) : tasks.filter((t) => !!(t.assigneeId || t.assignedToId || (t.assignee || t.assignedTo || '').trim()));
      }
      if (scope === 'from') {
        // Raised by the chosen person (everyone's tasks until someone is picked).
        const who = person ? users.find((u) => u.id === person) : undefined;
        return who ? tasks.filter((t) => raisedByUser(t as never, who)) : tasks;
      }
      return tasks;
    },
    [scope, person, restricted, currentUser, users, parts],
  );

  /** How many tasks each scope would show -- for the counts on the toggle. */
  const counts = useCallback(
    <T extends { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string }>(tasks: T[]) => ({
      all: tasks.length,
      mine: tasks.filter((t) => mineByParts(t as never, currentUser, parts)).length,
      fromMe: tasks.filter((t) => fromMe(t as never, currentUser)).length,
      assigned: tasks.filter((t) => !!(t.assigneeId || t.assignedToId || (t.assignee || t.assignedTo || '').trim())).length,
    }),
    [currentUser, parts],
  );

  return { scope, setScope, filter, restricted, currentUser, person, setPerson, users, counts };
}

/**
 * The person for "Assigned" or "From": type a name and pick from the
 * suggestions. Clearing it shows everyone again.
 */
export function PersonFilter({ person, setPerson, users, visible, scope = 'assigned' }: {
  person: string;
  setPerson: (id: string) => void;
  users: User[];
  visible: boolean;
  scope?: TaskScope;
}) {
  const listId = useId();
  const picked = users.find((u) => u.id === person);
  const [text, setText] = useState(picked?.name || '');
  useEffect(() => { setText(picked?.name || ''); }, [picked?.name]);
  if (!visible) return null;
  const active = users.filter((u) => u.status !== 'suspended');
  const choose = (v: string) => {
    setText(v);
    const exact = active.find((u) => u.name.trim().toLowerCase() === v.trim().toLowerCase());
    if (exact) setPerson(exact.id);
    else if (!v.trim()) setPerson('');
  };
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <input
        list={listId}
        value={text}
        onChange={(e) => choose(e.target.value)}
        placeholder={scope === 'from' ? 'From… type a name' : 'Assigned to… type a name'}
        aria-label={scope === 'from' ? 'Tasks from this person' : 'Tasks assigned to this person'}
        title={scope === 'from' ? 'Tasks this person raised' : "Show one person's tasks"}
        style={{
          padding: '7px 26px 7px 12px', borderRadius: 999, border: '1px solid ' + (person ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.14)'),
          background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--ink)', outline: 'none', width: 190,
        }}
      />
      <datalist id={listId}>{active.map((u) => <option key={u.id} value={u.name} />)}</datalist>
      {text && <span onClick={() => choose('')} title="Clear" style={{ position: 'absolute', right: 10, cursor: 'pointer', color: 'var(--c-9aa39d)', fontSize: 14, lineHeight: 1 }}>×</span>}
    </span>
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
  task: { title?: string; description?: string; assignee?: string; assignedTo?: string; labels?: string[]; serial?: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [task.serial, task.title, task.description, task.assignee, task.assignedTo, ...(task.labels ?? [])]
    .filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

/** Segmented Everyone / My tasks / From me / Assigned / From control. Renders nothing for restricted tiers. */
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
    <div style={{ display: 'flex', gap: 3, background: 'var(--c-efede8)', padding: 3, borderRadius: 999, maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 1 }}>
      {opt('all', 'Everyone', counts?.all ?? allCount)}
      {opt('mine', 'My tasks', counts?.mine ?? mineCount)}
      {scope === 'mine' && <MinePartsChips />}
      {opt('fromMe', 'From me', counts?.fromMe)}
      {opt('assigned', 'Assigned', counts?.assigned)}
      {opt('from', 'From')}
    </div>
  );
}

/** Under "My tasks": which of mine -- assigned to me, I'm a collaborator, I originated (any mix). */
function MinePartsChips() {
  const [parts, setParts] = useMineParts();
  const chip = (k: keyof MineParts, label: string) => (
    <label key={k} title={`Include tasks ${label.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
      background: parts[k] ? 'var(--surface)' : 'transparent', color: parts[k] ? 'var(--forest)' : 'var(--muted)', border: '1px solid ' + (parts[k] ? 'rgba(var(--rgb-forest), 0.35)' : 'transparent') }}>
      <input type="checkbox" checked={parts[k]} onChange={(e) => setParts({ ...parts, [k]: e.target.checked })} style={{ margin: 0 }} />{label}
    </label>
  );
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {chip('assigned', 'Assigned to me')}
      {chip('collab', 'I collaborate on')}
      {chip('originated', 'Assigned by me')}
    </span>
  );
}
