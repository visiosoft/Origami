import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Icon } from '../icons';
import { isMine } from './TaskScope';
import { relativeTime } from './ActivityFeed';
import type { ProjectTask } from '../data/projectTasks';
import type { Task } from '../data/tasks';

/** Ids already shown to this person, so the dot means "new since you looked". */
const SEEN_KEY = 'origami.seenAssignments';

interface Row {
  id: string;
  title: string;
  context: string;
  at?: string;
  to: string;
}

const readSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
};

/**
 * The topbar bell: work that has been assigned to you.
 *
 * Anything assigned since you last opened the panel counts as new and lights
 * the dot; opening the panel marks everything currently listed as seen.
 */
export function Notifications() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [boardTasks, setBoardTasks] = useState<ProjectTask[]>([]);
  const [logTasks, setLogTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Record<number, string>>({});
  const [seen, setSeen] = useState<string[]>(readSeen);
  const box = useRef<HTMLDivElement | null>(null);

  const load = () => {
    api.projectTasks.list().then((r: any) => { if (Array.isArray(r)) setBoardTasks(r); }).catch(() => { });
    api.tasks.list().then((r: any) => { if (Array.isArray(r)) setLogTasks(r); }).catch(() => { });
    api.projects.list().then((r: any) => {
      if (Array.isArray(r)) setProjects(Object.fromEntries(r.map((p: any) => [p.id, p.name])));
    }).catch(() => { });
  };

  // Poll gently so an assignment made elsewhere turns up without a reload.
  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    if (!currentUser) return [];
    const out: Row[] = [
      ...boardTasks
        .filter((t) => !t.parentId && !t.completed && t.status !== 'Done' && isMine(t, currentUser))
        .map((t) => ({
          id: 'b' + t.id,
          title: t.title,
          context: projects[Number(t.projectId)] || `Project ${t.projectId}`,
          at: t.updatedAt || t.createdAt,
          to: '/tasks',
        })),
      ...logTasks
        .filter((t) => t.status !== 'Closed' && isMine(t, currentUser))
        .map((t) => ({
          id: 'l' + t.id,
          title: t.description?.length > 70 ? t.description.slice(0, 70) + '…' : t.description || t.id,
          context: t.project || 'Request Log',
          at: t.updatedAt,
          to: '/tasks',
        })),
    ];
    return out.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))).slice(0, 12);
  }, [boardTasks, logTasks, projects, currentUser]);

  const unseen = rows.filter((r) => !seen.includes(r.id));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows.length) {
      // Opening the panel is the acknowledgement.
      const ids = rows.map((r) => r.id);
      setSeen(ids);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
    }
  };

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <div className="topbar-bell" title="Assigned to you" onClick={toggle} style={{ cursor: 'pointer' }}>
        <Icon name="bell" size={18} stroke="#43514D" strokeWidth={2} />
        {unseen.length > 0 && <span className="topbar-bell-dot" />}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 320, maxWidth: '90vw', zIndex: 200,
          background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.08)',
          boxShadow: '0 18px 44px rgba(11,26,18,0.16)', overflow: 'hidden',
        }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93' }}>Assigned to you</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#7E9B93' }}>{rows.length}</span>
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {rows.length === 0 && (
              <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 12, color: '#9AA39D' }}>
                Nothing is assigned to you right now.
              </div>
            )}
            {rows.map((r, i) => (
              <div
                key={r.id}
                onClick={() => { setOpen(false); navigate(r.to); }}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderTop: i ? '1px solid rgba(20,8,31,0.04)' : 'none',
                  background: unseen.some((u) => u.id === r.id) ? '#F4F9F4' : 'white',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0B1A12', lineHeight: 1.4 }}>{r.title}</div>
                <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 3 }}>
                  {r.context}{r.at ? ` · ${relativeTime(r.at)}` : ''}
                </div>
              </div>
            ))}
          </div>

          <div onClick={() => { setOpen(false); navigate('/tasks'); }}
               style={{ padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,0.06)', fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer', textAlign: 'center' }}>
            Open Tasks
          </div>
        </div>
      )}
    </div>
  );
}
