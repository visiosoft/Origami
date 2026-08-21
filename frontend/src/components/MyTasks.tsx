import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { PRIORITY_STYLE, type ProjectTask, type Priority } from '../data/projectTasks';
import type { Task } from '../data/tasks';

const BG = "'Bricolage Grotesque', serif";

interface Row {
  key: string;
  title: string;
  context: string;
  dueDate?: string;
  priority?: Priority;
  where: 'board' | 'log';
}

/** Everything currently assigned to the acting user, from both task systems. */
export function MyTasks() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [boardTasks, setBoardTasks] = useState<ProjectTask[]>([]);
  const [logTasks, setLogTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Record<number, string>>({});

  useEffect(() => {
    api.projectTasks.list().then((r: any) => { if (Array.isArray(r)) setBoardTasks(r as ProjectTask[]); }).catch(() => { });
    api.tasks.list().then((r: any) => { if (Array.isArray(r)) setLogTasks(r as Task[]); }).catch(() => { });
    api.projects.list().then((r: any) => { if (Array.isArray(r)) { const m: Record<number, string> = {}; r.forEach((p: any) => { m[p.id] = p.name; }); setProjects(m); } }).catch(() => { });
  }, []);

  const mine = useMemo<Row[]>(() => {
    const id = currentUser?.id;
    const name = currentUser?.name;
    // Prefer the user id; fall back to the name for rows written before
    // assignment carried an id (or assigned to someone with no account).
    const isMine = (assigneeId?: string, assignee?: string) =>
      assigneeId ? assigneeId === id : !!name && !!assignee && assignee.trim().toLowerCase() === name.trim().toLowerCase();

    const rows: Row[] = [
      ...boardTasks
        .filter((t) => !t.parentId && !t.completed && t.status !== 'Done' && isMine(t.assigneeId, t.assignee))
        .map((t) => ({
          key: 'b' + t.id,
          title: t.title,
          context: projects[t.projectId] || `Project ${t.projectId}`,
          dueDate: t.dueDate,
          priority: t.priority,
          where: 'board' as const,
        })),
      ...logTasks
        .filter((t) => t.status !== 'Closed' && isMine(t.assignedToId, t.assignedTo))
        .map((t) => ({
          key: 'l' + t.id,
          title: t.description?.length > 80 ? t.description.slice(0, 80) + '…' : t.description || t.id,
          context: t.project || 'Request Log',
          dueDate: t.dueDate,
          where: 'log' as const,
        })),
    ];
    return rows.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [boardTasks, logTasks, projects, currentUser]);

  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, color: '#0B1A12' }}>My Tasks <span style={{ fontSize: 13, color: '#7E9B93', fontWeight: 600 }}>({mine.length})</span></div>
        <span onClick={() => navigate('/tasks')} style={{ fontSize: 12, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>All tasks →</span>
      </div>
      {mine.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#9AA39D', fontStyle: 'italic' }}>No tasks assigned to you.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mine.slice(0, 8).map((t) => {
            const ps = t.priority ? PRIORITY_STYLE[t.priority] : null;
            return (
              <div key={t.key} onClick={() => navigate(t.where === 'board' ? '/projects' : '/tasks')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FBF8F2', borderRadius: 10, cursor: 'pointer', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#7E9B93' }}>{t.context}</div>
                </div>
                {t.dueDate && <span style={{ fontSize: 11, color: '#7E9B93' }}>📅 {t.dueDate}</span>}
                {ps && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ps.bg, color: ps.c }}>{t.priority}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
