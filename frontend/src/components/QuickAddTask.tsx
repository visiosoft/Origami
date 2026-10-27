import { useState, type CSSProperties } from 'react';
import { AssigneePicker } from './AssigneePicker';

export type QuickTask = { title: string; description?: string; assigneeId?: string; assignee?: string };

const field: CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)',
  background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none', resize: 'vertical',
};

/** Only what was filled in -- an empty assignee mustn't undo "My tasks" assigning it to you. */
export function quickTaskFields(q: QuickTask): Omit<QuickTask, 'title'> {
  const out: Omit<QuickTask, 'title'> = {};
  if (q.description?.trim()) out.description = q.description.trim();
  if (q.assignee?.trim()) { out.assignee = q.assignee.trim(); if (q.assigneeId) out.assigneeId = q.assigneeId; }
  return out;
}

/**
 * "+ Add task" on the board: a title, and -- before it's saved -- who does it
 * and any details. Enter in the title adds; Shift+Enter is a new line.
 */
export function QuickAddTask({ onAdd, onCancel, className, style }: {
  onAdd: (q: QuickTask) => void | Promise<unknown>;
  onCancel: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [who, setWho] = useState<{ id?: string; name: string } | null>(null);
  const add = () => {
    if (!title.trim()) return;
    void onAdd({ title: title.trim(), description, assigneeId: who?.id, assignee: who?.name });
    setTitle(''); setDescription('');
  };
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <textarea autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title…" rows={2} aria-label="Task title" style={field}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); }
          if (e.key === 'Escape') onCancel();
        }} />
      <AssigneePicker valueId={who?.id} valueName={who?.name} onChange={setWho} emptyLabel="Assign to… (optional)" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" rows={2} aria-label="Task details" style={{ ...field, fontSize: 12.5 }}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={add} disabled={!title.trim()}
          style={{ padding: '6px 14px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: title.trim() ? 'pointer' : 'default', background: title.trim() ? 'var(--forest)' : 'var(--c-9ab0a4)', color: 'white' }}>
          Add task
        </button>
        <button type="button" onClick={onCancel} style={{ padding: '6px 10px', border: 0, background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}
