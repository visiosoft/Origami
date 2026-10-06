import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { isLogClosed } from '../data/logStatuses';
import { logTaskTitle, type Task } from '../data/tasks';
import { raisedOn } from './Observations';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats, akDay, akToday } from '../components/ActionKit';

export type Phase = 'design' | 'construction';
type Kind = 'all' | 'meeting' | 'rfi' | 'task' | 'obs' | 'co';
interface Item { key: string; kind: Exclude<Kind, 'all'>; projectId?: number; project: string; date?: string; title: string; sub: string; status: string; open: boolean; overdue: boolean; to: string }

/** Which project stages belong to each phase. CRM (Kickoff) projects are in design and preconstruction. */
const PHASE_STAGES: Record<Phase, string[]> = { design: ['Kickoff', 'Design'], construction: ['Construction'] };
const PHASE_TEXT: Record<Phase, string> = {
  design: 'Meetings, RFIs, tasks, observations and FYIs, and change orders on projects in CRM and design.',
  construction: 'Meetings, RFIs, tasks, observations and FYIs, and change orders on projects under construction.',
};
const KIND_LABEL: Record<Item['kind'], string> = { meeting: 'Meeting', rfi: 'RFI', task: 'Task', obs: 'Observation / FYI', co: 'Change order' };
const RFI_LABEL: Record<string, string> = { draft: 'Draft', open: 'Open', answered: 'Answered', closed: 'Closed', void: 'Void' };
const CO_LABEL: Record<string, string> = { draft: 'Pending', internal_review: 'Internal review', submitted: 'With client', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
const norm = (s?: string) => (s || '').trim().toLowerCase();

/**
 * Special Actions for one phase (Design & Preconstruction, or Construction):
 * every RFI, task, observation / FYI and change order on that phase's projects
 * in one list, open ones first. Each row opens the real record.
 */
export function SpecialActions({ phase }: { phase: Phase }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<{ id: number; name: string }[] | null>(null);
  const [rfis, setRfis] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cos, setCos] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [kind, setKind] = useState<Kind>('all');
  const [openOnly, setOpenOnly] = useState(true);
  const [project, setProject] = useState<number | ''>('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const done = () => setLoaded((n) => n + 1);
    api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).filter((p: any) => PHASE_STAGES[phase].includes(p.stage)).map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => setProjects([]));
    // Each list is optional: a role without RFIs or finance still sees the rest.
    api.rfis.list().then((r) => setRfis(Array.isArray(r) ? r : [])).catch(() => setRfis([])).finally(done);
    api.tasks.list().then((r: any) => setTasks(Array.isArray(r) ? r : [])).catch(() => setTasks([])).finally(done);
    api.finance.allChangeOrders().then((r: any) => setCos(Array.isArray(r) ? r : [])).catch(() => setCos([])).finally(done);
    api.meetings.list().then((r) => setMeetings(Array.isArray(r) ? r : [])).catch(() => setMeetings([])).finally(done);
  }, [phase]);

  const today = akToday();
  const items = useMemo<Item[]>(() => {
    if (!projects) return [];
    const ids = new Set(projects.map((p) => p.id));
    const byName = new Map(projects.map((p) => [norm(p.name), p]));
    const nameOf = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
    const out: Item[] = [];
    for (const m of meetings) {
      const p = (m.projectId != null && projects.find((x) => x.id === Number(m.projectId))) || byName.get(norm(m.project));
      if (!p) continue;
      const open = m.status === 'scheduled' && m.date >= today;
      out.push({
        key: 'm' + m.id, kind: 'meeting', projectId: p.id, project: p.name, date: m.date, title: m.title,
        sub: [p.name, m.type, m.time, m.attendees?.length ? `${m.attendees.length} attending` : ''].filter(Boolean).join(' · '),
        status: m.status === 'scheduled' ? (m.date >= today ? 'Scheduled' : 'Not marked held') : m.status === 'held' ? 'Held' : 'Cancelled',
        open, overdue: false, to: `/meetings?open=${encodeURIComponent(m.id)}`,
      });
    }
    for (const r of rfis) {
      if (!ids.has(Number(r.projectId))) continue;
      const open = !['closed', 'void'].includes(r.status);
      out.push({
        key: 'r' + r.id, kind: 'rfi', projectId: Number(r.projectId), project: nameOf(Number(r.projectId)), date: (r.dateSent || r.createdAt || '').slice(0, 10),
        title: `${r.number ? r.number + ' · ' : ''}${r.subject || 'RFI'}`, sub: [nameOf(Number(r.projectId)), r.ownerName && 'with ' + r.ownerName, r.dateDue && 'due ' + akDay(r.dateDue)].filter(Boolean).join(' · '),
        status: RFI_LABEL[r.status] || r.status, open, overdue: open && !!r.dateDue && r.dateDue.slice(0, 10) < today, to: `/rfis?rfi=${encodeURIComponent(r.id)}`,
      });
    }
    for (const t of tasks) {
      const p = byName.get(norm(t.project));
      if (!p) continue;
      const isObs = t.topicType === 'FYI' || t.topicType === 'Observation';
      if (t.topicType === 'RFI') continue; // RFIs come from the RFI log
      const open = !isLogClosed(t.status);
      out.push({
        key: 't' + t.id, kind: isObs ? 'obs' : 'task', projectId: p.id, project: p.name, date: raisedOn(t),
        title: logTaskTitle(t), sub: [p.name, isObs ? t.topicType : '', t.assignedTo && 'to ' + t.assignedTo, t.dueDate && 'due ' + akDay(t.dueDate)].filter(Boolean).join(' · '),
        status: t.status, open, overdue: open && !!t.dueDate && t.dueDate < today, to: `/tasks?task=${encodeURIComponent(t.id)}&type=log`,
      });
    }
    for (const c of cos) {
      if (!ids.has(Number(c.projectId))) continue;
      const open = ['draft', 'internal_review', 'submitted'].includes(c.status);
      const amt = Number(c.total ?? c.amount);
      out.push({
        key: 'c' + c.id, kind: 'co', projectId: Number(c.projectId), project: nameOf(Number(c.projectId)), date: (c.dateRequested || c.submittedAt || '').slice(0, 10),
        title: `${c.number ? c.number + ' · ' : ''}${c.title || 'Change order'}`,
        sub: [nameOf(Number(c.projectId)), Number.isFinite(amt) && amt ? amt.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '', c.scheduleImpactDays ? `${c.scheduleImpactDays} days` : ''].filter(Boolean).join(' · '),
        status: CO_LABEL[c.status] || c.status, open, overdue: false, to: `/changeorders?co=${encodeURIComponent(c.id)}`,
      });
    }
    return out.sort((a, b) => Number(b.open) - Number(a.open) || Number(b.overdue) - Number(a.overdue) || String(b.date || '').localeCompare(String(a.date || '')));
  }, [projects, rfis, tasks, cos, meetings, today]);

  const scope = items.filter((i) => !project || i.projectId === project);
  const count = (k: Item['kind']) => scope.filter((i) => i.kind === k && i.open).length;
  const needle = q.trim().toLowerCase();
  const shown = scope.filter((i) => (kind === 'all' || i.kind === kind) && (!openOnly || i.open) && (!needle || `${i.title} ${i.sub}`.toLowerCase().includes(needle)));
  const overdue = scope.filter((i) => i.overdue).length;
  const loading = !projects || loaded < 4;

  return (
    <AkPage lead={<>{PHASE_TEXT[phase]} Open items first; click one to open it. {projects && <b style={{ color: 'var(--body)' }}>{projects.length} {projects.length === 1 ? 'project' : 'projects'} in this phase.</b>}</>}>
      <AkStats items={[
        { key: 'mtg', label: 'Meetings coming up', value: loading ? '—' : count('meeting'), onClick: () => setKind('meeting'), on: kind === 'meeting' },
        { key: 'rfi', label: 'Open RFIs', value: loading ? '—' : count('rfi'), onClick: () => setKind('rfi'), on: kind === 'rfi' },
        { key: 'task', label: 'Open tasks', value: loading ? '—' : count('task'), onClick: () => setKind('task'), on: kind === 'task' },
        { key: 'obs', label: 'Open observations & FYIs', value: loading ? '—' : count('obs'), onClick: () => setKind('obs'), on: kind === 'obs' },
        { key: 'co', label: 'Change orders in progress', value: loading ? '—' : count('co'), onClick: () => setKind('co'), on: kind === 'co' },
        { key: 'late', label: 'Overdue', value: loading ? '—' : overdue, sub: 'past their due date', tone: overdue ? 'dark' : undefined },
      ]} />

      <div className="ak-tools">
        <AkSeg<Kind> value={kind} onChange={setKind} options={[['all', 'All'], ['meeting', 'Meetings'], ['rfi', 'RFIs'], ['task', 'Tasks'], ['obs', 'Observations & FYI'], ['co', 'Change orders']]} />
        <AkSeg value={openOnly ? 'open' : 'all'} onChange={(v) => setOpenOnly(v === 'open')} options={[['open', 'Open'], ['all', 'Everything']]} />
        <select className="ak-select" value={project} onChange={(e) => setProject(e.target.value ? Number(e.target.value) : '')}>
          <option value="">All {phase === 'design' ? 'design & precon' : 'construction'} projects</option>
          {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="ak-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
      </div>

      <section className="ak-card">
        {loading && <div className="ak-empty">Loading…</div>}
        {!loading && !shown.length && <div className="ak-empty">{projects?.length ? (openOnly ? 'Nothing open here.' : 'Nothing here yet.') : 'No projects are in this phase right now.'}</div>}
        {!loading && shown.map((i, n) => (
          <AkRow key={i.key} index={n} muted={!i.open} onClick={() => navigate(i.to)}
            lead={<AkDate iso={i.date} />}
            title={i.title} sub={i.sub}
            right={<>
              <span className="ak-hide-sm"><AkPill tone="outline">{KIND_LABEL[i.kind]}</AkPill></span>
              {i.overdue ? <AkPill tone="dark">Overdue</AkPill> : <AkPill tone={i.open ? 'yellow' : 'soft'}>{i.status}</AkPill>}
            </>}
          />
        ))}
      </section>
    </AkPage>
  );
}
