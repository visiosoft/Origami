import { CompareEstimates } from '../components/estimate/CompareEstimates';
import { estimateWaiting } from '../data/estimateWaiting';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { EstimateGrid, type EstimateHeader } from '../components/estimate/EstimateGrid';
import { SourcePicker } from '../components/estimate/SourcePicker';
import { StatementLibrary } from '../components/estimate/StatementLibrary';
import { StrategyMap } from '../components/estimate/StrategyMap';
import { RevisionCompare } from '../components/estimate/RevisionCompare';
import { LetterPanel } from '../components/estimate/LetterPanel';
import { JobSetup } from '../components/estimate/JobSetup';
import { BidPackages } from '../components/estimate/BidPackages';
import { money } from '../data/estimateCalc';

interface Row { id: string; number: string; rev: number; title?: string | null; status: string; estimateDate?: string | null; sentAt?: string | null; updatedAt?: string | null; totalProject: number; valid?: boolean }
interface Project { id: number; name: string; status?: string; stage?: string | null }

/** The start page groups projects by where they are (Nov 13): CRM, Design, Precon, Construction. */
export const STAGE_FOLDS: { key: string; label: string; stages: string[] }[] = [
  { key: 'crm', label: 'CRM', stages: [''] },
  { key: 'design', label: 'Design', stages: ['design'] },
  { key: 'precon', label: 'Precon', stages: ['kickoff', 'precon', 'preconstruction'] },
  { key: 'construction', label: 'Construction', stages: ['construction'] },
  { key: 'closed', label: 'Closed & cancelled', stages: ['closeout', 'closed', 'cancelled'] },
];
export function foldOf(stage?: string | null): string {
  const s = (stage || '').trim().toLowerCase();
  return STAGE_FOLDS.find((f) => f.stages.includes(s))?.key || 'crm';
}
const FOLDS_KEY = 'origami.est.folds';
const loadFolds = (): string[] => { try { return JSON.parse(localStorage.getItem(FOLDS_KEY) || '[]'); } catch { return []; } };

/** Nov 17: how long a sent estimate has waited on the client (amber after a week). */
const waitChip = (r: { status: string; sentAt?: string | null }) => {
  const w = estimateWaiting(r);
  return <span className={`eg-chip is-${r.status}${w.late ? ' is-late' : ''}`} title={w.days != null ? `Sent ${String(r.sentAt).slice(0, 10)}` : undefined}>{w.late ? '⏱ ' : ''}{w.label}</span>;
};

/**
 * Estimating (Precon): a project's estimates, each built like the team's
 * spreadsheet. ?project= picks the project, ?estimate= opens one;
 * ?template= opens a company template (reused on any project).
 */
export function Estimating() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const projectId = Number(params.get('project')) || null;
  const estimateId = params.get('estimate');
  const templateId = params.get('template');
  const [templates, setTemplates] = useState<{ id: string; title: string; isDefault?: boolean; scopes: number; lines: number; totalProject: number; updatedAt?: string; updatedBy?: string }[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [rights, setRights] = useState({ view: false, edit: false });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<EstimateHeader | null>(null);
  const [filter, setFilter] = useState('');
  const [allProjects, setAllProjectsState] = useState(() => { try { return localStorage.getItem('origami.estimating.allProjects') === '1'; } catch { return false; } });
  const setAllProjects = (v: boolean) => { setAllProjectsState(v); try { localStorage.setItem('origami.estimating.allProjects', v ? '1' : '0'); } catch { /* private window */ } };
  const [reload, setReload] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [tab, setTab] = useState<'sheet' | 'letter'>('sheet');
  const [sending, setSending] = useState(false);
  // Nov 19 (Edward): compare the project's estimates side by side.
  const [comparingAll, setComparingAll] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [bidding, setBidding] = useState(false);
  const [mail, setMail] = useState({ to: '', cc: '', note: '' });
  /** K8: the client's copy as a PDF (new tab), or the internal workbook (download). */
  const openFile = async (kind: 'pdf' | 'xlsx') => {
    if (!projectId || !estimateId) return;
    const w = kind === 'pdf' ? window.open('', '_blank') : null;
    try {
      await grid.current?.flush();
      const blob = await api.finance.estimateFile(projectId, estimateId, kind);
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url;
      else { const a = document.createElement('a'); a.href = url; a.download = `${current?.number || 'Estimate'} Rev ${current?.rev || ''}.xlsx`; a.click(); }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { w?.close(); toast(e?.message || 'Could not make the file.'); }
  };
  const [shut, setShut] = useState<string[]>(loadFolds);
  const [showClosed, setShowClosed] = useState(false);
  const toggleFold = (k: string) => setShut((x) => { const n = x.includes(k) ? x.filter((y) => y !== k) : [...x, k]; try { localStorage.setItem(FOLDS_KEY, JSON.stringify(n)); } catch { /* private mode */ } return n; });
  const grid = useRef<{ flush: () => Promise<unknown> } | null>(null);

  useEffect(() => { (api.projects.list() as Promise<any>).then((l) => setProjects(Array.isArray(l) ? l : l?.rows || [])).catch(() => setProjects([])); }, []);
  // Nov 19 (Edward): which projects already have an estimate -- shown as a badge on the start page.
  const [estOf, setEstOf] = useState<Map<number, { count: number; last: string; status: string }>>(new Map());
  useEffect(() => {
    if (projectId) return;
    (api.finance.estimatesAll() as Promise<any>).then((r) => {
      const m = new Map<number, { count: number; last: string; status: string }>();
      for (const e of (r?.rows || []) as { projectId: number; updatedAt?: string; status: string }[]) {
        const x = m.get(e.projectId) || { count: 0, last: '', status: e.status };
        x.count++; if ((e.updatedAt || '') > x.last) { x.last = e.updatedAt || ''; x.status = e.status; }
        m.set(e.projectId, x);
      }
      setEstOf(m);
    }).catch(() => setEstOf(new Map()));
  }, [projectId]);
  const load = useCallback(() => {
    if (!projectId) { setRows(null); return; }
    api.finance.estimates(projectId).then((r: any) => { setRows(r?.rows || []); setRights(r?.rights || { view: false, edit: false }); }).catch((e: any) => { setRows([]); toast(e?.message || 'Could not load estimates.'); });
  }, [projectId, toast]);
  useEffect(load, [load]);
  const loadTemplates = useCallback(() => { api.finance.estimateTemplates().then((r: any) => { setTemplates(r?.rows || []); setRights(r?.rights || { view: false, edit: false }); }).catch(() => setTemplates([])); }, []);
  useEffect(() => { if (!projectId) loadTemplates(); }, [projectId, templateId, loadTemplates]);

  const go = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) { if (v == null) n.delete(k); else n.set(k, v); }
    setParams(n);
  };
  const act = async (fn: () => Promise<any>, then?: (r: any) => void) => {
    setBusy(true);
    try { const r = await fn(); then?.(r); load(); if (!projectId) loadTemplates(); } catch (e: any) { toast(e?.message || 'That didn’t work.'); } finally { setBusy(false); }
  };
  const project = projects.find((p) => p.id === projectId);

  if (templateId) {
    const t = templates?.find((x) => x.id === templateId);
    return (
      <div style={{ padding: '16px 20px 24px', display: 'grid', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <button type="button" className="eg-btn" onClick={() => go({ template: null })}>← Estimating</button>
          <h1 style={{ margin: 0, font: '700 20px var(--font-display, inherit)', color: 'var(--ink)', flex: '1 1 auto' }}>Template{t ? ` · ${t.title}` : ''}</h1>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Changes here don’t touch estimates already made from it.</span>
          {rights.edit && <button type="button" className="eg-btn is-danger" disabled={busy} onClick={() => window.confirm(`Delete the template “${t?.title || ''}”? Estimates made from it stay as they are.`) && act(() => api.finance.deleteEstimateTemplate(templateId), () => go({ template: null }))}>Delete template</button>}
        </div>
        <EstimateGrid key={templateId} projectId={0} estimateId={templateId} />
      </div>
    );
  }

  if (!projectId) {
    // Nov 20 (Edward): only projects with estimates, so empty ones don't take up space. Searching, or "Show all", finds the rest.
    const list = projects.filter((p) => (filter ? p.name?.toLowerCase().includes(filter.toLowerCase()) : allProjects || estOf.has(p.id)));
    return (
      <div style={{ padding: '20px 24px', display: 'grid', gap: 14, maxWidth: 900 }}>
        <div>
          <h1 style={{ margin: 0, font: '700 22px var(--font-display, inherit)', color: 'var(--ink)' }}>Estimating</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Build a project’s estimate like the team’s spreadsheet: scopes by CSI code, the subcontractor and markup columns, then General Requirements, profit and contingency. Pick a project.</div>
        </div>
        {rights.edit && <StrategyMap />}
        <input aria-label="Find a project" placeholder="Find a project…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16, background: 'var(--surface)', color: 'var(--ink)' }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: 'var(--muted)' }}>
          <span>{allProjects ? `All ${projects.length} projects` : `${projects.filter((p) => estOf.has(p.id)).length} projects with estimates`}{filter ? ' · searching every project' : ''}</span>
          <button type="button" className="eg-btn" aria-pressed={allProjects} onClick={() => setAllProjects(!allProjects)}>{allProjects ? 'Only projects with estimates' : 'Show all projects'}</button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {STAGE_FOLDS.filter((f) => f.key !== 'closed' || showClosed).map((f) => {
            const mine = list.filter((p) => foldOf(p.stage) === f.key);
            if (!mine.length && (filter || !allProjects || f.key === 'closed')) return null;
            const isOpen = !!filter || !shut.includes(f.key);
            return (
              <section key={f.key} className="est-fold" aria-label={f.label}>
                <button type="button" className="est-fold-head" aria-expanded={isOpen} onClick={() => toggleFold(f.key)}>
                  <span className={`est-caret${isOpen ? ' is-open' : ''}`}>›</span>{f.label}<span className="est-count">{mine.length}</span>
                </button>
                {isOpen && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {mine.slice(0, 200).map((p) => (
                      <button key={p.id} type="button" onClick={() => go({ project: String(p.id), estimate: null })} style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>{p.name}{p.stage && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{p.stage}</span>}
                        {estOf.get(p.id) && (() => { const x = estOf.get(p.id)!; return (
                          <span className="est-has" title={`Last changed ${x.last ? new Date(x.last).toLocaleDateString() : '—'} · latest is ${x.status}`} style={{ marginLeft: 10, padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: x.status === 'accepted' ? 'var(--c-d2ead3)' : '#FBEBDD', color: x.status === 'accepted' ? 'var(--success-deep)' : '#8A4B12' }}>
                            ▣ {x.count} estimate{x.count === 1 ? '' : 's'}{x.last ? ` · ${new Date(x.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                          </span>); })()}</button>
                    ))}
                    {!mine.length && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '0 4px' }}>None.</div>}
                  </div>
                )}
              </section>
            );
          })}
          {!list.length && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No projects found.</div>}
          <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show closed &amp; cancelled</label>
        </div>
        <div className="eg-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Templates <span className="eg-scope-fig">Start any project’s estimate from one</span>
            {rights.edit && <button type="button" className="eg-btn" style={{ marginLeft: 'auto' }} disabled={busy} onClick={() => { const title = window.prompt('Name the new template (e.g. “Bathroom remodel”):')?.trim(); if (title) void act(() => api.finance.createEstimateTemplate({ title }), (r) => go({ template: r.estimate.id })); }}>+ New template</button>}
          </h3>
          {templates === null ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div> : !templates.length ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No templates yet. Open any estimate and choose “Save as template”, or start one here.</div>
          ) : templates.map((t) => (
            <button key={t.id} type="button" onClick={() => go({ template: t.id })} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.1)', background: 'var(--surface)', font: 'inherit', cursor: 'pointer' }}>
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: 'var(--ink)', fontSize: 14 }}>{t.title}</b>{t.isDefault && <span className="eg-chip is-sent" style={{ marginLeft: 8 }}>Company default</span>}<span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{t.scopes} scope{t.scopes === 1 ? '' : 's'} · {t.lines} line{t.lines === 1 ? '' : 's'}{t.updatedBy ? ` · last changed by ${t.updatedBy}` : ''}</span></span>
              <b style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{money(Math.round(t.totalProject * 100))}</b>
            </button>
          ))}
        </div>
        <StatementLibrary />
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
            {siblings.map((s) => <option key={s.id} value={s.id}>Rev {s.rev} · {s.status === 'sent' ? 'shared' : s.status}</option>)}
          </select>
        )}
        {current && siblings.length > 1 && <button type="button" className="eg-btn" onClick={() => setComparing(true)}>Compare…</button>}
        {current && (
          <span role="tablist" aria-label="Sheet or letter" style={{ display: 'inline-flex', gap: 4 }}>
            {(['sheet', 'letter'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`eg-btn${tab === k ? ' is-on' : ''}`} onClick={async () => { await grid.current?.flush(); setTab(k); setReload((n) => n + 1); }}>{k === 'sheet' ? 'Sheet' : 'Letter'}</button>)}
          </span>
        )}
        {/* Nov 19 (Edward): bidding is run from GC & Sub Prequalify & RFP; this section is estimating only. */}
        {current && <a className="eg-btn" href={`/sub_prequal?tab=rfp&project=${projectId}&estimate=${encodeURIComponent(current.id)}`} title="Send scopes to subs for pricing — in GC & Sub Prequalify & RFP">Bid packages in RFP →</a>}
        {current && <button type="button" className="eg-btn" onClick={() => void openFile('pdf')} title="The client’s copy, as the project’s book type shows it">PDF</button>}
        {current && <button type="button" className="eg-btn" onClick={() => void openFile('xlsx')} title="The whole estimate as a spreadsheet (what your role may see)">Excel</button>}
        {current && rights.edit && open?.status === 'sent' && !siblings.some((s) => s.status === 'accepted') && (
          <button type="button" className="eg-btn" disabled={busy} title="The client accepted it on paper or by email" onClick={() => { const signer = window.prompt(`Who accepted ${current.number} Rev ${current.rev} for the client?`)?.trim(); if (signer) void act(() => api.finance.markEstimateAccepted(projectId, current.id, signer), () => { setReload((n) => n + 1); setSettingUp(true); }); }}>Mark accepted…</button>
        )}
        {current && rights.edit && open?.status === 'accepted' && (
          <button type="button" className="eg-btn is-primary" onClick={() => setSettingUp(true)}>Set up the job</button>
        )}
        {current && rights.edit && (open?.status === 'draft' || open?.status === 'sent') && !siblings.some((s) => s.status === 'accepted') && (
          <button type="button" className="eg-btn is-primary" disabled={busy} onClick={() => setSending(true)} title="Put it in the owner’s portal to review and accept, and let them know">{open?.status === 'sent' ? 'Share again…' : 'Share with owner…'}</button>
        )}
        {current && rights.edit && open && open.status !== 'draft' && open.status !== 'accepted' && !siblings.some((s) => s.status === 'draft') && !siblings.some((s) => s.status === 'accepted') && (
          current.rev < Math.max(...siblings.map((s) => s.rev))
            ? <button type="button" className="eg-btn" disabled={busy} title="Copy this revision as a new draft to keep working from it" onClick={() => window.confirm(`Copy ${current.number} Rev ${current.rev} as a new draft (Rev ${Math.max(...siblings.map((s) => s.rev)) + 1})? The later revisions stay as they are.`) && act(() => api.finance.reviseEstimate(projectId, current.id), (r) => go({ estimate: r.estimate.id }))}>Restore as new draft</button>
            : <button type="button" className="eg-btn" disabled={busy} onClick={() => act(() => api.finance.reviseEstimate(projectId, current.id), (r) => go({ estimate: r.estimate.id }))}>New revision</button>
        )}
        {current && rights.edit && (
          <button type="button" className="eg-btn" disabled={busy} onClick={() => {
            const title = window.prompt('Save this estimate as a template. Template name:', current.title || '')?.trim();
            if (title) void act(async () => { await grid.current?.flush(); return api.finance.createEstimateTemplate({ title, fromId: current.id }); }, () => toast(`Saved as the template “${title}”. Start any project’s estimate from it.`));
          }}>Save as template</button>
        )}
        {current && rights.edit && open?.status === 'draft' && (
          <button type="button" className="eg-btn is-danger" disabled={busy} onClick={() => window.confirm(`Delete the draft ${current.number} Rev ${current.rev}?`) && act(() => api.finance.deleteEstimate(projectId, current.id), () => go({ estimate: null }))}>Delete draft</button>
        )}
        {!estimateId && rights.edit && (
          <button type="button" className="eg-btn is-primary" disabled={busy} onClick={() => setStarting(true)}>+ New estimate</button>
        )}
      </div>

      {estimateId && tab === 'letter' ? (
        <LetterPanel key={`${estimateId}-${reload}`} projectId={projectId} estimateId={estimateId} onPreview={() => void openFile('pdf')} />
      ) : estimateId ? (
        <EstimateGrid key={`${estimateId}-${reload}`} projectId={projectId} estimateId={estimateId} onChanged={setOpen} controlRef={grid} />
      ) : rows === null ? (
        <div style={{ color: 'var(--muted)' }}>Loading…</div>
      ) : comparingAll && rows.length > 1 ? (
        <>
          <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button type="button" role="tab" aria-selected={false} className="eg-btn" onClick={() => setComparingAll(false)}>Estimates</button>
            <button type="button" role="tab" aria-selected className="eg-btn is-on">Compare estimates</button>
          </div>
          <CompareEstimates projectId={projectId} rows={rows} />
        </>
      ) : !rows.length ? (
        <div className="eg-card" style={{ color: 'var(--muted)', fontSize: 13.5 }}>No estimates for this project yet.{rights.edit ? ' Start one with “+ New estimate”.' : ''}</div>
      ) : (
        <>
        {rows.length > 1 && (
          <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button type="button" role="tab" aria-selected className="eg-btn is-on">Estimates</button>
            <button type="button" role="tab" aria-selected={false} className="eg-btn" onClick={() => setComparingAll(true)}>Compare estimates</button>
          </div>
        )}
        <div className="eg-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="eg-gr" style={{ minWidth: 560 }}>
            <thead><tr><th style={{ width: 34 }} title="Valid for Financials → Precon" /><th style={{ padding: '10px 14px' }}>Estimate</th><th>Status</th><th>Date</th><th style={{ textAlign: 'right', paddingRight: 14 }}>Total project cost</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => go({ estimate: r.id })}>
                  {/* Nov 19 (Edward): mark which estimates are valid -- they show in Financials → Precon. */}
                  <td style={{ textAlign: 'center' }} onClick={(ev) => ev.stopPropagation()}>
                    <button type="button" aria-pressed={!!r.valid} disabled={!rights.edit} aria-label={`${r.valid ? 'Valid' : 'Not valid'} for Financials: ${r.number} Rev ${r.rev}`} title={r.valid ? 'Valid — shows in Financials → Precon (click to unmark)' : 'Mark valid — show it in Financials → Precon'}
                      onClick={() => void act(() => api.finance.estimateValid(projectId, r.id, !r.valid), () => setRows((x) => (x || []).map((y) => (y.id === r.id ? { ...y, valid: !r.valid } : y))))}
                      style={{ border: 0, background: 'none', fontSize: 18, cursor: rights.edit ? 'pointer' : 'default', color: r.valid ? '#C98A00' : 'var(--muted)' }}>{r.valid ? '★' : '☆'}</button>
                  </td>
                  <td style={{ padding: '10px 14px' }}><b style={{ color: 'var(--ink)' }}>{r.number} · Rev {r.rev}</b> <span style={{ color: 'var(--muted)' }}>{r.title}</span></td>
                  <td>{waitChip(r)}</td>
                  <td style={{ color: 'var(--muted)' }}>{r.estimateDate || ''}</td>
                  <td className="is-num" style={{ paddingRight: 14, fontWeight: 600, color: 'var(--ink)' }}>{money(Math.round(r.totalProject * 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {bidding && current && <BidPackages projectId={projectId} estimateId={current.id} canEdit={rights.edit} onClose={() => setBidding(false)} onUsed={() => { setBidding(false); const draft = siblings.find((x) => x.status === 'draft'); if (draft && draft.id !== current.id) go({ estimate: draft.id }); else setReload((n) => n + 1); }} />}
      {settingUp && current && <JobSetup projectId={projectId} estimateId={current.id} label={`${current.number} Rev ${current.rev}`} onClose={() => setSettingUp(false)} />}
      {sending && current && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Share with owner" className="rc-back eg-portal" onClick={() => setSending(false)}>
          <form className="eg-card" style={{ width: 'min(520px, 100%)', display: 'grid', gap: 10 }} onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void act(async () => { await grid.current?.flush(); return api.finance.sendEstimate(projectId, current.id, mail); }, (r) => { setSending(false); toast(`Shared — it’s in the owner’s portal; ${r.to} has been told`); setReload((n) => n + 1); }); }}>
            <h3 style={{ margin: 0 }}>Share {current.number} Rev {current.rev} with the owner</h3>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>It goes into the owner’s portal to review and accept online, and they get a short email saying it’s ready (no PDF attached — PDF and Excel stay here as a backup).{open?.status === 'draft' ? ' This revision is then frozen; changes go in a new revision.' : ''}</div>
            {(['to', 'cc'] as const).map((k) => (
              <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>{k === 'to' ? 'To' : 'Cc (optional)'}
                <input type="email" multiple={k === 'cc'} value={mail[k]} placeholder={k === 'to' ? 'The bill-to email if left empty' : 'name@example.com, …'} onChange={(e) => setMail((m) => ({ ...m, [k]: e.target.value }))} style={{ font: 'inherit', fontSize: 16, padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)' }} />
              </label>
            ))}
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>Note (optional)
              <textarea rows={3} value={mail.note} onChange={(e) => setMail((m) => ({ ...m, note: e.target.value }))} style={{ font: 'inherit', fontSize: 14, padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)' }} />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="eg-btn" onClick={() => setSending(false)}>Cancel</button>
              <button type="submit" className="eg-btn is-primary" disabled={busy}>{busy ? 'Sharing…' : 'Share'}</button>
            </div>
          </form>
        </div>, document.body,
      )}
      {comparing && current && (() => {
        const sorted = [...siblings].sort((x, y) => x.rev - y.rev);
        const me = sorted.findIndex((x) => x.id === current.id);
        const other = sorted[me > 0 ? me - 1 : 1] || sorted[0];
        const [a, b] = me > 0 ? [other, current] : [current, other];
        return <RevisionCompare projectId={projectId} revs={sorted} initialA={a.id} initialB={b.id} onClose={() => setComparing(false)} />;
      })()}
      {starting && (
        <SourcePicker mode="start" onClose={() => setStarting(false)} onPick={(fromId, o) => act(() => api.finance.createEstimate(projectId, { title: o.title || undefined, fromId: fromId || undefined }), (r) => { setStarting(false); go({ estimate: r.estimate.id }); })} />
      )}
    </div>
  );
}
