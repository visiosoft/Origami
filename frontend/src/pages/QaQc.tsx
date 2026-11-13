import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { ChecklistTemplateSettings } from './ChecklistTemplateSettings';

type Row = Awaited<ReturnType<typeof api.checklistTemplates.qaqc>>[number];

/**
 * QA/QC (Nov 13): the inspection and quality checklists on programme tasks,
 * across the projects you can see -- progress per task and a link to it -- and
 * the QA/QC checklist templates that put them there.
 */
export function QaQc() {
  const { can } = useApp();
  const navigate = useNavigate();
  const manage = can('quality', 'manage');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [project, setProject] = useState<number | 0>(0);
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [tab, setTab] = useState<'list' | 'templates'>('list');
  useEffect(() => { (api.projects.list() as Promise<any[]>).then((p) => setProjects((Array.isArray(p) ? p : []).map((x) => ({ id: Number(x.id), name: String(x.name) })))).catch(() => undefined); }, []);
  useEffect(() => { setRows(null); api.checklistTemplates.qaqc(project || undefined).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [project]);
  const name = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
  const shown = useMemo(() => (rows || []).filter((r) => show === 'all' || (r.done < r.total && !r.completed)), [rows, show]);
  const pill = (on: boolean) => ({ padding: '7px 14px', borderRadius: 999, border: 0, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: on ? 'var(--forest)' : 'var(--mist)', color: on ? '#fff' : 'var(--forest)' }) as const;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {manage && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={pill(tab === 'list')} onClick={() => setTab('list')}>Checklists on tasks</button>
          <button type="button" style={pill(tab === 'templates')} onClick={() => setTab('templates')}>QA/QC templates</button>
        </div>
      )}
      {tab === 'templates' && manage ? <ChecklistTemplateSettings kind="qaqc" /> : (
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select aria-label="Project" value={project} onChange={(e) => setProject(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 13 }}>
              <option value={0}>All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={show === 'all'} onChange={(e) => setShow(e.target.checked ? 'all' : 'open')} /> Show finished</label>
          </div>
          {rows === null ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div> : !shown.length ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              {rows.length ? 'Every QA/QC checklist here is finished.' : 'No QA/QC checklists on tasks yet.'}{manage && !rows.length ? ' Make one under “QA/QC templates” and tie it to a programme task or a label.' : ''}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {shown.map((r) => {
                const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                return (
                  <button key={`${r.taskId}:${r.templateId}`} type="button" onClick={() => navigate(`/projects?open=${r.projectId}&tab=phases`)}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 12, alignItems: 'center', textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', font: 'inherit', cursor: 'pointer' }}>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 13.5, color: 'var(--ink)' }}>{r.templateName}</b>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[name(r.projectId), r.title, r.assignee && 'to ' + r.assignee, r.dueDate && 'due ' + r.dueDate.slice(0, 10)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: r.done === r.total ? 'var(--forest)' : 'var(--body)' }}>{r.done} of {r.total} done</span>
                      <span aria-hidden style={{ height: 6, borderRadius: 3, background: 'var(--mist)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--forest)' }} /></span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
