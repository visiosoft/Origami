import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats, akToday } from '../components/ActionKit';

interface LogRow {
  id: string; projectId: number; date: string; supervisorName?: string; notes?: string; status: string;
  submittedAt?: string; approvedByName?: string; rejectionNote?: string; crewCount?: number; totalHours?: number;
}
type Status = 'all' | 'submitted' | 'approved' | 'rejected' | 'draft';
const STATUS: Record<string, [string, 'yellow' | 'green' | 'warn' | 'soft']> = {
  submitted: ['Waiting for approval', 'yellow'], approved: ['Approved', 'green'], rejected: ['Sent back', 'warn'], draft: ['Draft', 'soft'],
};
const TASK = { start: 'Start', continued: 'Continued', completing: 'Done' } as Record<string, string>;

/**
 * Construction -> Daily Reports: every site's daily log, newest first -- who ran
 * the site, crew, hours and notes. A row opens the day: each worker's hours,
 * cost code and what they worked on. Approving stays in Manpower -> Approvals.
 */
export function DailyReports() {
  const navigate = useNavigate();
  const { can } = useApp();
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [projects, setProjects] = useState<Record<number, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [project, setProject] = useState<number | ''>('');
  const [status, setStatus] = useState<Status>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, any[]>>({});

  useEffect(() => {
    api.dailyLogs.list().then((r: any) => setLogs(Array.isArray(r) ? r : [])).catch(() => setLogs([]));
    api.projects.list().then((r: any) => setProjects(Object.fromEntries((Array.isArray(r) ? r : []).map((p: any) => [p.id, p.name])))).catch(() => { });
    api.employees.list().then((r: any) => setNames(Object.fromEntries((Array.isArray(r) ? r : []).map((e: any) => [e.id, e.name])))).catch(() => { });
    api.csiCodes.list().then((r: any) => setCodes(Object.fromEntries((Array.isArray(r) ? r : []).map((c: any) => [c.id, `${c.code} — ${c.division}`])))).catch(() => { });
  }, []);

  const toggle = (l: LogRow) => {
    if (openId === l.id) { setOpenId(null); return; }
    setOpenId(l.id);
    if (!days[l.id]) api.dailyLogs.day(l.projectId, l.date).then((r: any) => setDays((d) => ({ ...d, [l.id]: r?.entries || [] }))).catch(() => setDays((d) => ({ ...d, [l.id]: [] })));
  };

  const all = (logs || []).filter((l) => l.status !== 'draft' || (l.crewCount || 0) > 0);
  const inProject = project ? all.filter((l) => l.projectId === project) : all;
  const shown = inProject.filter((l) => status === 'all' || l.status === status);
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const thisWeek = inProject.filter((l) => l.date >= weekStart && l.date <= akToday() && l.status !== 'draft');
  const waiting = inProject.filter((l) => l.status === 'submitted');
  const sentBack = inProject.filter((l) => l.status === 'rejected');
  const projectIds = useMemo(() => [...new Set(all.map((l) => l.projectId))], [all]);
  const nameOf = (id: number) => projects[id] || `Project ${id}`;
  const canApprove = can('manpower_con', 'manage');

  return (
    <AkPage
      lead="Each site’s day — crew, hours, cost codes, what got done and the superintendent’s notes. Superintendents fill these in on Daily Log (field)."
      action={canApprove && waiting.length ? <button type="button" className="ak-btn is-dark" onClick={() => navigate('/manpower_con?tab=approvals')}>Approve {waiting.length} in Manpower</button> : undefined}
    >
      <AkStats items={[
        { key: 'wk', label: 'Reports this week', value: logs ? thisWeek.length : '—', sub: `${Math.round(thisWeek.reduce((a, l) => a + (l.totalHours || 0), 0))} h on site` },
        { key: 'crew', label: 'People on site this week', value: logs ? thisWeek.reduce((a, l) => a + (l.crewCount || 0), 0) : '—', sub: 'worker-days' },
        { key: 'wait', label: 'Waiting for approval', value: logs ? waiting.length : '—', sub: 'submitted, not approved', tone: waiting.length ? 'yellow' : undefined, onClick: () => setStatus('submitted'), on: status === 'submitted' },
        { key: 'back', label: 'Sent back', value: logs ? sentBack.length : '—', sub: 'to fix and resubmit', onClick: () => setStatus('rejected'), on: status === 'rejected' },
      ]} />

      <div className="ak-tools">
        <AkSeg<Status> value={status} onChange={setStatus} options={[['all', 'All'], ['submitted', 'Waiting', waiting.length], ['approved', 'Approved'], ['rejected', 'Sent back'], ['draft', 'Drafts']]} />
        <select className="ak-select" value={project} onChange={(e) => setProject(e.target.value ? Number(e.target.value) : '')}>
          <option value="">All projects</option>
          {projectIds.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
        </select>
      </div>

      <section className="ak-card">
        {logs === null && <div className="ak-empty">Loading…</div>}
        {logs && !shown.length && <div className="ak-empty">{all.length ? 'No reports match these filters.' : 'No daily reports yet. They appear here once a superintendent fills in Daily Log (field).'}</div>}
        {shown.map((l, i) => {
          const st = STATUS[l.status] || STATUS.draft;
          const open = openId === l.id;
          const entries = days[l.id];
          return (
            <Fragment key={l.id}>
              <AkRow index={i} onClick={() => toggle(l)}
                lead={<AkDate iso={l.date} />}
                title={nameOf(l.projectId)}
                sub={[l.supervisorName && 'by ' + l.supervisorName, `${l.crewCount || 0} ${(l.crewCount || 0) === 1 ? 'worker' : 'workers'}`, `${l.totalHours || 0} h`, (l.notes || '').split('\n')[0]].filter(Boolean).join(' · ')}
                right={<><AkPill tone={st[1]}>{st[0]}</AkPill><span aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s', color: 'var(--muted)' }}>⌄</span></>}
              />
              {open && (
                <div className="ak-detail">
                  {!entries ? 'Loading…' : !entries.length ? 'No one was logged on this day.' : (
                    <table>
                      <thead><tr><th>Worker</th><th>Hours</th><th>Cost code</th><th>Task</th><th>Team</th><th>Work done</th></tr></thead>
                      <tbody>
                        {entries.map((e: any) => (
                          <tr key={e.id || e.employeeId}>
                            <td>{names[e.employeeId] || e.employeeId}</td><td>{e.hours ?? '—'}</td><td>{codes[e.csiCodeId] || '—'}</td>
                            <td>{TASK[e.taskStatus] || '—'}</td><td>{e.team || '—'}</td><td>{e.taskDetail || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {l.notes && <div className="ak-notes"><b>Site notes</b><br />{l.notes}</div>}
                  {l.status === 'rejected' && l.rejectionNote && <div className="ak-notes" style={{ color: '#9A4318' }}><b>Sent back:</b> {l.rejectionNote}</div>}
                  {l.status === 'approved' && l.approvedByName && <div className="ak-notes">Approved by {l.approvedByName} — timesheets created.</div>}
                </div>
              )}
            </Fragment>
          );
        })}
      </section>
    </AkPage>
  );
}
