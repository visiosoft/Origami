import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';
import { TaskBoard } from '../components/TaskBoard';
import {
  ALL_TASKS, ST_COLORS, TT_COLORS, MT_COLORS, NEW_TASK_FIELDS, getLeadTime, type Task, type TaskTab,
} from '../data/tasks';

const BG = "'Bricolage Grotesque', serif";
const COLS = '110px 56px 2fr 80px 100px 64px 58px';
const TABS: TaskTab[] = ['internal', 'owner', 'subcontractor'];
const TAB_LABELS: Record<TaskTab, string> = { internal: 'Internal', owner: 'Owner', subcontractor: 'Subcontractor' };
const initials = (n: string) => (n ? n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '');

export function Tasks() {
  const { toast } = useApp();
  const [tab, setTab] = useState<TaskTab>('internal');
  const [pf, setPf] = useState('All projects');
  const [projOpen, setProjOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const swallow = useRef(false);
  const [mode, setMode] = useState<'board' | 'log'>('board');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [boardProjectId, setBoardProjectId] = useState<number | null>(null);

  useEffect(() => {
    api.projects.list().then((r: any) => {
      if (Array.isArray(r) && r.length) { setProjects(r.map((p) => ({ id: p.id, name: p.name }))); setBoardProjectId((cur) => cur ?? r[0].id); }
    }).catch(() => { });
  }, []);

  useEffect(() => {
    const onDoc = () => { if (swallow.current) { swallow.current = false; return; } setProjOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const taskProjects: string[] = [];
  TABS.forEach((t) => ALL_TASKS[t].forEach((x) => { if (x.project && !taskProjects.includes(x.project)) taskProjects.push(x.project); }));
  const byProject = (list: Task[]) => (pf === 'All projects' ? list : list.filter((x) => x.project === pf));
  const tabCounts: Record<TaskTab, number> = { internal: 0, owner: 0, subcontractor: 0 };
  TABS.forEach((t) => { tabCounts[t] = byProject(ALL_TASKS[t]).length; });
  const tasks = byProject(ALL_TASKS[tab]);

  const allFlat = [...ALL_TASKS.internal, ...ALL_TASKS.owner, ...ALL_TASKS.subcontractor];
  const sel = selectedId ? allFlat.find((x) => x.id === selectedId) || null : null;
  const lt = sel ? getLeadTime(sel) : null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Mode toggle: Asana-style board vs the request log */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999 }}>
          {([['board', 'Task Board'], ['log', 'Request Log']] as [typeof mode, string][]).map((m) => (
            <div key={m[0]} onClick={() => setMode(m[0])} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: mode === m[0] ? 'white' : 'transparent', color: mode === m[0] ? '#0B1A12' : '#7E9B93', boxShadow: mode === m[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{m[1]}</div>
          ))}
        </div>
        {mode === 'board' && (
          <>
            <span style={{ fontSize: 12, color: '#7E9B93', marginLeft: 4 }}>Project:</span>
            <select value={boardProjectId ?? ''} onChange={(e) => setBoardProjectId(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit', fontSize: 13, color: '#0B1A12', outline: 'none', maxWidth: 320 }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
      </div>

      {mode === 'board' ? (
        boardProjectId != null ? <TaskBoard projectId={boardProjectId} /> : <div style={{ fontSize: 13, color: '#7E9B93' }}>No projects yet.</div>
      ) : (
      <>
      {/* Tabs + filter + new */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <div key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#173326' : 'transparent', color: tab === t ? 'white' : '#7E9B93', border: tab === t ? 'none' : '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {TAB_LABELS[t]}
            <span style={{ fontSize: 11, fontWeight: 700, background: tab === t ? 'rgba(255,255,255,0.25)' : '#EDE3D0', padding: '1px 8px', borderRadius: 999, color: tab === t ? 'white' : '#7E9B93' }}>{tabCounts[t]}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <div onClick={(e) => { e.stopPropagation(); swallow.current = true; setProjOpen((o) => !o); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: pf === 'All projects' ? '#7E9B93' : 'white', background: pf === 'All projects' ? 'white' : '#173326', border: '1px solid rgba(20,8,31,0.08)' }}>
            <span>{pf}</span>
            <svg width={10} height={6} viewBox="0 0 10 6" fill="none" style={{ transform: projOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M1 1l4 4 4-4" stroke={pf === 'All projects' ? '#7E9B93' : 'white'} strokeWidth={1.6} strokeLinecap="round" /></svg>
          </div>
          {projOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 200, background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.08)', boxShadow: '0 12px 30px rgba(11,26,18,0.16)', padding: 5, maxHeight: 260, overflowY: 'auto' }}>
              {['All projects', ...taskProjects].map((pr) => (
                <div key={pr} onClick={() => { setPf(pr); setProjOpen(false); }} style={{ padding: '8px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: pf === pr ? 700 : 500, color: pf === pr ? '#173326' : '#43514D', background: pf === pr ? '#DCE7DE' : 'transparent' }}>{pr}</div>
              ))}
            </div>
          )}
        </div>
        <div onClick={() => setShowNew(true)} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: '#173326', color: 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>+ New Task</div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '12px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', gap: 10, fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 760 }}>
          <span>Task #</span><span>Type</span><span>Description</span><span>Status</span><span>Assigned To</span><span>Date</span><span>Due</span>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7E9B93', fontSize: 14 }}>No tasks in this category.</div>
        ) : (
          tasks.map((t) => {
            const sc = ST_COLORS[t.status];
            const tc = TT_COLORS[t.topicType];
            const inits = initials(t.assignedTo);
            const desc = t.description.length > 80 ? t.description.slice(0, 80) + '…' : t.description;
            return (
              <div key={t.id} onClick={() => setSelectedId(t.id)} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.04)', cursor: 'pointer', gap: 10, minWidth: 760 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#7E9B93', fontVariantNumeric: 'tabular-nums' }}>{t.id}</span>
                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.c, textAlign: 'center' }}>{t.topicType}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.c, textAlign: 'center' }}>{t.status}</span>
                {inits ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 999, background: '#0F2417', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{inits}</div>
                    <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assignedTo}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#7E9B93' }}>—</span>
                )}
                <span style={{ fontSize: 12, color: '#7E9B93' }}>{t.meetingDate}</span>
                <span style={{ fontSize: 12, color: '#7E9B93' }}>{t.dueDate || '—'}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Task detail modal */}
      {sel && lt && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 100, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: 760, maxWidth: '95vw', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,8,31,0.15)', animation: 'scaleIn 0.2s ease' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#7E9B93', fontVariantNumeric: 'tabular-nums', background: '#FBF8F2', padding: '3px 10px', borderRadius: 6 }}>{sel.id}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: ST_COLORS[sel.status].bg, color: ST_COLORS[sel.status].c }}>{sel.status}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: TT_COLORS[sel.topicType].bg, color: TT_COLORS[sel.topicType].c }}>{sel.topicType}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: MT_COLORS[sel.meetingType].bg, color: MT_COLORS[sel.meetingType].c }}>{sel.meetingType}</span>
                </div>
                <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.4 }}>{sel.description}</div>
              </div>
              <div onClick={() => setSelectedId(null)} style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px solid rgba(20,8,31,0.08)', marginLeft: 16, flexShrink: 0 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
              </div>
            </div>

            {/* Meta */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Assigned To</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 999, background: '#0F2417', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{initials(sel.assignedTo) || '—'}</div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{sel.assignedTo || 'Unassigned'}</span>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Meeting Date</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sel.meetingDate}</div>
                </div>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Project</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#173326' }}>{sel.project}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
                {([['Due Date', sel.dueDate || '—'], ['Date Closed', sel.dateClosed || '—'], ['Days Open', sel.daysOpen > 0 ? sel.daysOpen + ' days' : '—'], ['Originator', sel.originator || '—']] as [string, string][]).map((r) => (
                  <div key={r[0]} style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r[1]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 10 }}>Description</div>
              <div style={{ padding: '14px 16px', background: '#FBF8F2', borderRadius: 10 }}>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: '#0B1A12' }}>{sel.description}</div>
                {sel.resolution && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(20,8,31,0.07)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2F7D4A', marginBottom: 4 }}>Resolution</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#43514D' }}>{sel.resolution}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Due date & lead time */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>Due Date & Lead Time</div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 999, background: lt.bg, color: lt.color, whiteSpace: 'nowrap' }}>{lt.label}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {([['Lead Time', lt.leadTime + ' days'], ['Open Days', lt.openDays + ' days'], ['Variance', lt.variance === 0 ? 'On target' : lt.variance > 0 ? '+' + lt.variance + ' days' : lt.variance + ' days']] as [string, string][]).map((r, i) => (
                  <div key={r[0]} style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: i === 2 ? lt.color : '#0B1A12' }}>{r[1]}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Date Change Audit Trail</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {lt.audit.map((au, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#FBF8F2', borderRadius: 9 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 999, background: au.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0B1A12' }}>{au.what}</div>
                        <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 2 }}>{au.by} · {au.when}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: au.chipBg, color: au.chipC, flexShrink: 0 }}>{au.chip}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '11px 13px', background: '#EEF3EE', borderRadius: 10, fontSize: 10.5, color: '#43514D', lineHeight: 1.55 }}>Lead time is inherited from the task template ({lt.source}). Moving a due date needs approval from the task owner, and every change is logged above.</div>
            </div>

            {/* Comment input */}
            <div style={{ padding: '20px 28px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 14 }}>Activity</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: '#0F2417', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>EM</div>
                <div style={{ flex: 1, border: '1px solid rgba(20,8,31,0.12)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#7E9B93' }}>Write a comment...</div>
                <div style={{ padding: '10px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: '#173326', color: 'white', cursor: 'pointer', flexShrink: 0 }}>Send</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New task modal */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.6)', zIndex: 200, display: 'grid', placeItems: 'center', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, width: 600, maxWidth: '94vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(20,8,31,0.25)', animation: 'scaleIn 0.2s ease' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>New Task</div>
              <div onClick={() => setShowNew(false)} style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
              </div>
            </div>
            <div style={{ padding: '24px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {NEW_TASK_FIELDS.map((f) => (
                  <div key={f.label} style={{ gridColumn: f.span }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{f.label} {f.required && <span style={{ color: '#8E2E0A' }}>*</span>}</div>
                    <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(20,8,31,0.12)', fontSize: 14, background: 'white', color: f.valColor }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: 20, border: '2px dashed rgba(20,8,31,0.1)', borderRadius: 12, textAlign: 'center', cursor: 'pointer' }}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 6px' }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#7E9B93' }}>Drop files here or click to attach</div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <div onClick={() => setShowNew(false)} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', background: 'white' }}>Cancel</div>
                <div onClick={() => { setShowNew(false); toast('Task created'); }} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#173326', color: 'white', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>Create Task</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
