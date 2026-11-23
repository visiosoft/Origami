import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { TopScrollbar } from '../TopScrollbar';

type Pair = { low: number | null; high: number | null } | null;
interface RollEst { id: string; label: string; date: string | null; structureKey: string | null; building: string | null; fundingSourceId: string | null; paidBy: string | null }
interface Group { key: string; label: string; estimateIds: string[]; total: Pair }
interface Roll {
  estimates: RollEst[];
  rows: { key: string; label: string; cells: Pair[]; total: Pair }[];
  lines: { key: string; label: string; cells: (number | null)[]; total: number | null }[];
  totals: Pair[]; total: Pair; byBuilding: Group[]; byFunding: Group[];
}
interface EstRow { id: string; number: string; rev: number; title?: string | null; status: string; valid?: boolean }
const usd = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));

/** The latest revision of each estimate number that isn't superseded -- the ★ valid ones when any are marked. */
export function defaultRollupPick(rows: EstRow[]) {
  const latest = new Map<string, EstRow>();
  for (const r of rows) {
    if (r.status === 'superseded') continue;
    const cur = latest.get(r.number);
    if (!cur || r.rev > cur.rev) latest.set(r.number, r);
  }
  const all = [...latest.values()];
  const valid = rows.filter((r) => r.valid).map((r) => r.id);
  return valid.length ? valid : all.map((r) => r.id);
}

/**
 * Nov 23 (Edward's notes p30, "the roll up"): this project's estimates added
 * together -- e.g. the main house and the ADU, or the bank-financed and
 * owner-financed parts -- trade by trade, with each estimate's column (which
 * folds to its total) and subtotals by building and by who pays.
 */
export function EstimateRollup({ projectId, rows }: { projectId: number; rows: EstRow[] }) {
  // Every revision can be picked, the latest of each number first.
  const choices = useMemo(() => [...rows].sort((a, b) => a.number.localeCompare(b.number) || b.rev - a.rev), [rows]);
  const [picked, setPicked] = useState<string[]>(() => defaultRollupPick(rows));
  const [data, setData] = useState<Roll | null>(null);
  const [error, setError] = useState('');
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [showRange, setShowRange] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!picked.length) { setData(null); return; }
    setError('');
    (api.finance.estimatesRollup(projectId, picked) as Promise<Roll>).then(setData).catch((e: Error) => setError(e.message));
  }, [projectId, picked.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const fold = (id: string) => setFolded((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const th: React.CSSProperties = { padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(var(--rgb-shade), .08)', background: 'var(--surface)' };
  const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12.5, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const first: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', textAlign: 'left', minWidth: 190, maxWidth: 260, whiteSpace: 'normal' };
  const tot: React.CSSProperties = { ...td, fontWeight: 700, background: 'var(--panel)' };
  const cell = (p: Pair) => (p ? (showRange && p.high != null && p.high !== p.low ? `${usd(p.low)} – ${usd(p.high)}` : usd(p.low)) : '');

  const print = () => {
    if (!data) return;
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const head = `<tr><th>Trade</th>${data.estimates.map((e) => `<th>${esc(e.label)}${e.building || e.paidBy ? `<br><small>${esc([e.building, e.paidBy].filter(Boolean).join(' · '))}</small>` : ''}</th>`).join('')}<th>Total</th></tr>`;
    const body = data.rows.map((r) => `<tr><td>${esc(r.label)}</td>${r.cells.map((c) => `<td>${c ? usd(c.low) : ''}</td>`).join('')}<td><b>${usd(r.total?.low)}</b></td></tr>`).join('')
      + data.lines.map((l) => `<tr class="l"><td>${esc(l.label)}</td>${l.cells.map((c) => `<td>${usd(c)}</td>`).join('')}<td><b>${usd(l.total)}</b></td></tr>`).join('')
      + `<tr class="t"><td>Total project</td>${data.totals.map((t) => `<td>${usd(t?.low)}</td>`).join('')}<td>${usd(data.total?.low)}</td></tr>`;
    const groups = (title: string, gs: Group[]) => (gs.length ? `<h3>${title}</h3><table>${gs.map((g) => `<tr><td>${esc(g.label)}</td><td>${usd(g.total?.low)}</td></tr>`).join('')}</table>` : '');
    w.document.write(`<!doctype html><title>Estimate roll-up</title><style>body{font:12px system-ui,sans-serif;margin:24px}table{border-collapse:collapse;margin-bottom:16px}td,th{border-bottom:1px solid #ddd;padding:5px 8px;text-align:right}td:first-child,th:first-child{text-align:left}tr.l td{color:#555}tr.t td{font-weight:700;border-top:2px solid #333}small{color:#777;font-weight:400}</style><h2>Estimate roll-up</h2><table>${head}${body}</table>${groups('By building', data.byBuilding)}${groups('By who pays', data.byFunding)}<script>print()</script>`);
    w.document.close();
  };

  return (
    <div className="eg-card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <b style={{ fontSize: 13, marginRight: 6 }}>Roll up:</b>
        {choices.map((r) => (
          <label key={r.id} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12.5, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .14)', background: picked.includes(r.id) ? 'var(--mist)' : 'var(--surface)', cursor: 'pointer', opacity: r.status === 'superseded' ? 0.6 : 1 }}>
            <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />{r.valid ? '★ ' : ''}{r.number} Rev {r.rev}{r.title ? ` · ${r.title}` : ''}
          </label>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="eg-btn" aria-pressed={showRange} onClick={() => setShowRange((x) => !x)}>{showRange ? 'Low only' : 'Show low – high'}</button>
        <button type="button" className="eg-btn" disabled={!data} onClick={print}>Print</button>
      </div>
      {error && <div role="alert" style={{ color: '#8E2E0A', fontSize: 13 }}>{error}</div>}
      {!picked.length && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Tick the estimates to add together.</div>}
      {data && (
        <>
          <TopScrollbar target={wrap} />
          <div ref={wrap} style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }} aria-label="Estimate roll-up">
              <thead>
                <tr>
                  <th style={{ ...th, ...first, zIndex: 2 }}>Trade</th>
                  {data.estimates.map((e) => (
                    <th key={e.id} style={{ ...th, minWidth: folded.has(e.id) ? 60 : 130, verticalAlign: 'bottom' }}>
                      <button type="button" onClick={() => fold(e.id)} title={folded.has(e.id) ? 'Show this estimate’s trades' : 'Fold to its total'}
                        style={{ border: 0, background: 'none', font: 'inherit', color: 'var(--ink)', cursor: 'pointer', textAlign: 'right', padding: 0 }}>
                        {folded.has(e.id) ? '▸ ' : '▾ '}{e.label}
                      </button>
                      {(e.building || e.paidBy) && <div style={{ fontWeight: 600, color: 'var(--c-1e6b36, #1E6B36)' }}>{[e.building, e.paidBy].filter(Boolean).join(' · ')}</div>}
                    </th>
                  ))}
                  <th style={{ ...th, color: 'var(--ink)', background: 'var(--panel)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.key}>
                    <td style={{ ...td, ...first }}>{r.label}</td>
                    {r.cells.map((c, i) => <td key={i} style={td}>{folded.has(data.estimates[i].id) ? '' : cell(c)}</td>)}
                    <td style={tot}>{cell(r.total)}</td>
                  </tr>
                ))}
                {data.lines.map((l) => (
                  <tr key={l.key}>
                    <td style={{ ...td, ...first, color: 'var(--muted)', borderTop: l.key === 'subtotal' ? '1px solid rgba(var(--rgb-shade), .15)' : undefined }}>{l.label}</td>
                    {l.cells.map((c, i) => <td key={i} style={{ ...td, color: 'var(--muted)', borderTop: l.key === 'subtotal' ? '1px solid rgba(var(--rgb-shade), .15)' : undefined }}>{folded.has(data.estimates[i].id) ? '' : usd(c)}</td>)}
                    <td style={{ ...tot, borderTop: l.key === 'subtotal' ? '1px solid rgba(var(--rgb-shade), .15)' : undefined }}>{usd(l.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, ...first, fontWeight: 800, borderTop: '2px solid var(--ink)' }}>Total project</td>
                  {data.totals.map((t, i) => <td key={i} style={{ ...td, fontWeight: 800, borderTop: '2px solid var(--ink)' }}>{cell(t)}</td>)}
                  <td style={{ ...tot, fontWeight: 800, borderTop: '2px solid var(--ink)' }}>{cell(data.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {(data.byBuilding.length > 0 || data.byFunding.length > 0) && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {([['By building', data.byBuilding], ['By who pays', data.byFunding]] as [string, Group[]][]).filter(([, gs]) => gs.length).map(([title, gs]) => (
                <section key={title} aria-label={title} style={{ flex: '1 1 240px', border: '1px solid rgba(var(--rgb-shade), .1)', borderRadius: 12, padding: '10px 14px' }}>
                  <b style={{ fontSize: 12.5 }}>{title}</b>
                  {gs.map((g) => (
                    <Fragment key={g.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid rgba(var(--rgb-shade), .06)' }}>
                        <span>{g.label} <small style={{ color: 'var(--muted)' }}>({g.estimateIds.length})</small></span><b>{cell(g.total)}</b>
                      </div>
                    </Fragment>
                  ))}
                </section>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            Each estimate keeps its own sub contracts per building; estimates for the same building split only by who pays share one contract per sub (set when you “Set up the job”).
          </div>
        </>
      )}
    </div>
  );
}
