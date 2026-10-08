import { Avatar } from './Avatar';
import { useApp } from '../AppContext';

type Who = { id?: string | null; name?: string | null };

/** Everyone on a task -- assignee first, then collaborators -- as overlapping avatars, "+N" past `max`. */
export function AvatarStack({ people, max = 3, size = 26 }: { people: Who[]; max?: number; size?: number }) {
  const { users } = useApp();
  const seen = new Set<string>();
  const list = people.filter((p) => {
    const key = (p.id || p.name || '').toString().trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!list.length) return null;
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  const ring = { boxShadow: '0 0 0 2px var(--surface)', borderRadius: 999, display: 'inline-flex' } as const;
  return (
    <span title={list.map((p) => p.name).filter(Boolean).join(', ')} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      {shown.map((p, i) => (
        <span key={(p.id || p.name) as string} style={{ ...ring, marginLeft: i ? -Math.round(size * 0.32) : 0, zIndex: shown.length - i, position: 'relative' }}>
          <Avatar user={users.find((u) => u.id === p.id)} name={p.name || ''} size={size} title={p.name || ''} />
        </span>
      ))}
      {extra > 0 && (
        <span style={{ ...ring, marginLeft: -Math.round(size * 0.32), width: size, height: size, justifyContent: 'center', alignItems: 'center',
          background: 'rgba(29, 29, 27, 0.1)', color: 'var(--ink)', fontSize: Math.round(size * 0.4), fontWeight: 700, position: 'relative' }}>+{extra}</span>
      )}
    </span>
  );
}

/** The assignee plus collaborators of a task, in that order. */
export const taskPeople = (t: { assigneeId?: string | null; assignee?: string | null; collaborators?: { id: string; name: string }[] }) =>
  [{ id: t.assigneeId, name: t.assignee }, ...(Array.isArray(t.collaborators) ? t.collaborators : [])];
