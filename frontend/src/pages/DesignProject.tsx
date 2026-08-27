import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { ProjectTask } from '../data/projectTasks';

const HEADING = "'Bricolage Grotesque', serif";

/** Tokens from the design handoff. */
const INK = '#14081F';
const INK2 = '#4A4357';
const INK3 = '#756E80';
const MUTED = '#9c96a4';
const PAPER = '#FBF8F2';
const ACCENT = '#5B2BC9';
const ACCENT_BG = '#F7F3FF';
const SAND = '#EDE3CF';
const CARD_BORDER = '1px solid rgba(20,8,31,.06)';
const CARD_SHADOW = '0 1px 2px rgba(20,8,31,.05)';

/** Per-stage dot/bar and checked-text colours, per the handoff. */
const STAGE_COLORS: Record<string, { dot: string; text: string }> = {
  programming: { dot: '#2f6fb0', text: '#2f5f9e' },
  schematic: { dot: '#1f8a72', text: '#2f7a52' },
  dd: { dot: '#6b3fa0', text: '#6b46c1' },
  closeout: { dot: '#1f8a72', text: '#2f7a52' },
};

/** Header band colour by contract type, per the handoff. */
const HEADER_COLORS: Record<string, string> = {
  'Design + Build': '#16281f',
  'T&M': '#b8763a',
  Build: '#2f6b5e',
  Consulting: '#1f5f66',
};

const PRIORITY: Record<string, { bg: string; c: string }> = {
  High: { bg: '#f4d9d9', c: '#a13636' },
  Medium: { bg: '#f4e6cf', c: '#8a5a1e' },
  Low: { bg: '#d9efe4', c: '#1f7a52' },
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

const labelStyle: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED,
};

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
  const { toast, can } = useApp();
  const canManage = can('projects', 'manage');

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [layout, setLayout] = useState<'cards' | 'timeline'>('cards');
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
        setActiveStage(list.some((ph) => ph.key === wanted) ? wanted! : list[0]?.key ?? null);
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

  const active = stages.find((s) => s.key === activeStage) ?? null;

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
        <BackLink onClick={() => navigate('/design')} />
        <div style={{ marginTop: 20, fontSize: 13, color: '#8E2E0A' }}>{error || 'Project not found.'}</div>
      </div>
    );
  }

  const headerColor = HEADER_COLORS[project.contractType] || '#16281f';
  const pr = PRIORITY[project.priority];

  const checkMark = (checked: boolean, size: number, dot: string) => (
    <span style={{
      width: size, height: size, borderRadius: 999, flex: '0 0 auto',
      background: checked ? dot : 'transparent',
      border: `1.5px solid ${checked ? dot : 'rgba(20,8,31,.22)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </span>
  );

  return (
    <div style={{ background: PAPER, minHeight: '100%', padding: '32px 36px 60px' }}>
      <BackLink onClick={() => navigate('/design')} />

      <h1 style={{ fontFamily: HEADING, fontWeight: 700, fontSize: 26, color: INK, margin: 0 }}>{project.name}</h1>
      <p style={{ margin: '6px 0 22px', fontSize: 14, color: INK3 }}>
        {project.location || '—'} · {project.contractAmt || '—'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {stages.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                onClick={() => setActiveStage(s.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  color: s.key === activeStage ? INK : s.complete ? '#1f8a72' : MUTED,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, background: s.complete ? '#1f8a72' : SAND, color: s.complete ? '#fff' : INK3,
                }}>{s.complete ? '✓' : ''}</span>
                {s.name}
              </span>
              {i < stages.length - 1 && <span style={{ color: '#c9c2d1' }}>›</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: SAND, borderRadius: 999, padding: 3 }}>
          {(['cards', 'timeline'] as const).map((l) => (
            <span
              key={l}
              onClick={() => setLayout(l)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: layout === l ? '#fff' : 'transparent',
                color: layout === l ? INK : MUTED,
                boxShadow: layout === l ? '0 1px 2px rgba(20,8,31,.1)' : 'none',
              }}
            >{l === 'cards' ? 'Cards' : 'Timeline'}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(340px, 560px)', gap: 20, alignItems: 'start' }}>
        {/* Project overview */}
        <div style={{ background: '#fff', borderRadius: 18, border: CARD_BORDER, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
          <div style={{ background: headerColor, padding: '16px 18px', position: 'relative' }}>
            {pr && (
              <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', padding: '3px 8px', borderRadius: 999, background: pr.bg, color: pr.c }}>
                {project.priority.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.92)' }}>{project.contractType || 'Project'}</span>
          </div>
          <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {project.typeOfWork && (
              <div>
                <div style={labelStyle}>Category</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 3 }}>{project.typeOfWork}</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Detail label="Budget" value={project.contractAmt || '—'} big />
              <Detail label="Location" value={project.location || '—'} />
              <Detail label="Est. Start" value={project.estStart || '—'} />
              <Detail label="Duration" value={project.duration || '—'} />
            </div>
            {project.scope && (
              <div style={{ background: ACCENT_BG, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: INK2, lineHeight: 1.45 }}>
                {project.scope}
              </div>
            )}
            {project.referral && (
              <div style={{ fontSize: 12, color: INK3, borderTop: '1px solid rgba(20,8,31,.08)', paddingTop: 12 }}>
                Ref: {project.referral}
              </div>
            )}
          </div>
        </div>

        {/* Checklist */}
        {active ? (
          <div style={{ background: '#fff', borderRadius: 18, border: CARD_BORDER, padding: '20px 20px 22px', boxShadow: CARD_SHADOW }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: 15, color: INK }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: active.colors.dot }} />
                {active.name}
              </span>
              <span style={{ width: 26, height: 26, borderRadius: 999, background: '#F0EEE9', color: INK3, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                {active.items.length}
              </span>
            </div>

            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: active.status.bg, color: active.status.c }}>
                {active.status.label}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 999, background: SAND, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${active.percent}%`, background: active.percent === 100 ? '#1f8a72' : active.colors.dot, borderRadius: 999, transition: 'width .2s' }} />
              </div>
              <span style={{ fontSize: 12, color: MUTED, flex: '0 0 auto' }}>{active.percent}%</span>
            </div>

            {active.items.length === 0 ? (
              <div style={{ marginTop: 18, padding: '22px 14px', textAlign: 'center', fontSize: 12.5, color: MUTED, background: '#F7F5F0', borderRadius: 12 }}>
                No tasks in {active.name} yet. Add them on the project's Phase Board.
              </div>
            ) : layout === 'cards' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                {active.items.map((task) => {
                  const checked = !!(task.completed || task.status === 'Done');
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggle(task)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 999,
                        cursor: canManage ? 'pointer' : 'default',
                        background: checked ? '#dcf2e4' : '#F3F0EA',
                        transition: 'background .15s ease',
                      }}
                    >
                      {checkMark(checked, 20, active.colors.dot)}
                      <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: checked ? active.colors.text : '#5c5666' }}>
                        {task.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}>
                {active.items.map((task, idx) => {
                  const checked = !!(task.completed || task.status === 'Done');
                  return (
                    <div key={task.id} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flex: '0 0 auto' }}>
                        {checkMark(checked, 22, active.colors.dot)}
                        {idx !== active.items.length - 1 && (
                          <div style={{ width: 2, flex: 1, marginTop: 2, background: checked ? active.colors.dot : 'rgba(20,8,31,.12)' }} />
                        )}
                      </div>
                      <div onClick={() => toggle(task)} style={{ cursor: canManage ? 'pointer' : 'default', paddingBottom: 22 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: checked ? active.colors.text : '#5c5666' }}>
                          {task.title}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 18, border: CARD_BORDER, padding: 24, fontSize: 13, color: MUTED }}>
            This project has no design phases yet.
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: ACCENT, fontWeight: 700, fontSize: 13, marginBottom: 18 }}>
      <span style={{ fontSize: 16 }}>←</span>
      <span>Design &amp; Preconstruction</span>
    </div>
  );
}

function Detail({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: big ? 15 : 13, fontWeight: big ? 700 : 600, color: INK, marginTop: 3 }}>{value}</div>
    </div>
  );
}
