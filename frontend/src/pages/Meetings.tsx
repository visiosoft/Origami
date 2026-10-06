import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { SaveBar, useAutosave } from '../autosave';
import { isLogClosed } from '../data/logStatuses';
import { logTaskTitle, type Task } from '../data/tasks';
import { MEETING_FIELDS, MEETING_TYPES, type Attendee, type Meeting } from '../data/meetings';
import { raisedOn } from './Observations';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats, akDay, akToday } from '../components/ActionKit';
import './Meetings.css';

type View = 'upcoming' | 'past' | 'all';
interface Item { key: string; kind: 'meeting' | 'legacy'; date: string; time?: string; title: string; type: string; project?: string; status: string; actions: Task[]; meeting?: Meeting }
const STATUS: Record<string, [string, 'yellow' | 'soft' | 'outline']> = { scheduled: ['Scheduled', 'yellow'], held: ['Held', 'soft'], cancelled: ['Cancelled', 'outline'], legacy: ['From Request Log', 'soft'] };
const isoDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');
const timeLabel = (t?: string) => {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/**
 * Special Actions -> Meetings: plan a meeting (who, when, where, agenda), keep
 * its minutes, and raise what came out of it -- tasks, FYIs and observations go
 * to the Request Log linked to the meeting, RFIs to the RFI log. Past meetings
 * recorded only in the Request Log (its meeting type and date) are listed too.
 */
export function Meetings() {
  const { can } = useApp();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [rfis, setRfis] = useState<any[]>([]);
  const [view, setView] = useState<View>('upcoming');
  const [project, setProject] = useState('');
  const [q, setQ] = useState('');
  // ?open=<meeting id> opens that meeting (links from Special Actions).
  const [params] = useSearchParams();
  const [openKey, setOpenKey] = useState<string | null>(params.get('open'));
  const canEdit = can('meetings', 'manage') || can('tasks', 'manage');

  useEffect(() => {
    api.meetings.list().then((r) => setMeetings(Array.isArray(r) ? r : [])).catch(() => setMeetings([]));
    api.tasks.list().then((r: any) => setTasks(Array.isArray(r) ? r : [])).catch(() => { });
    api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).map((p: any) => ({ id: p.id, name: p.name })))).catch(() => { });
    api.rfis.list().then((r) => setRfis(Array.isArray(r) ? r : [])).catch(() => { });
  }, []);

  const today = akToday();
  const items = useMemo<Item[]>(() => {
    const out: Item[] = (meetings || []).map((m) => ({
      key: m.id, kind: 'meeting', date: m.date, time: m.time, title: m.title, type: m.type, project: m.project, status: m.status, meeting: m,
      actions: tasks.filter((t) => t.meetingId === m.id),
    }));
    // Meetings that exist only as Request Log entries (meeting type + date), grouped.
    const groups = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.meetingId || !String(t.meetingDate || '').trim()) continue;
      const k = `${t.meetingType || 'Internal'}|${t.meetingDate}|${t.project || ''}`;
      groups.set(k, [...(groups.get(k) || []), t]);
    }
    for (const [k, list] of groups) {
      const [type, md, proj] = k.split('|');
      out.push({ key: 'legacy:' + k, kind: 'legacy', date: isoDay(md) || raisedOn(list[0]) || '', title: `${type} meeting${isoDay(md) ? '' : ' · ' + md}`, type, project: proj, status: 'legacy', actions: list });
    }
    return out;
  }, [meetings, tasks]);

  const isUpcoming = (i: Item) => i.kind === 'meeting' && i.status === 'scheduled' && i.date >= today;
  const needle = q.trim().toLowerCase();
  const shown = items
    .filter((i) => (view === 'all' || (view === 'upcoming' ? isUpcoming(i) : !isUpcoming(i)))
      && (!project || i.project === project)
      && (!needle || [i.title, i.type, i.project, ...(i.meeting?.attendees || []).map((a) => a.name)].filter(Boolean).join(' ').toLowerCase().includes(needle)))
    .sort((a, b) => (view === 'upcoming' ? `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`) : `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`)));
  const upcoming = items.filter(isUpcoming).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const weekEnd = (() => { const d = new Date(weekStart + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
  const thisWeek = items.filter((i) => i.kind === 'meeting' && i.status !== 'cancelled' && i.date >= weekStart && i.date <= weekEnd).length;
  const openActions = items.reduce((a, i) => a + i.actions.filter((t) => !isLogClosed(t.status)).length, 0);
  const projectNames = useMemo(() => [...new Set(items.map((i) => i.project).filter(Boolean) as string[])].sort(), [items]);
  const opened = openKey === 'new' ? null : items.find((i) => i.key === openKey) || null;

  // Open on Past when nothing is coming up.
  useEffect(() => { if (meetings && !upcoming.length && view === 'upcoming') setView('past'); }, [meetings === null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AkPage
      lead="Plan meetings, keep their minutes, and raise what came out of them — tasks, FYIs and observations go to the Request Log linked to the meeting; RFIs go to the RFI log."
      action={canEdit ? <button type="button" className="ak-btn is-dark" onClick={() => setOpenKey('new')}>+ Meeting</button> : undefined}
    >
      <AkStats items={[
        { key: 'next', label: 'Next meeting', value: upcoming[0] ? akDay(upcoming[0].date) : '—', sub: upcoming[0] ? [upcoming[0].title, timeLabel(upcoming[0].time)].filter(Boolean).join(' · ') : 'nothing scheduled', tone: upcoming[0] ? 'yellow' : undefined, onClick: upcoming[0] ? () => setOpenKey(upcoming[0].key) : undefined },
        { key: 'week', label: 'This week', value: meetings ? thisWeek : '—', sub: 'meetings' },
        { key: 'up', label: 'Coming up', value: meetings ? upcoming.length : '—', sub: 'scheduled', onClick: () => setView('upcoming'), on: view === 'upcoming' },
        { key: 'act', label: 'Open actions', value: meetings ? openActions : '—', sub: 'raised in meetings, not closed', tone: openActions ? 'dark' : undefined },
      ]} />

      <div className="ak-tools">
        <AkSeg<View> value={view} onChange={setView} options={[['upcoming', 'Coming up', upcoming.length], ['past', 'Past'], ['all', 'All']]} />
        <select className="ak-select" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className="ak-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, project, attendee…" />
      </div>

      <section className="ak-card">
        {meetings === null && <div className="ak-empty">Loading…</div>}
        {meetings && !shown.length && (
          <div className="ak-empty">
            {view === 'upcoming' ? 'Nothing scheduled.' : 'No meetings here.'}
            {canEdit && <> <button type="button" className="ak-link" onClick={() => setOpenKey('new')}>Schedule one</button></>}
          </div>
        )}
        {shown.map((i, n) => {
          const open = i.actions.filter((t) => !isLogClosed(t.status)).length;
          const st = STATUS[i.status] || STATUS.scheduled;
          return (
            <AkRow key={i.key} index={n} muted={i.status === 'cancelled'} onClick={() => setOpenKey(i.key)}
              lead={<AkDate iso={i.date} />}
              title={i.title}
              sub={[i.type !== 'Internal' || i.kind === 'meeting' ? i.type : '', i.project, timeLabel(i.time), i.meeting?.attendees?.length ? `${i.meeting.attendees.length} attending` : '', i.meeting?.location].filter(Boolean).join(' · ')}
              right={<>
                {i.actions.length > 0 && <span className="ak-hide-sm" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{i.actions.length} {i.actions.length === 1 ? 'action' : 'actions'}{open ? ` · ${open} open` : ''}</span>}
                <AkPill tone={st[1]}>{st[0]}</AkPill>
              </>}
            />
          );
        })}
      </section>

      {openKey === 'new' && (
        <NewMeeting projects={projects} onClose={() => setOpenKey(null)}
          onCreated={(m) => { setMeetings((p) => [m, ...(p || [])]); setOpenKey(m.id); }} />
      )}
      {opened && (
        <MeetingPanel key={opened.key} item={opened} projects={projects} rfis={rfis} canEdit={canEdit}
          onClose={() => setOpenKey(null)}
          onSaved={(m) => setMeetings((p) => (p || []).map((x) => (x.id === m.id ? m : x)))}
          onDeleted={(id) => { setMeetings((p) => (p || []).filter((x) => x.id !== id)); setTasks((ts) => ts.map((t) => (t.meetingId === id ? { ...t, meetingId: undefined } : t))); setOpenKey(null); }}
          onAction={(t) => setTasks((ts) => [t, ...ts])}
          onRfi={(r) => setRfis((p) => [r, ...p])} />
      )}
    </AkPage>
  );
}

// ------------------------------------------------------------------ new meeting

function NewMeeting({ projects, onClose, onCreated }: { projects: { id: number; name: string }[]; onClose: () => void; onCreated: (m: Meeting) => void }) {
  const { toast } = useApp();
  const [m, setM] = useState<Partial<Meeting>>({ title: '', type: 'Internal', date: akToday(), time: '', location: '', projectId: null, project: '' });
  const [busy, setBusy] = useState(false);
  const create = () => {
    if (!String(m.title || '').trim()) { toast('⚠ Give the meeting a title'); return; }
    setBusy(true);
    api.meetings.create(m).then(onCreated).catch((e: Error) => toast('⚠ ' + (e.message || 'Could not create'))).finally(() => setBusy(false));
  };
  // Drawn at the top of the page (a portal), so the page's own animations can't box it in.
  return createPortal(
    <div className="mt-bg" onClick={onClose}>
      <aside className="mt-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New meeting">
        <div className="mt-head"><h2>New meeting</h2><button type="button" className="mt-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="mt-form">
          <label className="is-wide">Title<input autoFocus value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} placeholder="e.g. Weekly OAC meeting" onKeyDown={(e) => { if (e.key === 'Enter') create(); }} /></label>
          <label>Type<select value={m.type} onChange={(e) => setM({ ...m, type: e.target.value })}>{MEETING_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Project<ProjectSelect projects={projects} value={m.projectId ?? null} onChange={(id, name) => setM({ ...m, projectId: id, project: name })} /></label>
          <label>Date<input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></label>
          <label>Time<input type="time" value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} /></label>
          <label className="is-wide">Where<input value={m.location} onChange={(e) => setM({ ...m, location: e.target.value })} placeholder="Site, office, or a video link" /></label>
        </div>
        <div className="mt-foot">
          <span>Add attendees, the agenda and actions once it’s created.</span>
          <button type="button" className="ak-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="ak-btn is-dark" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create meeting'}</button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function ProjectSelect({ projects, value, onChange, disabled }: { projects: { id: number; name: string }[]; value: number | null; onChange: (id: number | null, name: string) => void; disabled?: boolean }) {
  return (
    <select disabled={disabled} value={value ?? ''} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; onChange(id, projects.find((p) => p.id === id)?.name || ''); }}>
      <option value="">No project (general)</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

// ------------------------------------------------------------------ one meeting

function MeetingPanel({ item, projects, rfis, canEdit, onClose, onSaved, onDeleted, onAction, onRfi }: {
  item: Item; projects: { id: number; name: string }[]; rfis: any[]; canEdit: boolean;
  onClose: () => void; onSaved: (m: Meeting) => void; onDeleted: (id: string) => void; onAction: (t: Task) => void; onRfi: (r: any) => void;
}) {
  const navigate = useNavigate();
  const { users, toast } = useApp();
  const m0 = item.meeting;
  const [saved, setSaved] = useState<Meeting | null>(m0 || null);
  const [draft, setDraft] = useState<Meeting>(m0 || ({} as Meeting));
  const editable = canEdit && item.kind === 'meeting';
  const auto = useAutosave<Meeting>({
    draft, saved, fields: MEETING_FIELDS, resetKey: 'meeting-' + item.key, enabled: editable, label: 'meeting',
    save: async (changes) => { const r = await api.meetings.update(draft.id, changes); setSaved(r); onSaved(r); return r; },
  });
  const set = (p: Partial<Meeting>) => setDraft((d) => ({ ...d, ...p }));

  // ---- attendees
  const [who, setWho] = useState('');
  const attendees = draft.attendees || [];
  const addAttendee = (a: Attendee) => {
    if (!a.name.trim() || attendees.some((x) => (a.id && x.id === a.id) || x.name.toLowerCase() === a.name.trim().toLowerCase())) return;
    set({ attendees: [...attendees, { ...a, name: a.name.trim() }] }); setWho('');
  };
  const pickable = users.filter((u) => u.status !== 'suspended' && !attendees.some((a) => a.id === u.id));

  // ---- actions
  const [kind, setKind] = useState<'Task' | 'FYI' | 'Observation' | 'RFI'>('Task');
  const [subject, setSubject] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [adding, setAdding] = useState(false);
  const linkedRfis = (draft.rfiIds || []).map((id) => rfis.find((r) => r.id === id) || { id, number: id, subject: 'RFI', status: '' });
  const addAction = async () => {
    if (!subject.trim()) { toast('⚠ Say what needs doing'); return; }
    setAdding(true);
    try {
      if (kind === 'RFI') {
        if (!draft.projectId) { toast('⚠ Pick the meeting’s project first — an RFI belongs to a project'); return; }
        const r = await api.rfis.create({ projectId: draft.projectId, project: draft.project, subject: subject.trim().slice(0, 300), question: `${subject.trim()}\n\nRaised in “${draft.title}” on ${akDay(draft.date)}.` });
        onRfi(r);
        const next = await api.meetings.update(draft.id, { rfiIds: [...(draft.rfiIds || []), r.id] });
        setSaved(next); setDraft((d) => ({ ...d, rfiIds: next.rfiIds })); onSaved(next);
        toast(`${r.number || 'RFI'} drafted`);
      } else {
        const u = users.find((x) => x.id === assignee);
        const t = await api.meetings.addAction(draft.id, { topicType: kind, subject: subject.trim(), assignedTo: u?.name, assignedToId: u?.id, dueDate: due || undefined });
        onAction(t);
        toast(`${kind} added${u ? ' — ' + u.name + ' is emailed' : ''}`);
      }
      setSubject(''); setDue('');
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not added')); }
    finally { setAdding(false); }
  };

  const toCalendar = () => {
    if (!draft.date) return;
    const start = new Date(`${draft.date}T${draft.time || '09:00'}:00`);
    const end = new Date(start.getTime() + 60 * 60000);
    api.google.myCalendar.createEvent({
      summary: draft.title, start: start.toISOString(), end: end.toISOString(), location: draft.location || undefined,
      description: [draft.project && `Project: ${draft.project}`, draft.agenda && `Agenda:\n${draft.agenda}`].filter(Boolean).join('\n\n') || undefined,
      attendees: attendees.map((a) => a.email || users.find((u) => u.id === a.id)?.email).filter(Boolean) as string[],
      video: /meet|zoom|teams|video|http/i.test(draft.location || ''),
    }).then((ev) => toast(ev?.htmlLink ? 'Added to your Google Calendar — invites sent' : 'Added to your Google Calendar'))
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Connect your Google Calendar in Settings → My account')));
  };
  const remove = () => {
    if (!confirm(`Delete “${draft.title}”? Actions raised in it stay in the Request Log.`)) return;
    api.meetings.remove(draft.id).then(() => { toast('Meeting deleted'); onDeleted(draft.id); }).catch((e: Error) => toast('⚠ ' + e.message));
  };

  return createPortal(
    <div className="mt-bg" onClick={onClose}>
      <aside className="mt-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={item.title}>
        <div className="mt-head">
          {editable ? <input className="mt-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} aria-label="Meeting title" /> : <h2>{item.title}</h2>}
          <button type="button" className="mt-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {item.kind === 'meeting' ? (
          <>
            <div className="mt-status">
              {(['scheduled', 'held', 'cancelled'] as const).map((s) => (
                <button type="button" key={s} disabled={!editable} className={draft.status === s ? 'is-on' : ''} onClick={() => set({ status: s })}>{STATUS[s][0]}</button>
              ))}
              {editable && <span className="mt-save"><SaveBar auto={auto} compact /></span>}
            </div>
            <div className="mt-form">
              <label>Type<select disabled={!editable} value={draft.type} onChange={(e) => set({ type: e.target.value })}>{MEETING_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label>Project<ProjectSelect disabled={!editable} projects={projects} value={draft.projectId ?? null} onChange={(id, name) => set({ projectId: id, project: name })} /></label>
              <label>Date<input disabled={!editable} type="date" value={draft.date || ''} onChange={(e) => e.target.value && set({ date: e.target.value })} /></label>
              <label>Time<input disabled={!editable} type="time" value={draft.time || ''} onChange={(e) => set({ time: e.target.value })} /></label>
              <label className="is-wide">Where<input disabled={!editable} value={draft.location || ''} onChange={(e) => set({ location: e.target.value })} placeholder="Site, office, or a video link" /></label>
            </div>

            <h3 className="mt-h">Attendees <small>{attendees.length}</small></h3>
            <div className="mt-chips">
              {attendees.map((a) => (
                <span key={a.id || a.name} className="mt-chip">{a.name}{editable && <button type="button" onClick={() => set({ attendees: attendees.filter((x) => x !== a) })} aria-label={`Remove ${a.name}`}>×</button>}</span>
              ))}
              {!attendees.length && <span className="mt-muted">No one added yet.</span>}
            </div>
            {editable && (
              <div className="mt-row">
                <select value="" onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (u) addAttendee({ id: u.id, name: u.name, email: u.email }); }}>
                  <option value="">Add someone from the team…</option>
                  {pickable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="…or type a name (client, consultant)" onKeyDown={(e) => { if (e.key === 'Enter') addAttendee({ name: who }); }} />
                <button type="button" className="ak-btn" onClick={() => addAttendee({ name: who })}>Add</button>
              </div>
            )}

            <h3 className="mt-h">Agenda</h3>
            <textarea className="mt-text" disabled={!editable} rows={4} value={draft.agenda || ''} onChange={(e) => set({ agenda: e.target.value })} placeholder="What will be covered" />
            <h3 className="mt-h">Minutes</h3>
            <textarea className="mt-text is-tall" disabled={!editable} rows={6} value={draft.minutes || ''} onChange={(e) => set({ minutes: e.target.value })} placeholder="What was discussed and decided" />
          </>
        ) : (
          <p className="mt-muted" style={{ margin: '0 0 6px' }}>Recorded in the Request Log as a {item.type.toLowerCase()} meeting{item.project ? ` on ${item.project}` : ''} — these are the entries raised in it.</p>
        )}

        <h3 className="mt-h">Actions <small>{item.actions.length + linkedRfis.length}</small></h3>
        <div className="mt-actions">
          {!item.actions.length && !linkedRfis.length && <span className="mt-muted">Nothing raised yet.</span>}
          {item.actions.map((t) => (
            <button type="button" key={t.id} className="mt-action" onClick={() => navigate(`/tasks?task=${encodeURIComponent(t.id)}&type=log`)}>
              <AkPill tone={t.topicType === 'Task' ? 'dark' : t.topicType === 'FYI' ? 'yellow' : 'outline'}>{t.topicType}</AkPill>
              <span className="mt-action-text"><b>{logTaskTitle(t)}</b><small>{[t.assignedTo && 'to ' + t.assignedTo, t.dueDate && 'due ' + akDay(t.dueDate)].filter(Boolean).join(' · ') || 'unassigned'}</small></span>
              <AkPill tone={isLogClosed(t.status) ? 'soft' : 'green'}>{t.status}</AkPill>
            </button>
          ))}
          {linkedRfis.map((r: any) => (
            <button type="button" key={r.id} className="mt-action" onClick={() => navigate(`/rfis?rfi=${encodeURIComponent(r.id)}`)}>
              <AkPill tone="soft">RFI</AkPill>
              <span className="mt-action-text"><b>{r.number ? `${r.number} · ` : ''}{r.subject}</b><small>{r.ownerName ? 'with ' + r.ownerName : 'RFI log'}</small></span>
              {r.status && <AkPill tone={['closed', 'void'].includes(r.status) ? 'soft' : 'green'}>{r.status}</AkPill>}
            </button>
          ))}
        </div>
        {editable && (
          <div className="mt-add">
            <AkSeg value={kind} onChange={setKind} options={[['Task', 'Task'], ['FYI', 'FYI'], ['Observation', 'Observation'], ['RFI', 'RFI']]} />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={kind === 'RFI' ? 'The question for the RFI' : 'What needs doing or knowing'} onKeyDown={(e) => { if (e.key === 'Enter') void addAction(); }} />
            {kind !== 'RFI' && (
              <div className="mt-row">
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Assign to…</option>
                  {users.filter((u) => u.status !== 'suspended').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
              </div>
            )}
            <button type="button" className="ak-btn is-dark" disabled={adding} onClick={() => void addAction()}>{adding ? 'Adding…' : kind === 'RFI' ? 'Draft RFI' : `Add ${kind.toLowerCase()}`}</button>
          </div>
        )}

        {item.kind === 'meeting' && (
          <div className="mt-foot">
            <button type="button" className="ak-btn" onClick={toCalendar}>Add to my Google Calendar</button>
            <span />
            {editable && <button type="button" className="ak-btn mt-danger" onClick={remove}>Delete</button>}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
