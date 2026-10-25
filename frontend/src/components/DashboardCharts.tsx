import { useState } from 'react';
import { axisTicks, axisTop, barFill, DELIVERY_CODES, type BillingMonth, type DeliveryCode, type ProjectBar } from '../data/dashboardCharts';
import './DashboardCharts.css';

const usd = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pctOf = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const monthName = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' });

/**
 * The New-look dashboard's charts, on live figures (Oct 2026): invoiced vs
 * collected by month with what's still open, and each project's contract,
 * billing, costs and time used (the Classic look's charts, which ran on
 * sample figures).
 */
export function DashboardCharts({ billing, bars, go }: { billing: BillingMonth[] | null; bars: ProjectBar[] | null; go: (to: string) => void }) {
  const [month, setMonth] = useState<string | null>(null);
  const [allBars, setAllBars] = useState(false);
  const [kind, setKind] = useState<'all' | DeliveryCode>('all');
  const [openBar, setOpenBar] = useState<number | null>(null);
  if (!billing && !bars) return null;

  const months = billing || [];
  const top = axisTop(Math.max(0, ...months.map((m) => Math.max(m.invoiced, m.collected, m.pastDue + m.withinTerms))));
  const sum = (k: 'invoiced' | 'collected' | 'pastDue' | 'withinTerms' | 'retention') => months.reduce((a, m) => a + (m[k] || 0), 0);
  const open = month ? months.find((m) => m.month === month)?.open || [] : months.flatMap((m) => m.open);
  const filtered = (bars || []).filter((b) => kind === 'all' || b.delivery === kind);
  const shownBars = filtered.slice(0, allBars ? undefined : 8);
  const ticks = axisTicks(Math.max(1, ...filtered.map((b) => b.total)));
  const maxTotal = ticks[ticks.length - 1].value;

  return (
    <div className="dc">
      {bars && bars.length > 0 && (
        <section className="do-card dc-card dc-budget" aria-label="Budget and time vs used by project">
          <div className="do-card-head dc-budget-head">
            <div>
              <h3>Budget &amp; Time vs Used by Project</h3>
              <p className="dc-sub">Roll-up of {filtered.length} of {bars.length} projects · filtered by delivery type</p>
            </div>
            <div className="dc-chips" role="group" aria-label="Delivery type">
              {(['all', ...DELIVERY_CODES] as const).map((c) => (
                <button type="button" key={c} className={'dc-chip' + (kind === c ? ' is-on' : '')} aria-pressed={kind === c} onClick={() => { setKind(c); setOpenBar(null); }}>{c === 'all' ? 'All' : c}</button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? <p className="dc-sub">No {kind} projects with a contract yet.</p> : (
            <div className="dc-roll">
              <div className="dc-grid" aria-hidden>{ticks.map((t) => <i key={t.f} style={{ left: `${t.f * 100}%` }} />)}</div>
              <div className="dc-ticks" aria-hidden>{ticks.map((t) => <span key={t.f}>{usd(t.value)}</span>)}</div>
              {shownBars.map((b) => {
                const f = barFill(b);
                const w = `${Math.max(8, (b.total / maxTotal) * 100)}%`;
                const open = openBar === b.projectId;
                return (
                  <div key={b.projectId} className={'dc-row' + (b.hot ? ' is-hot' : '') + (open ? ' is-expanded' : '')} style={{ ['--w' as any]: w }}>
                    <button type="button" className="dc-row-btn" aria-expanded={open} onClick={() => setOpenBar(open ? null : b.projectId)}>
                      <span className="dc-row-head">
                        <span className="dc-proj-name">{b.name}</span>
                        {b.delivery && <span className="dc-pill is-del">{b.delivery}</span>}
                        {b.pricing && <span className="dc-pill is-price">{b.pricing}</span>}
                        {b.labor && <span className="dc-pill is-labor">{b.labor}</span>}
                        <span className="dc-row-pcts">
                          {b.timePct != null && <><span className="dc-muted">{b.timePct}% Time Used</span><span className="dc-sep">|</span></>}
                          <span className="dc-used">{b.dollarPct}% $ Used</span>
                          {b.hot && <span className="dc-flag" title="90%+ billed, or time well ahead of billing">!</span>}
                        </span>
                      </span>
                      <span className="dc-bar-wrap">
                        <span className="dc-main" role="img" aria-label={`${usd0(b.billed + b.reimbBilled)} billed of ${usd0(b.total)}${b.timePct != null ? `, ${b.timePct}% of the time used` : ''}`}>
                          <span className="dc-sec" style={{ width: `${f.base}%` }}><span className="dc-fill" style={{ width: f.base ? `${(f.baseFill / f.base) * 100}%` : 0 }} /></span>
                          {b.co > 0 && <span className="dc-sec" style={{ width: `${f.co}%` }}><span className="dc-fill" style={{ width: `${(f.coFill / f.co) * 100}%` }} /></span>}
                          {b.reimb > 0 && <span className="dc-sec" style={{ width: `${f.reimb}%` }}><span className="dc-fill" style={{ width: `${(f.reimbFill / f.reimb) * 100}%` }} /></span>}
                        </span>
                        {b.timePct != null && <span className="dc-marker" style={{ left: `${b.timePct}%` }} />}
                      </span>
                      {(b.timePct != null || b.spentPct != null) && (
                        <span className="dc-line">
                          <span className="dc-line-bars">
                            {b.timePct != null && <span className="dc-line-time" style={{ width: `${Math.min(100, b.timePct)}%` }} />}
                            {b.spentPct != null && <span className={'dc-line-spent' + (b.spentHot ? ' is-hot' : '')} style={{ width: `${Math.min(100, b.spentPct)}%` }} />}
                          </span>
                          {b.timePct != null && <span className="dc-muted">{b.timePct}% time</span>}
                          {b.timePct != null && b.spentPct != null && <span className="dc-sep">|</span>}
                          {b.spentPct != null && <span className={'dc-spent' + (b.spentHot ? ' is-hot' : '')}>{b.spentPct}% spent</span>}
                        </span>
                      )}
                      <span className="dc-foot">
                        <b>{usd(b.base)}</b><span className="dc-muted">+</span><b>{usd(b.co)}</b><span className="dc-muted">+</span><b>{usd(b.reimb)}</b>
                        <span className="dc-foot-right">{usd(b.billed + b.reimbBilled)} of {usd(b.total)}{b.stage ? ` · ${b.stage}` : ''}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="dc-tip">
                        {[
                          ['Original contract', `${usd0(b.base)} · ${pctOf(Math.min(b.billed, b.base), b.base)}% billed`],
                          ['Change orders', b.co ? `${usd0(b.co)} · ${pctOf(Math.max(0, Math.min(b.billed, b.base + b.co) - b.base), b.co)}% billed` : 'none'],
                          ['Reimbursables', b.reimb ? `${usd0(b.reimb)} · ${pctOf(b.reimbBilled, b.reimb)}% billed` : 'none'],
                          ['Total contract', usd0(b.total)],
                          ['Billed to date', `${usd0(b.billed + b.reimbBilled)} · ${b.dollarPct}%`],
                          ['Paid', usd0(b.paid)],
                          ...(b.spent != null ? [['Costs spent', `${usd0(b.spent)} · ${b.spentPct}%`]] : []),
                          ['Time used', b.timePct != null ? `${b.timePct}%` : 'No start date or duration'],
                          ['Phase', b.stage || '—'],
                          ['Delivery / pricing / labour', [b.delivery, b.pricing, b.labor].map((x) => x || '—').join(' · ')],
                        ].map(([k, v]) => <div key={k} className="dc-tip-row"><span>{k}</span><b>{v}</b></div>)}
                        <button type="button" className="dc-link" onClick={() => go('/fin_project')}>Project Finance →</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length > 8 && <button type="button" className="dc-link dc-all" onClick={() => setAllBars(!allBars)}>{allBars ? 'Show fewer' : `Show all ${filtered.length} projects`}</button>}
          <div className="dc-legend dc-budget-legend">
            <span><i className="is-col" />On track</span>
            <span><i className="is-hot" />Over 90% or slipping</span>
            <span><i className="is-gray" />Schedule time used</span>
            <span><span className="dc-tri" />Marker = time used · bar length = total contract</span>
          </div>
        </section>
      )}

      {billing && (
        <section className="do-card dc-card" aria-label="Invoiced vs collected">
          <div className="do-card-head">
            <h3>Invoiced vs Collected</h3>
            <button type="button" className="dc-link" onClick={() => go('/fin_project')}>Project Finance →</button>
          </div>
          <div className="dc-legend">
            <span><i className="is-inv" />Invoiced {usd(sum('invoiced'))}</span>
            <span><i className="is-col" />Collected {usd(sum('collected'))}</span>
            <span><i className="is-open" />Still open</span>
            <span><i className="is-late" />Past due</span>
          </div>
          <div className="dc-chart" role="img" aria-label={`Invoiced ${usd0(sum('invoiced'))} and collected ${usd0(sum('collected'))} over ${months.length} months`}>
            <div className="dc-axis">{[1, 0.5, 0].map((f) => <span key={f}>{usd(top * f)}</span>)}</div>
            <div className="dc-cols">
              {months.map((m) => {
                const h = (v: number) => `${Math.max(0, (v / top) * 100)}%`;
                const openAmt = m.pastDue + m.withinTerms;
                return (
                  <button type="button" key={m.month} className={'dc-col' + (month === m.month ? ' is-on' : '')} onClick={() => setMonth(month === m.month ? null : m.month)}
                    title={`${monthName(m.month)}: invoiced ${usd0(m.invoiced)}, collected ${usd0(m.collected)}${openAmt ? `, ${usd0(openAmt)} still open` : ''}`}>
                    <span className="dc-bars">
                      <span className="dc-bar is-inv" style={{ height: h(m.invoiced) }}>
                        {openAmt > 0 && <span className={'dc-open' + (m.pastDue ? ' is-late' : '')} style={{ height: `${Math.min(100, (openAmt / Math.max(m.invoiced, 1)) * 100)}%` }} />}
                      </span>
                      <span className="dc-bar is-col" style={{ height: h(m.collected) }} />
                    </span>
                    <span className="dc-month">{monthName(m.month)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="dc-tiles">
            <div className="dc-tile is-late"><span>Past due</span><b>{usd0(sum('pastDue'))}</b></div>
            <div className="dc-tile"><span>Within terms</span><b>{usd0(sum('withinTerms'))}</b></div>
            <div className="dc-tile"><span>Retention held</span><b>{usd0(sum('retention'))}</b></div>
          </div>
          {open.length > 0 && (
            <div className="dc-open-list">
              <div className="dc-open-head">{month ? `Open from ${monthName(month)}` : 'Open invoices'} · {open.length}{month && <button type="button" className="dc-link" onClick={() => setMonth(null)}>All months</button>}</div>
              {open.slice(0, 8).map((i) => (
                <button type="button" key={i.id} className="dc-open-row" onClick={() => go('/fin_project')}>
                  <span className="dc-open-name"><b>{i.number}</b> · {i.project}</span>
                  <span className={i.pastDue ? 'dc-due is-late' : 'dc-due'}>{i.pastDue ? 'Past due' : i.dueDate ? `Due ${new Date(i.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Open'}</span>
                  <b>{usd0(i.unpaid)}</b>
                </button>
              ))}
              {open.length > 8 && <div className="dc-more">+{open.length - 8} more in Project Finance</div>}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
