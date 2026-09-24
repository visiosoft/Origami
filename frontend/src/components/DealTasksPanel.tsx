import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { DraftScope, SaveBar } from '../autosave';
import { NewTaskDrawer } from './NewTaskDrawer';
import { RequestLogTaskDrawer } from './RequestLogTaskDrawer';
import { taskHeadline, type Task } from '../data/tasks';

const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};

const STATUSES = ['Open', 'In Progress', 'Closed'];
const NOTE_FIELDS: (keyof Task)[] = ['resolution'];
/** Labels are free tags on the task -- this one records which pipeline stage it was filed under. */
const SECTION_PREFIX = 'section:';

/**
 * Action items tied to this lead, one list per pipeline stage -- a lead
 * passes through several sections before it's won, and a follow-up made
 * sense for "Virtual F2F meeting" doesn't belong mixed in with one from
 * "Proposal Sent". Same underlying task log as the Full Details tab
 * elsewhere (filtered to this card's id as its "project"), tagged by stage
 * via its labels, so nothing new had to be built on the backend.
 */
export function DealTasksPanel({
  dealId, dealName, currentStageName, stages, openTaskId,
}: {
  dealId: string;
  dealName: string;
  currentStageName: string;
  /** Every stage name the lead could have a task filed under -- the picker's options. */
  stages: string[];
  /** A task to open as soon as it's loaded -- e.g. one just converted from a note. */
  openTaskId?: string | null;
}) {
  // Opens over the lead, so reading a task never takes you out of the CRM.
  const [openId, setOpenId] = useState<string | null>(null);
  // A task made moments ago (from a note, or "+ Add task") opens in full, where files, labels and a checklist go.
  const [pendingOpen, setPendingOpen] = useState<string | null>(openTaskId || null);
  useEffect(() => { if (openTaskId) setPendingOpen(openTaskId); }, [openTaskId]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    api.tasks.list(undefined, dealId)
      .then((r: any) => setTasks(Array.isArray(r) ? r : []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(load, [dealId]);
  useEffect(() => {
    if (pendingOpen && tasks.some((t) => t.id === pendingOpen)) { setOpenId(pendingOpen); setPendingOpen(null); }
  }, [pendingOpen, tasks]);

  const sectionOf = (t: Task) => (t.labels || []).find((l) => l.startsWith(SECTION_PREFIX))?.slice(SECTION_PREFIX.length) || 'Other';

  const setStatus = (t: Task, status: string) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: status as Task['status'] } : x)));
    api.tasks.update(t.id, { status, dateClosed: status === 'Closed' ? new Date().toISOString().slice(0, 10) : '' }).catch(() => load());
  };

  const remove = (t: Task) => {
    if (!confirm('Remove this task?')) return;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    api.tasks.remove(t.id).catch(() => load());
  };

  const toggleNotes = (id: string) => setOpenNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  const putTask = (res: Task) => setTasks((prev) => prev.map((x) => (x.id === res.id ? res : x)));

  const visible = tasks.filter((t) => showClosed || t.status !== 'Closed');

  // Grouped by section, in the order the lead actually moves through the
  // board -- current stage first, everything else after, "Other" last.
  const grouped = useMemo(() => {
    const bySection = new Map<string, Task[]>();
    for (const t of visible) {
      const key = sectionOf(t);
      if (!bySection.has(key)) bySection.set(key, []);
      bySection.get(key)!.push(t);
    }
    const order = [currentStageName, ...stages.filter((s) => s !== currentStageName), 'Other'];
    return order
      .filter((s) => bySection.has(s))
      .map((s) => ({ section: s, tasks: bySection.get(s)! }));
  }, [visible, stages, currentStageName]);

  return (
    <div style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tasks for {dealName}</div>
          <div style={{ fontSize: 11.5, color: '#9AA39D', marginTop: 2 }}>Each section of the pipeline keeps its own list.</div>
        </div>
        <div onClick={() => setAdding(true)} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white', flexShrink: 0 }}>
          + Add task
        </div>
      </div>

      {openId && tasks.find((x) => x.id === openId) && (
        <RequestLogTaskDrawer
          task={tasks.find((x) => x.id === openId)!}
          allLabels={Array.from(new Set(tasks.flatMap((x) => x.labels ?? []))).sort()}
          zIndex={210}
          onClose={() => setOpenId(null)}
          onChanged={(res) => setTasks((prev) => prev.map((x) => (x.id === res.id ? res : x)))}
          onDeleted={(id) => setTasks((prev) => prev.filter((x) => x.id !== id))}
        />
      )}

      {adding && (
        <NewTaskDrawer
          onClose={() => setAdding(false)}
          onCreated={(c) => { if (c?.task?.id) setPendingOpen(c.task.id); load(); }}
          fixedProject={{ id: dealId, name: dealName }}
          sections={stages}
          defaultSection={currentStageName}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, marginTop: 14 }}>
        <span onClick={() => setShowClosed((v) => !v)} style={{ fontSize: 11, fontWeight: 700, color: '#7E9B93', cursor: 'pointer' }}>{showClosed ? 'Hide closed' : 'Show closed'}</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#9AA39D' }}>Loading…</div>
      ) : grouped.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No tasks on this lead yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(({ section: sec, tasks: secTasks }) => (
            <div key={sec}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: sec === currentStageName ? '#173326' : '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sec}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: '#9AA39D', background: '#EFEDE8', padding: '1px 7px', borderRadius: 999 }}>{secTasks.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {secTasks.map((t) => (
                  <div key={t.id} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 10, opacity: t.status === 'Closed' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', flexWrap: 'wrap' }}>
                      <div onClick={() => setOpenId(t.id)} style={{ flex: '1 1 200px', minWidth: 0, cursor: 'pointer' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0B1A12', textDecoration: t.status === 'Closed' ? 'line-through' : 'none' }}>{taskHeadline(t.description).title || t.id}</div>
                        {taskHeadline(t.description).details && (
                          <div style={{ fontSize: 11.5, color: '#5C6B65', lineHeight: 1.45, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{taskHeadline(t.description).details}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#7E9B93' }}>{t.assignedTo || 'Unassigned'}{t.dueDate ? ` · Due ${t.dueDate}` : ''}</div>
                      </div>
                      <select value={t.status} onChange={(e) => setStatus(t, e.target.value)} style={{ ...input, width: 'auto', padding: '5px 8px', fontSize: 11.5 }}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <span onClick={() => toggleNotes(t.id)} style={{ fontSize: 11, fontWeight: 700, color: t.resolution ? '#173326' : '#7E9B93', cursor: 'pointer' }}>
                        {openNotes[t.id] ? 'Hide notes' : t.resolution ? 'Notes' : '+ Notes'}
                      </span>
                      <span onClick={() => remove(t)} style={{ fontSize: 11, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer' }}>Remove</span>
                    </div>
                    {openNotes[t.id] && (
                      <DraftScope key={'notes' + t.id} record={t} fields={NOTE_FIELDS} label="task notes"
                        save={(changes) => api.tasks.update(t.id, changes) as Promise<Task>} onSaved={putTask}>
                        {({ draft, set, auto }) => (
                          <div style={{ padding: '0 12px 10px', display: 'grid', gap: 6 }}>
                            <textarea
                              value={draft.resolution || ''}
                              onChange={(e) => set({ resolution: e.target.value })}
                              placeholder="Notes on this task…"
                              rows={2}
                              style={{ ...input, width: '100%', resize: 'vertical', lineHeight: 1.5 }}
                            />
                            <SaveBar auto={auto} />
                          </div>
                        )}
                      </DraftScope>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
