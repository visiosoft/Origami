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
  const [view, setView] = useState<'board' | 'list' | 'timeline' | 'dashboard'>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Which phase keys belong to a Construction-category template -- so the
  // Construction board's own project page shows only its own phases, not the
  // rest of whatever lifecycle template the project happens to be on.
  const [constructionKeys, setConstructionKeys] = useState<Set<string> | null>(null);

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

  useEffect(() => {
    if (board !== '/pm') return;
    api.programmeTemplate.list()
      .then((res: any) => {
        const keys = new Set<string>();
        (Array.isArray(res) ? res : [])
          .filter((t: any) => (t.category || 'design') === 'construction')
          .forEach((t: any) => (t.phases || []).forEach((ph: any) => keys.add(ph.key)));
        setConstructionKeys(keys);
      })
      .catch(() => setConstructionKeys(new Set()));
  }, [board]);

  /** Tasks per phase, with the counts the header and tabs need. */
  const scopedPhases = useMemo(
    () => (board === '/pm' && constructionKeys ? phases.filter((ph) => constructionKeys.has(ph.key)) : phases),
    [phases, board, constructionKeys],
  );
  // Once the Construction scope is known, make sure the open phase is one of
  // this board's own -- the initial pick (above) had no way to know that yet.
  useEffect(() => {
    if (board !== '/pm' || !constructionKeys || phaseFilter === 'all') return;
    if (constructionKeys.has(phaseFilter)) return;
    const first = scopedPhases[0]?.key;
    if (first) setPhaseFilter(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, constructionKeys, scopedPhases]);

  const stages = useMemo(() => scopedPhases.map((ph) => {
    const items = tasks.filter((t) => t.phaseId === ph.id && !t.parentId);
    const done = items.filter((t) => t.completed || t.status === 'Done').length;
    const percent = items.length ? Math.round((done / items.length) * 100) : 0;
    const colors = STAGE_COLORS[ph.key] || { dot: ph.color, text: ph.color };
    return {
      ...ph, items, done, percent, colors,
      complete: items.length > 0 && done === items.length,
      status: percent === 100 ? STATUS.complete : percent > 0 ? STATUS.progress : STATUS.none,
    };
  }), [scopedPhases, tasks]);

  const reload = () => api.projectPhases.board(id)
    .then((b: any) => { setPhases((b?.phases ?? []) as Phase[]); setTasks((b?.tasks ?? []) as ProjectTask[]); })
    .catch(() => { });

  // A Construction phase's checklist is only ever seeded from the template at
  // the moment it's adopted onto the project -- a task added to the template
  // afterward otherwise never shows up. Re-adopting (idempotent, skips tasks
  // already there) each time the phase is actually viewed keeps it current.
  useEffect(() => {
    if (board !== '/pm' || phaseFilter === 'all' || !constructionKeys?.has(phaseFilter)) return;
    api.projectPhases.adopt(id, phaseFilter).then(reload).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, phaseFilter, constructionKeys, id]);

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
  const today = new Date().toISOString().slice(0, 10);
  const isLate = (t: any) => !isDone(t) && !!t.dueDate && t.dueDate < today;
  const lateCount = filtered.filter((r) => isLate(r.task)).length;
  /** Working days a task should take, from the programme template. */
  const targetOf = (t: any) => Number(t.targetDays) || 0;
  const plannedDays = filtered.reduce((a, r) => a + targetOf(r.task), 0);
  const doneDays = filtered.filter((r) => isDone(r.task)).reduce((a, r) => a + targetOf(r.task), 0);
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
        {(project.location || project.contractAmt) ? (
          <p style={{ margin: '6px 0 18px', fontSize: 14, color: INK3 }}>
            {[project.location, project.contractAmt].filter(Boolean).join(' · ')}
          </p>
        ) : <div style={{ marginBottom: 18 }} />}

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
                {board === '/pm' && canManage && phaseFilter !== 'all' && (
                  <span
                    onClick={() => api.projectPhases.adopt(id, phaseFilter).then(reload).then(() => toast('Synced with the template')).catch((e: Error) => toast('⚠ ' + e.message))}
                    style={{ display: 'inline-block', marginTop: 8, fontSize: 11.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}
                  >↻ Sync from template</span>
                )}
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

            <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: INK3 }}>
                {plannedDays ? <>{doneDays} of {plannedDays} planned days delivered</> : 'No day targets set yet'}
              </span>
              {lateCount > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#FBE4E4', color: '#B4232A', fontWeight: 700 }}>
                  {lateCount} past due
                </span>
              ) : (
                <span style={{ color: '#8A8194' }}>Nothing past its due date</span>
              )}
              {!plannedDays && (
                <span style={{ color: '#8A8194' }}>Set them per task in the Programme Template.</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 20, flexWrap: 'wrap' }}>
              {([['board', 'Board'], ['list', 'List'], ['timeline', 'Timeline'], ['dashboard', 'Dashboard']] as const).map(([key, label]) => (
                <div
                  key={key}
                  onClick={() => setView(key)}
                  style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    background: view === key ? ACCENT : '#fff', color: view === key ? '#fff' : '#4A4357',
                    border: '1px solid ' + (view === key ? ACCENT : 'rgba(20,8,31,.14)'),
                  }}
                >{label}</div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
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

          {view === 'board' && (
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
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                                {targetOf(task) > 0 && (
                                  <span
                                    title={(task as any).targetDerived
                                      ? "Derived by splitting the phase's week estimate across its tasks — set a real one in the Programme Template."
                                      : 'Target from the Programme Template'}
                                    style={{ fontSize: 11, fontWeight: 600, color: (task as any).targetDerived ? '#B7AFC4' : '#4A4357', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                                  >
                                    {(task as any).targetDerived ? '~' : ''}{targetOf(task)}d
                                  </span>
                                )}
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: overdue ? '#B4232A' : '#8A8194', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  {task.dueDate || 'No date'}
                                </span>
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
          )}

          {view === 'list' && (
            <ListView filtered={filtered} onOpen={setSelectedId} isDone={isDone} isLate={isLate} today={today} />
          )}

          {view === 'timeline' && (
            <TimelineView stages={shownPhases} filtered={filtered} onOpen={setSelectedId} isDone={isDone} />
          )}

          {view === 'dashboard' && (
            <DashboardView filtered={filtered} shownPhases={shownPhases} isDone={isDone} isProgress={isProgress} isLate={isLate} />
          )}
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

const PRIORITY_DOT: Record<string, { bg: string; c: string }> = {
  Low: { bg: '#EFEDE8', c: '#5C6B65' },
  Medium: { bg: '#D6E8E5', c: '#2F6F68' },
  High: { bg: '#FBE9AE', c: '#8A6D12' },
  Urgent: { bg: '#F2DFD4', c: '#8E2E0A' },
};

const LIST_GROUPS = [
  { key: 'open', label: 'Not started', dot: '#C9BFA8', match: (t: ProjectTask) => !(t.completed || t.status === 'Done') && t.status !== 'In progress' },
  { key: 'progress', label: 'In progress', dot: ACCENT, match: (t: ProjectTask) => !(t.completed || t.status === 'Done') && t.status === 'In progress' },
  { key: 'done', label: 'Done', dot: '#16A34A', match: (t: ProjectTask) => !!(t.completed || t.status === 'Done') },
];

/** A "Main table"-style list: rows grouped by status, one row per task. */
function ListView({ filtered, onOpen, isDone, isLate }: {
  filtered: { task: ProjectTask; stage: any }[];
  onOpen: (id: string) => void;
  isDone: (t: ProjectTask) => boolean;
  isLate: (t: ProjectTask) => boolean;
  today: string;
}) {
  const cols = '28px minmax(220px,2fr) 140px 110px 100px 110px 140px';
  return (
    <div style={{ padding: '18px 26px 28px', background: '#fff' }}>
      <div style={{ border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
          <span />
          <span>Task</span>
          <span>Owner</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due Date</span>
          <span>Phase</span>
        </div>
        {LIST_GROUPS.map((g) => {
          const rows = filtered.filter((r) => g.match(r.task));
          if (!rows.length) return null;
          return (
            <div key={g.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#FBF8F2', borderTop: '1px solid rgba(20,8,31,.06)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: g.dot }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{g.label}</span>
                <span style={{ fontSize: 11, color: '#9c96a4' }}>{rows.length}</span>
              </div>
              {rows.map(({ task, stage }) => {
                const pr = task.priority ? PRIORITY_DOT[task.priority] : null;
                const late = isLate(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => onOpen(task.id)}
                    style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer' }}
                  >
                    <span style={{ width: 16, height: 16, borderRadius: 5, border: '1.5px solid ' + (isDone(task) ? '#16A34A' : 'rgba(20,8,31,.2)'), background: isDone(task) ? '#16A34A' : 'transparent' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: INK, textDecoration: isDone(task) ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 999, background: task.assignee ? '#EDE5FF' : '#F0EEE9', color: '#4A1FA0', fontSize: 8.5, fontWeight: 700, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                        {task.assignee ? initials(task.assignee) : '—'}
                      </span>
                      <span style={{ fontSize: 11.5, color: '#4A4357', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assignee || 'Unassigned'}</span>
                    </span>
                    <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', height: 20, padding: '0 9px', borderRadius: 999, background: (STATUS as any)[task.status === 'Done' ? 'complete' : task.status === 'In progress' ? 'progress' : 'none'].bg, color: (STATUS as any)[task.status === 'Done' ? 'complete' : task.status === 'In progress' ? 'progress' : 'none'].c, fontSize: 10.5, fontWeight: 700 }}>
                      {task.status || 'Not started'}
                    </span>
                    {pr ? (
                      <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', height: 20, padding: '0 9px', borderRadius: 999, background: pr.bg, color: pr.c, fontSize: 10.5, fontWeight: 700 }}>{task.priority}</span>
                    ) : <span style={{ fontSize: 11, color: '#C9C2D1' }}>—</span>}
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: late ? '#B4232A' : '#8A8194' }}>{task.dueDate || '—'}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8194', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.name}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
        {!filtered.length && <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 12.5, color: '#8A8194' }}>No tasks match the current filters.</div>}
      </div>
    </div>
  );
}

const parseDate = (s?: string | null) => (s ? new Date(s + 'T00:00:00') : null);
const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

/** A read-only Gantt: rows grouped by phase, bars from Start Date to Due Date. */
function TimelineView({ stages, filtered, onOpen, isDone }: {
  stages: any[];
  filtered: { task: ProjectTask; stage: any }[];
  onOpen: (id: string) => void;
  isDone: (t: ProjectTask) => boolean;
}) {
  const dayWidth = 28;
  const rowHeight = 32;

  const ranges = filtered.map(({ task, stage }) => {
    const due = parseDate(task.dueDate);
    const start = parseDate(task.startDate);
    if (!due && !start) return { task, stage, start: null as Date | null, end: null as Date | null };
    const s = start || due!;
    const e = due || start!;
    return { task, stage, start: s <= e ? s : e, end: e >= s ? e : s };
  });
  const dated = ranges.filter((r): r is { task: ProjectTask; stage: any; start: Date; end: Date } => !!r.start && !!r.end);
  const undatedCount = ranges.length - dated.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let rangeStart = new Date(today); rangeStart.setDate(rangeStart.getDate() - 14);
  let rangeEnd = new Date(today); rangeEnd.setDate(rangeEnd.getDate() + 28);
  dated.forEach((r) => {
    if (r.start < rangeStart) rangeStart = new Date(r.start);
    if (r.end > rangeEnd) rangeEnd = new Date(r.end);
  });
  const days: Date[] = [];
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  const dayIndex = (d: Date) => Math.round((d.getTime() - rangeStart.getTime()) / 86400000);
  const todayX = dayIndex(today) * dayWidth;

  const byStage = stages.map((s) => ({ stage: s, rows: dated.filter((r) => r.stage.key === s.key) }));

  return (
    <div style={{ padding: '18px 26px 28px', background: '#fff' }}>
      {undatedCount > 0 && (
        <div style={{ fontSize: 11.5, color: '#9c96a4', marginBottom: 10 }}>{undatedCount} task{undatedCount === 1 ? '' : 's'} with no dates aren't shown on the chart.</div>
      )}
      <div style={{ display: 'flex', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid rgba(20,8,31,.08)' }}>
          <div style={{ height: 36, borderBottom: '1px solid rgba(20,8,31,.08)', background: '#F7F3EA' }} />
          {byStage.map(({ stage, rows }) => (
            <div key={stage.key}>
              <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', background: '#FBF8F2', fontSize: 11, fontWeight: 700, color: INK }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: stage.colors?.dot || ACCENT }} />
                {stage.name}
              </div>
              {rows.map((r) => (
                <div key={r.task.id} onClick={() => onOpen(r.task.id)} style={{ height: rowHeight, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12, color: INK, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderTop: '1px solid rgba(20,8,31,.04)' }}>
                  {r.task.title}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <div style={{ position: 'relative', width: days.length * dayWidth }}>
            <div style={{ display: 'flex', height: 36, borderBottom: '1px solid rgba(20,8,31,.08)', background: '#F7F3EA' }}>
              {days.map((d) => (
                <div key={fmtDay(d)} style={{ width: dayWidth, flexShrink: 0, textAlign: 'center', fontSize: 9, color: '#9c96a4', paddingTop: 4, borderRight: '1px solid rgba(20,8,31,.04)' }}>
                  {d.getDate() === 1 || d.getDay() === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.getDate()}
                </div>
              ))}
            </div>
            {byStage.map(({ stage, rows }) => (
              <div key={stage.key}>
                <div style={{ height: 28, background: '#FBF8F2', borderBottom: '1px solid rgba(20,8,31,.03)' }} />
                {rows.map((r) => {
                  const x = dayIndex(r.start) * dayWidth;
                  const w = Math.max(dayWidth, (dayIndex(r.end) - dayIndex(r.start) + 1) * dayWidth);
                  return (
                    <div key={r.task.id} style={{ position: 'relative', height: rowHeight, borderTop: '1px solid rgba(20,8,31,.04)' }}>
                      <div
                        onClick={() => onOpen(r.task.id)}
                        title={r.task.title}
                        style={{
                          position: 'absolute', left: x, width: w, top: 6, height: rowHeight - 12, borderRadius: 6, cursor: 'pointer',
                          background: isDone(r.task) ? '#16A34A' : stage.colors?.dot || ACCENT, opacity: isDone(r.task) ? 0.85 : 1,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: todayX + dayWidth / 2, width: 1, background: '#B4232A' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stat tiles + section/status bar charts, same div-bar technique used across the app. */
function DashboardView({ filtered, shownPhases, isDone, isProgress, isLate }: {
  filtered: { task: ProjectTask; stage: any }[];
  shownPhases: any[];
  isDone: (t: ProjectTask) => boolean;
  isProgress: (t: ProjectTask) => boolean;
  isLate: (t: ProjectTask) => boolean;
}) {
  const total = filtered.length;
  const done = filtered.filter((r) => isDone(r.task)).length;
  const overdue = filtered.filter((r) => isLate(r.task)).length;
  const incomplete = total - done;

  const tiles = [
    { label: 'Total tasks', value: total, c: INK },
    { label: 'Completed', value: done, c: '#16A34A' },
    { label: 'Incomplete', value: incomplete, c: ACCENT },
    { label: 'Overdue', value: overdue, c: '#B4232A' },
  ];

  const byPhase = shownPhases.map((s) => ({ name: s.name, dot: s.colors?.dot || ACCENT, count: filtered.filter((r) => r.stage.key === s.key).length }));
  const maxPhase = Math.max(1, ...byPhase.map((b) => b.count));

  const statusGroups = [
    { label: 'Not started', dot: '#C9BFA8', count: filtered.filter((r) => !isDone(r.task) && !isProgress(r.task)).length },
    { label: 'In progress', dot: ACCENT, count: filtered.filter((r) => isProgress(r.task)).length },
    { label: 'Done', dot: '#16A34A', count: done },
  ];
  const maxStatus = Math.max(1, ...statusGroups.map((s) => s.count));

  return (
    <div style={{ padding: '18px 26px 28px', background: '#fff' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 22 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ border: '1px solid rgba(20,8,31,.08)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>{t.label}</div>
            <div style={{ fontFamily: HEADING, fontWeight: 700, fontSize: 30, color: t.c, marginTop: 6 }}>{t.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <div style={{ border: '1px solid rgba(20,8,31,.08)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 12 }}>Tasks by phase</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byPhase.map((b) => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 88, fontSize: 11, color: '#4A4357', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{b.name}</span>
                <div style={{ flex: 1, height: 10, background: '#F0EEE9', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${(b.count / maxPhase) * 100}%`, height: '100%', background: b.dot, borderRadius: 999 }} />
                </div>
                <span style={{ width: 20, fontSize: 11, fontWeight: 700, color: INK, textAlign: 'right' }}>{b.count}</span>
              </div>
            ))}
            {!byPhase.length && <div style={{ fontSize: 11.5, color: '#9c96a4' }}>No phases to show.</div>}
          </div>
        </div>
        <div style={{ border: '1px solid rgba(20,8,31,.08)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 12 }}>Tasks by status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {statusGroups.map((b) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 88, fontSize: 11, color: '#4A4357', flexShrink: 0 }}>{b.label}</span>
                <div style={{ flex: 1, height: 10, background: '#F0EEE9', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${(b.count / maxStatus) * 100}%`, height: '100%', background: b.dot, borderRadius: 999 }} />
                </div>
                <span style={{ width: 20, fontSize: 11, fontWeight: 700, color: INK, textAlign: 'right' }}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: ACCENT, fontWeight: 700, fontSize: 13, marginBottom: 18 }}>
      <span style={{ fontSize: 16 }}>←</span>
      <span>{label}</span>
    </div>
  );
}
