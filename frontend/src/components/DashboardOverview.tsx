import { useState } from 'react';
import { CountUp } from './CountUp';
import './DashboardOverview.css';

export interface OverviewProps {
  name: string;
  pills: { label: string; pct: number; style: 'dark' | 'yellow' | 'hatch' | 'outline' }[];
  numbers: { label: string; value: string; icon: 'team' | 'tasks' | 'projects' | 'leads' }[];
  /** The project most worth a look; tag says why. */
  featured: { name: string; tag: string; sub: string; amount: string; to: string } | null;
  /** Money received per month (oldest first); null when the person can't see finance. */
  collections: { month: string; value: number }[] | null;
  ring: { title: string; pct: number; label: string; sub: string; to: string } | null;
  attentionTitle: string;
  attentionCount: number;
  attention: { task: string; project: string; due: string; past: boolean; to: string }[];
  attentionSplit: { label: string; n: number; of: number }[];
  funnel: { label: string; n: string; v: number }[];
  team: { name: string; role: string; tasks: number; done: number; av: string }[];
  teamLabel?: string;
  /** This week: the user's Google Calendar meetings and their tasks due. */
  week: { id: string; kind: 'meeting' | 'task'; title: string; date: string; project: string; done: boolean; time?: string; sort?: string; link?: string; to?: string }[];
  /** null while unknown; false shows a prompt to connect Google Calendar. */
  calendarConnected?: boolean | null;
  go: (to: string) => void;
}

const money0 = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const ICON: Record<OverviewProps['numbers'][number]['icon'], string> = {
  team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  leads: 'M3 3v18h18M7 15l4-4 3 3 5-6',
};
const Arrow = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" className="do-arrow" onClick={onClick} aria-label={label} title={label}>
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'currentColor' }}><path d="M7 17 17 7M8 7h9v9" /></svg>
  </button>
);

/**
 * The top of the dashboard in the New look: greeting, headline bars and
 * numbers, then a row of cards (featured project, collections, budget ring,
 * what needs attention) and a second row (funnel / workload, this week).
 */
export function DashboardOverview(p: OverviewProps) {
  const [openFold, setOpenFold] = useState<'funnel' | 'team' | null>('funnel');
  const cols = p.collections || [];
  const maxCol = Math.max(1, ...cols.map((c) => c.value));
  const avgCol = cols.length ? cols.reduce((a, c) => a + c.value, 0) / cols.length : 0;
  const last = cols[cols.length - 1];
  const monthName = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' });

  // This week, Monday first.
  const now = new Date();
  const monday = new Date(now); monday.setHours(12, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayIso = iso(now);
  const range = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const R = 74, C = 2 * Math.PI * R;
  const ringPct = Math.max(0, Math.min(100, p.ring?.pct || 0));

  return (
    <div className="do">
      <div className="do-top">
        <div className="do-top-left">
          <h2 className="do-hello">{greeting()}, {p.name}</h2>
          <div className="do-pills">
            {p.pills.map((x) => (
              <div key={x.label} className="do-pill-col" style={{ flexGrow: Math.max(x.pct, 14) }}>
                <span className="do-pill-label">{x.label}</span>
                <span className={'do-pill is-' + x.style}><CountUp value={`${Math.round(x.pct)}%`} /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="do-numbers">
          {p.numbers.map((n) => (
            <div key={n.label} className="do-number">
              <span className="do-number-value"><CountUp value={n.value} /></span>
              <span className="do-number-label">
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'currentColor' }}><path d={ICON[n.icon]} /></svg>
                {n.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="do-grid">
        {/* Featured project */}
        <button type="button" className="do-card do-feature" onClick={() => p.go(p.featured?.to || '/projects')}>
          {p.featured ? (
            <>
              <span className="do-feature-mark">{p.featured.name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
              <span className="do-feature-meta">
                <span className="do-feature-tag">{p.featured.tag}</span>
                <span className="do-feature-name">{p.featured.name}</span>
                <span className="do-feature-sub">{p.featured.sub}</span>
              </span>
              {p.featured.amount && <span className="do-feature-amount">{p.featured.amount}</span>}
            </>
          ) : <span className="do-feature-meta"><span className="do-feature-tag">Projects</span><span className="do-feature-name">No active projects yet</span></span>}
        </button>

        {/* Collections */}
        <div className="do-card">
          <div className="do-card-head"><h3>Collections</h3><Arrow label="Open Project Finance" onClick={() => p.go('/fin_project')} /></div>
          {p.collections === null ? <div className="do-foot" style={{ marginTop: 14 }}>Your role doesn't include project finance.</div> : <>
          <div className="do-stat"><span className="do-stat-num">{money0(avgCol)}</span><span className="do-stat-sub">Avg. collected<br />per month</span></div>
          <div className="do-bars">
            {cols.map((c, i) => {
              const isLast = i === cols.length - 1;
              return (
                <div key={c.month} className={'do-bar' + (isLast ? ' is-last' : '')}>
                  {isLast && <span className="do-bar-tip">{money0(c.value)}</span>}
                  <span className="do-bar-rail"><span className="do-bar-fill" style={{ height: `${Math.max(6, (c.value / maxCol) * 100)}%`, animationDelay: i * 0.06 + 's' }} /></span>
                  <span className="do-bar-dot" />
                  <span className="do-bar-label">{monthName(c.month).slice(0, 1)}</span>
                </div>
              );
            })}
          </div>
          {last && <div className="do-foot">{monthName(last.month)}: {money0(last.value)} collected</div>}
          </>}
        </div>

        {/* Budget ring */}
        <div className="do-card">
          <div className="do-card-head"><h3>{p.ring?.title || 'Billing'}</h3><Arrow label="Open Project Finance" onClick={() => p.go(p.ring?.to || '/fin_project')} /></div>
          {!p.ring ? <div className="do-foot" style={{ marginTop: 14 }}>Your role doesn't include project finance.</div> : <>
          <div className="do-ring">
            <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
              {Array.from({ length: 60 }, (_, i) => {
                const a = (i / 60) * 2 * Math.PI - Math.PI / 2, long = i % 5 === 0;
                const r1 = 92, r2 = long ? 84 : 87;
                return <line key={i} x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)} x2={100 + r2 * Math.cos(a)} y2={100 + r2 * Math.sin(a)} style={{ stroke: 'rgba(29,29,27,0.18)' }} strokeWidth={long ? 1.6 : 1} strokeLinecap="round" />;
              })}
              <circle cx={100} cy={100} r={R} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth={14} />
              <circle className="do-ring-arc" cx={100} cy={100} r={R} fill="none" style={{ stroke: 'var(--yellow)', strokeDasharray: `${(ringPct / 100) * C} ${C}` }} strokeWidth={14} strokeLinecap="round" transform="rotate(-90 100 100)" />
            </svg>
            <div className="do-ring-center">
              <span className="do-ring-num"><CountUp value={`${Math.round(ringPct)}%`} /></span>
              <span className="do-ring-label">{p.ring.label}</span>
            </div>
          </div>
          <div className="do-foot">{p.ring.sub}</div>
          </>}
        </div>

        {/* Needs attention */}
        <div className="do-card do-attn-wrap">
          <div className="do-card-head"><h3>Needs attention</h3><span className="do-big-num">{p.attentionCount}</span></div>
          <div className="do-split">
            {p.attentionSplit.map((s) => (
              <div key={s.label} className="do-split-col">
                <span className="do-split-pct">{s.of ? Math.round((s.n / s.of) * 100) : 0}%</span>
                <span className="do-split-bar"><span style={{ width: `${s.of ? (s.n / s.of) * 100 : 0}%` }} /><em>{s.label}</em></span>
              </div>
            ))}
          </div>
          <div className="do-attn">
            <div className="do-attn-head"><span>{p.attentionTitle}</span><b>{p.attention.filter((a) => a.past).length}/{p.attention.length}</b></div>
            {p.attention.length === 0 && <div className="do-attn-empty">Nothing on your plate. Nice.</div>}
            {p.attention.map((a, i) => (
              <button type="button" key={a.task + i} className="do-attn-item" onClick={() => p.go(a.to)}>
                <span className="do-attn-icon">{a.past ? '!' : '•'}</span>
                <span className="do-attn-text"><span className="do-attn-title">{a.task}</span><span className="do-attn-sub">{a.project} · {a.due}</span></span>
                <span className={'do-attn-check' + (a.past ? ' is-late' : '')} />
              </button>
            ))}
          </div>
        </div>

        {/* Funnel / workload */}
        <div className="do-card do-fold">
          {([['funnel', 'Lead funnel'], ['team', p.teamLabel || 'Team workload']] as const).map(([k, title]) => (
            <div key={k} className="do-fold-item">
              <button type="button" className="do-fold-head" onClick={() => setOpenFold(openFold === k ? null : k)} aria-expanded={openFold === k}>
                <span>{title}</span>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" style={{ stroke: 'currentColor', transform: openFold === k ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {openFold === k && (
                <div className="do-fold-body">
                  {k === 'funnel' ? p.funnel.map((f) => (
                    <div key={f.label} className="do-fold-row">
                      <span className="do-fold-name">{f.label}</span>
                      <span className="do-fold-track"><span style={{ width: `${f.v}%` }} /></span>
                      <span className="do-fold-n">{f.n}</span>
                    </div>
                  )) : p.team.map((t) => (
                    <div key={t.name} className="do-fold-row is-team">
                      <span className="do-fold-av">{t.av}</span>
                      <span className="do-fold-name">{t.name}<small>{t.role}</small></span>
                      <span className="do-fold-n">{t.done}/{t.tasks}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* This week */}
        <div className="do-card do-week">
          <div className="do-week-head">
            <h3>This week</h3>
            <span className="do-week-range">{range}</span>
            {p.calendarConnected === false && <button type="button" className="do-week-connect" onClick={() => p.go('/my-calendar')}>Connect Google Calendar</button>}
            <Arrow label="Open My Calendar" onClick={() => p.go('/my-calendar')} />
          </div>
          <div className="do-week-grid">
            {days.map((d) => {
              const di = iso(d);
              const items = p.week.filter((w) => w.date === di).sort((a, b) => ((a.sort || '') < (b.sort || '') ? -1 : (a.sort || '') > (b.sort || '') ? 1 : 0));
              return (
                <div key={di} className={'do-day' + (di === todayIso ? ' is-today' : '')}>
                  <div className="do-day-head"><span>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>{d.getDate()}</b></div>
                  <div className="do-day-items">
                    {items.slice(0, 4).map((w) => w.kind === 'meeting' ? (
                      <button type="button" key={w.id} className={'do-event is-meeting' + (di < todayIso ? ' is-past' : '')} title={`${w.time} · ${w.title}`}
                        onClick={() => (w.link ? window.open(w.link, '_blank', 'noopener') : p.go('/my-calendar'))}>
                        <span className="do-event-time">{w.time}</span><span className="do-event-title">{w.title}</span>
                      </button>
                    ) : (
                      <button type="button" key={w.id} className={'do-event' + (w.done ? ' is-done' : di < todayIso ? ' is-late' : '')} title={`${w.title} · ${w.project}`} onClick={() => p.go(w.to || '/tasks')}>{w.title}</button>
                    ))}
                    {items.length > 4 && <button type="button" className="do-more" onClick={() => p.go('/my-calendar')}>+{items.length - 4} more</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
