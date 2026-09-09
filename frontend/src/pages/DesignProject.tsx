import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { ProjectTask } from '../data/projectTasks';
import { PhaseTaskPanel } from '../components/PhaseTaskPanel';
import { TEAM_COLORS } from '../data/projects';

const HEADING = "'Bricolage Grotesque', serif";

/** Tokens from the design handoff. */
const INK = '#14081F';
const INK3 = '#756E80';
const MUTED = '#9c96a4';
const PAPER = '#FBF8F2';
const ACCENT = '#5B2BC9';
const SAND = '#EDE3CF';

/** Per-stage dot/bar and checked-text colours, per the handoff. */
const STAGE_COLORS: Record<string, { dot: string; text: string }> = {
  programming: { dot: '#2f6fb0', text: '#2f5f9e' },
  schematic: { dot: '#1f8a72', text: '#2f7a52' },
  dd: { dot: '#6b3fa0', text: '#6b46c1' },
  closeout: { dot: '#1f8a72', text: '#2f7a52' },
};

const STATUS = {
  complete: { label: 'Complete', bg: '#d9efe4', c: '#1f7a52' },
  progress: { label: 'In Progress', bg: '#f4e6cf', c: '#8a5a1e' },
  none: { label: 'Not Started', bg: SAND, c: INK3 },
};

interface Phase { id: string; key: string; name: string; color: string; order: number }
interface Project {
  id: number; name: string; location: string; contractAmt: string; contractType: string;
  priority: string; typeOfWork: string; estStart: string; duration: string; scope: string;
  referral: string; designPhase?: string;
}

/**
 * One project's design checklist, opened from a card on the Design board.
 *
 * The checklist is the project's real phase tasks rather than a fixed list, so
 * ticking a box here is the same completion the Phase Board and reports read —
 * there is no separate copy of the truth.
 */
export function DesignProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Opened from Design or from Construction; go back to whichever it was.
  const board = pathname.startsWith('/pm') ? '/pm' : '/design';
  const { toast, can } = useApp();
  const canManage = can('projects', 'manage');

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Filters over the checklist, and the rows picked for a bulk change.
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const id = Number(projectId);

  useEffect(() => {
    if (!Number.isFinite(id)) { setError('Unknown project.'); setLoading(false); return; }
    Promise.all([api.projects.get(String(id)), api.projectPhases.board(id)])
      .then(([p, board]: any[]) => {
        setProject(p as Project);
        setPhases((board?.phases ?? []) as Phase[]);
        setTasks((board?.tasks ?? []) as ProjectTask[]);
        // Open on the phase the project is sitting in, falling back to the first.
        const wanted = (p as Project)?.designPhase;
        const list = (board?.phases ?? []) as Phase[];
        setPhaseFilter(list.some((ph) => ph.key === wanted) ? wanted! : list[0]?.key ?? 'all');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  /** Tasks per phase, with the counts the header and tabs need. */
  const stages = useMemo(() => phases.map((ph) => {
    const items = tasks.filter((t) => t.phaseId === ph.id && !t.parentId);
    const done = items.filter((t) => t.completed || t.status === 'Done').length;
    const percent = items.length ? Math.round((done / items.length) * 100) : 0;
    const colors = STAGE_COLORS[ph.key] || { dot: ph.color, text: ph.color };
    return {
      ...ph, items, done, percent, colors,
      complete: items.length > 0 && done === items.length,
      status: percent === 100 ? STATUS.complete : percent > 0 ? STATUS.progress : STATUS.none,
    };
  }), [phases, tasks]);

  const reload = () => api.projectPhases.board(id)
    .then((b: any) => { setPhases((b?.phases ?? []) as Phase[]); setTasks((b?.tasks ?? []) as ProjectTask[]); })
    .catch(() => { });

  /** Ticking writes through — the board and reports read the same completion. */
  const toggle = (task: ProjectTask) => {
    if (!canManage) return;
    const next = !(task.completed || task.status === 'Done');
    setTasks((prev) => prev.map((t) => (t.id === task.id
      ? { ...t, completed: next, status: next ? 'Done' : 'In progress' }
      : t)));
    api.projectTasks.update(task.id, { completed: next, status: next ? 'Done' : 'In progress' })
      .catch((e: Error) => {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        toast('⚠ ' + e.message);
      });
  };

  if (loading) return <div style={{ padding: 32, fontSize: 13, color: INK3 }}>Loading project…</div>;
  if (error || !project) {
    return (
      <div style={{ padding: '32px 36px', background: PAPER, minHeight: '100%' }}>
        <BackLink onClick={() => navigate(board)} label="Back" />
        <div style={{ marginTop: 20, fontSize: 13, color: '#8E2E0A' }}>{error || 'Project not found.'}</div>
      </div>
    );
  }

  const shownPhases = phaseFilter === 'all' ? stages : stages.filter((s) => s.key === phaseFilter);
  const pool = shownPhases.flatMap((s) => s.items.map((t) => ({ task: t, stage: s })));

  const roleOptions = ['All roles', ...Array.from(new Set(pool.map((r) => r.task.team).filter(Boolean))).sort()];
  const q = query.trim().toLowerCase();
  const filtered = pool.filter(({ task }) =>
    (roleFilter === 'All roles' || task.team === roleFilter)
    && (!q || task.title.toLowerCase().includes(q) || (task.assignee || '').toLowerCase().includes(q)));

  const isDone = (t: ProjectTask) => !!(t.completed || t.status === 'Done');
  const isProgress = (t: ProjectTask) => !isDone(t) && t.status === 'In progress';
  const doneCount = filtered.filter((r) => isDone(r.task)).length;
  const progCount = filtered.filter((r) => isProgress(r.task)).length;
  const openCount = filtered.length - doneCount - progCount;
  const total = filtered.length;
  const donePct = total ? Math.round((doneCount / total) * 100) : 0;
  const progPct = total ? Math.round((progCount / total) * 100) : 0;

  const heading = phaseFilter === 'all'
    ? 'All phases'
    : stages.find((s) => s.key === phaseFilter)?.name || 'Phase';

  const COLUMNS = [
    { key: 'open', label: 'Not started', dot: '#C9BFA8', match: (t: ProjectTask) => !isDone(t) && !isProgress(t), emptyText: 'Nothing waiting to start.' },
    { key: 'progress', label: 'In progress', dot: ACCENT, match: isProgress, emptyText: 'Nothing under way.' },
    { key: 'done', label: 'Done', dot: '#16A34A', match: isDone, emptyText: 'Nothing finished yet.' },
  ];

  const selCount = selected.length;
  const toggleSelect = (taskId: string) =>
    setSelected((prev) => (prev.includes(taskId) ? prev.filter((x) => x !== taskId) : [...prev, taskId]));

  /** Bulk status change. Applied one row at a time; the board reads the result. */
  const bulk = async (patch: any) => {
    if (!canManage || !selCount) return;
    const ids = [...selected];
    setSelected([]);
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)));
    try {
      for (const taskId of ids) await api.projectTasks.update(taskId, patch);
      toast(`${ids.length} task${ids.length === 1 ? '' : 's'} updated`);
    } catch (e: any) {
      toast('⚠ ' + (e.message || 'Some tasks did not update'));
      reload();
    }
  };

  const pill: React.CSSProperties = {
    height: 40, padding: '0 12px', border: '1px solid rgba(20,8,31,.14)', borderRadius: 999,
    background: '#FFFFFF', fontSize: 14, color: '#4A4357', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
  };
  const bulkBtn = (text: string, onClick: () => void, primary = false): React.ReactNode => (
    <div
      onClick={onClick}
      style={{
        height: 34, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 999,
        border: primary ? 'none' : '1px solid rgba(20,8,31,.14)',
        background: primary ? ACCENT : '#fff', color: primary ? '#fff' : '#4A4357',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}
    >{text}</div>
  );

  return (
    <div style={{ background: PAPER, minHeight: '100%', padding: '24px 24px 60px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <BackLink onClick={() => navigate(board)} label={board === '/pm' ? 'Construction' : 'Design & Preconstruction'} />

        <h1 style={{ fontFamily: HEADING, fontWeight: 700, fontSize: 26, color: INK, margin: 0 }}>{project.name}</h1>
        <p style={{ margin: '6px 0 18px', fontSize: 14, color: INK3 }}>
          {project.location || '—'} · {project.contractAmt || '—'}
        </p>

        {/* Phase stepper — the same selection as the Phase filter below it. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          {stages.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                onClick={() => setPhaseFilter(s.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                  color: s.key === phaseFilter ? INK : s.complete ? '#16A34A' : MUTED,
                }}
              >
                <span style={{
                  width: 15, height: 15, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, background: s.complete ? '#16A34A' : SAND, color: '#fff',
                }}>{s.complete ? '✓' : ''}</span>
                {s.name}
              </span>
              {i < stages.length - 1 && <span style={{ color: '#c9c2d1' }}>›</span>}
            </div>
          ))}
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid rgba(20,8,31,.10)', borderRadius: 24, boxShadow: '0 8px 24px rgba(20,8,31,.06)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 26px 20px', borderBottom: '1px solid rgba(20,8,31,.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT }}>Phase checklist</div>
                <h2 style={{ fontFamily: HEADING, fontWeight: 700, letterSpacing: '-.02em', fontSize: 26, margin: '8px 0 0' }}>{heading}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ fontFamily: HEADING, fontWeight: 700, fontSize: 34, letterSpacing: '-.03em', lineHeight: 1 }}>{donePct}%</div>
                <div style={{ fontSize: 13, color: INK3, paddingBottom: 3 }}>{doneCount} of {total} complete</div>
              </div>
            </div>

            <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: SAND, marginTop: 18 }}>
              <div style={{ background: '#16A34A', transition: 'width .3s ease', width: `${donePct}%` }} />
              <div style={{ background: ACCENT, transition: 'width .3s ease', width: `${progPct}%` }} />
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, color: INK3, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#16A34A' }} />{doneCount} done</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: ACCENT }} />{progCount} in progress</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#C9BFA8' }} />{openCount} not started</span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', border: '1px solid rgba(20,8,31,.14)', borderRadius: 999, background: PAPER, flex: '1 1 220px', maxWidth: 340 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth={2} strokeLinecap="round"><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks"
                  style={{ border: 0, outline: 0, background: 'transparent', fontSize: 14, width: '100%', color: INK, fontFamily: 'inherit' }}
                />
              </div>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={pill}>
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} style={pill}>
                <option value="all">All phases</option>
                {stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
              <div
                onClick={() => { setQuery(''); setRoleFilter('All roles'); setPhaseFilter('all'); }}
                style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 16px', border: '1px solid rgba(20,8,31,.14)', borderRadius: 999, fontSize: 14, fontWeight: 600, color: '#4A4357', cursor: 'pointer' }}
              >Reset</div>
            </div>
          </div>

          {selCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 26px', background: '#F7F3FF', borderBottom: '1px solid #DDD0FF' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4A1FA0' }}>{selCount} selected</span>
              <div style={{ flex: 1 }} />
              {bulkBtn('Mark complete', () => bulk({ completed: true, status: 'Done' }), true)}
              {bulkBtn('Move to in progress', () => bulk({ completed: false, status: 'In progress' }))}
              {bulkBtn('Reopen', () => bulk({ completed: false, status: 'Not started' }))}
              <div onClick={() => setSelected([])} style={{ height: 34, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, fontWeight: 600, color: INK3, cursor: 'pointer' }}>Clear</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 16, padding: '22px 26px 28px', background: '#F6F0E4' }}>
            {COLUMNS.map((col) => {
              const rows = filtered.filter((r) => col.match(r.task));
              return (
                <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 2px' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: col.dot }} />
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#4A4357' }}>{col.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#8A8194' }}>{rows.length}</span>
                  </div>

                  {rows.map(({ task, stage }, idx) => {
                    const done = isDone(task);
                    const picked = selected.includes(task.id);
                    const checklist = task.checklist ?? [];
                    const ticked = checklist.filter((c: any) => c.done).length;
                    const overdue = !done && !!task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedId(task.id)}
                        title="Open the task"
                        style={{
                          position: 'relative', background: '#FFFFFF',
                          border: '1px solid ' + (picked ? ACCENT : 'rgba(20,8,31,.08)'),
                          boxShadow: picked ? '0 0 0 3px rgba(91,43,201,.12)' : '0 1px 2px rgba(20,8,31,.05)',
                          borderRadius: 14, padding: '12px 14px', cursor: 'pointer', transition: 'box-shadow .18s ease, border-color .18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div
                            onClick={(e) => { e.stopPropagation(); toggle(task); }}
                            role="checkbox"
                            aria-checked={done}
                            title={done ? 'Mark not done' : 'Mark done'}
                            style={{
                              flex: '0 0 auto', width: 20, height: 20, marginTop: 1, borderRadius: 6,
                              border: '1.5px solid ' + (done ? '#16A34A' : 'rgba(20,8,31,.22)'),
                              background: done ? '#16A34A' : 'transparent',
                              display: 'grid', placeItems: 'center', transition: 'all .15s ease',
                              cursor: canManage ? 'pointer' : 'default',
                            }}
                          >
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: done ? 1 : 0 }}><path d="M20 6 9 17l-5-5" /></svg>
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#A79EB4', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                              <span style={{ fontFamily: HEADING, fontWeight: 600, fontSize: 15, letterSpacing: '-.01em', lineHeight: 1.25, color: done ? '#8A8194' : INK, textDecoration: done ? 'line-through' : 'none' }}>{task.title}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                              {task.team && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 22, padding: '0 9px', borderRadius: 999, background: '#F3EFE6', fontSize: 11, fontWeight: 600, color: '#4A4357' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: 999, background: TEAM_COLORS[task.team] || ACCENT }} />{task.team}
                                </span>
                              )}
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8194' }}>{stage.name}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(20,8,31,.07)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                <span style={{ width: 22, height: 22, borderRadius: 999, background: task.assignee ? '#EDE5FF' : '#F0EEE9', color: '#4A1FA0', fontSize: 9.5, fontWeight: 700, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                                  {task.assignee ? initials(task.assignee) : '—'}
                                </span>
                                <span style={{ fontSize: 12, color: task.assignee ? '#4A4357' : '#A79EB4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {task.assignee || 'Unassigned'}
                                </span>
                              </div>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: overdue ? '#B4232A' : '#8A8194', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                {task.dueDate || 'No date'}
                              </span>
                            </div>

                            {checklist.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: '#8A8194' }}>
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 5v8a3 3 0 0 0 3 3h11" /><path d="m15 12 4 4-4 4" /></svg>
                                <span>{ticked} of {checklist.length} checklist items</span>
                              </div>
                            )}
                          </div>

                          <div
                            onClick={(e) => { e.stopPropagation(); toggleSelect(task.id); }}
                            title={picked ? 'Remove from selection' : 'Select for a bulk change'}
                            style={{
                              flex: '0 0 auto', width: 16, height: 16, borderRadius: 999, marginTop: 3,
                              border: '1.5px solid ' + (picked ? ACCENT : 'rgba(20,8,31,.16)'),
                              background: picked ? ACCENT : 'transparent', cursor: 'pointer',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {rows.length === 0 && (
                    <div style={{ border: '1.5px dashed rgba(20,8,31,.14)', borderRadius: 14, padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: '#8A8194' }}>{col.emptyText}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedId && (() => {
        const t = tasks.find((x) => x.id === selectedId);
        if (!t) return null;
        const ph = phases.find((x) => x.id === t.phaseId);
        return (
          <PhaseTaskPanel
            task={t}
            tasks={tasks}
            phaseName={ph?.name || ''}
            phaseColor={ph?.color || ACCENT}
            onClose={() => setSelectedId(null)}
            onSaved={(next: any) => setTasks((prev) => prev.map((x) => (x.id === next.id ? next : x)))}
            onReload={reload}
          />
        );
      })()}
    </div>
  );
}

const initials = (n: string) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: ACCENT, fontWeight: 700, fontSize: 13, marginBottom: 18 }}>
      <span style={{ fontSize: 16 }}>←</span>
      <span>{label}</span>
    </div>
  );
}
