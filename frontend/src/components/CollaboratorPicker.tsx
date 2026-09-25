import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { Avatar } from './Avatar';

export interface Collaborator { id: string; name: string }

/**
 * "Collaborative": people who follow a task without owning it. The task still
 * has one assignee; collaborators get an email when they're added, when
 * someone comments, and when it's done, and it shows under their "My tasks".
 *
 * Removing someone is a deliberate tap on a proper-sized button, and can be
 * undone for a few seconds -- on a phone the old small "x" next to the name
 * was easy to hit by accident, and autosave then saved the removal.
 */
export function CollaboratorPicker({ value, onChange, assigneeId, disabled }: {
  value?: Collaborator[] | null;
  onChange: (next: Collaborator[]) => void;
  /** The assignee already owns the task, so they aren't offered here. */
  assigneeId?: string | null;
  disabled?: boolean;
}) {
  const { users } = useApp();
  const list = value || [];
  const [removed, setRemoved] = useState<{ c: Collaborator; at: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(t);
  }, [removed]);
  const offered = users.filter((u) => u.id !== assigneeId && !list.some((c) => c.id === u.id) && u.status !== 'suspended');
  const userOf = (id: string) => users.find((u) => u.id === id);
  const remove = (c: Collaborator) => { onChange(list.filter((x) => x.id !== c.id)); setRemoved({ c, at: list.findIndex((x) => x.id === c.id) }); };
  const undo = () => {
    if (!removed || list.some((x) => x.id === removed.c.id)) { setRemoved(null); return; }
    const next = [...list];
    next.splice(Math.min(removed.at, next.length), 0, removed.c);
    onChange(next);
    setRemoved(null);
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {list.map((c) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: disabled ? '3px 10px 3px 3px' : '3px 3px 3px 3px', borderRadius: 999, background: '#EEF3EE', border: '1px solid rgba(20,8,31,0.08)', fontSize: 12.5, color: '#0B1A12' }}>
              <Avatar user={userOf(c.id)} name={c.name} size={24} />
              <span style={{ paddingRight: disabled ? 0 : 2 }}>{c.name}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${c.name} from collaborators`}
                  title={`Remove ${c.name}`}
                  onClick={(e) => { e.stopPropagation(); remove(c); }}
                  style={{ width: 30, height: 30, marginLeft: 2, borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', background: 'white', color: '#7E9B93', fontSize: 15, lineHeight: 1, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, flexShrink: 0 }}
                >×</button>
              )}
            </span>
          ))}
        </div>
      )}
      {removed && !disabled && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#43514D', background: '#FBF0CC', borderRadius: 8, padding: '6px 10px' }}>
          <span style={{ flex: 1 }}>{removed.c.name} removed</span>
          <button type="button" onClick={undo} style={{ border: 0, background: 'none', padding: '4px 6px', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>Undo</button>
        </div>
      )}
      {!disabled && (
        <select
          value=""
          onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (u) onChange([...list, { id: u.id, name: u.name }]); }}
          style={{ boxSizing: 'border-box', width: '100%', minHeight: 36, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit', fontSize: 13, color: '#43514D', outline: 'none' }}
        >
          <option value="">{list.length ? '+ Add another collaborator…' : '+ Add a collaborator…'}</option>
          {offered.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
      {disabled && !list.length && <div style={{ fontSize: 12, color: '#9AA39D' }}>No collaborators</div>}
    </div>
  );
}
