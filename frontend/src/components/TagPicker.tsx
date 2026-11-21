import { ACTION_TAGS, toggleTag } from '../data/actionTags';
import { useApp } from '../AppContext';

/** Nov 20 (Edward): who a task is for -- only i-1 / i-2 change these. */
const ACCESS = ['internal', 'client', 'external', 'financial'];

/** Pick an item's access tags (Internal, Client, External, Financial, CRM, Design, Construction). */
export function TagPicker({ tags, onChange, disabled, compact, leadOnlyAccess }: { tags: string[]; onChange: (t: string[]) => void; disabled?: boolean; compact?: boolean; leadOnlyAccess?: boolean }) {
  const { authUser } = useApp();
  const locked = !!leadOnlyAccess && !['admin', 'principal'].includes(String(authUser?.roleKey || ''));
  return (
    <div>
      {!compact && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)', marginBottom: 6 }}>Standard tags · who sees it</div>}
      <div role="group" aria-label="Access tags" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {ACTION_TAGS.map(([k, l]) => {
          const on = tags.includes(k);
          const off = disabled || (locked && ACCESS.includes(k));
          return (
            <button key={k} type="button" aria-pressed={on} disabled={off} onClick={() => onChange(toggleTag(tags, k))}
              title={locked && ACCESS.includes(k) ? 'Only an admin or principal changes who a task is for' : k === 'financial' ? 'Financial items come in Internal too' : k === 'internal' ? 'Internal items are never shown to clients or consultants' : undefined}
              style={{ padding: '3px 9px', borderRadius: 999, border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.14)'), background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--muted)', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: off ? 'default' : 'pointer', opacity: off && !disabled ? 0.75 : 1 }}>{l}{locked && ACCESS.includes(k) ? ' 🔒' : ''}</button>
          );
        })}
      </div>
      {!compact && tags.some((t) => t === 'internal' || t === 'financial') && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>Not shown to clients or consultants.</div>}
    </div>
  );
}
