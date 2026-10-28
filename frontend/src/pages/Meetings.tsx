import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { SaveBar, useAutosave, type Autosave } from '../autosave';
import { isLogClosed } from '../data/logStatuses';
import { isForRecord, logTaskTitle, type Task } from '../data/tasks';
import {
  MEETING_FIELDS, MEETING_LOCATION_TYPES, MEETING_STATUSES, MEETING_TYPES, isPlanned, locationTypeInfo, meetingStatus, meetingStatusInfo, needsReview,
  type Attendee, type Meeting, type MeetingLocationType, type MeetingStatus,
} from '../data/meetings';
import { RECORD_TONE, raisedOn } from './Observations';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats, akDay, akToday } from '../components/ActionKit';
import { SavedViews } from '../components/SavedViews';
import { ActionMenu, ActionTrail, OriginatorLine } from '../components/ActionTools';
import { SortSelect, sortFromString, sortToString, useSort } from '../components/SortHeader';
import './Meetings.css';
import { Skeleton } from '../components/Skeleton';
import { MeetingNotesImport } from '../components/MeetingNotesImport';
import { TagPicker } from '../components/TagPicker';

type View = 'upcoming' | 'past' | 'all';
type StatusFilter = 'all' | 'review' | MeetingStatus;
type WhereFilter = 'all' | MeetingLocationType;
interface Item { key: string; kind: 'meeting' | 'legacy'; date: string; time?: string; title: string; type: string; project?: string; status: string; actions: Task[]; meeting?: Meeting }
const CO_LABEL: Record<string, string> = { draft: 'Pending', internal_review: 'Internal review', submitted: 'With client', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
const isoDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');
const timeLabel = (t?: string) => {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
const WHERE_PLACEHOLDER: Record<string, string> = {
  virtual: 'The video link (Zoom, Meet, Teams…)', call: 'The number or dial-in', text: 'The group chat or thread', in_person: 'The address — site, office or elsewhere',
};
const linkOk = (u?: string) => !!u && /^https?:\/\//i.test(u.trim());

/**
 * Special Actions -> Meetings: plan a meeting (who, when, how, where, agenda),
 * keep its notes, recording and transcript, then review it -- pull out the
 * special actions (tasks, RFIs, change orders) and FOR RECORD items
 * (observations, FYIs, decisions). Special Actions Log entries are linked to the
 * meeting; RFIs and change orders are listed on it. A reviewed meeting turns
 * Complete by itself once everything raised in it is done. Past meetings
 * recorded only in the Special Actions Log (its meeting type and date) are listed too.
 */
/** `projectName`: shown inside a project (its Special Actions tab) -- that project's only, no project picker. */
export function Meetings({ projectName }: { projectName?: string } = {}) {
  const { can } = useApp();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [rfis, setRfis] = useState<any[]>([]);
  const [cos, setCos] = useState<any[]>([]);
  const [view, setView] = useState<View>('upcoming');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [where, setWhere] = useState<WhereFilter>('all');
  const [project, setProjectRaw] = useState(projectName || '');
  const setProject = (v: string) => { if (!projectName) setProjectRaw(v); };
  const [q, setQ] = useState('');
  // ?open=<meeting id> opens that meeting (links from Special Actions).
  const [params] = useSearchParams();
  const [openKey, setOpenKey] = useState<string | null>(params.get('open'));
  const canEdit = can('meetings', 'manage') || can('tasks', 'manage');

  useEffect(() => {
    api.meetings.list().then((r) => setMeetings(Array.isArray(r) ? r : [])).catch(() => setMeetings([]));
    api.tasks.list(undefined, undefined, { slim: true }).then((r: any) => setTasks(Array.isArray(r) ? r : [])).catch(() => { });
    api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).map((p: any) => ({ id: p.id, name: p.name })))).catch(() => { });
    api.rfis.list().then((r) => setRfis(Array.isArray(r) ? r : [])).catch(() => { });
    api.finance.allChangeOrders().then((r: any) => setCos(Array.isArray(r) ? r : [])).catch(() => { });
  }, []);

  const today = akToday();
  const items = useMemo<Item[]>(() => {
    const out: Item[] = (meetings || []).filter((m) => !projectName || m.project === projectName).map((m) => ({
      key: m.id, kind: 'meeting', date: m.date, time: m.time, title: m.title, type: m.type, project: m.project, status: meetingStatus(m.status), meeting: m,
      actions: tasks.filter((t) => t.meetingId === m.id),
    }));
    // Meetings that exist only as Special Actions Log entries (meeting type + date), grouped.
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
  }, [meetings, tasks, projectName]);

  const real = items.filter((i) => i.kind === 'meeting');
  const isUpcoming = (i: Item) => i.kind === 'meeting' && isPlanned(i.status) && i.date >= today;
  const toReview = (i: Item) => i.kind === 'meeting' && needsReview({ status: i.status as MeetingStatus, date: i.date }, today);
  const statusOk = (i: Item) => status === 'all' || (status === 'review' ? toReview(i) : i.status === status);
  const whereOk = (i: Item) => where === 'all' || i.meeting?.locationType === where;
  const needle = q.trim().toLowerCase();
  const shown = items
    .filter((i) => (view === 'all' || (view === 'upcoming' ? isUpcoming(i) : !isUpcoming(i)))
      && statusOk(i) && whereOk(i)
      && (!project || i.project === project)
      && (!needle || [i.title, i.meeting?.serial, i.type, i.project, i.meeting?.location, ...(i.meeting?.attendees || []).map((a) => a.name)].filter(Boolean).join(' ').toLowerCase().includes(needle)))
    .sort((a, b) => (view === 'upcoming' ? `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`) : `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`)));
  const { sorted, sort, setSort } = useSort(shown, { date: (i) => `${i.date}${i.time || ''}`, title: (i) => i.title, project: (i) => i.project, type: (i) => i.type });
  const viewValue = { view, status, where, project, q, sort: sortToString(sort) };
  const upcoming = items.filter(isUpcoming).sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  const reviewCount = real.filter(toReview).length;
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const weekEnd = (() => { const d = new Date(weekStart + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })();
  const thisWeek = real.filter((i) => i.status !== 'cancelled' && i.date >= weekStart && i.date <= weekEnd).length;
  const openActions = items.reduce((a, i) => a + i.actions.filter((t) => !isForRecord(t) && !isLogClosed(t.status)).length, 0);
  const projectNames = useMemo(() => [...new Set(items.map((i) => i.project).filter(Boolean) as string[])].sort(), [items]);
  const opened = openKey === 'new' ? null : items.find((i) => i.key === openKey) || null;
  const pickStatus = (s: StatusFilter) => { setStatus(s); if (s !== 'all') setView('all'); };

  // Open on Past when nothing is coming up.
  useEffect(() => { if (meetings && !upcoming.length && view === 'upcoming') setView('past'); }, [meetings === null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AkPage
      lead="Plan meetings, keep their notes, recordings and transcripts, then review them: pull out the tasks, RFIs and change orders, and the observations, FYIs and decisions to keep FOR RECORD."
      action={canEdit ? <button type="button" className="ak-btn is-dark" onClick={() => setOpenKey('new')}>+ Meeting</button> : undefined}
    >
      <AkStats items={[
        { key: 'next', label: 'Next meeting', value: upcoming[0] ? akDay(upcoming[0].date) : '—', sub: upcoming[0] ? [upcoming[0].title, timeLabel(upcoming[0].time)].filter(Boolean).join(' · ') : 'nothing scheduled', tone: upcoming[0] ? 'yellow' : undefined, onClick: upcoming[0] ? () => setOpenKey(upcoming[0].key) : undefined },
        { key: 'week', label: 'This week', value: meetings ? thisWeek : '—', sub: 'meetings' },
        { key: 'review', label: 'To review', value: meetings ? reviewCount : '—', sub: 'occurred, special actions not pulled out', tone: reviewCount ? 'dark' : undefined, onClick: () => pickStatus('review'), on: status === 'review' },
        { key: 'act', label: 'Open actions', value: meetings ? openActions : '—', sub: 'tasks raised in meetings, not closed' },
      ]} />

      <div className="ak-tools">
        <AkSeg<View> value={view} onChange={setView} options={[['upcoming', 'Coming up', upcoming.length], ['past', 'Past'], ['all', 'All']]} />
        {!projectName && <select className="ak-select" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>}
        <input className="ak-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, project, attendee…" />
        <SortSelect className="ak-select" value={sort} onChange={setSort} options={[
          { key: 'default', dir: 'asc', label: view === 'upcoming' ? 'Soonest first' : 'Newest first' }, { key: 'date', dir: 'desc', label: 'Newest first' }, { key: 'date', dir: 'asc', label: 'Oldest first' },
          { key: 'title', dir: 'asc', label: 'A–Z' }, { key: 'project', dir: 'asc', label: 'Project' }, { key: 'type', dir: 'asc', label: 'Meeting type' },
        ]} />
      </div>
      <div className="ak-tools">
        <AkSeg<StatusFilter> value={status} onChange={pickStatus}
          options={[['all', 'Any status'], ['review', 'To review', reviewCount], ...MEETING_STATUSES.map((s) => [s.key, s.label, real.filter((i) => i.status === s.key).length] as [StatusFilter, string, number])]} />
        <AkSeg<WhereFilter> value={where} onChange={setWhere}
          options={[['all', 'Any way'], ...MEETING_LOCATION_TYPES.map((l) => [l.key, l.short, real.filter((i) => i.meeting?.locationType === l.key).length] as [WhereFilter, string, number])]} />
      </div>
      <SavedViews page="meetings" value={viewValue} defaults={{ view: 'upcoming', status: 'all', where: 'all', project: '', q: '', sort: '' }}
        onApply={(v) => { setView(v.view as View); setStatus(v.status as StatusFilter); setWhere(v.where as WhereFilter); setProject(String(v.project || '')); setQ(String(v.q || '')); setSort(sortFromString(v.sort)); }} />

      <section className="ak-card">
        {meetings === null && <div style={{ padding: 16 }}><Skeleton rows={4} /></div>}
        {meetings && !shown.length && (
          <div className="ak-empty">
            {view === 'upcoming' && status === 'all' ? 'Nothing scheduled.' : 'No meetings here.'}
            {canEdit && <> <button type="button" className="ak-link" onClick={() => setOpenKey('new')}>Schedule one</button></>}
          </div>
        )}
        {sorted.map((i, n) => {
          const acts = i.actions.filter((t) => !isForRecord(t));
          const open = acts.filter((t) => !isLogClosed(t.status)).length;
          const rec = i.actions.length - acts.length;
          const lt = locationTypeInfo(i.meeting?.locationType);
          const late = i.kind === 'meeting' && isPlanned(i.status) && i.date < today;
          return (
            <AkRow key={i.key} index={n} muted={i.status === 'cancelled' || i.status === 'complete'} onClick={() => setOpenKey(i.key)}
              lead={<AkDate iso={i.date} />}
              title={i.title}
              sub={[i.meeting?.serial, i.type !== 'Internal' || i.kind === 'meeting' ? i.type : '', i.project, timeLabel(i.time), i.meeting?.attendees?.length ? `${i.meeting.attendees.length} attending` : '', i.meeting?.location].filter(Boolean).join(' · ')}
              right={<>
                {(acts.length > 0 || rec > 0) && <span className="ak-hide-sm" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{[acts.length && `${acts.length} ${acts.length === 1 ? 'action' : 'actions'}${open ? ` · ${open} open` : ''}`, rec && `${rec} on record`].filter(Boolean).join(' · ')}</span>}
                {lt && <span className="ak-hide-sm"><AkPill tone="outline" title={lt.label}>{lt.short}</AkPill></span>}
                {i.kind === 'legacy' ? <AkPill tone="soft">From Special Actions Log</AkPill>
                  : late ? <AkPill tone="warn" title="Its date has passed — mark it occurred, rescheduled or cancelled">Not marked occurred</AkPill>
                    : <AkPill tone={meetingStatusInfo(i.status).tone} title={meetingStatusInfo(i.status).hint}>{meetingStatusInfo(i.status).label}</AkPill>}
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
        <MeetingPanel key={opened.key} item={opened} projects={projects} rfis={rfis} cos={cos} canEdit={canEdit}
          onClose={() => setOpenKey(null)}
          onSaved={(m) => setMeetings((p) => (p || []).map((x) => (x.id === m.id ? m : x)))}
          onDeleted={(id) => { setMeetings((p) => (p || []).filter((x) => x.id !== id)); setTasks((ts) => ts.map((t) => (t.meetingId === id ? { ...t, meetingId: undefined } : t))); setOpenKey(null); }}
          onAction={(t) => setTasks((ts) => [t, ...ts])}
          onRfi={(r) => setRfis((p) => [r, ...p])}
          onCo={(c) => setCos((p) => [c, ...p])} />
      )}
    </AkPage>
  );
}

// ------------------------------------------------------------------ pieces

function LocationTypePick({ value, onChange, disabled }: { value?: string | null; onChange: (v: MeetingLocationType) => void; disabled?: boolean }) {
  return (
    <div className="mt-choice" role="radiogroup" aria-label="How it is held">
      {MEETING_LOCATION_TYPES.map((l) => (
        <button type="button" role="radio" aria-checked={value === l.key} key={l.key} disabled={disabled} className={value === l.key ? 'is-on' : ''} onClick={() => onChange(l.key)} title={l.hint}>
          <b>{l.label}</b><small>{l.hint}</small>
        </button>
      ))}
    </div>
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

// ------------------------------------------------------------------ new meeting

function NewMeeting({ projects, onClose, onCreated }: { projects: { id: number; name: string }[]; onClose: () => void; onCreated: (m: Meeting) => void }) {
  const { toast } = useApp();
  const [m, setM] = useState<Partial<Meeting>>({ title: '', type: 'Internal', date: akToday(), time: '', location: '', locationType: null, projectId: null, project: '' });
  const [busy, setBusy] = useState(false);
  const create = () => {
    if (!String(m.title || '').trim()) { toast('⚠ Give the meeting a title'); return; }
    if (!m.locationType) { toast('⚠ Choose how the meeting is held — virtual, call, text or in person'); return; }
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
          <div className="is-wide mt-field"><span>How it’s held <em>required</em></span><LocationTypePick value={m.locationType} onChange={(v) => setM({ ...m, locationType: v })} /></div>
          <label className="is-wide">Where<input value={m.location} onChange={(e) => setM({ ...m, location: e.target.value })} placeholder={WHERE_PLACEHOLDER[m.locationType || ''] || 'Site, office, or a video link'} /></label>
        </div>
        <div className="mt-foot">
          <span>Add attendees, the agenda, notes and the recording once it’s created.</span>
          <button type="button" className="ak-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="ak-btn is-dark" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create meeting'}</button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ one meeting

type Ctx = {
  draft: Meeting; projects: { id: number; name: string }[];
  /** Apply a server copy of the meeting (after linking an RFI / change order, or a status the server settled). */
  applyServer: (m: Meeting) => void;
  onAction: (t: Task) => void; onRfi: (r: any) => void; onCo: (c: any) => void;
};

function MeetingPanel({ item, projects, rfis, cos, canEdit, onClose, onSaved, onDeleted, onAction, onRfi, onCo }: {
  item: Item; projects: { id: number; name: string }[]; rfis: any[]; cos: any[]; canEdit: boolean;
  onClose: () => void; onSaved: (m: Meeting) => void; onDeleted: (id: string) => void; onAction: (t: Task) => void; onRfi: (r: any) => void; onCo: (c: any) => void;
}) {
  const navigate = useNavigate();
  const { users, toast } = useApp();
  const m0 = item.meeting;
  const [saved, setSaved] = useState<Meeting | null>(m0 || null);
  const [draft, setDraft] = useState<Meeting>(m0 ? { ...m0, status: meetingStatus(m0.status) } : ({} as Meeting));
  const [reviewing, setReviewing] = useState(false);
  const editable = canEdit && item.kind === 'meeting';
  const applyServer = (r: Meeting) => {
    setSaved(r); onSaved(r);
    // Keep fields the server owns in step, so autosave doesn't send them back.
    setDraft((d) => ({ ...d, status: meetingStatus(r.status), rfiIds: r.rfiIds, changeOrderIds: r.changeOrderIds, reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt }));
  };
  const auto = useAutosave<Meeting>({
    draft, saved, fields: MEETING_FIELDS, resetKey: 'meeting-' + item.key, enabled: editable, label: 'meeting',
    save: async (changes) => {
      const r = await api.meetings.update(draft.id, changes);
      onSaved(r);
      // The server may settle the status (reviewed -> complete): take its word for it.
      if (meetingStatus(r.status) !== changes.status && changes.status) setDraft((d) => ({ ...d, status: meetingStatus(r.status) }));
      setSaved(r);
      return r;
    },
  });
  const set = (p: Partial<Meeting>) => setDraft((d) => ({ ...d, ...p }));
  const ctx: Ctx = { draft, projects, applyServer, onAction, onRfi, onCo };

  // ---- attendees
  const [who, setWho] = useState('');
  const attendees = draft.attendees || [];
  const addAttendee = (a: Attendee) => {
    if (!a.name.trim() || attendees.some((x) => (a.id && x.id === a.id) || x.name.toLowerCase() === a.name.trim().toLowerCase())) return;
    set({ attendees: [...attendees, { ...a, name: a.name.trim() }] }); setWho('');
  };
  const pickable = users.filter((u) => u.status !== 'suspended' && !attendees.some((a) => a.id === u.id));

  const toCalendar = () => {
    if (!draft.date) return;
    const start = new Date(`${draft.date}T${draft.time || '09:00'}:00`);
    const end = new Date(start.getTime() + 60 * 60000);
    api.google.myCalendar.createEvent({
      summary: draft.title, start: start.toISOString(), end: end.toISOString(), location: draft.location || undefined,
      description: [draft.project && `Project: ${draft.project}`, draft.agenda && `Agenda:\n${draft.agenda}`].filter(Boolean).join('\n\n') || undefined,
      attendees: attendees.map((a) => a.email || users.find((u) => u.id === a.id)?.email).filter(Boolean) as string[],
      video: draft.locationType === 'virtual' || /meet|zoom|teams|video|http/i.test(draft.location || ''),
    }).then((ev) => toast(ev?.htmlLink ? 'Added to your Google Calendar — invites sent' : 'Added to your Google Calendar'))
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Connect your Google Calendar in Settings → My account')));
  };
  const remove = () => {
    if (!confirm(`Delete “${draft.title}”? Actions raised in it stay in the Special Actions Log.`)) return;
    api.meetings.remove(draft.id).then(() => { toast('Meeting deleted'); onDeleted(draft.id); }).catch((e: Error) => toast('⚠ ' + e.message));
  };
  const st = meetingStatus(draft.status);

  return createPortal(
    <div className="mt-bg" onClick={onClose}>
      <aside className="mt-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={item.title}>
        <div className="mt-head">
          {editable ? <input className="mt-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} aria-label="Meeting title" /> : <h2>{item.title}</h2>}
          <button type="button" className="mt-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {saved && <OriginatorLine by={saved.createdBy} at={saved.createdAt} number={saved.serial} />}
        {item.kind === 'meeting' ? (
          <>
            <div className="mt-status">
              {MEETING_STATUSES.map((s) => (
                // Complete is the server's call: it follows from the actions, not a click.
                <button type="button" key={s.key} title={s.hint} disabled={!editable || s.key === 'complete'} className={st === s.key ? 'is-on' : ''} onClick={() => set({ status: s.key })}>{s.label}</button>
              ))}
              {editable && <span className="mt-save"><SaveBar auto={auto} compact /></span>}
            </div>
            <p className="mt-muted" style={{ margin: 0 }}>
              {meetingStatusInfo(st).hint}.
              {(st === 'reviewed' || st === 'complete') && draft.reviewedBy ? ` Reviewed by ${draft.reviewedBy}${draft.reviewedAt ? ' on ' + akDay(draft.reviewedAt) : ''}.` : ''}
              {st === 'reviewed' ? ' It turns Complete by itself once every task, RFI and change order from it is done.' : ''}
            </p>
            {editable && st !== 'scheduled' && st !== 'rescheduled' && st !== 'cancelled' && (
              <button type="button" className={'ak-btn mt-review-btn' + (st === 'occurred' ? ' is-dark' : '')} onClick={() => setReviewing(true)}>
                {st === 'occurred' ? 'Review notes & transcript for special actions →' : 'Open the review →'}
              </button>
            )}
            <div className="mt-form">
              <label>Type<select disabled={!editable} value={draft.type} onChange={(e) => set({ type: e.target.value })}>{MEETING_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label>Project<ProjectSelect disabled={!editable} projects={projects} value={draft.projectId ?? null} onChange={(id, name) => set({ projectId: id, project: name })} /></label>
              <label>Date<input disabled={!editable} type="date" value={draft.date || ''} onChange={(e) => e.target.value && set({ date: e.target.value })} /></label>
              <label>Time<input disabled={!editable} type="time" value={draft.time || ''} onChange={(e) => set({ time: e.target.value })} /></label>
              <div className="is-wide mt-field"><span>How it’s held{!draft.locationType && editable && <em>choose one</em>}</span><LocationTypePick disabled={!editable} value={draft.locationType} onChange={(v) => set({ locationType: v })} /></div>
              <label className="is-wide">Where<input disabled={!editable} value={draft.location || ''} onChange={(e) => set({ location: e.target.value })} placeholder={WHERE_PLACEHOLDER[draft.locationType || ''] || 'Site, office, or a video link'} /></label>
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
            <h3 className="mt-h">Notes / minutes</h3>
            <textarea className="mt-text is-tall" disabled={!editable} rows={6} value={draft.minutes || ''} onChange={(e) => set({ minutes: e.target.value })} placeholder="What was discussed and decided — for meetings without a recording, the notes taken" />

            <h3 className="mt-h">Recording & transcript</h3>
            <div className="mt-form">
              <label className="is-wide">Recording link
                <span className="mt-linkrow">
                  <input disabled={!editable} value={draft.recordingUrl || ''} onChange={(e) => set({ recordingUrl: e.target.value })} placeholder="https://… (Zoom, Teams, Drive)" />
                  {linkOk(draft.recordingUrl) && <a className="ak-btn" href={draft.recordingUrl!.trim()} target="_blank" rel="noreferrer">Open</a>}
                </span>
              </label>
              <label className="is-wide">Transcript link
                <span className="mt-linkrow">
                  <input disabled={!editable} value={draft.transcriptUrl || ''} onChange={(e) => set({ transcriptUrl: e.target.value })} placeholder="https://… (if the transcript lives elsewhere)" />
                  {linkOk(draft.transcriptUrl) && <a className="ak-btn" href={draft.transcriptUrl!.trim()} target="_blank" rel="noreferrer">Open</a>}
                </span>
              </label>
            </div>
            <textarea className="mt-text" disabled={!editable} rows={4} value={draft.transcript || ''} onChange={(e) => set({ transcript: e.target.value })} placeholder="…or paste the transcript here" />
          </>
        ) : (
          <p className="mt-muted" style={{ margin: '0 0 6px' }}>Recorded in the Special Actions Log as a {item.type.toLowerCase()} meeting{item.project ? ` on ${item.project}` : ''} — these are the entries raised in it.</p>
        )}

        {saved && <div style={{ margin: '4px 0 10px' }}><ActionTrail sourceType={saved.sourceType} sourceId={saved.sourceId} sourceLabel={saved.sourceLabel} derived={saved.derivedRefs} /></div>}
        <Captured item={item} draft={draft} rfis={rfis} cos={cos} navigate={navigate} />
        {editable && <ActionForm ctx={ctx} />}
        {editable && saved && (
          <div style={{ margin: '12px 0' }}>
            <ActionMenu kind="meeting" id={saved.id} projectId={saved.projectId ?? null} projectName={saved.project || undefined}
              onMade={() => { api.meetings.get(saved.id).then((r) => applyServer(r)).catch(() => { }); }} />
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
      {reviewing && editable && (
        <ReviewPanel item={item} draft={draft} set={set} auto={auto} ctx={ctx} rfis={rfis} cos={cos} onClose={() => setReviewing(false)} />
      )}
    </div>,
    document.body,
  );
}

/** What came out of the meeting: special actions first, then what's on record. */
function Captured({ item, draft, rfis, cos, navigate, compact }: { item: Item; draft: Meeting; rfis: any[]; cos: any[]; navigate: (to: string) => void; compact?: boolean }) {
  const linkedRfis = (draft.rfiIds || []).map((id) => rfis.find((r) => r.id === id) || { id, number: id, subject: 'RFI', status: '' });
  const linkedCos = (draft.changeOrderIds || []).map((id) => cos.find((c) => c.id === id) || { id, number: '', title: 'Change order', status: '' });
  const acts = item.actions.filter((t) => !isForRecord(t));
  const recs = item.actions.filter(isForRecord);
  const taskRow = (t: Task) => (
    <button type="button" key={t.id} className="mt-action" onClick={() => navigate(isForRecord(t) ? `/observations?item=${encodeURIComponent(t.id)}` : `/tasks?task=${encodeURIComponent(t.id)}&type=log`)}>
      <AkPill tone={RECORD_TONE[t.topicType] || 'soft'}>{t.topicType}</AkPill>
      <span className="mt-action-text"><b>{logTaskTitle(t)}</b><small>{[t.assignedTo && 'to ' + t.assignedTo, t.dueDate && 'due ' + akDay(t.dueDate), (t.linkedTaskIds?.length || 0) + (t.changeOrderIds?.length || 0) ? 'linked' : ''].filter(Boolean).join(' · ') || (isForRecord(t) ? 'on record' : 'unassigned')}</small></span>
      <AkPill tone={isLogClosed(t.status) ? 'soft' : 'green'}>{t.status}</AkPill>
    </button>
  );
  const nActs = acts.length + linkedRfis.length + linkedCos.length;
  return (
    <>
      <h3 className="mt-h">Special actions <small>{nActs}</small></h3>
      <div className="mt-actions">
        {!nActs && <span className="mt-muted">No tasks, RFIs or change orders raised yet.</span>}
        {acts.map(taskRow)}
        {linkedRfis.map((r: any) => (
          <button type="button" key={r.id} className="mt-action" onClick={() => navigate(`/rfis?rfi=${encodeURIComponent(r.id)}`)}>
            <AkPill tone="soft">RFI</AkPill>
            <span className="mt-action-text"><b>{r.number ? `${r.number} · ` : ''}{r.subject}</b><small>{r.ownerName ? 'with ' + r.ownerName : 'RFI log'}</small></span>
            {r.status && <AkPill tone={['closed', 'void'].includes(r.status) ? 'soft' : 'green'}>{r.status}</AkPill>}
          </button>
        ))}
        {linkedCos.map((c: any) => (
          <button type="button" key={c.id} className="mt-action" onClick={() => navigate(`/changeorders?co=${encodeURIComponent(c.id)}`)}>
            <AkPill tone="soft">Change order</AkPill>
            <span className="mt-action-text"><b>{c.number ? `${c.number} · ` : ''}{c.title}</b><small>Change orders</small></span>
            {c.status && <AkPill tone={['approved', 'rejected', 'cancelled'].includes(c.status) ? 'soft' : 'green'}>{CO_LABEL[c.status] || c.status}</AkPill>}
          </button>
        ))}
      </div>
      <h3 className="mt-h">FOR RECORD <small>{recs.length}</small></h3>
      <div className="mt-actions">
        {!recs.length && <span className="mt-muted">{compact ? 'Nothing on record yet.' : 'No observations, FYIs or decisions recorded yet.'}</span>}
        {recs.map(taskRow)}
      </div>
    </>
  );
}

type Kind = 'Task' | 'RFI' | 'CO' | 'Observation' | 'FYI' | 'Decision';
const KIND_TEXT: Record<Kind, { ph: string; btn: string }> = {
  Task: { ph: 'What needs doing', btn: 'Add task' },
  RFI: { ph: 'The question for the RFI', btn: 'Draft RFI' },
  CO: { ph: 'The change — becomes a change-order draft', btn: 'Draft change order' },
  Observation: { ph: 'What was observed', btn: 'Record observation' },
  FYI: { ph: 'What people need to know', btn: 'Record FYI' },
  Decision: { ph: 'What was decided', btn: 'Record decision' },
};

/** Raise a special action or a FOR RECORD item from the meeting. `seed` fills it from a passage of the notes / transcript. */
function ActionForm({ ctx, seed }: { ctx: Ctx; seed?: { text: string; n: number } }) {
  const { users, toast } = useApp();
  const { draft } = ctx;
  const [kind, setKind] = useState<Kind>('Task');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  // A passage picked in the review: a short one is the subject; a long one goes in the details with its first line as the subject.
  useEffect(() => {
    if (!seed?.text) return;
    const text = seed.text.trim();
    const first = text.split(/\r?\n/)[0].trim();
    if (text.length <= 160 && first === text) { setSubject(text); setDetails(''); } else { setSubject(first.slice(0, 160)); setDetails(text); }
  }, [seed?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const source = `Raised in “${draft.title}” on ${akDay(draft.date)}.`;
  const add = async () => {
    if (!subject.trim()) { toast('⚠ Say what it is'); return; }
    setAdding(true);
    try {
      if (kind === 'RFI' || kind === 'CO') {
        if (!draft.projectId) { toast(`⚠ Pick the meeting’s project first — ${kind === 'RFI' ? 'an RFI' : 'a change order'} belongs to a project`); return; }
        // Through the shared conversion: the meeting lists it, and both record where it came from.
        const made = await api.specialActions.convert({
          from: { kind: 'meeting', id: draft.id }, to: kind === 'RFI' ? 'rfi' : 'co', projectId: draft.projectId,
          title: subject.trim().slice(0, 300), body: [kind === 'RFI' ? subject.trim() : '', details.trim(), source].filter(Boolean).join('\n\n'),
        });
        if (kind === 'RFI') api.rfis.get(made.id).then(ctx.onRfi).catch(() => { });
        else api.finance.changeOrder(made.id).then(ctx.onCo).catch(() => { });
        ctx.applyServer(await api.meetings.get(draft.id));
        toast(`${made.label} drafted`);
      } else {
        const u = users.find((x) => x.id === assignee);
        const t = await api.meetings.addAction(draft.id, { topicType: kind, subject: subject.trim().slice(0, 300), description: details.trim() || undefined, assignedTo: u?.name, assignedToId: u?.id, dueDate: due || undefined, tags: tags.length ? tags : undefined });
        ctx.onAction(t);
        // A new open task takes a complete meeting back to reviewed.
        api.meetings.get(draft.id).then(ctx.applyServer).catch(() => { });
        toast(`${kind} added${u ? ' — ' + u.name + ' is emailed' : ''}`);
      }
      setSubject(''); setDetails(''); setDue(''); setTags([]);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not added')); }
    finally { setAdding(false); }
  };
  const assignable = kind === 'Task' || kind === 'Observation' || kind === 'FYI' || kind === 'Decision';

  return (
    <div className="mt-add">
      <AkSeg<Kind> value={kind} onChange={setKind} options={[['Task', 'Task'], ['RFI', 'RFI'], ['CO', 'Change order'], ['Observation', 'Observation'], ['FYI', 'FYI'], ['Decision', 'Decision']]} />
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={KIND_TEXT[kind].ph} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
      {details && <textarea className="mt-text" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} aria-label="Details" />}
      {assignable && (
        <div className="mt-row">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{kind === 'Task' ? 'Assign to…' : 'Share with / owner…'}</option>
            {users.filter((u) => u.status !== 'suspended').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {kind === 'Task' && <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />}
        </div>
      )}
      {assignable && <TagPicker compact tags={tags} onChange={setTags} />}
      <button type="button" className="ak-btn is-dark" disabled={adding} onClick={() => void add()}>{adding ? 'Adding…' : KIND_TEXT[kind].btn}</button>
    </div>
  );
}

// ------------------------------------------------------------------ review

/**
 * Review a meeting: read the notes and transcript on the left, raise what came
 * out of it on the right -- select a passage and "Use selection" to start from
 * it. "Mark reviewed" when done. Nothing is sent to any outside service.
 */
function ReviewPanel({ item, draft, set, auto, ctx, rfis, cos, onClose }: {
  item: Item; draft: Meeting; set: (p: Partial<Meeting>) => void; auto: Autosave; ctx: Ctx; rfis: any[]; cos: any[]; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [src, setSrc] = useState<'minutes' | 'transcript'>(draft.transcript?.trim() ? 'transcript' : 'minutes');
  const [sel, setSel] = useState('');
  const [seed, setSeed] = useState<{ text: string; n: number }>({ text: '', n: 0 });
  const [importing, setImporting] = useState(false);
  const st = meetingStatus(draft.status);
  const pickSel = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setSel(el.value.slice(el.selectionStart, el.selectionEnd).trim());
  };
  const text = src === 'minutes' ? draft.minutes || '' : draft.transcript || '';

  return (
    <div className="mt-bg is-review" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <aside className="mt-panel mt-review" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Review ${draft.title}`}>
        <div className="mt-head">
          <h2>Review · {draft.title}</h2>
          <span className="mt-save"><SaveBar auto={auto} compact /></span>
          <button type="button" className="mt-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="mt-muted" style={{ margin: 0 }}>
          {akDay(draft.date)}{draft.project ? ` · ${draft.project}` : ''}{locationTypeInfo(draft.locationType) ? ` · ${locationTypeInfo(draft.locationType)!.label}` : ''}.
          {' '}Read through and raise each task, RFI, change order, observation, FYI and decision. Select a passage, then “Use selection”.
        </p>
        <div className="mt-review-grid">
          <section className="mt-review-src">
            <div className="mt-row" style={{ alignItems: 'center' }}>
              <AkSeg value={src} onChange={(v) => { setSrc(v); setSel(''); }} options={[['minutes', 'Notes / minutes'], ['transcript', 'Transcript']]} />
              {linkOk(draft.recordingUrl) && <a className="ak-btn" href={draft.recordingUrl!.trim()} target="_blank" rel="noreferrer">Recording ↗</a>}
              {linkOk(draft.transcriptUrl) && <a className="ak-btn" href={draft.transcriptUrl!.trim()} target="_blank" rel="noreferrer">Transcript ↗</a>}
            </div>
            <textarea className="mt-text mt-review-text" value={text} onChange={(e) => set(src === 'minutes' ? { minutes: e.target.value } : { transcript: e.target.value })}
              onSelect={pickSel} onMouseUp={pickSel} onKeyUp={pickSel}
              placeholder={src === 'minutes' ? 'Type the notes taken in the meeting…' : 'Paste the transcript here (or open it from its link)…'} />
            <div className="mt-row" style={{ alignItems: 'center' }}>
              <span className="mt-muted">{sel ? `${sel.length} characters selected` : 'Select a passage to raise it as an item.'}</span>
              <button type="button" className="ak-btn is-dark" disabled={!sel} onClick={() => setSeed((s) => ({ text: sel, n: s.n + 1 }))}>Use selection →</button>
            </div>
            {src === 'minutes' && (
              <div className="mt-row" style={{ alignItems: 'center' }}>
                <span className="mt-muted">Pasted Google Meet notes? Each summary bullet becomes a FOR RECORD item and each next step a task — you check them first.</span>
                <button type="button" className="ak-btn" disabled={!text.trim()} onClick={() => setImporting(true)}>Turn notes into items</button>
              </div>
            )}
          </section>
          <section className="mt-review-out">
            <ActionForm ctx={ctx} seed={seed} />
            <Captured item={item} draft={draft} rfis={rfis} cos={cos} navigate={navigate} compact />
          </section>
        </div>
        <div className="mt-foot">
          <span>{st === 'reviewed' || st === 'complete' ? `Marked ${meetingStatusInfo(st).label.toLowerCase()}${draft.reviewedBy ? ' by ' + draft.reviewedBy : ''}.` : 'When everything is pulled out, mark the meeting reviewed.'}</span>
          <button type="button" className="ak-btn" onClick={onClose}>Close</button>
          {st !== 'reviewed' && st !== 'complete' && <button type="button" className="ak-btn is-dark" onClick={() => { set({ status: 'reviewed' }); onClose(); }}>Mark reviewed</button>}
        </div>
        {importing && (
          <MeetingNotesImport meeting={{ id: draft.id, title: draft.title, date: draft.date }} text={text} onClose={() => setImporting(false)}
            onAdded={(made) => { made.forEach((t) => ctx.onAction(t)); api.meetings.get(draft.id).then(ctx.applyServer).catch(() => { }); }} />
        )}
      </aside>
    </div>
  );
}
