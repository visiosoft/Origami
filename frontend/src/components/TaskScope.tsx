import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import type { User } from '../data/users';

const KEY = 'origami.taskScope';

/** Whether a task belongs to this person — by id, falling back to the name. */
export function isMine(
  task: { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string },
  user?: User,
): boolean {
  if (!user) return false;
  const id = task.assigneeId ?? task.assignedToId;
  if (id) return id === user.id;
  const name = task.assignee ?? task.assignedTo;
  return !!name && name.trim().toLowerCase() === user.name.trim().toLowerCase();
}

/**
 * The "my tasks / everyone's" preference, shared by every task surface and
 * remembered between visits.
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

  const [scope, setScopeState] = useState<'mine' | 'all'>(() => {
    try { return localStorage.getItem(KEY) === 'all' ? 'all' : 'mine'; } catch { return 'mine'; }
  });

  const setScope = useCallback((next: 'mine' | 'all') => {
    setScopeState(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (restricted && scope !== 'mine') setScope('mine'); }, [restricted, scope, setScope]);

  const filter = useCallback(
    <T extends { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string }>(tasks: T[]): T[] => {
      if (restricted) return tasks;              // the server already scoped these
      if (scope === 'mine') return tasks.filter((t) => isMine(t, currentUser));
      if (person) {
        const who = users.find((u) => u.id === person);
        return who ? tasks.filter((t) => isMine(t, who)) : tasks;
      }
      return tasks;
    },
    [scope, person, restricted, currentUser, users],
  );

  return { scope, setScope, filter, restricted, currentUser, person, setPerson, users };
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
        padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.14)',
        background: 'white', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        color: person ? '#0B1A12' : '#7E9B93', outline: 'none', maxWidth: 190,
      }}
    >
      <option value="">Anyone</option>
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
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#9AA39D" strokeWidth={2.2} strokeLinecap="round"
           style={{ position: 'absolute', left: 11, pointerEvents: 'none' }}>
        <circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '7px 28px 7px 30px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.14)',
          background: 'white', fontFamily: 'inherit', fontSize: 12, color: '#0B1A12', outline: 'none', width: 190,
        }}
      />
      {value && (
        <span onClick={() => onChange('')} title="Clear"
              style={{ position: 'absolute', right: 10, cursor: 'pointer', color: '#9AA39D', fontSize: 14, lineHeight: 1 }}>×</span>
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

/** Segmented "Mine / Everyone" control. Renders nothing for restricted tiers. */
export function TaskScopeToggle({ scope, setScope, restricted, mineCount, allCount }: {
  scope: 'mine' | 'all';
  setScope: (s: 'mine' | 'all') => void;
  restricted: boolean;
  mineCount: number;
  allCount: number;
}) {
  if (restricted) return null;
  const opt = (value: 'mine' | 'all', label: string, count: number) => (
    <div
      key={value}
      onClick={() => setScope(value)}
      style={{
        padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        background: scope === value ? 'white' : 'transparent',
        color: scope === value ? '#0B1A12' : '#7E9B93',
        boxShadow: scope === value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label} <span style={{ opacity: 0.6 }}>{count}</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999 }}>
      {opt('mine', 'My tasks', mineCount)}
      {opt('all', 'Everyone', allCount)}
    </div>
  );
}
