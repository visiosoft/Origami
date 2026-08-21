import { useApp } from '../AppContext';
import { Avatar } from './Avatar';
import type { User } from '../data/users';

const selectStyle: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none', width: '100%',
};

/**
 * Pick the platform user a task belongs to.
 *
 * Assignment is stored as a user id with the display name alongside it, so a
 * rename no longer orphans the task. A stored name that matches no account —
 * older rows, or someone who never got an account — is preserved and shown as a
 * legacy option rather than silently dropped.
 */
export function AssigneePicker({
  valueId,
  valueName,
  onChange,
  disabled,
  emptyLabel = 'Unassigned',
}: {
  valueId?: string;
  valueName?: string;
  onChange: (user: { id?: string; name: string } | null) => void;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const { users } = useApp();

  const selected: User | undefined =
    (valueId && users.find((u) => u.id === valueId)) ||
    (valueName ? users.find((u) => u.name.trim().toLowerCase() === valueName.trim().toLowerCase()) : undefined);

  const isLegacy = !selected && !!valueName;
  const current = selected?.id ?? (isLegacy ? '__legacy' : '');

  const pick = (value: string) => {
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
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
        {isLegacy && <option value="__legacy">{valueName} (no account)</option>}
      </select>
    </div>
  );
}
