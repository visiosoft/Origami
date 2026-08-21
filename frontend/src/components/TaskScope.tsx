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
  const { currentUser, tier } = useApp();
  const restricted = tier === 'client' || tier === 'consultant';

  const [scope, setScopeState] = useState<'mine' | 'all'>(() => {
    try { return localStorage.getItem(KEY) === 'all' ? 'all' : 'mine'; } catch { return 'mine'; }
  });

  const setScope = useCallback((next: 'mine' | 'all') => {
    setScopeState(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (restricted && scope !== 'mine') setScope('mine'); }, [restricted, scope, setScope]);

  const filter = useCallback(
    <T extends { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string }>(tasks: T[]): T[] =>
      scope === 'all' || restricted ? tasks : tasks.filter((t) => isMine(t, currentUser)),
    [scope, restricted, currentUser],
  );

  return { scope, setScope, filter, restricted, currentUser };
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
