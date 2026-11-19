import { Fragment, useEffect, useState } from 'react';
import { api } from '../../api';

type Pair = { low: number | null; high: number | null } | null;
type Cmp = { estimates: { id: string; label: string; date: string | null }[]; rows: { key: string; label: string; cells: Pair[]; changes: Pair[] }[]; totals: Pair[]; totalChanges: Pair[] };
const usd = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
const delta = (n: number | null | undefined) => (n == null ? '—' : n === 0 ? '·' : `${n > 0 ? '+' : '−'}${usd(Math.abs(n))}`);

/**
 * Nov 19 (Edward): compare this project's estimates -- any numbers or
 * revisions -- trade by trade: each one's low and high, and what changed
 * from the one before (those columns fold away).
 */
export function CompareEstimates({ projectId, rows }: { projectId: number; rows: { id: string; number: string; rev: number; title?: string | null; estimateDate?: string | null; updatedAt?: string | null }[] }) {
  const sorted = [...rows].sort((a, b) => String(a.estimateDate || a.updatedAt || '').localeCompare(String(b.estimateDate || b.updatedAt || '')));
  const [picked, setPicked] = useState<string[]>(() => sorted.slice(-3).map((r) => r.id));
  const [data, setData] = useState<Cmp | null>(null);
  const [error, setError] = useState('');
  const [showChanges, setShowChanges] = useState(true);
  useEffect(() => {
    if (picked.length < 2) { setData(null); return; }
    setError('');
    (api.finance.estimatesCompare(projectId, picked) as Promise<Cmp>).then(setData).catch((e: Error) => setError(e.message));
  }, [projectId, picked.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  const th: React.CSSProperties = { padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(var(--rgb-shade), .08)' };
  const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12.5, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const chg: React.CSSProperties = { ...td, color: 'var(--muted)', background: 'var(--panel)' };
  return (
    <div className="eg-card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <b style={{ fontSize: 13, marginRight: 6 }}>Compare (2–4):</b>
        {sorted.map((r) => (
          <label key={r.id} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12.5, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .14)', background: picked.includes(r.id) ? 'var(--mist)' : 'var(--surface)', cursor: 'pointer' }}>
            <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />{r.number} Rev {r.rev}{r.title ? ` · ${r.title}` : ''}
          </label>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="eg-btn" aria-pressed={showChanges} onClick={() => setShowChanges((x) => !x)}>{showChanges ? 'Hide changes' : 'Show changes'}</button>
      </div>
      {picked.length < 2 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Tick at least two estimates.</div>}
      {error && <div role="alert" style={{ fontSize: 12.5, color: '#8E2E0A' }}>{error}</div>}
      {data && (
        <div style={{ overflowX: 'auto' }}>
          <table className="est-compare" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }} rowSpan={2}>Trade (CSI)</th>
                {data.estimates.map((e, i) => (
                  <Fragment key={e.id}>
                    {i > 0 && showChanges && <th style={{ ...th, background: 'var(--panel)', textAlign: 'center' }} colSpan={2}>Change</th>}
                    <th style={{ ...th, textAlign: 'center' }} colSpan={2}>{e.label}{e.date ? <div style={{ fontWeight: 400 }}>{e.date}</div> : null}</th>
                  </Fragment>
                ))}
              </tr>
              <tr>
                {data.estimates.map((e, i) => (
                  <Fragment key={e.id}>
                    {i > 0 && showChanges && <><th style={{ ...th, background: 'var(--panel)' }}>Low</th><th style={{ ...th, background: 'var(--panel)' }}>High</th></>}
                    <th style={th}>Low</th><th style={th}>High</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.key} style={{ borderTop: '1px solid rgba(var(--rgb-shade), .05)' }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{r.label}</td>
                  {r.cells.map((c, i) => (
                    <Fragment key={i}>
                      {i > 0 && showChanges && <><td style={chg}>{delta(r.changes[i - 1]?.low)}</td><td style={chg}>{delta(r.changes[i - 1]?.high)}</td></>}
                      <td style={td}>{c ? usd(c.low) : '—'}</td><td style={{ ...td, color: 'var(--muted)' }}>{c ? usd(c.high) : '—'}</td>
                    </Fragment>
                  ))}
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid rgba(var(--rgb-shade), .15)', fontWeight: 700 }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Total project</td>
                {data.totals.map((t, i) => (
                  <Fragment key={i}>
                    {i > 0 && showChanges && <><td style={{ ...chg, fontWeight: 700 }}>{delta(data.totalChanges[i - 1]?.low)}</td><td style={{ ...chg, fontWeight: 700 }}>{delta(data.totalChanges[i - 1]?.high)}</td></>}
                    <td style={{ ...td, fontWeight: 800 }}>{usd(t?.low)}</td><td style={td}>{usd(t?.high)}</td>
                  </Fragment>
                ))}
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>Low is each trade’s price; High is the precon range (price × the scope’s range factor). Oldest on the left.</div>
        </div>
      )}
    </div>
  );
}
