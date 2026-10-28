import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { PRIORITY_STYLE, type Priority } from '../data/projectTasks';

const BG = 'var(--font-display)';

interface Row {
  key: string;
  title: string;
  context: string;
  dueDate?: string;
  priority?: Priority;
  where: 'board' | 'log';
  to?: string;
}

/** Everything currently assigned to the acting user, from both task systems. */
export function MyTasks() {
  const navigate = useNavigate();
  // The server picks out my open tasks and sends the first few, not every task.
  const [data, setData] = useState<{ total: number; rows: Row[] }>({ total: 0, rows: [] });
  useEffect(() => {
    api.dashboard.myTasks(8).then((r) => setData({ total: r?.total ?? 0, rows: Array.isArray(r?.rows) ? (r.rows as Row[]) : [] })).catch(() => { });
  }, []);
  const mine = data.rows;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>My Tasks <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>({data.total})</span></div>
        <span onClick={() => navigate('/tasks')} style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>All tasks →</span>
      </div>
      {mine.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--c-9aa39d)', fontStyle: 'italic' }}>No tasks assigned to you.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mine.slice(0, 8).map((t) => {
            const ps = t.priority ? PRIORITY_STYLE[t.priority] : null;
            return (
              <div key={t.key} onClick={() => navigate(t.to || (t.where === 'board' ? '/projects' : '/tasks'))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--panel)', borderRadius: 10, cursor: 'pointer', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.context}</div>
                </div>
                {t.dueDate && <span style={{ fontSize: 11, color: 'var(--muted)' }}>📅 {t.dueDate}</span>}
                {ps && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ps.bg, color: ps.c }}>{t.priority}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
