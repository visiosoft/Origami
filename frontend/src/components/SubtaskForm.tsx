import { useState, type CSSProperties } from 'react';
import { AssigneePicker } from './AssigneePicker';

export type NewSubtask = { title: string; assigneeId?: string; assignee: string; dueDate: string; description?: string };

const field: CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)',
  background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none', width: '100%',
};

/**
 * Adding a subtask: a title, who does it and when it's due -- all three are
 * required, so shared work and inspections can be tracked and reminded.
 * Details are optional.
 */
export function SubtaskForm({ onAdd, onCancel, autoFocus, compact, initial, submitLabel = 'Add subtask' }: {
  onAdd: (s: NewSubtask) => void | Promise<unknown>;
  onCancel?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
  /** Editing an existing subtask: its current title, assignee, due date and details. */
  initial?: NewSubtask;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [who, setWho] = useState<{ id?: string; name: string } | null>(initial?.assignee ? { id: initial.assigneeId, name: initial.assignee } : null);
  const [due, setDue] = useState(initial?.dueDate || '');
  const [details, setDetails] = useState(initial?.description || '');
  const missing = [!title.trim() && 'a title', !who?.name && 'who it’s for', !due && 'a due date'].filter(Boolean) as string[];
  const add = async () => {
    if (missing.length || !who) return;
    await onAdd({ title: title.trim(), assigneeId: who.id, assignee: who.name, dueDate: due, description: details.trim() });
    if (!initial) { setTitle(''); setDue(''); setDetails(''); }
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input autoFocus={autoFocus} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={initial ? 'Subtask title' : 'Add a subtask…'} style={{ ...field, fontSize: compact ? 12.5 : 13 }}
        onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') onCancel?.(); }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px', gap: 6 }}>
        <AssigneePicker valueId={who?.id} valueName={who?.name} onChange={setWho} emptyLabel="Assign to…" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" style={field} />
      </div>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details (optional)" rows={2} aria-label="Subtask details"
        style={{ ...field, fontSize: 12.5, resize: 'vertical' }} onKeyDown={(e) => { if (e.key === 'Escape') onCancel?.(); }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" onClick={add} disabled={missing.length > 0}
          style={{ padding: '6px 14px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: missing.length ? 'default' : 'pointer', background: missing.length ? 'var(--c-9ab0a4)' : 'var(--forest)', color: 'white' }}>
          {submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} style={{ padding: '6px 10px', border: 0, background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>}
        {title.trim() && missing.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Needs {missing.join(' and ')}</span>}
      </div>
    </div>
  );
}
