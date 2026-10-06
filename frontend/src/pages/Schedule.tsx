import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { stageLabel } from '../data/projects';
import { AkPage, AkSeg, AkStats, akDay, akToday } from '../components/ActionKit';
import './Schedule.css';

interface SPhase { id: string; key: string; name: string; color?: string; progress: number; complete: boolean; total: number; start: string | null; end: string | null }
interface SRow {
  projectId: number; name: string; stage: string; contractType?: string; estStart?: string; duration?: string; holdUntil?: string;
  progress: number; currentPhaseKey?: string | null; start: string | null; end: string | null; phases: SPhase[];
}
type Span = { start: string; end: string; estimated: boolean; noEnd?: boolean };

const DAY = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = (s: string) => new Date(s + 'T12:00:00').getTime();
const addDays = (s: string, n: number) => iso(new Date(at(s) + n * DAY));
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** A typed-in estimated start ("Sep 2025", "01-08-2026", "2026-03-01", "2025") as a date, or null. */
export function parseStart(v?: string): string | null {
  const t = (v || '').trim().toLowerCase();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t); // US style: month-day-year
  if (m && +m[1] <= 12) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = /^([a-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(t);
  if (m && MONTHS.includes(m[1])) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-01`;
  m = /^(\d{4})$/.exec(t);
  return m ? `${m[1]}-01-01` : null;
}
/** A typed-in duration ("10 mos", "4 months", "2 years", "6 weeks") in days, or null. */
export function parseDuration(v?: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(d|day|w|wk|week|mo|mos|mon|month|y|yr|year)/i.exec(v || '');
  if (!m) return null;
  const n = parseFloat(m[1]), u = m[2].toLowerCase();
  return Math.round(n * (u.startsWith('d') ? 1 : u.startsWith('w') ? 7 : u.startsWith('y') ? 365 : 30.4));
}
/** Where a project sits on the timeline: its dated work, else its estimated start and duration. */
const spanOf = (r: SRow): Span | null => {
  if (r.start && r.end) return { start: r.start, end: r.end, estimated: false };
  const s = parseStart(r.estStart);
  if (!s) return null;
  const d = parseDuration(r.duration);
  return d ? { start: s, end: addDays(s, d), estimated: true } : { start: s, end: addDays(s, 14), estimated: true, noEnd: true };
};

const PHASE_TONES = ['#F5C443', '#1D1D1B', '#9BB89A', '#C9A27E', '#8EA6C9', '#D59A8E', '#B6A6D2'];
const toneOf = (i: number) => PHASE_TONES[i % PHASE_TONES.length];

/**
 * Construction -> Schedule: every project on one timeline. A project's bar is
 * made of its phases, dated from the tasks under them; a project with nothing
 * dated yet uses its estimated start and duration (drawn hatched). Click a
 * project to see each phase.
 */
export function Schedule() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SRow[] | null>(null);
  const [scope, setScope] = useState<'live' | 'all'>('live');
  const [span, setSpan] = useState<6 | 12 | 24>(12);
  const [offset, setOffset] = useState(0); // months from the default window
  const [open, setOpen] = useState<Set<number>>(new Set());
  useEffect(() => { api.projectPhases.schedule().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, []);

  const today = akToday();
  // The window: starts two months back (for a 12-month view), moved by the arrows.
  const winStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - Math.round(span / 6) + offset); return iso(d); }, [span, offset]);
  const winEnd = useMemo(() => { const d = new Date(winStart + 'T12:00:00'); d.setMonth(d.getMonth() + span); return iso(d); }, [winStart, span]);
  const total = at(winEnd) - at(winStart);
  const x = (s: string) => Math.max(0, Math.min(100, ((at(s) - at(winStart)) / total) * 100));
  /** Unclamped position, so a bar that starts before the window runs off the edge instead of squashing. */
  const xr = (s: string) => ((at(s) - at(winStart)) / total) * 100;
  const months = useMemo(() => { const out: string[] = []; const d = new Date(winStart + 'T12:00:00'); while (iso(d) < winEnd) { out.push(iso(d)); d.setMonth(d.getMonth() + 1); } return out; }, [winStart, winEnd]);

  const live = (rows || []).filter((r) => scope === 'all' || r.stage === 'Design' || r.stage === 'Construction');
  const placed = live.map((r) => ({ r, s: spanOf(r) }));
  const dated = placed.filter((p) => p.s).sort((a, b) => a.s!.start.localeCompare(b.s!.start));
  const undated = placed.filter((p) => !p.s);
  const order = ['Construction', 'Design', 'Kickoff', 'Closeout'];
  const groups = order.map((st) => ({ st, items: dated.filter((p) => p.r.stage === st) })).filter((g) => g.items.length);
  const running = dated.filter((p) => p.s!.start <= today && p.s!.end >= today).length;
  const startingSoon = dated.filter((p) => p.s!.start > today && p.s!.start <= addDays(today, 60)).length;
  const finishingSoon = dated.filter((p) => p.s!.end >= today && p.s!.end <= addDays(today, 60)).length;
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const bar = (s: Span, inner?: React.ReactNode, title?: string) => {
    if (s.end < winStart || s.start > winEnd) return null;
    const l = xr(s.start), w = Math.max(0.6, xr(s.end) - l);
    return <span className={'sc-bar' + (s.estimated ? ' is-est' : '') + (s.noEnd ? ' is-open' : '')} style={{ left: l + '%', width: w + '%' }} title={title}>{inner}</span>;
  };

  return (
    <AkPage lead="Every project on one timeline. Bars come from the dates on each project’s phase tasks; a hatched bar is only the estimated start and duration from the project card. Click a project to see its phases.">
      <AkStats items={[
        { key: 'run', label: 'Running now', value: rows ? running : '—', sub: 'between start and finish today' },
        { key: 'start', label: 'Starting in 60 days', value: rows ? startingSoon : '—' },
        { key: 'end', label: 'Finishing in 60 days', value: rows ? finishingSoon : '—' },
        { key: 'none', label: 'Not scheduled yet', value: rows ? undated.length : '—', sub: 'no dated work or estimate', tone: undated.length ? 'yellow' : undefined },
      ]} />

      <div className="ak-tools">
        <AkSeg value={scope} onChange={setScope} options={[['live', 'Design & construction'], ['all', 'All projects']]} />
        <AkSeg value={String(span) as '6' | '12' | '24'} onChange={(v) => { setSpan(Number(v) as 6 | 12 | 24); setOffset(0); }} options={[['6', '6 months'], ['12', '12 months'], ['24', '2 years']]} />
        <span className="sc-nav">
          <button type="button" className="ak-btn" onClick={() => setOffset((o) => o - Math.max(1, span / 4))} aria-label="Earlier">‹</button>
          <button type="button" className="ak-btn" onClick={() => setOffset(0)}>Today</button>
          <button type="button" className="ak-btn" onClick={() => setOffset((o) => o + Math.max(1, span / 4))} aria-label="Later">›</button>
        </span>
      </div>

      <section className="ak-card sc-card">
        {rows === null ? <div className="ak-empty">Loading…</div> : !dated.length && !undated.length ? <div className="ak-empty">No projects here yet.</div> : (
          <div className="sc-grid" style={{ ['--months' as any]: months.length }}>
            <div className="sc-head">
              <span className="sc-name-h">Project</span>
              <span className="sc-track">
                {months.map((m) => (
                  <span key={m} className={'sc-month' + (m.slice(0, 7) === today.slice(0, 7) ? ' is-now' : '')} style={{ left: x(m) + '%', width: (100 / months.length) + '%' }}>
                    {new Date(m + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}{m.slice(5, 7) === '01' || m === months[0] ? ` ${m.slice(2, 4)}` : ''}
                  </span>
                ))}
              </span>
            </div>
            {groups.map((g) => (
              <Fragment key={g.st}>
                <div className="sc-group">{stageLabel(g.st)} <small>{g.items.length}</small></div>
                {g.items.map(({ r, s }) => {
                  const isOpen = open.has(r.projectId);
                  const dp = r.phases.filter((ph) => ph.start && ph.end);
                  return (
                    <Fragment key={r.projectId}>
                      <div className={'sc-row' + (isOpen ? ' is-open' : '')} role="button" tabIndex={0} onClick={() => toggle(r.projectId)} onKeyDown={(e) => { if (e.key === 'Enter') toggle(r.projectId); }}>
                        <span className="sc-name">
                          <b>{r.name}</b>
                          <small>{s!.estimated ? `Estimated · ${r.estStart || ''}${r.duration ? ' · ' + r.duration : ''}` : `${akDay(s!.start)} – ${akDay(s!.end)}`} · {r.progress}% done</small>
                        </span>
                        <span className="sc-track">
                          {months.map((m) => <i key={m} className="sc-grid-line" style={{ left: x(m) + '%' }} />)}
                          {today >= winStart && today <= winEnd && <i className="sc-today" style={{ left: x(today) + '%' }} />}
                          {bar(s!, !s!.estimated && dp.length ? dp.map((ph) => {
                            const pl = ((at(ph.start!) - at(s!.start)) / Math.max(DAY, at(s!.end) - at(s!.start))) * 100;
                            const pw = ((at(ph.end!) - at(ph.start!)) / Math.max(DAY, at(s!.end) - at(s!.start))) * 100;
                            const idx = r.phases.indexOf(ph);
                            return <i key={ph.id} className="sc-seg" style={{ left: pl + '%', width: Math.max(1, pw) + '%', background: toneOf(idx), opacity: ph.complete ? 0.45 : 1 }} />;
                          }) : null, `${r.name}: ${akDay(s!.start)} – ${s!.noEnd ? 'no duration set' : akDay(s!.end)}`)}
                        </span>
                      </div>
                      {isOpen && (
                        <>
                          {r.phases.map((ph, i) => (
                            <div key={ph.id} className="sc-row is-phase">
                              <span className="sc-name">
                                <span className="sc-dot" style={{ background: toneOf(i) }} />
                                <span><b>{ph.name}</b><small>{ph.start ? `${akDay(ph.start)} – ${akDay(ph.end || ph.start)}` : 'no dates yet'} · {ph.total ? `${ph.progress}%` : 'no tasks'}{ph.key === r.currentPhaseKey ? ' · current' : ''}</small></span>
                              </span>
                              <span className="sc-track">
                                {months.map((m) => <i key={m} className="sc-grid-line" style={{ left: x(m) + '%' }} />)}
                                {today >= winStart && today <= winEnd && <i className="sc-today" style={{ left: x(today) + '%' }} />}
                                {ph.start && ph.end && bar({ start: ph.start, end: ph.end, estimated: false }, <i className="sc-fill" style={{ width: ph.progress + '%', background: toneOf(i) }} />, `${ph.name}: ${akDay(ph.start)} – ${akDay(ph.end)} · ${ph.progress}%`)}
                              </span>
                            </div>
                          ))}
                          <div className="sc-row is-phase is-link">
                            <span className="sc-name"><button type="button" className="ak-link" onClick={() => navigate(`/projects?open=${r.projectId}&tab=phases`)}>Open {r.name}’s phase board →</button></span>
                            <span className="sc-track" />
                          </div>
                        </>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
            {undated.length > 0 && (
              <>
                <div className="sc-group">Not scheduled yet <small>{undated.length}</small></div>
                {undated.map(({ r }) => (
                  <div key={r.projectId} className="sc-row is-link" role="button" tabIndex={0} onClick={() => navigate(`/projects?open=${r.projectId}&tab=phases`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects?open=${r.projectId}&tab=phases`); }}>
                    <span className="sc-name"><b>{r.name}</b><small>{stageLabel(r.stage)} · add dates to its phase tasks, or an estimated start</small></span>
                    <span className="sc-track" />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>
      <div className="sc-legend">
        <span><i className="sc-key" />Dated work (colours are phases)</span>
        <span><i className="sc-key is-est" />Estimated from the project card</span>
        <span><i className="sc-key is-today" />Today</span>
      </div>
    </AkPage>
  );
}
