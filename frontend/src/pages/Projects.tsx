import { useEffect, useState } from 'react';
import { TaskBoard } from '../components/TaskBoard';
import { api } from '../api';
import { useApp } from '../AppContext';
import {
  STAGE_CONFIG, PR_COLORS, computeWorkflow, TEAM_COLORS, TEAM_BGS, WF_ST_COLORS,
  type Project,
} from '../data/projects';

const BG = "'Bricolage Grotesque', serif";
const initials = (n: string) => (n ? n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '');
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' };
const PRIORITIES = ['High', 'Medium', 'Low'];
const STAGES = ['Leads', 'Design', 'Construction', 'Closeout'];
const BLANK: Partial<Project> = { name: '', priority: 'Medium', stage: 'Leads', location: '', typeOfWork: '', contractType: 'Design + Build', contractAmt: '', estStart: '', duration: '', scope: '', referral: '', contactedBy: '', progress: 0, imgColor: '#173326' };

export function Projects() {
  const { can, toast } = useApp();
  const canManage = can('projects', 'manage');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'overview' | 'workflow' | 'tasks'>('overview');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [np, setNp] = useState<Partial<Project>>(BLANK);

  const reload = () => { api.projects.list().then((r) => { if (Array.isArray(r)) setProjects(r as Project[]); }).catch(() => { }); };
  useEffect(() => { reload(); }, []);

  const sel = selectedId ? projects.find((p) => p.id === selectedId) || null : null;
  const stColor = sel ? STAGE_CONFIG.find((s) => s.name === sel.stage)?.color || '#173326' : '#173326';
  const workflow = computeWorkflow();

  const openProject = (id: number) => { setSelectedId(id); setTab('overview'); };
  const openNew = () => { setNp(BLANK); setEditingId(null); setShowForm(true); };
  const openEdit = (p: Project) => { setNp({ ...p }); setEditingId(p.id); setSelectedId(null); setShowForm(true); };
  const saveProject = () => {
    if (!np.name || np.name.trim().length < 2) { toast('Project name is required'); return; }
    const payload = { ...np, progress: Number(np.progress) || 0 };
    const done = (v: string) => { setShowForm(false); setEditingId(null); setNp(BLANK); reload(); toast(`${np.name} ${v}`); };
    if (editingId != null) api.projects.update(editingId, payload).then(() => done('updated')).catch(() => toast('⚠ Failed to save'));
    else api.projects.create(payload).then(() => done('created')).catch(() => toast('⚠ Failed to save'));
  };
  const deleteProject = (p: Project) => {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
    setSelectedId(null);
    api.projects.remove(p.id).then(() => reload()).catch(() => toast('⚠ Failed to delete'));
    toast(`${p.name} deleted`);
  };

  const card = (p: Project, stCol: string) => (
    <div key={p.id} onClick={() => openProject(p.id)} style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.06)', overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ height: 80, background: `linear-gradient(135deg, ${p.imgColor}, ${p.imgColor}cc)`, position: 'relative' }}>
        <span style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: PR_COLORS[p.priority].c, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.priority}</span>
        <span style={{ position: 'absolute', bottom: 8, left: 8, padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,0.5)', color: 'white' }}>{p.contractType}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#7E9B93', marginBottom: 8 }}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx={12} cy={10} r={3} /></svg>
          {p.location}
        </div>
        <div style={{ fontSize: 10, color: '#7E9B93', marginBottom: 10, lineHeight: 1.4 }}>{p.typeOfWork}</div>
        <div style={{ fontFamily: BG, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{p.contractAmt}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
          <div><div style={{ fontSize: 9, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Est. Start</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{p.estStart}</div></div>
          <div><div style={{ fontSize: 9, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Duration</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{p.duration}</div></div>
        </div>
        {p.scope && <div style={{ fontSize: 11, color: '#43514D', lineHeight: 1.4, padding: '8px 10px', background: '#FBF8F2', borderRadius: 8, marginBottom: 10 }}>{p.scope}</div>}
        {p.progress > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 5, background: '#EDE3D0', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: p.progress + '%', height: '100%', background: stCol, borderRadius: 999 }} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7E9B93' }}>{p.progress}%</span>
          </div>
        )}
        {p.referral && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#7E9B93', paddingTop: 8, borderTop: '1px solid rgba(20,8,31,0.04)' }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /></svg>
            Ref: <strong>{p.referral}</strong>
          </div>
        )}
      </div>
    </div>
  );

  const fields = sel
    ? ([
        ['Priority', sel.priority], ['Stage', sel.stage], ['Contract Type', sel.contractType], ['Contract Amount', sel.contractAmt],
        ['Est. Start', sel.estStart], ['Duration', sel.duration], ['Location', sel.location], ['Type of Work', sel.typeOfWork],
        ['Referral', sel.referral || '—'], ['Contacted By', sel.contactedBy],
      ] as [string, string][])
    : [];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'High Priority', 'Design + Build', 'Build Only'].map((f) => (
            <div key={f} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, background: f === 'All' ? '#173326' : 'white', color: f === 'All' ? 'white' : '#7E9B93', border: '1px solid ' + (f === 'All' ? '#173326' : 'rgba(20,8,31,0.08)'), cursor: 'pointer' }}>{f}</div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={openNew} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: '#173326', color: 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>+ New Project</div>}
      </div>

      {/* Pipeline columns */}
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
        {STAGE_CONFIG.map((st) => {
          const stageProjects = projects.filter((p) => p.stage === st.name);
          return (
            <div key={st.name} style={{ flex: '0 0 280px' }}>
              <div style={{ height: 4, borderRadius: 999, background: st.color, margin: '0 4px 8px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
                <div style={{ width: 13, height: 13, borderRadius: 999, background: st.color, boxShadow: '0 0 0 3px ' + st.color + '2E' }} />
                <span style={{ fontFamily: BG, fontWeight: 700, fontSize: 15 }}>{st.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#7E9B93', background: '#EDE3D0', padding: '2px 10px', borderRadius: 999 }}>{stageProjects.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 8, background: '#FBF8F2', borderRadius: 14, minHeight: 200, border: '1px solid rgba(20,8,31,0.04)' }}>
                {stageProjects.map((p) => card(p, st.color))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project detail drawer */}
      {sel && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 100, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: tab === 'workflow' || tab === 'tasks' ? 'min(1100px, 96vw)' : 'min(560px, 95vw)', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,8,31,0.15)', animation: 'scaleIn 0.2s ease', transition: 'width 0.3s ease', display: 'flex', flexDirection: 'column' }}>
            {/* Header image */}
            <div style={{ height: 150, background: `linear-gradient(135deg, ${sel.imgColor}, ${sel.imgColor}cc)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={18} height={18} rx={2} ry={2} /><circle cx={8.5} cy={8.5} r={1.5} /><polyline points="21 15 16 10 5 21" /></svg>
              <div style={{ position: 'absolute', top: 14, right: 14 }}>
                <div onClick={() => setSelectedId(null)} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', gap: 8 }}>
                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.5)', color: 'white' }}>{sel.stage}</span>
                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: PR_COLORS[sel.priority].c }}>{sel.priority}</span>
              </div>
            </div>

            {/* Title */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)', flexShrink: 0 }}>
              <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>{sel.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7E9B93', marginTop: 4 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx={12} cy={10} r={3} /></svg>
                {sel.location}
              </div>
              <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 28, letterSpacing: '-0.02em', marginTop: 14, color: '#173326' }}>{sel.contractAmt}</div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(20,8,31,0.06)', padding: '0 28px', flexShrink: 0 }}>
              <div onClick={() => setTab('overview')} style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid ' + (tab === 'overview' ? '#173326' : 'transparent'), color: tab === 'overview' ? '#0B1A12' : '#7E9B93' }}>Overview</div>
              <div onClick={() => setTab('workflow')} style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid ' + (tab === 'workflow' ? '#173326' : 'transparent'), color: tab === 'workflow' ? '#0B1A12' : '#7E9B93' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={7} height={7} /><rect x={14} y={3} width={7} height={7} /><rect x={3} y={14} width={7} height={7} /><rect x={14} y={14} width={7} height={7} /></svg>
                  Workflow Board
                </span>
              </div>
              <div onClick={() => setTab('tasks')} style={{ padding: '14px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid ' + (tab === 'tasks' ? '#173326' : 'transparent'), color: tab === 'tasks' ? '#0B1A12' : '#7E9B93' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                  Tasks
                </span>
              </div>
            </div>

            {tab === 'overview' ? (
              <div>
                <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 14 }}>Project Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {fields.map((r) => (
                      <div key={r[0]} style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r[0]}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12' }}>{r[1]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 8 }}>Scope of Work</div>
                  <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10, fontSize: 13, lineHeight: 1.6, color: '#43514D' }}>{sel.scope}</div>
                </div>
                {sel.progress > 0 && (
                  <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>Progress</span>
                      <span style={{ fontFamily: BG, fontWeight: 700, fontSize: 18 }}>{sel.progress}%</span>
                    </div>
                    <div style={{ height: 8, background: '#EDE3D0', borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 999, background: stColor, width: sel.progress + '%' }} /></div>
                  </div>
                )}
                <div style={{ padding: '20px 28px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {canManage && <div onClick={() => openEdit(sel)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#173326', color: 'white', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>Edit</div>}
                  <div onClick={() => setTab('workflow')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', background: 'white' }}>Open Workflow Board</div>
                  {canManage && <div onClick={() => deleteProject(sel)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid #D08A6A', color: '#8E2E0A', background: 'white', marginLeft: 'auto' }}>Delete</div>}
                </div>
              </div>
            ) : tab === 'tasks' ? (
              <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
                <TaskBoard projectId={sel.id} />
              </div>
            ) : (
              <div style={{ padding: '20px 16px', overflowX: 'auto', flex: 1 }}>
                {/* Wizard step indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16, padding: '0 4px' }}>
                  {workflow.map((step) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 999, background: step.statusBg, border: '2px solid ' + step.statusC, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          {step.isComplete && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={step.statusC} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          {step.isLocked && <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#9AA39D" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={11} width={18} height={11} rx={2} ry={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: step.statusC, whiteSpace: 'nowrap' }}>{step.name}</span>
                      </div>
                      <div style={{ flex: 1, height: 2, background: step.statusBg, margin: '0 6px', minWidth: 8 }} />
                    </div>
                  ))}
                </div>

                {/* Phase columns */}
                <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
                  {workflow.map((phase) => (
                    <div key={phase.id} style={{ width: 220, flexShrink: 0, background: '#FBF8F2', borderRadius: 12, border: '1px solid rgba(20,8,31,0.04)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 340px)', opacity: phase.headerOpacity }}>
                      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 3, background: phase.color, flexShrink: 0 }} />
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0B1A12', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.name}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', background: 'rgba(20,8,31,0.06)', padding: '2px 7px', borderRadius: 999 }}>{phase.count}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 4, background: 'rgba(20,8,31,0.06)', borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 999, background: phase.color, width: phase.progress + '%', transition: 'width 0.3s' }} /></div>
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 600, background: phase.statusBg, color: phase.statusC }}>{phase.statusLabel}</span>
                        </div>
                      </div>
                      {phase.isLocked ? (
                        <div style={{ padding: '40px 16px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#D5D3CC" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={11} width={18} height={11} rx={2} ry={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#9AA39D' }}>Complete previous phase to unlock</div>
                        </div>
                      ) : (
                        <div style={{ padding: 6, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {phase.tasks.map((pt) => {
                            const sc = WF_ST_COLORS[pt.status];
                            const done = pt.status === 'Done';
                            if (phase.isComplete && done) {
                              return (
                                <div key={pt.title} style={{ background: '#EDF4EC', borderRadius: 8, padding: '9px 10px', border: '1px solid rgba(5,150,105,0.08)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#1C5230" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: '#43514D', textDecoration: 'line-through' }}>{pt.title}</span>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={pt.title} style={{ background: 'white', borderRadius: 8, padding: '9px 10px', border: '1px solid rgba(20,8,31,0.05)', boxShadow: '0 1px 3px rgba(20,8,31,0.04)' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#0B1A12', lineHeight: 1.4, marginBottom: 6 }}>{pt.title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                                  <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 8, fontWeight: 600, background: TEAM_BGS[pt.team] || '#EFEDE8', color: TEAM_COLORS[pt.team] || '#7E9B93' }}>{pt.team}</span>
                                  {pt.auto && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999, background: '#FBE9AE', border: '1px solid rgba(245,158,11,0.2)' }}>
                                      <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="#D2822E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                      <span style={{ fontSize: 7, fontWeight: 700, color: '#93520F' }}>AUTO</span>
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                  <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 600, background: sc.bg, color: sc.c }}>{pt.status}</span>
                                  {pt.start && (
                                    <span style={{ fontSize: 9, color: '#7E9B93', display: 'flex', alignItems: 'center', gap: 2 }}>
                                      <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={4} width={18} height={18} rx={2} ry={2} /><line x1={16} y1={2} x2={16} y2={6} /><line x1={8} y1={2} x2={8} y2={6} /><line x1={3} y1={10} x2={21} y2={10} /></svg>
                                      {pt.start} – {pt.end}
                                    </span>
                                  )}
                                  <span style={{ fontSize: 9, color: '#7E9B93', marginLeft: 'auto', fontWeight: 600 }}>{pt.dur}</span>
                                </div>
                                {pt.assignee && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: 999, background: '#0F2417', display: 'grid', placeItems: 'center', fontSize: 7, fontWeight: 700, color: 'white' }}>{initials(pt.assignee)}</div>
                                    <span style={{ fontSize: 9, color: '#7E9B93' }}>{pt.assignee}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New / Edit Project form */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 140, display: 'grid', placeItems: 'center', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: 16, boxShadow: '0 24px 60px rgba(20,8,31,0.24)', animation: 'scaleIn 0.18s ease' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(20,8,31,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700 }}>{editingId != null ? 'Edit project' : 'New project'}</div>
              <div onClick={() => setShowForm(false)} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93' }}>×</div>
            </div>
            <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Project name', 'name', 'text', '1 / -1'],
                ['Priority', 'priority', 'select-priority'],
                ['Stage', 'stage', 'select-stage'],
                ['Location', 'location', 'text'],
                ['Type of work', 'typeOfWork', 'text'],
                ['Contract type', 'contractType', 'text'],
                ['Contract amount', 'contractAmt', 'text'],
                ['Est. start', 'estStart', 'text'],
                ['Duration', 'duration', 'text'],
                ['Referral', 'referral', 'text'],
                ['Contacted by', 'contactedBy', 'text'],
                ['Progress %', 'progress', 'number'],
                ['Scope of work', 'scope', 'textarea', '1 / -1'],
              ].map(([label, key, kind, span]) => (
                <div key={key as string} style={{ gridColumn: (span as string) || 'auto' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
                  {kind === 'select-priority' ? (
                    <select value={(np as any)[key as string] || 'Medium'} onChange={(e) => setNp({ ...np, [key as string]: e.target.value })} style={inputStyle}>{PRIORITIES.map((o) => <option key={o}>{o}</option>)}</select>
                  ) : kind === 'select-stage' ? (
                    <select value={(np as any)[key as string] || 'Leads'} onChange={(e) => setNp({ ...np, [key as string]: e.target.value })} style={inputStyle}>{STAGES.map((o) => <option key={o}>{o}</option>)}</select>
                  ) : kind === 'textarea' ? (
                    <textarea value={(np as any)[key as string] || ''} onChange={(e) => setNp({ ...np, [key as string]: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  ) : (
                    <input type={kind === 'number' ? 'number' : 'text'} value={(np as any)[key as string] ?? ''} onChange={(e) => setNp({ ...np, [key as string]: kind === 'number' ? Number(e.target.value) : e.target.value })} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(20,8,31,0.07)', display: 'flex', gap: 9 }}>
              <div onClick={saveProject} style={{ padding: '11px 22px', borderRadius: 999, background: '#173326', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{editingId != null ? 'Save changes' : 'Create project'}</div>
              <div onClick={() => setShowForm(false)} style={{ padding: '11px 18px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#43514D' }}>Cancel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
