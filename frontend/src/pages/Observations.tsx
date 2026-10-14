import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { isLogClosed } from '../data/logStatuses';
import { FOR_RECORD_TOPICS, isForRecord, logTaskTitle, type Task } from '../data/tasks';
import { NewTaskDrawer } from '../components/NewTaskDrawer';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats, akDay } from '../components/ActionKit';
import './Meetings.css';

type Kind = 'all' | (typeof FOR_RECORD_TOPICS)[number];
type Pill = 'soft' | 'yellow' | 'dark' | 'outline' | 'green';
/** The pill each FOR RECORD kind wears, here and in Meetings. */
export const RECORD_TONE: Record<string, Pill> = { Observation: 'outline', FYI: 'yellow', Decision: 'green', Task: 'dark', RFI: 'soft' };
const CO_LABEL: Record<string, string> = { draft: 'Pending', internal_review: 'Internal review', submitted: 'With client', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
const coName = (c: any) => `${c.number ? c.number + ' · ' : ''}${c.title || 'Change order'}`;

/** When an entry was raised: its "created" history event, else the date in its id (YYYYMMDD-nn). */
export const raisedOn = (t: Task) => {
  const created = t.activity?.find((a: any) => a.type === 'created')?.at;
  if (created) return String(created).slice(0, 10);
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(t.id || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : t.updatedAt?.slice(0, 10);
};

/**
 * Special Actions -> FOR RECORD: the Request Log entries kept on record --
 * observations, FYIs and decisions, raised on their own or from a meeting.
 * Each one can drive or be attached to tasks and change orders: open it to
 * link an existing one, or create a task / change-order draft from it.
 * ?item=<task id> opens one.
 */
export function Observations() {
  const { can } = useApp();
  const [params] = useSearchParams();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [cos, setCos] = useState<any[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [kind, setKind] = useState<Kind>('all');
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');
  const [project, setProject] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get('item'));
  const load = () => api.tasks.list().then((r: any) => setTasks(Array.isArray(r) ? r : [])).catch(() => setTasks([]));
  useEffect(() => {
    load();
    // Change orders are optional: a role without finance still sees and links tasks.
    api.finance.allChangeOrders().then((r: any) => setCos(Array.isArray(r) ? r : [])).catch(() => setCos([]));
    api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).map((p: any) => ({ id: p.id, name: p.name })))).catch(() => { });
  }, []);

  const rows = useMemo(() => (tasks ? tasks.filter(isForRecord) : null), [tasks]);
  const all = useMemo(() => rows || [], [rows]);
  const projectNames = useMemo(() => [...new Set(all.map((t) => t.project).filter(Boolean))].sort(), [all]);
  const needle = q.trim().toLowerCase();
  const inScope = all.filter((t) => (!project || t.project === project) && (kind === 'all' || t.topicType === kind));
  const shown = inScope
    .filter((t) => (state === 'all' || (state === 'open' ? !isLogClosed(t.status) : isLogClosed(t.status)))
      && (!needle || [t.subject, t.description, t.project, t.assignedTo, t.originator].filter(Boolean).join(' ').toLowerCase().includes(needle)))
    .sort((a, b) => String(raisedOn(b) || '').localeCompare(String(raisedOn(a) || '')));
  const open = all.filter((t) => !isLogClosed(t.status));
  const linked = all.filter((t) => (t.linkedTaskIds?.length || 0) + (t.changeOrderIds?.length || 0) > 0).length;
  const count = (k: string) => all.filter((t) => t.topicType === k).length;
  const canAdd = can('tasks', 'manage') || can('observations', 'manage');
  const opened = openId ? (tasks || []).find((t) => t.id === openId) || null : null;
  const replace = (t: Task) => setTasks((p) => (p || []).some((x) => x.id === t.id) ? (p || []).map((x) => (x.id === t.id ? t : x)) : [t, ...(p || [])]);

  return (
    <AkPage
      lead="Observations from site, FYIs to share and decisions made — raised on their own or from a meeting, and kept on record. Link them to the tasks and change orders they drive."
      action={canAdd ? (
        <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ak-btn" onClick={() => setCreating('FYI')}>+ FYI</button>
          <button type="button" className="ak-btn" onClick={() => setCreating('Decision')}>+ Decision</button>
          <button type="button" className="ak-btn is-dark" onClick={() => setCreating('Observation')}>+ Observation</button>
        </span>
      ) : undefined}
    >
      <AkStats items={[
        { key: 'open', label: 'Open', value: rows ? open.length : '—', sub: 'not closed yet', tone: open.length ? 'yellow' : undefined, onClick: () => setState('open'), on: state === 'open' },
        { key: 'obs', label: 'Observations', value: rows ? count('Observation') : '—', sub: 'all time', onClick: () => setKind('Observation'), on: kind === 'Observation' },
        { key: 'fyi', label: 'FYIs', value: rows ? count('FYI') : '—', sub: 'all time', onClick: () => setKind('FYI'), on: kind === 'FYI' },
        { key: 'dec', label: 'Decisions', value: rows ? count('Decision') : '—', sub: 'all time', onClick: () => setKind('Decision'), on: kind === 'Decision' },
        { key: 'linked', label: 'Driving work', value: rows ? linked : '—', sub: 'linked to a task or change order' },
      ]} />

      <div className="ak-tools">
        <AkSeg<Kind> value={kind} onChange={setKind} options={[['all', 'All', all.length], ['Observation', 'Observations'], ['FYI', 'FYI'], ['Decision', 'Decisions']]} />
        <AkSeg value={state} onChange={setState} options={[['open', 'Open'], ['closed', 'Closed'], ['all', 'All']]} />
        <select className="ak-select" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className="ak-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
      </div>

      <section className="ak-card">
        {rows === null && <div className="ak-empty">Loading…</div>}
        {rows && !shown.length && (
          <div className="ak-empty">
            {all.length ? 'Nothing matches these filters.' : 'Nothing on record yet.'}
            {canAdd && !all.length && <> <button type="button" className="ak-link" onClick={() => setCreating('Observation')}>Record the first one</button></>}
          </div>
        )}
        {shown.map((t, i) => {
          const nT = t.linkedTaskIds?.length || 0;
          const nC = t.changeOrderIds?.length || 0;
          return (
            <AkRow key={t.id} index={i} muted={isLogClosed(t.status)} onClick={() => setOpenId(t.id)}
              lead={<AkDate iso={raisedOn(t)} />}
              title={logTaskTitle(t)}
              sub={[t.project || 'No project', t.originator && 'from ' + t.originator, t.assignedTo && 'to ' + t.assignedTo, t.meetingId ? 'from a meeting' : t.meetingType && t.meetingType !== 'Internal' ? t.meetingType + ' meeting' : ''].filter(Boolean).join(' · ')}
              right={<>
                {nT + nC > 0 && <span className="ak-hide-sm" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{[nT && `${nT} ${nT === 1 ? 'task' : 'tasks'}`, nC && `${nC} CO`].filter(Boolean).join(' · ')}</span>}
                <AkPill tone={RECORD_TONE[t.topicType] || 'soft'}>{t.topicType}</AkPill>
                <AkPill tone={isLogClosed(t.status) ? 'soft' : 'dark'}>{t.status}</AkPill>
              </>}
            />
          );
        })}
      </section>

      {creating && <NewTaskDrawer defaultTopic={creating} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); load(); }} />}
      {opened && (
        <RecordPanel key={opened.id} item={opened} tasks={tasks || []} cos={cos} projects={projects} canEdit={canAdd}
          onClose={() => setOpenId(null)} onTask={replace} onCo={(c) => setCos((p) => [c, ...p])} />
      )}
    </AkPage>
  );
}

/** Draft a change order on a project from a FOR RECORD item or a meeting. Finance permissions apply. */
export async function draftChangeOrder(projectId: number, title: string, description: string) {
  return api.finance.createChangeOrder(projectId, { title: title.trim().slice(0, 300), description }) as Promise<any>;
}

// ------------------------------------------------------------------ one entry

function RecordPanel({ item, tasks, cos, projects, canEdit, onClose, onTask, onCo }: {
  item: Task; tasks: Task[]; cos: any[]; projects: { id: number; name: string }[]; canEdit: boolean;
  onClose: () => void; onTask: (t: Task) => void; onCo: (c: any) => void;
}) {
  const navigate = useNavigate();
  const { users, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'task' | 'co'>('task');
  const [subject, setSubject] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [pick, setPick] = useState('');
  const projectId = projects.find((p) => p.name === item.project)?.id;
  const linkedTasks = (item.linkedTaskIds || []).map((id) => tasks.find((t) => t.id === id) || ({ id, subject: id, status: '', topicType: 'Task' } as unknown as Task));
  const linkedCos = (item.changeOrderIds || []).map((id) => cos.find((c) => c.id === id) || { id, title: id, status: '' });
  // Offer the same project's entries first, then the rest.
  const taskChoices = tasks.filter((t) => t.id !== item.id && !isForRecord(t) && t.topicType !== 'RFI' && !(item.linkedTaskIds || []).includes(t.id))
    .sort((a, b) => Number(b.project === item.project) - Number(a.project === item.project) || Number(isLogClosed(a.status)) - Number(isLogClosed(b.status)));
  const coChoices = cos.filter((c) => !(item.changeOrderIds || []).includes(c.id) && (!projectId || Number(c.projectId) === projectId));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast('⚠ ' + ((e as Error).message || 'That didn’t work')); } finally { setBusy(false); }
  };
  const createTask = () => run(async () => {
    const u = users.find((x) => x.id === assignee);
    const r = await api.tasks.linkedTask(item.id, { subject: subject.trim() || undefined, assignedTo: u?.name, assignedToId: u?.id, dueDate: due || undefined });
    onTask(r.entry); onTask(r.task);
    setSubject(''); setDue('');
    toast(`Task created${u ? ' — ' + u.name + ' is emailed' : ''}`);
  });
  const createCo = () => run(async () => {
    if (!projectId) { toast('⚠ This entry has no project — a change order belongs to a project'); return; }
    const co = await draftChangeOrder(projectId, subject.trim() || logTaskTitle(item), `From ${item.topicType} ${item.id}: ${logTaskTitle(item)}${item.description ? '\n\n' + item.description : ''}`);
    onCo(co);
    onTask(await api.tasks.link(item.id, 'changeOrder', co.id));
    setSubject('');
    toast(`${co.number || 'Change order'} drafted`);
  });
  const linkPicked = () => run(async () => {
    if (!pick) return;
    const r = await api.tasks.link(item.id, mode === 'task' ? 'task' : 'changeOrder', pick);
    onTask(r);
    if (mode === 'task') { const other = tasks.find((t) => t.id === pick); if (other) onTask({ ...other, linkedTaskIds: [...(other.linkedTaskIds || []), item.id] }); }
    setPick('');
  });
  const unlink = (kind: 'task' | 'changeOrder', id: string) => run(async () => {
    onTask(await api.tasks.unlink(item.id, kind, id));
    if (kind === 'task') { const other = tasks.find((t) => t.id === id); if (other) onTask({ ...other, linkedTaskIds: (other.linkedTaskIds || []).filter((x) => x !== item.id) }); }
  });

  return createPortal(
    <div className="mt-bg" onClick={onClose}>
      <aside className="mt-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={logTaskTitle(item)}>
        <div className="mt-head">
          <h2>{logTaskTitle(item)}</h2>
          <button type="button" className="mt-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="mt-status">
          <AkPill tone={RECORD_TONE[item.topicType] || 'soft'}>{item.topicType}</AkPill>
          <AkPill tone={isLogClosed(item.status) ? 'soft' : 'dark'}>{item.status}</AkPill>
          <span className="mt-muted">{[item.project || 'No project', raisedOn(item) && 'raised ' + akDay(raisedOn(item)), item.originator && 'by ' + item.originator].filter(Boolean).join(' · ')}</span>
        </div>
        {item.subject && item.description && <p className="mt-muted" style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>{item.description}</p>}
        <div className="mt-row">
          <button type="button" className="ak-btn" onClick={() => navigate(`/tasks?task=${encodeURIComponent(item.id)}&type=log`)}>Open in the Request Log</button>
          {item.meetingId && <button type="button" className="ak-btn" onClick={() => navigate(`/meetings?open=${encodeURIComponent(item.meetingId!)}`)}>Open the meeting</button>}
        </div>

        <h3 className="mt-h">Drives or is attached to <small>{linkedTasks.length + linkedCos.length}</small></h3>
        <div className="mt-actions">
          {!linkedTasks.length && !linkedCos.length && <span className="mt-muted">Not linked to any task or change order yet.</span>}
          {linkedTasks.map((t) => (
            <div key={t.id} className="mt-action">
              <AkPill tone="dark">Task</AkPill>
              <button type="button" className="mt-action-text mt-plain" onClick={() => navigate(`/tasks?task=${encodeURIComponent(t.id)}&type=log`)}><b>{logTaskTitle(t)}</b><small>{[t.assignedTo && 'to ' + t.assignedTo, t.dueDate && 'due ' + akDay(t.dueDate)].filter(Boolean).join(' · ') || t.id}</small></button>
              {t.status && <AkPill tone={isLogClosed(t.status) ? 'soft' : 'green'}>{t.status}</AkPill>}
              {canEdit && <button type="button" className="mt-unlink" disabled={busy} onClick={() => unlink('task', t.id)} aria-label="Unlink">×</button>}
            </div>
          ))}
          {linkedCos.map((c: any) => (
            <div key={c.id} className="mt-action">
              <AkPill tone="soft">Change order</AkPill>
              <button type="button" className="mt-action-text mt-plain" onClick={() => navigate(`/changeorders?co=${encodeURIComponent(c.id)}`)}><b>{coName(c)}</b><small>{CO_LABEL[c.status] || c.status || 'change order'}</small></button>
              {canEdit && <button type="button" className="mt-unlink" disabled={busy} onClick={() => unlink('changeOrder', c.id)} aria-label="Unlink">×</button>}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="mt-add">
            <AkSeg value={mode} onChange={(v) => { setMode(v); setPick(''); }} options={[['task', 'Task'], ['co', 'Change order']]} />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={mode === 'task' ? `New task — e.g. Follow up: ${logTaskTitle(item)}` : `Change order title — e.g. ${logTaskTitle(item)}`} />
            {mode === 'task' && (
              <div className="mt-row">
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Assign to…</option>
                  {users.filter((u) => u.status !== 'suspended').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
              </div>
            )}
            <button type="button" className="ak-btn is-dark" disabled={busy} onClick={mode === 'task' ? createTask : createCo}>{mode === 'task' ? 'Create linked task' : 'Draft linked change order'}</button>
            <div className="mt-row">
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={mode === 'task' ? 'Existing task' : 'Existing change order'}>
                <option value="">{mode === 'task' ? '…or attach to an existing task' : '…or attach to an existing change order'}</option>
                {mode === 'task'
                  ? taskChoices.slice(0, 300).map((t) => <option key={t.id} value={t.id}>{logTaskTitle(t).slice(0, 80)}{t.project ? ` — ${t.project}` : ''}{isLogClosed(t.status) ? ' (closed)' : ''}</option>)
                  : coChoices.map((c) => <option key={c.id} value={c.id}>{coName(c)}</option>)}
              </select>
              <button type="button" className="ak-btn" disabled={busy || !pick} onClick={linkPicked}>Attach</button>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
