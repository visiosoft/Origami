import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, Badge, bodyRow, btn, card, headRow, input, SUBTRADE_CATEGORIES, type SubcontractorTrade } from './manpowerUi';

export function useSubcontractorTrades() {
  const [trades, setTrades] = useState<SubcontractorTrade[]>([]);
  const load = () => api.subcontractorTrades.list().then((r: any) => setTrades(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { load(); }, []);
  return { trades, reload: load };
}

const catLabel = (c: string) => SUBTRADE_CATEGORIES.find(([k]) => k === c)?.[1] || c;

/** Compact codes for a list cell: "C-10 Electrical" then "+2". */
export function TradeChips({ trades, ids, max = 2 }: { trades: SubcontractorTrade[]; ids?: string[]; max?: number }) {
  const held = (ids || []).map((id) => trades.find((t) => t.id === id)).filter(Boolean) as SubcontractorTrade[];
  if (!held.length) return <span style={{ color: MUTED, fontSize: 12 }}>—</span>;
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} title={held.map((t) => `${t.code} ${t.name}`).join('\n')}>
      {held.slice(0, max).map((t) => (
        <span key={t.id} style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#EEF3EE', color: ACCENT, whiteSpace: 'nowrap' }}>
          <b>{t.code}</b> {t.name}
        </span>
      ))}
      {held.length > max && <span style={{ fontSize: 11, color: MUTED, alignSelf: 'center' }}>+{held.length - max}</span>}
    </span>
  );
}

/** Pick the classifications a company holds: chips plus a searchable, grouped list. */
export function TradePicker({ trades, value, onChange, disabled }: { trades: SubcontractorTrade[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const held = value.map((id) => trades.find((t) => t.id === id)).filter(Boolean) as SubcontractorTrade[];
  const s = q.trim().toLowerCase();
  const options = trades.filter((t) => t.active && !value.includes(t.id) && (!s || `${t.code} ${t.name}`.toLowerCase().includes(s)));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: held.length ? 8 : 0 }}>
        {held.map((t) => (
          <span key={t.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: '#EEF3EE', color: ACCENT, fontSize: 12 }}>
            <b>{t.code}</b> {t.name}
            {!disabled && <span onClick={() => onChange(value.filter((x) => x !== t.id))} style={{ cursor: 'pointer', color: MUTED }}>×</span>}
          </span>
        ))}
      </div>
      {!disabled && (
        <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          placeholder={held.length ? '+ Add another classification…' : 'Search classifications, e.g. C-10 or Electrical…'} style={input} />
      )}
      {disabled && !held.length && <div style={{ fontSize: 12.5, color: MUTED }}>None recorded.</div>}
      {open && !disabled && (
        <div style={{ position: 'absolute', zIndex: 60, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 300, overflowY: 'auto', background: 'white', border: '1px solid rgba(20,8,31,.12)', borderRadius: 10, boxShadow: '0 12px 32px rgba(20,8,31,.14)', padding: 4 }}>
          {SUBTRADE_CATEGORIES.map(([cat, label]) => {
            const inCat = options.filter((t) => t.category === cat);
            if (!inCat.length) return null;
            return (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 10px 4px' }}>{label}</div>
                {inCat.map((t) => (
                  <div key={t.id} onClick={() => { onChange([...value, t.id]); setQ(''); }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F7F3EA'; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                    style={{ display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
                    <b style={{ width: 44, color: ACCENT }}>{t.code}</b><span style={{ color: INK }}>{t.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {!options.length && <div style={{ padding: 10, fontSize: 12.5, color: MUTED }}>No matching classification.</div>}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ setup

export function SubcontractorTradesSetup({ canManage }: { canManage: boolean }) {
  const { toast } = useApp();
  const { trades, reload } = useSubcontractorTrades();
  const [usage, setUsage] = useState<Map<string, { companies: number; workers: number }>>(new Map());
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: '', name: '', category: 'specialty' });
  useEffect(() => {
    Promise.all([api.contractors.list().catch(() => []), api.employees.list().catch(() => [])]).then(([cs, es]: any[]) => {
      const m = new Map<string, { companies: number; workers: number }>();
      const at = (id: string) => { if (!m.has(id)) m.set(id, { companies: 0, workers: 0 }); return m.get(id)!; };
      for (const c of Array.isArray(cs) ? cs : []) for (const id of c.tradeIds || []) at(id).companies++;
      for (const e of Array.isArray(es) ? es : []) if (e.tradeId) at(e.tradeId).workers++;
      setUsage(m);
    });
  }, []);
  const usedBy = (id: string) => {
    const u = usage.get(id);
    return u ? [u.companies && `${u.companies} co.`, u.workers && `${u.workers} worker${u.workers === 1 ? '' : 's'}`].filter(Boolean).join(' · ') : '';
  };

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); if (msg) toast(msg); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    reload();
  };
  const q = query.trim().toLowerCase();
  const shown = trades.filter((t) => (!category || t.category === category) && (!q || `${t.code} ${t.name} ${t.description || ''}`.toLowerCase().includes(q)));
  const cols = '70px minmax(200px,1.5fr) 190px 150px 70px 26px';

  return (
    <div>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 12, maxWidth: 760, lineHeight: 1.6 }}>
        The one trade list for the whole module: licence classifications a subcontractor company holds — A general engineering, B general building,
        C specialty trades and the C-61 / D limited specialties — and the trade each worker is classified under (a mason is C-29 Masonry, a welder C-60 Welding).
        Roles that aren't a licensed trade, like driver or helper, go in the worker's designation.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All categories</option>
          {SUBTRADE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, name or scope…" style={{ ...input, width: 260 }} />
        <span style={{ fontSize: 12, color: MUTED }}>{shown.length} of {trades.length}</span>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 720 }}>
            <div style={headRow(cols)}><span>Code</span><span>Classification</span><span>Category</span><span>Used by</span><span>Active</span><span /></div>
            {shown.map((t) => (
              <div key={t.id}>
                <div onClick={() => setOpenId(openId === t.id ? null : t.id)} style={{ ...bodyRow(cols), cursor: 'pointer', opacity: t.active ? 1 : 0.55 }}>
                  <b style={{ fontSize: 12.5, color: ACCENT }}>{t.code}</b>
                  <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{t.name} <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>{openId === t.id ? '▴' : '▾'}</span></span>
                  <span style={{ fontSize: 12 }}>{catLabel(t.category)}</span>
                  <span>{usedBy(t.id) ? <Badge tone="blue">{usedBy(t.id)}</Badge> : <span style={{ color: MUTED, fontSize: 12 }}>—</span>}</span>
                  <input type="checkbox" disabled={!canManage} checked={t.active} onClick={(e) => e.stopPropagation()} onChange={(e) => run(() => api.subcontractorTrades.update(t.id, { active: e.target.checked }))} />
                  {canManage && !usedBy(t.id) ? <span onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${t.code} ${t.name}?`)) run(() => api.subcontractorTrades.remove(t.id), 'Removed'); }} style={{ cursor: 'pointer', color: DANGER }}>×</span> : <span />}
                </div>
                {openId === t.id && (
                  <div style={{ padding: '4px 14px 14px 94px', background: '#FBF9F4', display: 'grid', gap: 8 }}>
                    {canManage ? (
                      <>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input defaultValue={t.code} onBlur={(e) => e.target.value.trim() && e.target.value !== t.code && run(() => api.subcontractorTrades.update(t.id, { code: e.target.value }), 'Saved')} style={{ ...input, width: 90 }} />
                          <input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && run(() => api.subcontractorTrades.update(t.id, { name: e.target.value }), 'Saved')} style={input} />
                          <select value={t.category} onChange={(e) => run(() => api.subcontractorTrades.update(t.id, { category: e.target.value }))} style={{ ...input, width: 210 }}>
                            {SUBTRADE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </div>
                        <textarea defaultValue={t.description || ''} rows={5} placeholder="Scope of this classification"
                          onBlur={(e) => e.target.value !== (t.description || '') && run(() => api.subcontractorTrades.update(t.id, { description: e.target.value }), 'Saved')} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
                      </>
                    ) : <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.description || 'No description.'}</div>}
                  </div>
                )}
              </div>
            ))}
            {!shown.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>{trades.length ? 'Nothing matches.' : 'Loading…'}</div>}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid ' + LINE, flexWrap: 'wrap' }}>
            <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Code, e.g. D-66" style={{ ...input, width: 130 }} />
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name, e.g. Waterproofing" style={{ ...input, width: 240 }} />
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ ...input, width: 'auto' }}>
              {SUBTRADE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div onClick={() => run(async () => { await api.subcontractorTrades.create(draft); setDraft({ code: '', name: '', category: draft.category }); }, 'Classification added')} style={btn(true)}>+ Add</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sample data

export function SampleDataPanel({ canManage, onChanged }: { canManage: boolean; onChanged: () => Promise<unknown> | void }) {
  const { toast } = useApp();
  const [status, setStatus] = useState<{ loaded: boolean; employees: number; contractors: number; payrollRuns?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.sampleData.status().then((r: any) => setStatus(r)).catch(() => setStatus(null));
  useEffect(() => { load(); }, []);
  const act = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try { const r = await fn(); setStatus(r); toast(msg); await onChanged(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ ...card, padding: '18px 20px', maxWidth: 760 }}>
      <div style={{ fontFamily: BG, fontSize: 16, fontWeight: 700, color: INK }}>Sample data for testing</div>
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.7, margin: '6px 0 14px' }}>
        Loads a realistic crew so every screen has something to try: 17 people (site staff, daily-wage workers, one who has resigned),
        two subcontractors with their licence classifications and workers, deployment on your first two projects, a workforce request,
        a week of daily logs by cost code, documents and certifications (some expiring), leave, overtime, advances and loans,
        payroll (last month finalized and paid by direct deposit, this month as a draft), shift rosters, company assets, crew housing and transport routes.
        <br />Everything it creates is tagged, so <b>Remove sample data</b> deletes exactly that — and anything you later recorded against a sample person — without touching your real records.
        Worker IDs start with <b>SMP-</b> so sample people are easy to spot.
      </div>
      {status === null ? <div style={{ fontSize: 12.5, color: MUTED }}>Checking…</div> : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {status.loaded
            ? <Badge tone="green">Loaded · {status.employees} people, {status.contractors} contractors, {status.payrollRuns || 0} payroll runs</Badge>
            : <Badge tone="grey">Not loaded</Badge>}
          <div style={{ flex: 1 }} />
          {canManage && !status.loaded && <div onClick={busy ? undefined : () => act(() => api.sampleData.load(), 'Sample data loaded')} style={btn(true, busy)}>{busy ? 'Loading…' : 'Load sample data'}</div>}
          {canManage && status.loaded && !status.payrollRuns && (
            <div onClick={busy ? undefined : () => act(() => api.sampleData.loadPayroll(), 'Sample payroll added')} style={btn(true, busy)}>{busy ? 'Adding…' : 'Add sample payroll'}</div>
          )}
          {canManage && status.loaded && (
            <div onClick={busy ? undefined : () => { if (confirm('Remove all sample data, and anything recorded against sample people?')) act(() => api.sampleData.remove(), 'Sample data removed'); }}
              style={{ ...btn(false, busy), color: DANGER }}>{busy ? 'Removing…' : 'Remove sample data'}</div>
          )}
          {!canManage && <span style={{ fontSize: 12, color: MUTED }}>Only HR managers can load or remove sample data.</span>}
        </div>
      )}
    </div>
  );
}
