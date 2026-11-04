import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { EstimateGrid, type EstimateHeader } from '../components/estimate/EstimateGrid';
import { money } from '../data/estimateCalc';

interface Row { id: string; number: string; rev: number; title?: string | null; status: string; estimateDate?: string | null; sentAt?: string | null; updatedAt?: string | null; totalProject: number }
interface Project { id: number; name: string; status?: string }

const chip = (status: string) => <span className={`eg-chip is-${status}`}>{status}</span>;

/**
 * Estimating (Precon): a project's estimates, each built like the team's
 * spreadsheet. ?project= picks the project, ?estimate= opens one.
 */
export function Estimating() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const projectId = Number(params.get('project')) || null;
  const estimateId = params.get('estimate');
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [rights, setRights] = useState({ view: false, edit: false });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<EstimateHeader | null>(null);
  const [filter, setFilter] = useState('');
  const [reload, setReload] = useState(0);
  const grid = useRef<{ flush: () => Promise<unknown> } | null>(null);

  useEffect(() => { (api.projects.list() as Promise<any>).then((l) => setProjects(Array.isArray(l) ? l : l?.rows || [])).catch(() => setProjects([])); }, []);
  const load = useCallback(() => {
    if (!projectId) { setRows(null); return; }
    api.finance.estimates(projectId).then((r: any) => { setRows(r.rows); setRights(r.rights); }).catch((e: any) => { setRows([]); toast(e?.message || 'Could not load estimates.'); });
  }, [projectId, toast]);
  useEffect(load, [load]);

  const go = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) { if (v == null) n.delete(k); else n.set(k, v); }
    setParams(n);
  };
  const act = async (fn: () => Promise<any>, then?: (r: any) => void) => {
    setBusy(true);
    try { const r = await fn(); then?.(r); load(); } catch (e: any) { toast(e?.message || 'That didn’t work.'); } finally { setBusy(false); }
  };
  const project = projects.find((p) => p.id === projectId);

  if (!projectId) {
    const list = projects.filter((p) => !filter || p.name?.toLowerCase().includes(filter.toLowerCase()));
    return (
      <div style={{ padding: '20px 24px', display: 'grid', gap: 14, maxWidth: 900 }}>
        <div>
          <h1 style={{ margin: 0, font: '700 22px var(--font-display, inherit)', color: 'var(--ink)' }}>Estimating</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Build a project’s estimate like the team’s spreadsheet: scopes by CSI code, the subcontractor and markup columns, then General Requirements, profit and contingency. Pick a project.</div>
        </div>
        <input aria-label="Find a project" placeholder="Find a project…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16, background: 'var(--surface)', color: 'var(--ink)' }} />
        <div style={{ display: 'grid', gap: 6 }}>
          {list.slice(0, 200).map((p) => (
            <button key={p.id} type="button" onClick={() => go({ project: String(p.id), estimate: null })} style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>{p.name}</button>
          ))}
          {!list.length && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No projects found.</div>}
        </div>
      </div>
    );
  }

  const current = rows?.find((r) => r.id === estimateId) || null;
  const siblings = current ? (rows || []).filter((r) => r.number === current.number) : [];
  return (
    <div style={{ padding: '16px 20px 24px', display: 'grid', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <button type="button" className="eg-btn" onClick={() => go(estimateId ? { estimate: null } : { project: null, estimate: null })}>← {estimateId ? 'All estimates' : 'Projects'}</button>
        <h1 style={{ margin: 0, font: '700 20px var(--font-display, inherit)', color: 'var(--ink)', flex: '1 1 auto' }}>Estimating · {project?.name || `Project ${projectId}`}</h1>
        {current && siblings.length > 1 && (
          <select aria-label="Revision" value={current.id} onChange={(e) => go({ estimate: e.target.value })} className="eg-btn">
            {siblings.map((s) => <option key={s.id} value={s.id}>Rev {s.rev} · {s.status}</option>)}
          </select>
        )}
        {current && rights.edit && open?.status === 'draft' && (
          <button type="button" className="eg-btn is-primary" disabled={busy} onClick={() => window.confirm(`Mark ${current.number} Rev ${current.rev} as sent to the client? It is frozen after this; changes go in a new revision.`) && act(async () => { await grid.current?.flush(); return api.finance.estimateSent(projectId, current.id); }, () => setReload((n) => n + 1))}>Mark as sent</button>
        )}
        {current && rights.edit && open && open.status !== 'draft' && open.status !== 'accepted' && !siblings.some((s) => s.status === 'draft') && (
          <button type="button" className="eg-btn" disabled={busy} onClick={() => act(() => api.finance.reviseEstimate(projectId, current.id), (r) => go({ estimate: r.estimate.id }))}>New revision</button>
        )}
        {current && rights.edit && open?.status === 'draft' && (
          <button type="button" className="eg-btn is-danger" disabled={busy} onClick={() => window.confirm(`Delete the draft ${current.number} Rev ${current.rev}?`) && act(() => api.finance.deleteEstimate(projectId, current.id), () => go({ estimate: null }))}>Delete draft</button>
        )}
        {!estimateId && rights.edit && (
          <button type="button" className="eg-btn is-primary" disabled={busy} onClick={() => act(() => api.finance.createEstimate(projectId, {}), (r) => go({ estimate: r.estimate.id }))}>+ New estimate</button>
        )}
      </div>

      {estimateId ? (
        <EstimateGrid key={`${estimateId}-${reload}`} projectId={projectId} estimateId={estimateId} onChanged={setOpen} controlRef={grid} />
      ) : rows === null ? (
        <div style={{ color: 'var(--muted)' }}>Loading…</div>
      ) : !rows.length ? (
        <div className="eg-card" style={{ color: 'var(--muted)', fontSize: 13.5 }}>No estimates for this project yet.{rights.edit ? ' Start one with “+ New estimate”.' : ''}</div>
      ) : (
        <div className="eg-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="eg-gr" style={{ minWidth: 560 }}>
            <thead><tr><th style={{ padding: '10px 14px' }}>Estimate</th><th>Status</th><th>Date</th><th style={{ textAlign: 'right', paddingRight: 14 }}>Total project cost</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => go({ estimate: r.id })}>
                  <td style={{ padding: '10px 14px' }}><b style={{ color: 'var(--ink)' }}>{r.number} · Rev {r.rev}</b> <span style={{ color: 'var(--muted)' }}>{r.title}</span></td>
                  <td>{chip(r.status)}</td>
                  <td style={{ color: 'var(--muted)' }}>{r.estimateDate || ''}</td>
                  <td className="is-num" style={{ paddingRight: 14, fontWeight: 600, color: 'var(--ink)' }}>{money(Math.round(r.totalProject * 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
