import { useState } from 'react';
import { axisTop, type BillingMonth, type ProjectBar } from '../data/dashboardCharts';
import './DashboardCharts.css';

const usd = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const monthName = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' });

/**
 * The New-look dashboard's charts, on live figures (Oct 2026): invoiced vs
 * collected by month with what's still open, and each project's contract,
 * billing and time used. The Classic look had these on sample figures.
 */
export function DashboardCharts({ billing, bars, go }: { billing: BillingMonth[] | null; bars: ProjectBar[] | null; go: (to: string) => void }) {
  const [month, setMonth] = useState<string | null>(null);
  const [allBars, setAllBars] = useState(false);
  if (!billing && !bars) return null;

  const months = billing || [];
  const top = axisTop(Math.max(0, ...months.map((m) => Math.max(m.invoiced, m.collected, m.pastDue + m.withinTerms))));
  const sum = (k: 'invoiced' | 'collected' | 'pastDue' | 'withinTerms' | 'retention') => months.reduce((a, m) => a + (m[k] || 0), 0);
  const open = month ? months.find((m) => m.month === month)?.open || [] : months.flatMap((m) => m.open);
  const shownBars = (bars || []).slice(0, allBars ? undefined : 6);

  return (
    <div className="dc">
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

      {bars && bars.length > 0 && (
        <section className="do-card dc-card" aria-label="Contract, billing and time by project">
          <div className="do-card-head">
            <h3>Budget &amp; Time Used by Project</h3>
            <button type="button" className="dc-link" onClick={() => go('/fin_project')}>Project Finance →</button>
          </div>
          <div className="dc-legend">
            <span><i className="is-col" />Paid</span>
            <span><i className="is-billed" />Billed, not paid</span>
            <span><i className="is-rest" />Left to bill</span>
            <span><i className="is-time" />Time used</span>
          </div>
          <div className="dc-projects">
            {shownBars.map((b) => (
              <div key={b.projectId} className={'dc-proj' + (b.behind ? ' is-behind' : '')}>
                <div className="dc-proj-head">
                  <span className="dc-proj-name">{b.name}</span>
                  <span className="dc-proj-figs">
                    {usd(b.contract)} · <b>{b.billedPct}% billed</b>{b.timePct != null && <> · {b.timePct}% time</>}
                    {b.behind && <span className="dc-flag" title="Much more of the time has gone than has been billed">!</span>}
                  </span>
                </div>
                <div className="dc-track">
                  <span className="dc-seg is-col" style={{ width: `${Math.min(100, b.paidPct)}%` }} />
                  <span className="dc-seg is-billed" style={{ width: `${Math.max(0, Math.min(100, b.billedPct) - Math.min(100, b.paidPct))}%` }} />
                  {b.timePct != null && <span className="dc-time" style={{ left: `${b.timePct}%` }} aria-label={`${b.timePct}% of the time used`} />}
                </div>
              </div>
            ))}
          </div>
          {(bars.length > 6) && <button type="button" className="dc-link dc-all" onClick={() => setAllBars(!allBars)}>{allBars ? 'Show fewer' : `Show all ${bars.length} projects`}</button>}
        </section>
      )}
    </div>
  );
}
