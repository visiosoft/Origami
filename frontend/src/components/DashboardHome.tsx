import { useState } from 'react';
import { CountUp } from './CountUp';
import { DashboardWeek, type WeekItem } from './DashboardWeek';
import { ago, donutArcs, niceAxis, plot, smoothPath, type Tone } from '../data/dashboardHome';
import './DashboardHome.css';

/** Card colours, as in the Glass look's icon chips and chart lines. */
export type Hue = 'blue' | 'purple' | 'green' | 'orange' | 'teal' | 'red';
const TONE_HUE: Record<Tone, Hue> = { good: 'green', warn: 'orange', bad: 'red', info: 'blue' };

const ICONS = {
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  leads: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6',
  invoiced: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  collected: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const;
export type IconName = keyof typeof ICONS;
const Svg = ({ name, size = 16 }: { name: IconName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'currentColor' }} aria-hidden="true"><path d={ICONS[name]} /></svg>
);

export interface HomeKpi {
  key: string; label: string; value: string; icon: IconName; hue: Hue; to: string;
  /** A line under the value: what it's made of, or how it compares with last month. */
  sub?: string;
  trend?: { up: boolean; pct: number } | null;
  /** Monthly figures behind the value, drawn as a sparkline (real history only). */
  series?: number[];
  /** Or how the value splits up, drawn as a thin stacked bar. */
  split?: { label: string; n: number; hue: Hue }[];
}
export interface HomeSeries { key: string; label: string; hue: Hue; values: number[]; area?: boolean }
export interface HomeRow { key: string; title: string; sub: string; hue: Hue; icon: IconName; to: string; right?: string; rightSub?: string; badge?: string }
export interface HomeProps {
  name: string;
  subtitle: string;
  kpis: HomeKpi[];
  /** Invoiced / collected / past due by month; null when the person can't see finance. */
  chart: { title: string; months: string[]; series: HomeSeries[] } | null;
  range: number; ranges: number[]; onRange: (n: number) => void;
  tasks: HomeRow[]; tasksTitle: string; tasksCount: number;
  projects: HomeRow[]; projectCols: [string, string];
  /** null while loading. */
  activity: { key: string; title: string; sub: string; at: string; tone: Tone; to?: string }[] | null;
  donut: { title: string; total: number; label: string; parts: { label: string; n: number; hue: Hue }[]; action: string; to: string };
  week: WeekItem[];
  calendarConnected?: boolean | null;
  go: (to: string) => void;
}

const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`);
const monthShort = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' });

function Sparkline({ values, hue }: { values: number[]; hue: Hue }) {
  const W = 160, H = 42;
  const pts = plot(values, W, H);
  if (pts.length < 2) return null;
  const line = smoothPath(pts);
  return (
    <svg className={'dh-spark is-' + hue} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`} className="dh-spark-fill" />
      <path d={line} className="dh-spark-line" />
    </svg>
  );
}

function Kpi({ k, go }: { k: HomeKpi; go: (to: string) => void }) {
  const total = (k.split || []).reduce((a, s) => a + s.n, 0);
  return (
    <button type="button" className="dh-card dh-kpi" onClick={() => go(k.to)}>
      <span className="dh-kpi-head"><span className={'dh-chip is-' + k.hue}><Svg name={k.icon} /></span>{k.label}</span>
      <span className="dh-kpi-value"><CountUp value={k.value} /></span>
      <span className="dh-kpi-sub">
        {k.trend && <b className={k.trend.up ? 'is-up' : 'is-down'}>{k.trend.up ? '↗' : '↘'} {k.trend.pct}%</b>}
        {k.sub}
      </span>
      {k.series && k.series.length > 1 ? <Sparkline values={k.series} hue={k.hue} /> : k.split && total > 0 ? (
        <span className="dh-split" title={k.split.map((s) => `${s.label}: ${s.n}`).join(' · ')}>
          {k.split.filter((s) => s.n > 0).map((s) => <span key={s.label} className={'is-' + s.hue} style={{ flexGrow: s.n }} />)}
        </span>
      ) : <span className="dh-split is-empty" />}
    </button>
  );
}

function AreaChart({ chart, range, ranges, onRange }: { chart: NonNullable<HomeProps['chart']>; range: number; ranges: number[]; onRange: (n: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 250, L = 52, T = 14, B = 30, R = 12;
  const iw = W - L - R, ih = H - T - B;
  const max = Math.max(1, ...chart.series.flatMap((s) => s.values));
  const ticks = niceAxis(max);
  const top = ticks[ticks.length - 1];
  const n = chart.months.length;
  const x = (i: number) => L + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v: number) => T + ih - (Math.max(0, v) / top) * ih;
  return (
    <div className="dh-card dh-chart">
      <div className="dh-card-head">
        <h3>{chart.title}</h3>
        <select value={range} onChange={(e) => onRange(Number(e.target.value))} aria-label="Months shown">
          {ranges.map((r) => <option key={r} value={r}>Last {r} months</option>)}
        </select>
      </div>
      <div className="dh-legend">
        {chart.series.map((s) => <span key={s.key}><i className={'is-' + s.hue} />{s.label}</span>)}
      </div>
      <div className="dh-chart-box" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${chart.title}, by month`}>
          <defs>
            {chart.series.filter((s) => s.area).map((s) => (
              <linearGradient key={s.key} id={'dh-g-' + s.key} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" className={'dh-stop is-' + s.hue} stopOpacity={0.28} />
                <stop offset="100%" className={'dh-stop is-' + s.hue} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="dh-grid" />
              <text x={L - 10} y={y(t) + 4} textAnchor="end" className="dh-axis">{money(t)}</text>
            </g>
          ))}
          {chart.months.map((m, i) => <text key={m} x={x(i)} y={H - 8} textAnchor="middle" className="dh-axis">{monthShort(m)}</text>)}
          {chart.series.map((s) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = smoothPath(pts);
            return (
              <g key={s.key} className={'dh-series is-' + s.hue}>
                {s.area && pts.length > 1 && <path d={`${line} L${pts[pts.length - 1][0]},${T + ih} L${pts[0][0]},${T + ih} Z`} fill={`url(#dh-g-${s.key})`} />}
                <path d={line} className="dh-series-line" />
                {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={hover === i ? 5 : 3.5} className="dh-series-dot" />)}
              </g>
            );
          })}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} className="dh-hover-line" />}
          {chart.months.map((m, i) => (
            <rect key={m} x={x(i) - iw / Math.max(1, n - 1) / 2} y={T} width={iw / Math.max(1, n - 1)} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {hover !== null && (
          <div className="dh-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <b>{new Date(chart.months[hover] + '-15T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
            {chart.series.map((s) => <span key={s.key}><i className={'is-' + s.hue} />{s.label}<em>{money(s.values[hover] || 0)}</em></span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function RowList({ rows, empty, go }: { rows: HomeRow[]; empty: string; go: (to: string) => void }) {
  if (!rows.length) return <div className="dh-empty">{empty}</div>;
  return (
    <div className="dh-rows">
      {rows.map((r) => (
        <button type="button" key={r.key} className="dh-row" onClick={() => go(r.to)}>
          {r.badge ? <span className={'dh-num is-' + r.hue}>{r.badge}</span> : <span className={'dh-chip is-' + r.hue}><Svg name={r.icon} /></span>}
          <span className="dh-row-text"><span className="dh-row-title">{r.title}</span><span className="dh-row-sub">{r.sub}</span></span>
          {r.right !== undefined && <span className="dh-row-right">{r.right}{r.rightSub && <small>{r.rightSub}</small>}</span>}
        </button>
      ))}
    </div>
  );
}

const ViewAll = ({ to, go, label = 'View all' }: { to: string; go: (to: string) => void; label?: string }) => (
  <button type="button" className="dh-viewall" onClick={() => go(to)}>{label}</button>
);

/**
 * The Glass dashboard (Oct 29), laid out like the reference: a welcome line,
 * five tiles with sparklines, the billing chart beside my tasks, then
 * projects, recent activity and the lead pipeline, and this week.
 */
export function DashboardHome(p: HomeProps) {
  const R = 58, C = 2 * Math.PI * R;
  const arcs = donutArcs(p.donut.parts.map((x) => x.n), C);
  return (
    <div className="dh">
      <div className="dh-hello">
        <h2>Welcome back, {p.name} <span aria-hidden="true">👋</span></h2>
        <p>{p.subtitle}</p>
      </div>

      <div className="dh-kpis" style={{ ['--n' as string]: p.kpis.length }}>
        {p.kpis.map((k) => <Kpi key={k.key} k={k} go={p.go} />)}
      </div>

      <div className="dh-row2">
        {p.chart ? <AreaChart chart={p.chart} range={p.range} ranges={p.ranges} onRange={p.onRange} /> : (
          <div className="dh-card dh-chart is-empty">
            <div className="dh-card-head"><h3>Billing & collections</h3></div>
            <div className="dh-empty">Your role doesn’t include project finance, so the money chart is hidden.</div>
          </div>
        )}
        <div className="dh-card dh-tasks">
          <div className="dh-card-head"><h3>{p.tasksTitle} <small>{p.tasksCount}</small></h3><ViewAll to="/tasks" go={p.go} /></div>
          <RowList rows={p.tasks} empty="Nothing on your plate. Nice." go={p.go} />
        </div>
      </div>

      <div className="dh-row3">
        <div className="dh-card">
          <div className="dh-card-head"><h3>Projects</h3><ViewAll to="/projects" go={p.go} /></div>
          {p.projects.length > 0 && <div className="dh-cols"><span>{p.projectCols[0]}</span><span>{p.projectCols[1]}</span></div>}
          <RowList rows={p.projects} empty="No active projects yet." go={p.go} />
        </div>
        <div className="dh-card">
          <div className="dh-card-head"><h3>Recent activity</h3><ViewAll to="/notifications" go={p.go} /></div>
          {p.activity === null ? <div className="dh-empty">Loading…</div> : !p.activity.length ? <div className="dh-empty">Nothing new for you yet.</div> : (
            <div className="dh-rows">
              {p.activity.map((a) => (
                <button type="button" key={a.key} className="dh-row is-activity" onClick={() => a.to && p.go(a.to)} disabled={!a.to}>
                  <span className={'dh-status is-' + TONE_HUE[a.tone]}><Svg name={a.tone === 'good' ? 'check' : a.tone === 'bad' ? 'alert' : a.tone === 'warn' ? 'clock' : 'info'} size={13} /></span>
                  <span className="dh-row-text"><span className="dh-row-title">{a.title}</span><span className="dh-row-sub">{a.sub}</span></span>
                  <span className="dh-row-when">{ago(a.at)}<i className={'is-' + TONE_HUE[a.tone]} /></span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="dh-card dh-donut-card">
          <div className="dh-card-head"><h3>{p.donut.title}</h3></div>
          <div className="dh-donut-wrap">
            <div className="dh-donut">
              <svg viewBox="0 0 150 150" aria-hidden="true">
                <circle cx={75} cy={75} r={R} className="dh-donut-track" />
                {p.donut.parts.map((part, i) => arcs[i].len > 0 && (
                  <circle key={part.label} cx={75} cy={75} r={R} className={'dh-donut-arc is-' + part.hue}
                    style={{ strokeDasharray: `${arcs[i].len} ${C}`, strokeDashoffset: arcs[i].offset }} transform="rotate(-90 75 75)" />
                ))}
              </svg>
              <span className="dh-donut-center"><b><CountUp value={String(p.donut.total)} /></b>{p.donut.label}</span>
            </div>
            <ul className="dh-donut-legend">
              {p.donut.parts.map((part) => <li key={part.label}><i className={'is-' + part.hue} /><span>{part.label}</span><b>{part.n}</b></li>)}
            </ul>
          </div>
          <button type="button" className="dh-wide-btn" onClick={() => p.go(p.donut.to)}>{p.donut.action} <Svg name="arrow" size={14} /></button>
        </div>
      </div>

      <DashboardWeek week={p.week} calendarConnected={p.calendarConnected} go={p.go} className="dh-card dh-week do-week" />
    </div>
  );
}
