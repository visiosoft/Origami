import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { stageLabel } from '../data/projects';
import { AkPage, AkPill, AkSeg, AkStats } from '../components/ActionKit';
import './BusinessFinance.css';

interface Row {
  projectId: number; name: string; stage?: string; hasClientContract?: boolean;
  originalContract?: number; approvedChanges?: number; pendingChanges?: number; revisedContract?: number;
  ev?: number; invoiceTotals?: number; paid?: number; arOutstanding?: number; overdue?: number; overdueCount?: number;
  retentionHeld?: number; unbilledEarned?: number; overBilled?: number;
  costToDate?: number; forecastCost?: number; committed?: number; stillToPay?: number;
}
type Line = 'all' | 'db' | 'build' | 'design' | 'other';
const LINES: [Line, string][] = [['all', 'All work'], ['db', 'Design + Build'], ['build', 'Build only'], ['design', 'Design only'], ['other', 'Other']];
/** Which line of business a project is, from its contract type. */
const lineOf = (contractType?: string): Exclude<Line, 'all'> => {
  const t = (contractType || '').toLowerCase();
  const d = /design/.test(t), b = /build|construction|\bbo\b/.test(t);
  return d && b ? 'db' : b ? 'build' : d ? 'design' : 'other';
};
const n = (v?: number) => Number(v) || 0;
const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const short = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : Math.abs(v) >= 1e4 ? `$${Math.round(v / 1e3)}K` : usd(v));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const sum = (rows: Row[], k: keyof Row) => rows.reduce((a, r) => a + n(r[k] as number), 0);
type SortKey = 'name' | 'revisedContract' | 'done' | 'invoiceTotals' | 'paid' | 'arOutstanding' | 'margin';

/**
 * Financial -> Business: every project's finances rolled up -- contract value,
 * work done, billed, collected, outstanding and retention, split into Design +
 * Build, Build only and Design only, with cost and margin for roles that may see
 * profitability. Each project opens its own finances.
 */
export function BusinessFinance() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const [types, setTypes] = useState<Record<number, string>>({});
  const [months, setMonths] = useState<{ month: string; amount: number }[]>([]);
  const [line, setLine] = useState<Line>('all');
  const [active, setActive] = useState<'active' | 'all'>('active');
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: 'revisedContract', desc: true });

  useEffect(() => {
    api.finance.portfolio().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch((e: Error) => { setRows([]); setErr(e.message || 'Could not load'); });
    api.projects.list().then((r: any) => setTypes(Object.fromEntries((Array.isArray(r) ? r : []).map((p: any) => [p.id, p.contractType || ''])))).catch(() => { });
    api.finance.collections(12).then((r) => setMonths(Array.isArray(r) ? r : [])).catch(() => setMonths([]));
  }, []);

  const all = (rows || []).filter((r) => r.hasClientContract);
  const showCosts = all.some((r) => r.forecastCost != null || r.costToDate != null);
  const live = all.filter((r) => active === 'all' || r.stage !== 'Closeout');
  const scoped = live.filter((r) => line === 'all' || lineOf(types[r.projectId]) === line);
  const T = (k: keyof Row) => sum(scoped, k);
  const contract = T('revisedContract'), done = T('ev'), billed = T('invoiceTotals'), paid = T('paid'), ar = T('arOutstanding'), overdue = T('overdue');
  const cost = T('forecastCost'), margin = contract - cost;

  const byLine = useMemo(() => (['db', 'build', 'design', 'other'] as const).map((k) => {
    const rs = live.filter((r) => lineOf(types[r.projectId]) === k);
    return { k, label: LINES.find(([x]) => x === k)![1], count: rs.length, contract: sum(rs, 'revisedContract'), done: sum(rs, 'ev'), billed: sum(rs, 'invoiceTotals'), paid: sum(rs, 'paid'), ar: sum(rs, 'arOutstanding') };
  }).filter((g) => g.count > 0), [live, types]);

  const val = (r: Row, k: SortKey): number | string => k === 'name' ? r.name.toLowerCase() : k === 'done' ? pct(n(r.ev), n(r.revisedContract)) : k === 'margin' ? n(r.revisedContract) - n(r.forecastCost) : n(r[k] as number);
  const table = [...scoped].sort((a, b) => { const x = val(a, sort.k), y = val(b, sort.k); const c = x < y ? -1 : x > y ? 1 : 0; return sort.desc ? -c : c; });
  const head = (k: SortKey, label: string, right = true) => (
    <th className={(right ? 'is-num ' : '') + (sort.k === k ? 'is-sorted' : '')} onClick={() => setSort((s) => ({ k, desc: s.k === k ? !s.desc : k !== 'name' }))}>
      {label}{sort.k === k ? (sort.desc ? ' ↓' : ' ↑') : ''}
    </th>
  );
  const maxMonth = Math.max(1, ...months.map((m) => m.amount));
  const lastMonths = months.slice(-12);

  if (rows && err) return <AkPage lead="The whole business at a glance."><div className="ak-card"><div className="ak-empty">{/403|access/i.test(err) ? 'Your role doesn’t include project finance.' : err}</div></div></AkPage>;

  return (
    <AkPage lead="Every project’s finances added up — contract value, work done, billed, collected and still owed — split by line of business. Click a project to open its finances.">
      <AkStats items={[
        { key: 'c', label: 'Contract value', value: rows ? short(contract) : '—', sub: rows ? `${scoped.length} projects · ${short(T('approvedChanges'))} in approved changes` : '' },
        { key: 'd', label: 'Work done', value: rows ? short(done) : '—', sub: rows ? `${pct(done, contract)}% of contract · ${short(T('unbilledEarned'))} not billed yet` : '' },
        { key: 'b', label: 'Billed', value: rows ? short(billed) : '—', sub: rows ? `${pct(billed, contract)}% of contract` : '' },
        { key: 'p', label: 'Collected', value: rows ? short(paid) : '—', sub: rows ? `${pct(paid, billed)}% of what’s billed` : '' },
        { key: 'a', label: 'Still owed', value: rows ? short(ar) : '—', sub: rows ? (overdue ? `${short(overdue)} overdue` : 'nothing overdue') : '', tone: overdue ? 'dark' : undefined },
        ...(showCosts ? [{ key: 'm', label: 'Forecast margin', value: rows ? short(margin) : '—', sub: `${pct(margin, contract)}% · cost forecast ${short(cost)}`, tone: 'yellow' as const }] : []),
      ]} />

      <div className="ak-tools">
        <AkSeg<Line> value={line} onChange={setLine} options={LINES.filter(([k]) => k === 'all' || byLine.some((g) => g.k === k)).map(([k, l]) => [k, l, k === 'all' ? live.length : byLine.find((g) => g.k === k)?.count])} />
        <AkSeg value={active} onChange={setActive} options={[['active', 'Open projects'], ['all', 'Including closed']]} />
      </div>

      <div className="bf-grid">
        <section className="ak-card bf-lines">
          <div className="ak-card-head"><h3>By line of business</h3><span>contract · billed · collected</span></div>
          {!byLine.length && <div className="ak-empty">{rows ? 'No projects with a client contract yet.' : 'Loading…'}</div>}
          {byLine.map((g) => (
            <button type="button" key={g.k} className={'bf-line' + (line === g.k ? ' is-on' : '')} onClick={() => setLine(line === g.k ? 'all' : g.k)}>
              <span className="bf-line-top"><b>{g.label}</b><small>{g.count} {g.count === 1 ? 'project' : 'projects'}</small><span>{short(g.contract)}</span></span>
              <span className="bf-bar" title={`Billed ${usd(g.billed)} · collected ${usd(g.paid)} of ${usd(g.contract)}`}>
                <i className="is-billed" style={{ width: pct(g.billed, g.contract) + '%' }} />
                <i className="is-paid" style={{ width: pct(g.paid, g.contract) + '%' }} />
              </span>
              <span className="bf-line-sub">{pct(g.billed, g.contract)}% billed · {pct(g.paid, g.contract)}% collected · {short(g.ar)} owed</span>
            </button>
          ))}
          <div className="bf-legend"><span><i className="is-paid" />Collected</span><span><i className="is-billed" />Billed</span><span><i />Contract</span></div>
        </section>

        <section className="ak-card bf-months">
          <div className="ak-card-head"><h3>Collected per month</h3><span>last 12 months · all projects</span></div>
          {!lastMonths.length ? <div className="ak-empty">No payments recorded yet.</div> : (
            <div className="bf-chart" role="img" aria-label="Client payments collected per month">
              {lastMonths.map((m, i) => (
                <div key={m.month} className={'bf-col' + (i === lastMonths.length - 1 ? ' is-now' : '')} title={`${new Date(m.month + '-15T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${usd(m.amount)}`}>
                  <span className="bf-col-val">{m.amount ? short(m.amount) : ''}</span>
                  <span className="bf-col-bar" style={{ height: Math.max(2, (m.amount / maxMonth) * 100) + '%' }} />
                  <span className="bf-col-m">{new Date(m.month + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="ak-card bf-table-card">
        <div className="ak-card-head"><h3>Projects</h3><span>click a column to sort</span></div>
        {rows === null ? <div className="ak-empty">Loading…</div> : !table.length ? <div className="ak-empty">No projects here.</div> : (
          <div className="bf-scroll">
            <table className="bf-table">
              <thead><tr>
                {head('name', 'Project', false)}{head('revisedContract', 'Contract')}{head('done', 'Done')}{head('invoiceTotals', 'Billed')}{head('paid', 'Collected')}{head('arOutstanding', 'Owed')}
                <th className="is-num">Retention</th>{showCosts && head('margin', 'Margin')}
              </tr></thead>
              <tbody>
                {table.map((r) => {
                  const c = n(r.revisedContract), m = c - n(r.forecastCost);
                  return (
                    <tr key={r.projectId} onClick={() => navigate(`/projects?open=${r.projectId}&tab=financial`)}>
                      <td><b>{r.name}</b><small>{[stageLabel(r.stage), LINES.find(([k]) => k === lineOf(types[r.projectId]))?.[1]].filter(Boolean).join(' · ')}</small></td>
                      <td className="is-num">{usd(c)}{n(r.pendingChanges) ? <small>+{short(n(r.pendingChanges))} pending</small> : null}</td>
                      <td className="is-num"><span className="bf-mini"><i style={{ width: Math.min(100, pct(n(r.ev), c)) + '%' }} /></span>{pct(n(r.ev), c)}%</td>
                      <td className="is-num">{usd(n(r.invoiceTotals))}</td>
                      <td className="is-num">{usd(n(r.paid))}</td>
                      <td className="is-num">{usd(n(r.arOutstanding))}{n(r.overdue) ? <AkPill tone="dark">{short(n(r.overdue))} overdue</AkPill> : null}</td>
                      <td className="is-num">{n(r.retentionHeld) ? usd(n(r.retentionHeld)) : '—'}</td>
                      {showCosts && <td className={'is-num' + (m < 0 ? ' is-neg' : '')}>{r.forecastCost != null ? `${usd(m)}` : '—'}{r.forecastCost != null && c ? <small>{pct(m, c)}%</small> : null}</td>}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td><b>Total</b><small>{table.length} projects</small></td>
                <td className="is-num">{usd(contract)}</td><td className="is-num">{pct(done, contract)}%</td><td className="is-num">{usd(billed)}</td><td className="is-num">{usd(paid)}</td>
                <td className="is-num">{usd(ar)}</td><td className="is-num">{usd(T('retentionHeld'))}</td>{showCosts && <td className="is-num">{usd(margin)}</td>}
              </tr></tfoot>
            </table>
          </div>
        )}
      </section>
    </AkPage>
  );
}
