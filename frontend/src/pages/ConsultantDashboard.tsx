import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { api } from '../api';
import { MyTasks } from '../components/MyTasks';
import type { Project } from '../data/projects';
import type { Person } from '../data/people';
import type { ProjectTask } from '../data/projectTasks';
import './Dashboard.css';

const BG = "'Bricolage Grotesque', serif";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 16, flex: '1 1 150px', minWidth: 140 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>{label}</div>
      <div style={{ fontFamily: BG, fontWeight: 800, fontSize: 26, color: accent || '#173326', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function ConsultantDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [boardTasks, setBoardTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.projects.list(), api.people.list(), api.projectTasks.list()])
      .then(([p, pp, t]) => {
        if (Array.isArray(p)) setAllProjects(p as Project[]);
        if (Array.isArray(pp)) setPeople(pp as Person[]);
        if (Array.isArray(t)) setBoardTasks(t as ProjectTask[]);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  // Same directory link the client dashboard uses: the People record ties
  // this login to the scopes they're actually on, since a consultant's own
  // account carries no project list of its own.
  const me = useMemo(
    () => people.find((p) => p.tier === 'Consultant' && p.email.toLowerCase() === (currentUser?.email || '').toLowerCase()),
    [people, currentUser],
  );
  const assigned = useMemo(
    () => (me ? allProjects.filter((p) => me.projects.includes(p.name)) : []),
    [allProjects, me],
  );
  const projectsById = useMemo(() => Object.fromEntries(assigned.map((p) => [p.id, p.name])), [assigned]);

  const queue = useMemo(() => {
    const id = currentUser?.id;
    const name = currentUser?.name;
    const isMine = (assigneeId?: string, assignee?: string) =>
      assigneeId ? assigneeId === id : !!name && !!assignee && assignee.trim().toLowerCase() === name.trim().toLowerCase();
    return boardTasks
      .filter((t) => !t.parentId && !t.completed && t.status !== 'Done' && projectsById[t.projectId] && isMine(t.assigneeId, t.assignee))
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [boardTasks, projectsById, currentUser]);

  return (
    <div className="dashboard-page dashboard-role-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      <section className="dashboard-intro">
        <div>
          <div className="dashboard-eyebrow">Your work queue</div>
          <h2>Your next commitments.</h2>
          <p>A short list of the scopes and decisions closest to you.</p>
        </div>
        <button className="dashboard-primary-action" onClick={() => navigate('/prequal')}>
          Review scopes
        </button>
      </section>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' }}>
        <Stat label="Assigned Scopes" value={String(assigned.length)} />
        <Stat label="Open Items" value={String(queue.length)} accent="#D2822E" />
      </div>

      <MyTasks />

      {!loading && !me && (
        <div style={{ padding: '16px 18px', borderRadius: 14, background: '#FBF8F2', border: '1px solid rgba(20,8,31,0.06)', fontSize: 12.5, color: '#7E9B93', marginBottom: 14 }}>
          No scopes are linked to your account yet. Ask your project manager to add {currentUser?.email || 'your email'} to the People directory as a consultant on your project(s).
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 12 }}>My Queue</div>
        {queue.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#9AA39D', fontStyle: 'italic' }}>Nothing open on your assigned scopes right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queue.slice(0, 8).map((t) => (
              <div key={t.id} onClick={() => navigate('/prequal')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#FBF8F2', borderRadius: 10, flexWrap: 'wrap', cursor: 'pointer' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#7E9B93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectsById[t.projectId]}</div>
                </div>
                {t.dueDate && <span style={{ fontSize: 11, color: '#7E9B93' }}>Due {t.dueDate}</span>}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#EFEDE8', color: '#3A423E' }}>{t.status || 'Open'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="dashboard-secondary-action" onClick={() => navigate('/prequal')}>View prequalification and scopes</button>
    </div>
  );
}
