import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { isLogClosed } from '../data/logStatuses';
import { logTaskTitle, type Task } from '../data/tasks';
import { NewTaskDrawer } from '../components/NewTaskDrawer';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats } from '../components/ActionKit';

type Kind = 'all' | 'Observation' | 'FYI';
const KINDS = ['Observation', 'FYI'];

/** When an entry was raised: its "created" history event, else the date in its id (YYYYMMDD-nn). */
export const raisedOn = (t: Task) => {
  const created = t.activity?.find((a: any) => a.type === 'created')?.at;
  if (created) return String(created).slice(0, 10);
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(t.id || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : t.updatedAt?.slice(0, 10);
};

/**
 * Special Actions -> Observations & FYI: the Request Log entries raised as an
 * observation or an FYI (from a meeting or on site). Same records as Tasks --
 * opening one opens it there; "+ Observation" / "+ FYI" create one.
 */
export function Observations() {
  const navigate = useNavigate();
  const { can } = useApp();
  const [rows, setRows] = useState<Task[] | null>(null);
  const [kind, setKind] = useState<Kind>('all');
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');
  const [project, setProject] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState<string | null>(null);
  const load = () => api.tasks.list().then((r: any) => setRows((Array.isArray(r) ? r : []).filter((t: Task) => KINDS.includes(t.topicType)))).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const all = rows || [];
  const projects = useMemo(() => [...new Set(all.map((t) => t.project).filter(Boolean))].sort(), [all]);
  const needle = q.trim().toLowerCase();
  const inScope = all.filter((t) => (!project || t.project === project) && (kind === 'all' || t.topicType === kind));
  const shown = inScope
    .filter((t) => (state === 'all' || (state === 'open' ? !isLogClosed(t.status) : isLogClosed(t.status)))
      && (!needle || [t.subject, t.description, t.project, t.assignedTo, t.originator].filter(Boolean).join(' ').toLowerCase().includes(needle)))
    .sort((a, b) => String(raisedOn(b) || '').localeCompare(String(raisedOn(a) || '')));
  const open = all.filter((t) => !isLogClosed(t.status));
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const canAdd = can('tasks', 'manage') || can('observations', 'manage');

  return (
    <AkPage
      lead="Observations from site and FYIs to share — raised on their own or from a meeting. They live in the Request Log with your tasks."
      action={canAdd ? (
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <button type="button" className="ak-btn" onClick={() => setCreating('FYI')}>+ FYI</button>
          <button type="button" className="ak-btn is-dark" onClick={() => setCreating('Observation')}>+ Observation</button>
        </span>
      ) : undefined}
    >
      <AkStats items={[
        { key: 'open', label: 'Open', value: rows ? open.length : '—', sub: 'not closed yet', tone: open.length ? 'yellow' : undefined, onClick: () => setState('open'), on: state === 'open' },
        { key: 'obs', label: 'Observations', value: rows ? all.filter((t) => t.topicType === 'Observation').length : '—', sub: 'all time', onClick: () => setKind('Observation'), on: kind === 'Observation' },
        { key: 'fyi', label: 'FYIs', value: rows ? all.filter((t) => t.topicType === 'FYI').length : '—', sub: 'all time', onClick: () => setKind('FYI'), on: kind === 'FYI' },
        { key: 'week', label: 'Raised this week', value: rows ? all.filter((t) => (raisedOn(t) || '') >= weekAgo).length : '—', sub: 'last 7 days' },
      ]} />

      <div className="ak-tools">
        <AkSeg<Kind> value={kind} onChange={setKind} options={[['all', 'All', all.length], ['Observation', 'Observations'], ['FYI', 'FYI']]} />
        <AkSeg value={state} onChange={setState} options={[['open', 'Open'], ['closed', 'Closed'], ['all', 'All']]} />
        <select className="ak-select" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className="ak-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
      </div>

      <section className="ak-card">
        {rows === null && <div className="ak-empty">Loading…</div>}
        {rows && !shown.length && (
          <div className="ak-empty">
            {all.length ? 'Nothing matches these filters.' : 'No observations or FYIs yet.'}
            {canAdd && !all.length && <> <button type="button" className="ak-link" onClick={() => setCreating('Observation')}>Record the first one</button></>}
          </div>
        )}
        {shown.map((t, i) => (
          <AkRow key={t.id} index={i} muted={isLogClosed(t.status)} onClick={() => navigate(`/tasks?task=${encodeURIComponent(t.id)}&type=log`)}
            lead={<AkDate iso={raisedOn(t)} />}
            title={logTaskTitle(t)}
            sub={[t.project || 'No project', t.originator && 'from ' + t.originator, t.assignedTo && 'to ' + t.assignedTo, t.meetingType && t.meetingType !== 'Internal' ? t.meetingType + ' meeting' : ''].filter(Boolean).join(' · ')}
            right={<>
              <AkPill tone={t.topicType === 'Observation' ? 'outline' : 'yellow'}>{t.topicType}</AkPill>
              <AkPill tone={isLogClosed(t.status) ? 'soft' : 'dark'}>{t.status}</AkPill>
            </>}
          />
        ))}
      </section>

      {creating && <NewTaskDrawer defaultTopic={creating} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); load(); }} />}
    </AkPage>
  );
}
