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
              <div key={col.key} style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#FBF8F2', borderRadius: 12, border: '1px solid rgba(20,8,31,0.04)', maxHeight: '100%' }}>
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
                        style={{ background: 'white', borderRadius: 10, border: '1px solid rgba(20,8,31,0.07)', padding: '10px 11px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(11,26,18,0.04)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: p.imgColor || col.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12', lineHeight: 1.35 }}>{p.name}</div>
                            {p.location && <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 2 }}>{p.location}</div>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', margin: '8px 0 7px' }}>
                          <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, background: pr.bg, color: pr.c }}>{p.priority}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#173326' }}>{p.contractAmt}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 600, color: '#7E9B93' }}>{p.stage}</span>
                        </div>

                        {/* Progress through this phase, not the whole project. */}
                        <div style={{ height: 5, borderRadius: 3, background: '#EDEBE5', overflow: 'hidden' }}>
                          <div style={{ width: `${phase?.progress ?? 0}%`, height: '100%', background: col.color, transition: 'width 0.2s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 9.5, color: '#7E9B93' }}>
                            {phase && phase.total > 0 ? `${phase.done}/${phase.total} tasks` : 'No tasks yet'}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: col.color }}>{phase?.progress ?? 0}%</span>
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
