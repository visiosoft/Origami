import { useEffect, useMemo, useState } from 'react';
import { MapLink } from '../components/ContactLinks';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { PHASE_SCOPES } from '../data/projects';

const BG = "'Bricolage Grotesque', serif";

/** One project's progress through the design phases. */
interface PhaseProgress {
  id: string; key: string; name: string; color: string; order: number;
  /** Design, construction or other -- decided once, on the server, for every screen. */
  category?: 'design' | 'construction' | 'other';
  total: number; done: number; progress: number; complete: boolean;
}

interface DesignProject {
  projectId: number;
  name: string;
  stage: string;
  priority: string;
  contractAmt: string;
  location: string;
  typeOfWork: string;
  imgColor: string;
  contractType: string;
  estStart: string;
  duration: string;
  scope: string;
  referral: string;
  projectProgress: number;
  /** Which section of the Programme Template library the project's template is filed under. */
  templateCategory?: 'design' | 'construction';
  designPhase?: string;
  currentPhaseKey: string | null;
  phases: PhaseProgress[];
  taskTotal: number;
  taskDone: number;
  progress: number;
}

interface TemplatePhaseLite { key: string; name: string; color: string; order?: number }
interface LibraryEntryLite { key: string; name: string; phases: TemplatePhaseLite[]; category?: 'design' | 'construction' }

const PRIORITY_STYLE: Record<string, { bg: string; c: string }> = {
  High: { bg: '#F2DFD4', c: '#8E2E0A' },
  Medium: { bg: '#FBE9AE', c: '#93520F' },
  Low: { bg: '#D6E8E5', c: '#2F6F68' },
};

/**
 * Design & Preconstruction, as a board.
 *
 * Columns are the design phases and each card is a project, sitting in the
 * phase its work has actually reached — so the question "what is in schematic
 * right now" is answered by looking, rather than by opening every project.
 */
export function Design({ scope = 'design' }: { scope?: 'design' | 'construction' }) {
  const view = PHASE_SCOPES[scope] || PHASE_SCOPES.design;
  const navigate = useNavigate();
  const { toast, can } = useApp();
  const canManage = can('projects', 'manage');
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [rows, setRows] = useState<DesignProject[]>([]);
  const [templates, setTemplates] = useState<LibraryEntryLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.projectPhases.overview()
      .then((res: any) => { if (Array.isArray(res)) setRows(res as DesignProject[]); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    api.programmeTemplate.list()
      .then((res: any) => { if (Array.isArray(res)) setTemplates(res as LibraryEntryLite[]); })
      .catch(() => { });
  }, []);

  /** The Projects board's own coarse stage label for this scope -- "Design" or "Construction". */
  const stageLabel = scope === 'construction' ? 'Construction' : 'Design';
  const OTHER_COL = '__other';
  /** Projects the Projects board has moved past design -- they belong on the Construction board. */
  const inConstruction = (p: DesignProject) => p.stage === 'Construction' || p.stage === 'Closeout';

  /**
   * Which column a project sits in on this board, or null when it isn't on it.
   *
   * Design: a project that has moved on to construction never shows here, even
   * if design tasks were left unticked. Construction: a construction-stage
   * project whose derived phase is still a design one (nobody ticked the
   * design checklist) sits in its first unfinished construction phase instead.
   */
  function placeOn(p: DesignProject, keys: Set<string>): string | null {
    const pinned = p.designPhase && keys.has(p.designPhase) ? p.designPhase : null;
    if (scope !== 'construction') {
      if (inConstruction(p)) return null;
      if (p.currentPhaseKey && keys.has(p.currentPhaseKey)) return p.currentPhaseKey;
      return p.stage === stageLabel ? OTHER_COL : null;
    }
    if (pinned) return pinned;
    if (p.currentPhaseKey && keys.has(p.currentPhaseKey)) return p.currentPhaseKey;
    if (!inConstruction(p)) return null;
    const next = p.phases.find((ph) => ph.category === 'construction' && keys.has(ph.key) && !ph.complete);
    return next?.key ?? OTHER_COL;
  }

  // The Construction board's columns are the Construction-category template(s)'
  // own phases from the Library -- so a phase shows up here the moment it's
  // added to the template, not only once some project has already reached it.
  // The Design board keeps the legacy behaviour (derived from projects' own
  // phase rows): the Default template is filed under "design" but its phase
  // list spans the whole lifecycle, so treating all of its phases as Design
  // columns would be wrong.
  const columns = useMemo(() => {
    const seen = new Map<string, { key: string; name: string; color: string; order: number }>();
    if (scope === 'construction') {
      templates
        .filter((t) => (t.category || 'design') === 'construction')
        .forEach((t) => t.phases.forEach((ph, i) => {
          if (!seen.has(ph.key)) seen.set(ph.key, { key: ph.key, name: ph.name, color: ph.color, order: ph.order ?? i });
        }));
      // The lifecycle templates' own construction phases (GC selection, CA,
      // closeout) -- construction work even though the template is filed under Design.
      rows.forEach((p) => p.phases.forEach((ph) => {
        if (ph.category !== 'construction' || seen.has(ph.key)) return;
        seen.set(ph.key, { key: ph.key, name: ph.name, color: ph.color, order: ph.key === 'gc' ? -1 : 100 + ph.order });
      }));
    } else {
      rows.forEach((p) => p.phases.forEach((ph) => {
        if (!view.keys.includes(ph.key)) return;
        if (!seen.has(ph.key)) seen.set(ph.key, { key: ph.key, name: ph.name, color: ph.color, order: ph.order });
      }));
    }
    const known = [...seen.values()].sort((a, b) => a.order - b.order);
    // A project the Projects board already counts under this stage, but whose
    // current phase isn't one of the columns above (an older/other template's
    // phase, or none yet) -- still belongs on this board, so it gets a
    // catch-all column instead of silently disappearing and throwing the two
    // views' counts out of sync.
    const keySet = new Set(known.map((c) => c.key));
    const hasStragglers = rows.some((p) => placeOn(p, keySet) === OTHER_COL);
    if (hasStragglers) known.push({ key: OTHER_COL, name: 'Other Steps', color: '#9AA39D', order: Number.MAX_SAFE_INTEGER });
    return known;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, templates, view, scope, stageLabel]);

  const columnKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      p.name.toLowerCase().includes(q)
      || (p.location || '').toLowerCase().includes(q)
      || (p.typeOfWork || '').toLowerCase().includes(q));
  }, [rows, query]);

  // A project shows here if it's sitting in one of this board's phases, OR the
  // Projects board already counts it under this stage -- keeps the two boards'
  // counts in sync instead of a project quietly vanishing from both.
  const onBoard = useMemo(
    () => visible.filter((p) => placeOn(p, columnKeys) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, columnKeys, scope, stageLabel],
  );
  const planned = onBoard.filter((p) => p.taskTotal > 0).length;

  /**
   * Dragging pins a project to a phase, overriding the position derived from
   * task progress — the team's word on where it is beats the arithmetic.
   *
   * A project dropped onto a phase from a template it isn't already using
   * (e.g. any project dragged onto a Construction-only phase) gets that
   * phase -- and its template tasks -- created on the fly first, so the
   * checklist is there the moment you open it, not just an empty pin.
   */
  const moveTo = (projectId: number, phaseKey: string) => {
    const project = rows.find((p) => p.projectId === projectId);
    if (!project || placeOn(project, columnKeys) === phaseKey) return;
    const previous = project.currentPhaseKey;
    const previousPin = project.designPhase;
    const hasPhase = project.phases.some((ph) => ph.key === phaseKey);
    const col = columns.find((c) => c.key === phaseKey);

    setRows((prev) => prev.map((p) => (p.projectId === projectId ? { ...p, currentPhaseKey: phaseKey, designPhase: phaseKey } : p)));
    (hasPhase ? Promise.resolve() : api.projectPhases.adopt(projectId, phaseKey))
      .then(() => api.projects.update(String(projectId), { name: project.name, designPhase: phaseKey }))
      .then(() => {
        toast(`${project.name} moved to ${col?.name || phaseKey}`);
        if (!hasPhase) return api.projectPhases.overview().then((res: any) => { if (Array.isArray(res)) setRows(res as DesignProject[]); });
      })
      .catch((e: Error) => {
        setRows((prev) => prev.map((p) => (p.projectId === projectId ? { ...p, currentPhaseKey: previous, designPhase: previousPin } : p)));
        toast('⚠ ' + e.message);
      });
  };

  /** Stop pinning and let the card follow task progress again. */
  const clearPin = (projectId: number) => {
    const project = rows.find((p) => p.projectId === projectId);
    if (!project) return;
    api.projects.update(String(projectId), { name: project.name, designPhase: '' })
      .then(() => api.projectPhases.overview())
      .then((res: any) => { if (Array.isArray(res)) setRows(res as DesignProject[]); toast(`${project.name} follows task progress again`); })
      .catch((e: Error) => toast('⚠ ' + e.message));
  };

  const onDrop = (e: React.DragEvent, phaseKey: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    setDragId(null);
    if (Number.isFinite(id)) moveTo(id, phaseKey);
  };

  if (loading) return <div style={{ padding: 24, fontSize: 13, color: '#7E9B93' }}>Loading design board…</div>;

  return (
    <div style={{ padding: '18px 22px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: '#0B1A12' }}>{view.title}</div>
          <div style={{ fontSize: 11.5, color: '#9AA39D', marginTop: 2, maxWidth: 520, lineHeight: 1.5 }}>{view.blurb}</div>
          <div style={{ fontSize: 12, color: '#7E9B93', marginTop: 3 }}>
            {onBoard.length} project{onBoard.length === 1 ? '' : 's'} · {planned} with a programme
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          style={{ marginLeft: 'auto', width: 240, maxWidth: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' }}
        />
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', fontSize: 12.5, fontWeight: 600, color: '#8E2E0A', marginBottom: 14 }}>{error}</div>
      )}

      {columns.length === 0 ? (
        <div style={{ padding: '30px 20px', textAlign: 'center', fontSize: 13, color: '#9AA39D', background: '#FBF8F2', borderRadius: 12 }}>
          {scope === 'construction'
            ? 'No Construction template phases yet. Add them under Document & Template Library → Programme Template → Construction.'
            : "No design phases yet. Open a project's Phase Board to create them."}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', flex: 1, minHeight: 0, paddingBottom: 6 }}>
          {columns.map((col) => {
            const isOther = col.key === OTHER_COL;
            const cards = visible.filter((p) => placeOn(p, columnKeys) === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => { if (!canManage || isOther) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== col.key) setDragOver(col.key); }}
                onDragLeave={() => { if (dragOver === col.key) setDragOver(null); }}
                onDrop={(e) => { if (isOther) return; onDrop(e, col.key); }}
                style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', background: dragOver === col.key ? '#EEF3EE' : '#FBF8F2', borderRadius: 12, border: dragOver === col.key ? '2px dashed #7E9B93' : '1px solid rgba(20,8,31,0.04)', maxHeight: '100%', transition: 'background 0.15s, border 0.15s' }}
              >
                <div style={{ padding: '10px 12px 9px', borderTop: `3px solid ${col.color}`, borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottom: '1px solid rgba(20,8,31,0.06)', background: 'white', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: col.color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: col.color, background: 'rgba(20,8,31,0.05)', padding: '1px 7px', borderRadius: 999 }}>{cards.length}</span>
                  </div>
                </div>

                <div style={{ padding: 7, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cards.length === 0 && (
                    <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 11, color: '#B6BDB8' }}>No projects</div>
                  )}
                  {cards.map((p) => {
                    const phase = p.phases.find((ph) => ph.key === col.key);
                    const pr = PRIORITY_STYLE[p.priority] || { bg: '#EFEDE8', c: '#43514D' };
                    return (
                      <div
                        key={p.projectId}
                        draggable={canManage}
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(p.projectId)); e.dataTransfer.effectAllowed = 'move'; setDragId(p.projectId); }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onClick={() => navigate(`${scope === 'construction' ? '/pm' : '/design'}/${p.projectId}`)}
                        title={canManage ? `${p.name} — drag to move phase, click to open` : `${p.name} — open`}
                        style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.06)', overflow: 'hidden', cursor: canManage ? 'grab' : 'pointer', opacity: dragId === p.projectId ? 0.4 : 1 }}
                      >
                        {/* Same banner treatment as the Projects page card. */}
                        <div style={{ height: 66, background: `linear-gradient(135deg, ${p.imgColor || col.color}, ${(p.imgColor || col.color)}cc)`, position: 'relative' }}>
                          <span style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.9)', color: pr.c, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.priority}</span>
                          {p.contractType && (
                            <span style={{ position: 'absolute', bottom: 8, left: 8, padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,0.5)', color: 'white' }}>{p.contractType}</span>
                          )}
                        </div>

                        <div style={{ padding: 12 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, color: '#0B1A12' }}>{p.name}</div>
                          {p.location && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#7E9B93', marginBottom: 7, minWidth: 0 }}>
                              <MapLink address={p.location} />
                            </div>
                          )}
                          {p.typeOfWork && <div style={{ fontSize: 10, color: '#7E9B93', marginBottom: 8, lineHeight: 1.4 }}>{p.typeOfWork}</div>}
                          <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8, color: '#0B1A12' }}>{p.contractAmt}</div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 9 }}>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Est. Start</div>
                              <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 1, color: '#0B1A12' }}>{p.estStart || '—'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Duration</div>
                              <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 1, color: '#0B1A12' }}>{p.duration || '—'}</div>
                            </div>
                          </div>

                          {p.scope && (
                            <div style={{ fontSize: 10.5, color: '#43514D', lineHeight: 1.4, padding: '8px 10px', background: '#FBF8F2', borderRadius: 8, marginBottom: 9 }}>{p.scope}</div>
                          )}

                          {/* Progress through this phase, not the project overall. */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 5, background: '#EDE3D0', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${phase?.progress ?? 0}%`, height: '100%', background: col.color, borderRadius: 999, transition: 'width 0.2s' }} />
                            </div>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: col.color }}>{phase?.progress ?? 0}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: '#7E9B93', marginTop: 4 }}>
                            <span>{phase && phase.total > 0 ? `${phase.done}/${phase.total} tasks in ${col.name}` : 'No tasks yet'}</span>
                            {p.designPhase && canManage && (
                              <span
                                onClick={(e) => { e.stopPropagation(); clearPin(p.projectId); }}
                                title="Placed here by hand. Clear to follow task progress again."
                                style={{ marginLeft: 'auto', fontWeight: 700, color: '#93520F', cursor: 'pointer' }}
                              >Pinned ✕</span>
                            )}
                          </div>

                          {p.referral && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#7E9B93', marginTop: 9, paddingTop: 8, borderTop: '1px solid rgba(20,8,31,0.04)' }}>
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /></svg>
                              Ref: <strong>{p.referral}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
