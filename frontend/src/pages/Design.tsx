import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const BG = "'Bricolage Grotesque', serif";

/** One project's progress through the design phases. */
interface PhaseProgress {
  id: string; key: string; name: string; color: string; order: number;
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
  currentPhaseKey: string | null;
  phases: PhaseProgress[];
  taskTotal: number;
  taskDone: number;
  progress: number;
}

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
export function Design() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DesignProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.projectPhases.overview()
      .then((res: any) => { if (Array.isArray(res)) setRows(res as DesignProject[]); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Columns come from the projects themselves, so a renamed or added phase
  // needs no change here.
  const columns = useMemo(() => {
    const seen = new Map<string, { key: string; name: string; color: string; order: number }>();
    rows.forEach((p) => p.phases.forEach((ph) => {
      if (!seen.has(ph.key)) seen.set(ph.key, { key: ph.key, name: ph.name, color: ph.color, order: ph.order });
    }));
    return [...seen.values()].sort((a, b) => a.order - b.order);
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) =>
      p.name.toLowerCase().includes(q)
      || (p.location || '').toLowerCase().includes(q)
      || (p.typeOfWork || '').toLowerCase().includes(q));
  }, [rows, query]);

  const planned = visible.filter((p) => p.taskTotal > 0).length;

  if (loading) return <div style={{ padding: 24, fontSize: 13, color: '#7E9B93' }}>Loading design board…</div>;

  return (
    <div style={{ padding: '18px 22px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: '#0B1A12' }}>Design &amp; Preconstruction</div>
          <div style={{ fontSize: 12, color: '#7E9B93', marginTop: 3 }}>
            {visible.length} project{visible.length === 1 ? '' : 's'} · {planned} with a programme
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
          No design phases yet. Open a project's Phase Board to create them.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', flex: 1, minHeight: 0, paddingBottom: 6 }}>
          {columns.map((col) => {
            const cards = visible.filter((p) => p.currentPhaseKey === col.key);
            return (
              <div key={col.key} style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#FBF8F2', borderRadius: 12, border: '1px solid rgba(20,8,31,0.04)', maxHeight: '100%' }}>
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
                        onClick={() => navigate('/projects')}
                        title={`${p.name} — open in Projects`}
                        style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.06)', overflow: 'hidden', cursor: 'pointer' }}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#7E9B93', marginBottom: 7 }}>
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx={12} cy={10} r={3} /></svg>
                              {p.location}
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
                          <div style={{ fontSize: 9.5, color: '#7E9B93', marginTop: 4 }}>
                            {phase && phase.total > 0 ? `${phase.done}/${phase.total} tasks in ${col.name}` : 'No tasks yet'}
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
