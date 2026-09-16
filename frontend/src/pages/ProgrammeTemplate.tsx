import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { PROJECT_TYPES, PROJECT_TYPE_GROUPS, projectTypeLabel } from '../data/projectTypes';

const BG = "'Bricolage Grotesque', serif";

export interface TemplateTask { id: string; title: string; team: string; labels: string[]; days?: number }
export interface TemplatePhase { key: string; name: string; color: string; gated?: boolean; dependsOn?: string[]; weeks?: number; tasks: TemplateTask[] }

/**
 * Not a person: marks work meant to run by itself. Everything else in the list
 * is a real role from the roles table, so what a task is assigned to is always
 * something a person can actually hold.
 */
const AUTOMATION = 'Automation';
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
interface LibraryEntry { key: string; name: string; phases: TemplatePhase[]; projectTypes?: string[]; category?: 'design' | 'construction' }

export function ProgrammeTemplate() {
  const { toast } = useApp();
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [categoryTab, setCategoryTab] = useState<'design' | 'construction'>('design');
  const [activeKey, setActiveKey] = useState('');
  const [phases, setPhases] = useState<TemplatePhase[]>([]);
  const [projectTypes, setProjectTypes] = useState<string[]>([]);
  const [typesOpen, setTypesOpen] = useState(false);
  const [teams, setTeams] = useState<string[]>([]);
  const [openPhase, setOpenPhase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = (preferredKey?: string) => api.programmeTemplate.list()
    .then((res: any) => {
      const lib: LibraryEntry[] = Array.isArray(res) ? res : [];
      setLibrary(lib);
      const active = lib.find((t) => t.key === (preferredKey ?? activeKey)) || lib[0];
      setActiveKey(active?.key || '');
      setPhases(active?.phases || []);
      setProjectTypes(active?.projectTypes || []);
      setOpenPhase(active?.phases?.[0]?.key ?? null);
      setDirty(false);
    })
    .catch((e: Error) => setError(e.message))
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // Roles are the source of truth for who work can be given to.
    api.roles.list()
      .then((res: any) => {
        if (!Array.isArray(res)) return;
        setTeams([...res.filter((r: any) => r.tier === 'internal').map((r: any) => r.name as string), AUTOMATION]);
      })
      .catch(() => setTeams([AUTOMATION]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeName = library.find((t) => t.key === activeKey)?.name || 'Template';
  const activeCategory = library.find((t) => t.key === activeKey)?.category || 'design';
  const visibleLibrary = library.filter((t) => (t.category || 'design') === categoryTab);

  const switchCategory = (next: 'design' | 'construction') => {
    if (next === categoryTab) return;
    if (dirty && !confirm('Switch sections? Unsaved changes to this template will be lost.')) return;
    setCategoryTab(next);
    const first = library.find((t) => (t.category || 'design') === next);
    setActiveKey(first?.key || '');
    setPhases(first?.phases || []);
    setProjectTypes(first?.projectTypes || []);
    setOpenPhase(first?.phases?.[0]?.key ?? null);
    setDirty(false);
    setError('');
  };

  const switchTo = (key: string) => {
    if (key === activeKey) return;
    if (dirty && !confirm('Switch templates? Unsaved changes to this one will be lost.')) return;
    const t = library.find((x) => x.key === key);
    if (!t) return;
    setActiveKey(key);
    setPhases(t.phases);
    setProjectTypes(t.projectTypes || []);
    setOpenPhase(t.phases[0]?.key ?? null);
    setDirty(false);
    setError('');
  };

  const newTemplate = (duplicate: boolean) => {
    const name = (prompt(duplicate ? `Name for the copy of "${activeName}":` : 'Name this template:') || '').trim();
    if (!name) return;
    const basePhases = duplicate ? phases : [{ key: 'kickoff', name: 'Kickoff', color: COLORS[0], tasks: [] }];
    setSaving(true);
    setError('');
    api.programmeTemplate.save(undefined, name, basePhases, undefined, categoryTab)
      .then((res: any) => { toast(`Created "${name}"`); return load(res?.key); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const renameTemplate = () => {
    const name = (prompt('Rename this template:', activeName) || '').trim();
    if (!name || name === activeName) return;
    setSaving(true);
    setError('');
    api.programmeTemplate.save(activeKey, name, phases, projectTypes, activeCategory)
      .then(() => { toast('Renamed'); return load(activeKey); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const deleteTemplate = () => {
    if (library.length <= 1) { toast('At least one template must remain'); return; }
    if (!confirm(`Delete the "${activeName}" template? Any project using it falls back to another.`)) return;
    setSaving(true);
    setError('');
    api.programmeTemplate.remove(activeKey)
      .then(() => { toast('Deleted'); return load(); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

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
    api.programmeTemplate.save(activeKey, activeName, phases.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.title.trim()) })), projectTypes, activeCategory)
      .then(() => { toast(`"${activeName}" saved`); return load(activeKey); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Programme Templates</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 660, lineHeight: 1.6 }}>
          The phases and tasks a project starts from — a kitchen remodel and a ground-up build don't need the same shape.
          Every project picks one when it's created. "{activeName}" has {phases.length} phases, {totalTasks} tasks.
          Editing here changes what a project built from it gets next; a project already running keeps what it has,
          except that a phase added here also appears on it.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999, marginBottom: 12, width: 'fit-content' }}>
        {(['design', 'construction'] as const).map((c) => (
          <div
            key={c}
            onClick={() => switchCategory(c)}
            style={{ padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: categoryTab === c ? 'white' : 'transparent', color: categoryTab === c ? '#0B1A12' : '#7E9B93', boxShadow: categoryTab === c ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}
          >{c === 'design' ? 'Design' : 'Construction'}</div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {visibleLibrary.length === 0 && (
          <div style={{ fontSize: 12, color: '#9AA39D', padding: '7px 4px' }}>No {categoryTab === 'design' ? 'Design' : 'Construction'} templates yet.</div>
        )}
        {visibleLibrary.map((t) => (
          <div
            key={t.key}
            onClick={() => switchTo(t.key)}
            style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: t.key === activeKey ? '#173326' : 'white', color: t.key === activeKey ? 'white' : '#7E9B93', border: '1px solid ' + (t.key === activeKey ? '#173326' : 'rgba(20,8,31,0.08)') }}
          >{t.name}</div>
        ))}
        <div onClick={() => newTemplate(false)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px dashed rgba(20,8,31,0.2)', color: '#173326', whiteSpace: 'nowrap' }}>+ New template</div>
        <div style={{ flex: 1 }} />
        {activeKey && <div onClick={() => newTemplate(true)} style={{ fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer', whiteSpace: 'nowrap' }}>Duplicate</div>}
        {activeKey && <div onClick={renameTemplate} style={{ fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer', whiteSpace: 'nowrap' }}>Rename</div>}
        {activeKey && <div onClick={deleteTemplate} style={{ fontSize: 11.5, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer', whiteSpace: 'nowrap' }}>Delete</div>}
      </div>

      {activeKey && (
      <>
      <div style={{ position: 'relative', marginBottom: 18, maxWidth: 420 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Potential Project Type</div>
        <div
          onClick={() => setTypesOpen((v) => !v)}
          style={{ ...input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', minHeight: 34 }}
        >
          <span style={{ color: projectTypes.length ? '#0B1A12' : '#9AA39D' }}>
            {projectTypes.length ? `${projectTypes.length} type${projectTypes.length === 1 ? '' : 's'} selected` : 'Not tied to a project type yet'}
          </span>
          <span style={{ fontSize: 9, color: '#9AA39D', transform: typesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
        </div>
        {typesOpen && (
          <>
            <div onClick={() => setTypesOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid rgba(20,8,31,0.12)', borderRadius: 10, boxShadow: '0 12px 30px rgba(20,8,31,0.14)', maxHeight: 340, overflowY: 'auto', zIndex: 10, padding: 10 }}>
              <div style={{ fontSize: 10.5, color: '#9AA39D', marginBottom: 8, lineHeight: 1.5 }}>
                Which project types "{activeName}" is built for — a kitchen remodel skips steps a ground-up build needs. Duplicate this template and pick a different set to make a type-specific variant.
              </div>
              {PROJECT_TYPE_GROUPS.map((g) => (
                <div key={g} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{g}</div>
                  {PROJECT_TYPES.filter((t) => t.group === g).map((t) => {
                    const label = projectTypeLabel(t);
                    const on = projectTypes.includes(label);
                    return (
                      <label key={t.code} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 2px', fontSize: 12, color: '#0B1A12', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => { setProjectTypes((prev) => (on ? prev.filter((x) => x !== label) : [...prev, label])); setDirty(true); }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
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
                <label title="How long this phase is expected to take. It sets the projected week range on every project's Phase Board." style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#7E9B93', flexShrink: 0 }}>
                  <input
                    type="number"
                    min={0}
                    value={phase.weeks ?? ''}
                    onChange={(e) => patchPhase(phase.key, { weeks: e.target.value === '' ? 0 : Number(e.target.value) })}
                    placeholder="0"
                    style={{ ...input, width: 52, textAlign: 'right' }}
                  />
                  wks
                </label>
                <label
                  title={i === 0
                    ? 'The first phase has nothing before it, so it can never be locked.'
                    : `Keep ${phase.name} locked on the Phase Board until the last task of the phase before it is done. Its tasks stay visible either way.`}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, flexShrink: 0, color: i === 0 ? '#C9CDC9' : '#7E9B93', cursor: i === 0 ? 'default' : 'pointer' }}
                >
                  <input
                    type="checkbox"
                    disabled={i === 0}
                    checked={!!phase.gated && i > 0}
                    onChange={(e) => patchPhase(phase.key, { gated: e.target.checked })}
                    style={{ accentColor: '#173326', cursor: i === 0 ? 'default' : 'pointer' }}
                  />
                  Locks
                </label>
                <span onClick={() => movePhase(i, -1)} title="Move up" style={{ cursor: 'pointer', color: i ? '#7E9B93' : '#DDD', fontSize: 13, flexShrink: 0 }}>↑</span>
                <span onClick={() => movePhase(i, 1)} title="Move down" style={{ cursor: 'pointer', color: i < phases.length - 1 ? '#7E9B93' : '#DDD', fontSize: 13, flexShrink: 0 }}>↓</span>
                <span
                  onClick={() => { if (confirm(`Remove the ${phase.name} phase from the template?`)) edit(phases.filter((p) => p.key !== phase.key)); }}
                  style={{ cursor: 'pointer', color: '#8E2E0A', fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                >Remove</span>
              </div>

              {open && (
                <div style={{ padding: '6px 12px 12px' }}>
                  {phases.length > 1 && (
                    <div style={{ marginBottom: 12, padding: '9px 11px', background: '#FBF8F2', borderRadius: 9 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Depends on</div>
                      <div style={{ fontSize: 10.5, color: '#9AA39D', marginBottom: 7, lineHeight: 1.5 }}>
                        Waits for these phases' last task before it can start — pick more than one for phases that run in parallel off the same predecessor.
                        {!phase.dependsOn?.length && <> Nothing picked, so it falls back to the "Locks" checkbox above (the phase right before it).</>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {phases.filter((p) => p.key !== phase.key).map((p) => {
                          const on = !!phase.dependsOn?.includes(p.key);
                          return (
                            <span
                              key={p.key}
                              onClick={() => patchPhase(phase.key, { dependsOn: on ? (phase.dependsOn || []).filter((k) => k !== p.key) : [...(phase.dependsOn || []), p.key] })}
                              style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', userSelect: 'none', border: '1px solid ' + (on ? '#2F7D4A' : 'rgba(20,8,31,0.1)'), background: on ? '#D2EAD3' : 'white', color: on ? '#173326' : '#43514D', fontWeight: on ? 700 : 400 }}
                            >{p.name}</span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {phase.tasks.length === 0 && (
                    <div style={{ padding: '12px 4px', fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No tasks in this phase yet.</div>
                  )}
                  {phase.tasks.map((task, ti) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderTop: ti ? '1px solid rgba(20,8,31,0.04)' : 'none' }}>
                      <span style={{ width: 20, fontSize: 10.5, color: '#9AA39D', flexShrink: 0 }}>{ti + 1}</span>
                      <input value={task.title} onChange={(e) => patchTask(phase.key, task.id, { title: e.target.value })} placeholder="Task title" style={{ ...input, flex: 1 }} />
                      <select value={task.team} onChange={(e) => patchTask(phase.key, task.id, { team: e.target.value })} style={{ ...input, width: 132, flexShrink: 0, ...(TEAM_TONE[task.team] ? { background: TEAM_TONE[task.team].bg, color: TEAM_TONE[task.team].c, fontWeight: 600 } : {}) }}>
                        <option value="">No team</option>
                        {/* Keep a value the roles list no longer offers, rather than losing it. */}
                        {task.team && !teams.includes(task.team) && <option value={task.team}>{task.team} (not a current role)</option>}
                        {teams.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <select
                        value={task.labels[0] || ''}
                        onChange={(e) => patchTask(phase.key, task.id, { labels: e.target.value ? [e.target.value] : [] })}
                        style={{ ...input, width: 106, flexShrink: 0 }}
                      >
                        <option value="">No tag</option>
                        {LABELS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={task.days || ''}
                        onChange={(e) => patchTask(phase.key, task.id, { days: e.target.value === '' ? 0 : Number(e.target.value) })}
                        placeholder="d"
                        title="Working days this task should take. Left blank, the phase's week estimate is split evenly across its tasks."
                        style={{ ...input, width: 46, flexShrink: 0, textAlign: 'right' }}
                      />
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
        {dirty && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#93520F' }}>Unsaved changes</span>}
      </div>
      </>)}
    </div>
  );
}
