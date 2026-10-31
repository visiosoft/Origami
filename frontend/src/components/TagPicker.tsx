import { ACTION_TAGS, toggleTag } from '../data/actionTags';

/** Pick an item's access tags (Internal, Client, External, Financial, CRM, Design, Construction). */
export function TagPicker({ tags, onChange, disabled, compact }: { tags: string[]; onChange: (t: string[]) => void; disabled?: boolean; compact?: boolean }) {
  return (
    <div>
      {!compact && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)', marginBottom: 6 }}>Access tags</div>}
      <div role="group" aria-label="Access tags" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {ACTION_TAGS.map(([k, l]) => {
          const on = tags.includes(k);
          return (
            <button key={k} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(toggleTag(tags, k))}
              title={k === 'financial' ? 'Financial items come in Internal too' : k === 'internal' ? 'Internal items are never shown to clients or consultants' : undefined}
              style={{ padding: '3px 9px', borderRadius: 999, border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.14)'), background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--muted)', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: disabled ? 'default' : 'pointer' }}>{l}</button>
          );
        })}
      </div>
      {!compact && tags.some((t) => t === 'internal' || t === 'financial') && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>Not shown to clients or consultants.</div>}
    </div>
  );
}
