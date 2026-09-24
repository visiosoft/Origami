import { useApp } from '../AppContext';
import { Avatar } from './Avatar';

export interface Collaborator { id: string; name: string }

/**
 * "Collaborative": people who follow a task without owning it. The task still
 * has one assignee; collaborators get an email when they're added, when
 * someone comments, and when it's done, and it shows under their "My tasks".
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
  const offered = users.filter((u) => u.id !== assigneeId && !list.some((c) => c.id === u.id) && u.status !== 'suspended');
  const userOf = (id: string) => users.find((u) => u.id === id);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {list.map((c) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 3px', borderRadius: 999, background: '#EEF3EE', border: '1px solid rgba(20,8,31,0.08)', fontSize: 12.5, color: '#0B1A12' }}>
              <Avatar user={userOf(c.id)} name={c.name} size={22} />
              {c.name}
              {!disabled && (
                <span role="button" aria-label={`Remove ${c.name}`} onClick={() => onChange(list.filter((x) => x.id !== c.id))} style={{ cursor: 'pointer', color: '#7E9B93', fontSize: 14, lineHeight: 1, paddingLeft: 2 }}>×</span>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <select
          value=""
          onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (u) onChange([...list, { id: u.id, name: u.name }]); }}
          style={{ boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit', fontSize: 13, color: '#43514D', outline: 'none' }}
        >
          <option value="">{list.length ? '+ Add another collaborator…' : '+ Add a collaborator…'}</option>
          {offered.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
      {disabled && !list.length && <div style={{ fontSize: 12, color: '#9AA39D' }}>No collaborators</div>}
    </div>
  );
}
