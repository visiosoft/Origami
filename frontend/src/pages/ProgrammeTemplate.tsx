import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const BG = "'Bricolage Grotesque', serif";

export interface TemplateTask { id: string; title: string; team: string; labels: string[] }
export interface TemplatePhase { key: string; name: string; color: string; tasks: TemplateTask[] }

const TEAMS = ['Admin', 'Project Manager', 'Architect', 'Drafting', 'Estimator', 'Accounting', 'Client', 'Permits & Compliance', 'Automation', 'Interior Design', 'Construction'];
const LABELS = ['Deliverable', 'Approval', 'Auto', 'Milestone'];

/** Same palette the phase columns use. */
const COLORS = ['#0E5A8A', '#0F7C7C', '#6B2FA0', '#C77A0A', '#A81E4D', '#145C33', '#8E2E0A', '#2F6FB0'];

const TEAM_TONE: Record<string, { bg: string; c: string }> = {
  Admin: { bg: '#F2DFD4', c: '#8E2E0A' },
  'Project Manager': { bg: '#F7DCE4', c: '#A81E4D' },
  Architect: { bg: '#FBE0CC', c: '#93520F' },
  Drafting: { bg: '#E7E0F5', c: '#6B2FA0' },
  Estimator: { bg: '#D2EAD3', c: '#1C5230' },
  Accounting: { bg: '#E8DDF2', c: '#6B2FA0' },
  Client: { bg: '#D6E8E5', c: '#2F6F68' },
};

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'phase';

/**
 * Settings → Programme Template.
 *
 * The phases and tasks every new project starts from. Editing here changes what
 * the next project is built with; projects already running keep what they have,
 * except that a newly added phase appears on them too.
 */
export function ProgrammeTemplate() {
  const { toast } = useApp();
  const [phases, setPhases] = useState<TemplatePhase[]>([]);
  const [openPhase, setOpenPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = () => api.programmeTemplate.get()
    .then((res: any) => { setPhases(res as TemplatePhase[]); setOpenPhase((res as TemplatePhase[])[0]?.key ?? null); })
    .catch((e: Error) => setError(e.message))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const edit = (next: TemplatePhase[]) => { setPhases(next); setDirty(true); };
  const patchPhase = (key: string, patch: Partial<TemplatePhase>) =>
    edit(phases.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const patchTask = (key: string, id: string, patch: Partial<TemplateTask>) =>
    patchPhase(key, { tasks: (phases.find((p) => p.key === key)?.tasks || []).map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  const movePhase = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= phases.length) return;
    const next = [...phases];
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  };

  const moveTask = (key: string, i: number, by: number) => {
    const tasks = [...(phases.find((p) => p.key === key)?.tasks || [])];
    const j = i + by;
    if (j < 0 || j >= tasks.length) return;
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
    patchPhase(key, { tasks });
  };

  const addPhase = () => {
    const name = 'New Phase';
    // Keys must stay unique: they are how a project's phases match the template.
    let key = slug(name);
    let n = 2;
    while (phases.some((p) => p.key === key)) key = `${slug(name)}-${n++}`;
    edit([...phases, { key, name, color: COLORS[phases.length % COLORS.length], tasks: [] }]);
    setOpenPhase(key);
  };

  const addTask = (key: string) => {
    const tasks = phases.find((p) => p.key === key)?.tasks || [];
    patchPhase(key, { tasks: [...tasks, { id: `${key}-${Date.now().toString(36)}`, title: '', team: '', labels: [] }] });
  };

  const save = () => {
    const bad = phases.find((p) => !p.name.trim());
    if (bad) { setError('Every phase needs a name.'); return; }
    setSaving(true);
    setError('');
    api.programmeTemplate.save(phases.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.title.trim()) })))
      .then(() => { toast('Programme template saved'); setDirty(false); return load(); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const restore = () => {
    if (!confirm('Replace the template with the shipped default? Projects already running keep what they have.')) return;
    setSaving(true);
    api.programmeTemplate.reset()
      .then(() => { toast('Template restored to the default'); setDirty(false); return load(); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Programme Template</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 660, lineHeight: 1.6 }}>
          The phases and tasks every new project starts from — {phases.length} phases, {totalTasks} tasks. Editing here
          changes what the next project is built with. Projects already running keep what they have, except that a phase
          added here also appears on them.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {phases.map((phase, i) => {
          const open = openPhase === phase.key;
          return (
            <div key={phase.key} style={{ border: '1px solid rgba(20,8,31,0.08)', borderRadius: 11, background: 'white', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderTop: `3px solid ${phase.color}`, background: open ? '#F7F9F7' : 'white' }}>
                <span onClick={() => setOpenPhase(open ? null : phase.key)} style={{ fontSize: 9, color: '#9AA39D', cursor: 'pointer', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                <input
                  value={phase.name}
                  onChange={(e) => patchPhase(phase.key, { name: e.target.value })}
                  style={{ ...input, flex: 1, fontWeight: 700, border: '1px solid transparent', background: 'transparent' }}
                />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', flexShrink: 0 }}>{phase.tasks.length} tasks</span>
                <select value={phase.color} onChange={(e) => patchPhase(phase.key, { color: e.target.value })} style={{ ...input, width: 74, flexShrink: 0 }}>
                  {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <span onClick={() => movePhase(i, -1)} title="Move up" style={{ cursor: 'pointer', color: i ? '#7E9B93' : '#DDD', fontSize: 13, flexShrink: 0 }}>↑</span>
                <span onClick={() => movePhase(i, 1)} title="Move down" style={{ cursor: 'pointer', color: i < phases.length - 1 ? '#7E9B93' : '#DDD', fontSize: 13, flexShrink: 0 }}>↓</span>
                <span
                  onClick={() => { if (confirm(`Remove the ${phase.name} phase from the template?`)) edit(phases.filter((p) => p.key !== phase.key)); }}
                  style={{ cursor: 'pointer', color: '#8E2E0A', fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                >Remove</span>
              </div>

              {open && (
                <div style={{ padding: '6px 12px 12px' }}>
                  {phase.tasks.length === 0 && (
                    <div style={{ padding: '12px 4px', fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No tasks in this phase yet.</div>
                  )}
                  {phase.tasks.map((task, ti) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderTop: ti ? '1px solid rgba(20,8,31,0.04)' : 'none' }}>
                      <span style={{ width: 20, fontSize: 10.5, color: '#9AA39D', flexShrink: 0 }}>{ti + 1}</span>
                      <input value={task.title} onChange={(e) => patchTask(phase.key, task.id, { title: e.target.value })} placeholder="Task title" style={{ ...input, flex: 1 }} />
                      <select value={task.team} onChange={(e) => patchTask(phase.key, task.id, { team: e.target.value })} style={{ ...input, width: 132, flexShrink: 0, ...(TEAM_TONE[task.team] ? { background: TEAM_TONE[task.team].bg, color: TEAM_TONE[task.team].c, fontWeight: 600 } : {}) }}>
                        <option value="">No team</option>
                        {TEAMS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <select
                        value={task.labels[0] || ''}
                        onChange={(e) => patchTask(phase.key, task.id, { labels: e.target.value ? [e.target.value] : [] })}
                        style={{ ...input, width: 106, flexShrink: 0 }}
                      >
                        <option value="">No tag</option>
                        {LABELS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                      <span onClick={() => moveTask(phase.key, ti, -1)} style={{ cursor: 'pointer', color: ti ? '#7E9B93' : '#DDD', fontSize: 12, flexShrink: 0 }}>↑</span>
                      <span onClick={() => moveTask(phase.key, ti, 1)} style={{ cursor: 'pointer', color: ti < phase.tasks.length - 1 ? '#7E9B93' : '#DDD', fontSize: 12, flexShrink: 0 }}>↓</span>
                      <span onClick={() => patchPhase(phase.key, { tasks: phase.tasks.filter((t) => t.id !== task.id) })} style={{ cursor: 'pointer', color: '#8E2E0A', fontSize: 14, flexShrink: 0 }}>×</span>
                    </div>
                  ))}
                  <div onClick={() => addTask(phase.key)} style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>+ Add task</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div onClick={addPhase} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326' }}>+ Add phase</div>
        <div onClick={saving ? undefined : save} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>
          {saving ? 'Saving…' : 'Save template'}
        </div>
        <div onClick={restore} style={{ padding: '10px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#8E2E0A' }}>Restore default</div>
        {dirty && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#93520F' }}>Unsaved changes</span>}
      </div>
    </div>
  );
}
