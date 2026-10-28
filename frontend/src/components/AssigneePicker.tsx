import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Avatar } from './Avatar';
import type { User } from '../data/users';

/** People (who is on which project), fetched once per page load for every picker. */
let peopleOnce: Promise<{ userId?: string; email?: string; projects?: string[] }[]> | null = null;
const loadPeople = () => (peopleOnce ??= (api.people.list() as Promise<any>).then((r) => (Array.isArray(r) ? r : [])).catch(() => { peopleOnce = null; return []; }));

/** Account ids linked to a project in People (by their login, or the same email). */
export function useProjectUserIds(project?: string | null) {
  const { users } = useApp();
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!project) { setIds(null); return; }
    let live = true;
    loadPeople().then((people) => {
      if (!live) return;
      const on = people.filter((p) => (p.projects || []).includes(project));
      const emails = new Set(on.map((p) => String(p.email || '').trim().toLowerCase()).filter(Boolean));
      setIds(new Set(users.filter((u) => on.some((p) => p.userId === u.id) || emails.has(String(u.email || '').trim().toLowerCase())).map((u) => u.id)));
    });
    return () => { live = false; };
  }, [project, users]);
  return ids;
}

const selectStyle: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit',
  fontSize: 13, color: 'var(--ink)', outline: 'none', width: '100%',
};

/**
 * Pick the platform user a task belongs to.
 *
 * Assignment is stored as a user id with the display name alongside it, so a
 * rename no longer orphans the task. A stored name that matches no account —
 * older rows, or someone who never got an account — is preserved and shown as a
 * legacy option rather than silently dropped.
 *
 * With `project`, the list is the people attached to that project in People
 * (staff when nobody is linked yet); with `internalOnly` (lead and General
 * tasks), it's the internal team. "Show everyone" lifts either for odd cases.
 */
export function AssigneePicker({
  valueId,
  valueName,
  onChange,
  disabled,
  emptyLabel = 'Unassigned',
  project,
  internalOnly,
}: {
  valueId?: string;
  valueName?: string;
  onChange: (user: { id?: string; name: string } | null) => void;
  disabled?: boolean;
  emptyLabel?: string;
  project?: string | null;
  internalOnly?: boolean;
}) {
  const { users } = useApp();
  const onProject = useProjectUserIds(project);
  const [everyone, setEveryone] = useState(false);
  const internal = users.filter((u) => u.tier === 'internal' || u.roleKey === 'admin');
  const narrowed = everyone ? null
    : project ? (onProject && onProject.size ? users.filter((u) => onProject.has(u.id)) : onProject ? internal : null)
    : internalOnly ? internal : null;

  const selected: User | undefined =
    (valueId && users.find((u) => u.id === valueId)) ||
    (valueName ? users.find((u) => u.name.trim().toLowerCase() === valueName.trim().toLowerCase()) : undefined);

  const isLegacy = !selected && !!valueName;
  const current = selected?.id ?? (isLegacy ? '__legacy' : '');

  const shown = narrowed ? [...narrowed, ...(selected && !narrowed.includes(selected) ? [selected] : [])] : users;
  const pick = (value: string) => {
    if (value === '__everyone') { setEveryone(true); return; }
    if (!value) return onChange(null);
    if (value === '__legacy') return;
    const user = users.find((u) => u.id === value);
    if (user) onChange({ id: user.id, name: user.name });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar user={selected} name={selected?.name ?? valueName} size={26} />
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => pick(e.target.value)}
        style={{ ...selectStyle, opacity: disabled ? 0.7 : 1 }}
      >
        <option value="">{emptyLabel}</option>
        {shown.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
        {isLegacy && <option value="__legacy">{valueName} (no account)</option>}
        {narrowed && shown.length < users.length && <option value="__everyone">Show everyone…</option>}
      </select>
    </div>
  );
}
