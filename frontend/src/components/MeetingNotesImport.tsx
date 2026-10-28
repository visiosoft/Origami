import { useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { matchPeople, parseMeetingNotes } from '../data/meetingNotes';
import { TagPicker } from './TagPicker';

type RecordKind = 'Observation' | 'FYI' | 'Decision' | 'Task';
interface Row {
  key: string; on: boolean; kind: RecordKind; subject: string; description: string;
  assigneeId: string; others: string[]; dueDate: string; priority: string; tags: string[];
}

/**
 * "Turn notes into items" (Oct 26 review notes): the meeting's pasted notes,
 * read into FOR RECORD items (each summary bullet, under its heading) and tasks
 * (each next step: who, what, when). Every row can be changed, retyped or left
 * out before it's added; each records the meeting it came from.
 */
export function MeetingNotesImport({ meeting, text, onClose, onAdded }: {
  meeting: { id: string; title: string; date: string };
  text: string;
  onClose: () => void;
  onAdded: (made: any[]) => void;
}) {
  const { users, toast } = useApp();
  const people = useMemo(() => users.filter((u) => u.status !== 'suspended'), [users]);
  const parsed = useMemo(() => parseMeetingNotes(text, meeting.date), [text, meeting.date]);
  const [rows, setRows] = useState<Row[]>(() => [
    ...parsed.records.map((r, i): Row => ({ key: 'r' + i, on: true, kind: 'Observation', subject: r.title, description: r.description, assigneeId: '', others: [], dueDate: '', priority: '', tags: [] })),
    ...parsed.tasks.map((t, i): Row => {
      const { matched, unmatched } = matchPeople(t.names, people);
      return {
        key: 't' + i, on: true, kind: 'Task', subject: t.title, description: t.description, assigneeId: matched[0]?.id || '',
        others: [...matched.slice(1).map((p) => p.name), ...unmatched], dueDate: t.dueDate || '', priority: t.priority || '', tags: [],
      };
    }),
  ]);
  const [busy, setBusy] = useState(false);
  const patch = (key: string, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const picked = rows.filter((r) => r.on && r.subject.trim());

  const add = async () => {
    setBusy(true);
    const made: any[] = [];
    try {
      for (const r of picked) {
        const u = people.find((p) => p.id === r.assigneeId);
        const also = r.others.length ? `\n\nAlso named: ${r.others.join(', ')}.` : '';
        made.push(await api.meetings.addAction(meeting.id, {
          topicType: r.kind, subject: r.subject.trim().slice(0, 300), description: (r.description.trim() + also).trim() || undefined,
          assignedTo: u?.name, assignedToId: u?.id, dueDate: r.kind === 'Task' ? r.dueDate || undefined : undefined,
          priority: r.kind === 'Task' && !r.dueDate ? (r.priority || 'High') : r.priority || undefined,
          tags: r.tags.length ? r.tags : undefined,
        }));
      }
      toast(`${made.length} item${made.length === 1 ? '' : 's'} added from the notes`);
      onAdded(made);
      onClose();
    } catch (e) {
      toast('⚠ ' + ((e as Error).message || 'Not all were added') + (made.length ? ` — ${made.length} were` : ''));
      if (made.length) onAdded(made);
    } finally { setBusy(false); }
  };

  const section = (title: string, list: Row[], hint: string) => (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13.5 }}>{title} · {list.length}</h3>
        <span className="mt-muted" style={{ fontSize: 12 }}>{hint}</span>
      </div>
      {!list.length && <span className="mt-muted" style={{ fontSize: 12.5 }}>None found.</span>}
      {list.map((r) => (
        <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8, padding: 10, borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.1)', opacity: r.on ? 1 : 0.5 }}>
          <input type="checkbox" checked={r.on} onChange={(e) => patch(r.key, { on: e.target.checked })} aria-label={`Add “${r.subject}”`} style={{ marginTop: 4 }} />
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <select value={r.kind} onChange={(e) => patch(r.key, { kind: e.target.value as RecordKind })} aria-label="Kind">
                {(['Observation', 'FYI', 'Decision', 'Task'] as RecordKind[]).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input value={r.subject} onChange={(e) => patch(r.key, { subject: e.target.value })} aria-label="Title" style={{ flex: 1, minWidth: 180 }} />
            </div>
            <textarea value={r.description} onChange={(e) => patch(r.key, { description: e.target.value })} rows={2} aria-label="Details" className="mt-text" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={r.assigneeId} onChange={(e) => patch(r.key, { assigneeId: e.target.value })} aria-label="Assignee">
                <option value="">{r.kind === 'Task' ? 'Assign to…' : 'Owner…'}</option>
                {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {r.kind === 'Task' && <input type="date" value={r.dueDate} onChange={(e) => patch(r.key, { dueDate: e.target.value })} aria-label="Due date" />}
              {r.kind === 'Task' && !r.dueDate && <span className="mt-muted" style={{ fontSize: 11.5 }}>No date in the notes — comes in as High priority</span>}
              {r.others.length > 0 && <span className="mt-muted" style={{ fontSize: 11.5 }}>Also named: {r.others.join(', ')}</span>}
            </div>
            <TagPicker compact tags={r.tags} onChange={(tags) => patch(r.key, { tags })} />
          </div>
        </div>
      ))}
    </section>
  );

  return (
    <div className="mt-bg" onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ zIndex: 150 }}>
      <aside className="mt-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Items from the notes" style={{ maxWidth: 760 }}>
        <div className="mt-head">
          <h2>Items from the notes</h2>
          <button type="button" className="mt-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="mt-muted" style={{ margin: 0 }}>
          Read from the notes of “{meeting.title}”. Check each one, change what’s wrong, untick what you don’t want. Every item notes that it came from this meeting.
        </p>
        <div style={{ display: 'grid', gap: 18, overflowY: 'auto' }}>
          {section('FOR RECORD', rows.filter((r) => r.key.startsWith('r')), 'each summary bullet, under its heading')}
          {section('Tasks', rows.filter((r) => r.key.startsWith('t')), 'from “Next steps”')}
        </div>
        <div className="mt-foot">
          <span>{picked.length} to add</span>
          <button type="button" className="ak-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="ak-btn is-dark" disabled={busy || !picked.length} onClick={() => void add()}>{busy ? 'Adding…' : `Add ${picked.length}`}</button>
        </div>
      </aside>
    </div>
  );
}
