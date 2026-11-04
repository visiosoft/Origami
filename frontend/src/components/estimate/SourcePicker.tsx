import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { money } from '../../data/estimateCalc';

interface Tpl { id: string; title: string; scopes: number; lines: number; totalProject: number; updatedBy?: string }
interface Est { id: string; projectId: number; projectName: string; number: string; rev: number; title?: string | null; status: string }
interface SourceScope { id: string; title?: string | null; lines: number; total: number }

/**
 * Reuse an estimate: start a new one from a template or from any estimate on
 * a project you can see ("start"), or pull chosen scopes from one into the
 * estimate you're editing ("scopes"). Everything is copied as it is.
 */
export function SourcePicker({ mode, excludeId, onPick, onClose }: {
  mode: 'start' | 'scopes';
  excludeId?: string;
  onPick: (fromId: string, opts: { scopeIds?: string[]; title?: string }) => Promise<void> | void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'blank' | 'templates' | 'estimates'>(mode === 'start' ? 'blank' : 'templates');
  const [templates, setTemplates] = useState<Tpl[] | null>(null);
  const [estimates, setEstimates] = useState<Est[] | null>(null);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [scopes, setScopes] = useState<SourceScope[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.finance.estimateTemplates().then((r: any) => setTemplates(r.rows)).catch(() => setTemplates([])); }, []);
  useEffect(() => { if (tab === 'estimates' && !estimates) api.finance.estimatesAll().then((r: any) => setEstimates(r.rows)).catch(() => setEstimates([])); }, [tab, estimates]);
  useEffect(() => {
    if (mode !== 'scopes' || !chosen) { setScopes(null); return; }
    api.finance.estimateSource(chosen).then((r: any) => { setScopes(r.scopes); setPicked(new Set(r.scopes.map((s: SourceScope) => s.id))); }).catch(() => setScopes([]));
  }, [mode, chosen]);

  const est = useMemo(() => (estimates || []).filter((e) => e.id !== excludeId && (!q || `${e.projectName} ${e.number} ${e.title || ''}`.toLowerCase().includes(q.toLowerCase()))), [estimates, q, excludeId]);
  const go = async () => {
    setBusy(true);
    try {
      if (mode === 'start' && tab === 'blank') await onPick('', { title });
      else if (chosen) await onPick(chosen, { scopeIds: mode === 'scopes' ? [...picked] : undefined, title });
    } finally { setBusy(false); }
  };
  const row = (id: string, main: React.ReactNode, sub: React.ReactNode) => (
    <label key={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 10px', borderRadius: 9, cursor: 'pointer', background: chosen === id ? 'rgba(var(--rgb-success), 0.1)' : 'transparent', border: `1px solid ${chosen === id ? 'rgba(var(--rgb-success), 0.45)' : 'rgba(var(--rgb-shade), 0.08)'}` }}>
      <input type="radio" name="est-source" checked={chosen === id} onChange={() => setChosen(id)} style={{ marginTop: 3 }} />
      <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 650, color: 'var(--ink)', fontSize: 13.5 }}>{main}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{sub}</span></span>
    </label>
  );
  const can = mode === 'start' ? tab === 'blank' || !!chosen : !!chosen && picked.size > 0;

  return (
    <div role="dialog" aria-modal="true" aria-label={mode === 'start' ? 'New estimate' : 'Copy scopes'} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="eg-card" style={{ width: 'min(620px, 100%)', maxHeight: 'min(80vh, 760px)', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <h3 style={{ margin: 0 }}>{mode === 'start' ? 'New estimate' : 'Copy scopes from…'}</h3>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {mode === 'start' && <button type="button" className={`eg-btn${tab === 'blank' ? ' is-on' : ''}`} onClick={() => { setTab('blank'); setChosen(null); }}>Blank</button>}
          <button type="button" className={`eg-btn${tab === 'templates' ? ' is-on' : ''}`} onClick={() => { setTab('templates'); setChosen(null); }}>From a template</button>
          <button type="button" className={`eg-btn${tab === 'estimates' ? ' is-on' : ''}`} onClick={() => { setTab('estimates'); setChosen(null); }}>From another estimate</button>
        </div>
        <div style={{ overflowY: 'auto', display: 'grid', gap: 6, minHeight: 80 }}>
          {tab === 'blank' && <div style={{ fontSize: 13, color: 'var(--muted)' }}>An empty estimate. If a template is marked “Company default”, it starts with that template’s columns, General Requirements, percentages and payments; otherwise with the standard General Requirements and 17% / 12% / 5%.</div>}
          {tab === 'templates' && (templates === null ? <div style={{ color: 'var(--muted)' }}>Loading…</div> : !templates.length ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No templates yet. Open any estimate and use “Save as template”.</div>
            : templates.map((t) => row(t.id, t.title, `${t.scopes} scope${t.scopes === 1 ? '' : 's'} · ${t.lines} line${t.lines === 1 ? '' : 's'} · ${money(Math.round(t.totalProject * 100))}`)))}
          {tab === 'estimates' && <>
            <input aria-label="Find an estimate" placeholder="Find by project, number or title…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16, background: 'var(--surface)', color: 'var(--ink)' }} />
            {estimates === null ? <div style={{ color: 'var(--muted)' }}>Loading…</div> : !est.length ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No estimates found.</div>
              : est.slice(0, 200).map((e) => row(e.id, `${e.projectName} · ${e.number} Rev ${e.rev}`, `${e.title || ''} · ${e.status}`))}
          </>}
          {mode === 'scopes' && chosen && (
            <div style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.1)', paddingTop: 8, display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Scopes to copy</div>
              {scopes === null ? <div style={{ color: 'var(--muted)' }}>Loading…</div> : !scopes.length ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>This one has no scopes.</div> : scopes.map((s) => (
                <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={picked.has(s.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                  <span style={{ flex: 1 }}>{s.title || 'Untitled scope'} <span style={{ color: 'var(--muted)' }}>· {s.lines} row{s.lines === 1 ? '' : 's'}</span></span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(Math.round(s.total * 100))}</b>
                </label>
              ))}
            </div>
          )}
        </div>
        {mode === 'start' && <input aria-label="Estimate title" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16, background: 'var(--surface)', color: 'var(--ink)' }} />}
        {mode === 'start' && tab !== 'blank' && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Everything is copied as it is — scopes, lines, notes, subs, amounts, General Requirements, percentages and payments. Change what you need afterwards.</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="eg-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="eg-btn is-primary" disabled={!can || busy} onClick={() => void go()}>
            {mode === 'start' ? 'Create estimate' : `Copy ${picked.size} scope${picked.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
