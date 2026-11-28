import { useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { matchPeople, parseMeetingNotes } from '../data/meetingNotes';
import { TagPicker } from './TagPicker';

type RecordKind = 'Observation' | 'FYI' | 'Decision' | 'Task';
interface Row {
  key: string; on: boolean; kind: RecordKind; subject: string; description: string;
  assigneeId: string; others: string[]; dueDate: string; priority: string; tags: string[];
  /** Nov 27 (Weekly Sync): each item to its own project, or General (null). */
  projectId: number | null;
}

/**
 * "Turn notes into items" (Oct 26 review notes): the meeting's pasted notes,
 * read into FOR RECORD items (each summary bullet, under its heading) and tasks
 * (each next step: who, what, when). Every row can be changed, retyped or left
 * out before it's added; each records the meeting it came from.
 */
/** Same item, ignoring case, spacing and punctuation (the server checks the same way). */
const norm = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function MeetingNotesImport({ meeting, text, existing = [], projects = [], onClose, onAdded }: {
  meeting: { id: string; title: string; date: string; project?: string; projectId?: number | null };
  text: string;
  /** Nov 20: what's already been raised from this meeting -- by anyone -- so it isn't raised twice. */
  existing?: { subject?: string; assignedTo?: string | null }[];
  projects?: { id: number; name: string }[];
  onClose: () => void;
  onAdded: (made: any[]) => void;
}) {
  const { users, toast } = useApp();
  const already = useMemo(() => new Map(existing.filter((t) => t.subject).map((t) => [norm(t.subject!), t] as const)), [existing]);
  // Nov 20: a meeting with no project files its items under the one picked here, not "General".
  const meetingPid = meeting.projectId ?? projects.find((p) => p.name === meeting.project)?.id ?? null;
  const [projectId, setProjectId] = useState<number | null>(meetingPid);
  const people = useMemo(() => users.filter((u) => u.status !== 'suspended'), [users]);
  const parsed = useMemo(() => parseMeetingNotes(text, meeting.date), [text, meeting.date]);
  const [rows, setRows] = useState<Row[]>(() => [
    ...parsed.records.map((r, i): Row => ({ key: 'r' + i, on: !already.has(norm(r.title)), kind: r.kind || 'Observation', subject: r.title, description: r.description, assigneeId: '', others: [], dueDate: '', priority: '', tags: [], projectId: meetingPid })),
    ...parsed.tasks.map((t, i): Row => {
      const { matched, unmatched } = matchPeople(t.names, people);
      return {
        key: 't' + i, on: !already.has(norm(t.title)), kind: 'Task', subject: t.title, description: t.description, assigneeId: matched[0]?.id || '',
        others: [...matched.slice(1).map((p) => p.name), ...unmatched], dueDate: t.dueDate || '', priority: t.priority || '', tags: [], projectId: meetingPid,
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
        // Others named who are people here follow the task as collaborators, so it shows under their "Mine".
        const collaborators = r.others.map((n) => people.find((p) => p.name.toLowerCase() === n.toLowerCase())).filter((p): p is NonNullable<typeof p> => !!p && p.id !== u?.id).map((p) => ({ id: p.id, name: p.name }));
        const proj = r.projectId != null ? projects.find((p) => p.id === r.projectId) || null : null;
        made.push(await api.meetings.addAction(meeting.id, {
          topicType: r.kind, subject: r.subject.trim().slice(0, 300), description: (r.description.trim() + also).trim() || undefined,
          assignedTo: u?.name, assignedToId: u?.id, dueDate: r.kind === 'Task' ? r.dueDate || undefined : undefined,
          priority: r.kind === 'Task' && !r.dueDate ? (r.priority || 'High') : r.priority || undefined,
          tags: r.tags.length ? r.tags : undefined,
          collaborators: collaborators.length ? collaborators : undefined,
          // Its own project, or General (Nov 27); a Task goes on that project's board.
          project: proj?.name || '', projectId: proj?.id ?? null,
        }));
      }
      const dup = made.filter((m) => m?.duplicate).length;
      toast(`${made.length - dup} item${made.length - dup === 1 ? '' : 's'} added from the notes${dup ? ` · ${dup} already there` : ''}`);
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
              {projects.length > 0 && (
                <select value={r.projectId ?? ''} onChange={(e) => patch(r.key, { projectId: e.target.value ? Number(e.target.value) : null })} aria-label="Project" style={{ maxWidth: 220 }}>
                  <option value="">General</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {r.kind === 'Task' && <input type="date" value={r.dueDate} onChange={(e) => patch(r.key, { dueDate: e.target.value })} aria-label="Due date" />}
              {r.kind === 'Task' && !r.dueDate && <span className="mt-muted" style={{ fontSize: 11.5 }}>No date in the notes — comes in as High priority</span>}
              {r.others.length > 0 && <span className="mt-muted" style={{ fontSize: 11.5 }}>Also named: {r.others.join(', ')}</span>}
              {already.has(norm(r.subject)) && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2F6B3A' }}>Already raised{already.get(norm(r.subject))?.assignedTo ? ` · ${already.get(norm(r.subject))?.assignedTo}` : ''}</span>}
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
        {projects.length > 0 && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, flexWrap: 'wrap' }}>
            <b>Project for all</b>
            <select aria-label="Project for these items" value={projectId ?? ''} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setProjectId(v); setRows((cur) => cur.map((r) => ({ ...r, projectId: v }))); }}>
              <option value="">General</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="mt-muted" style={{ fontSize: 11.5 }}>Each item can go to its own project below. Tasks go on that project’s board{!meeting.project ? ' — this meeting has no project yet' : ''}.</span>
          </label>
        )}
        {existing.length > 0 && <div className="mt-muted" style={{ fontSize: 12 }}>{existing.length} item{existing.length === 1 ? ' was' : 's were'} already raised from this meeting; those are unticked so nobody adds them twice.</div>}
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
