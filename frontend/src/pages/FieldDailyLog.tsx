import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MapLink } from '../components/ContactLinks';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { SaveBar, useAutosave } from '../autosave';

// ------------------------------------------------------------------ shapes

interface Entry { employeeId: string; csiCodeId?: string; hours?: number; taskDetail?: string; taskStatus?: string; team?: string }
interface Day { notes: string; entries: Entry[] }
interface Log { id: string | null; status: string; rejectionNote?: string; submittedAt?: string; approvedByName?: string }
interface Emp { id: string; name: string; workerId?: string; tradeId?: string; trade?: string; designation?: string; employmentStatus?: string; status?: string }
interface Code { id: string; code: string; division: string; active: boolean }
interface Assign { employeeId: string; projectId: number; startDate: string; endDate?: string }

const INK = 'var(--ink)';
const MUTED = 'var(--muted)';
const ACCENT = 'var(--forest)';
const LINE = 'rgba(var(--rgb-shade), .08)';
const BG = 'var(--font-display)';
const LEFT = ['resigned', 'terminated', 'contract_expired', 'demobilized'];
const STATUSES: [string, string][] = [['start', 'Start'], ['continued', 'Cont.'], ['completing', 'Done']];
const QUICK_HOURS = [4, 8, 10, 12];
const TEAMS = ['A', 'B', 'C', 'D'];
const QUICK_NOTES = ['Weather delay', 'Inspection passed', 'Inspection failed', 'Material delivered', 'Toolbox / safety talk', 'Visitor on site', 'Equipment issue', 'Waiting on another trade'];
const PROJECT_KEY = 'origami.fieldProject';
// Columns: worker · hours · cost code · task · team · work done
const COLS = 'minmax(190px, 1.3fr) 250px minmax(150px, 1fr) 150px 128px minmax(170px, 1.4fr)';

const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const shift = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return localISO(d); };
const niceDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// ------------------------------------------------------------------ small controls

const cellBtn = (on: boolean, disabled?: boolean): React.CSSProperties => ({
  minWidth: 30, height: 28, padding: '0 7px', borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  cursor: disabled ? 'default' : 'pointer', border: '1px solid ' + (on ? ACCENT : 'rgba(var(--rgb-shade), .12)'),
  background: on ? ACCENT : 'var(--surface)', color: on ? 'white' : INK, whiteSpace: 'nowrap', opacity: disabled && !on ? 0.55 : 1,
});
const cellInput: React.CSSProperties = {
  boxSizing: 'border-box', height: 30, borderRadius: 7, border: '1px solid rgba(var(--rgb-shade), .12)', padding: '0 8px',
  fontSize: 12.5, fontFamily: 'inherit', background: 'var(--surface)', color: INK, outline: 'none', width: '100%', minWidth: 0,
};
const pill = (on: boolean): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  border: '1px solid ' + (on ? ACCENT : 'rgba(var(--rgb-shade), .12)'), background: on ? ACCENT : 'var(--surface)', color: on ? 'white' : 'var(--body)',
});

function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid ' + LINE, borderRadius: 'var(--r-14)', ...style }}>{children}</div>;
}

// ------------------------------------------------------------------ the page

/**
 * The superintendent's daily log, as a sheet: every employee is a row, and a
 * click on an hours button puts them on today's log. Cost code, task, team and
 * what they worked on sit on the same row; "fill down" sets everyone at once,
 * and the arrow keys / Enter move between rows. It saves by itself 3 seconds
 * after the last change. The same log the office sees under Manpower -> Daily
 * Log, and approving it there makes the timesheets.
 */
export function FieldDailyLog() {
  const { authUser, toast } = useApp();
  // Only for site superintendents; the office works in Manpower -> Daily Log.
  const runsSite = !!authUser?.isSuperintendent;
  const [projects, setProjects] = useState<{ id: number; name: string; location?: string }[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [assignments, setAssignments] = useState<Assign[]>([]);
  // ?project=&date= opens a past log (from the superintendent's dashboard).
  const [params] = useSearchParams();
  const [projectId, setProjectId] = useState<number | ''>(() => { const p = Number(params.get('project')); if (p) return p; try { return Number(localStorage.getItem(PROJECT_KEY)) || ''; } catch { return ''; } });
  const [date, setDate] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date')! : localISO()));
  const [log, setLog] = useState<Log | null>(null);
  const [saved, setSaved] = useState<Day | null>(null);
  const [draft, setDraft] = useState<Day>({ notes: '', entries: [] });
  const [loadKey, setLoadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const logIdRef = useRef<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.projects.list().then((r: any) => {
      const real = (Array.isArray(r) ? r : []).filter((p: any) => p.stage !== 'Kickoff').map((p: any) => ({ id: p.id, name: p.name, location: p.location }));
      setProjects(real);
      setProjectId((cur) => (cur && real.some((p: any) => p.id === cur) ? cur : real[0]?.id ?? ''));
    }).catch(() => { });
    api.employees.list().then((r: any) => setEmployees((Array.isArray(r) ? r : []).filter((e: Emp) => !LEFT.includes(e.employmentStatus || '') && e.status !== 'inactive'))).catch(() => { });
    api.csiCodes.list().then((r: any) => setCodes((Array.isArray(r) ? r : []).filter((c: Code) => c.active))).catch(() => { });
    api.assignments.list({ status: 'current' }).then((r: any) => setAssignments(Array.isArray(r) ? r : [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    try { localStorage.setItem(PROJECT_KEY, String(projectId)); } catch { /* ignore */ }
    setLoading(true);
    api.dailyLogs.day(Number(projectId), date).then((r: any) => {
      const day: Day = {
        notes: r.log?.notes || '',
        entries: (r.entries || []).map((e: any) => ({ employeeId: e.employeeId, csiCodeId: e.csiCodeId || '', hours: e.hours ?? undefined, taskDetail: e.taskDetail || '', taskStatus: e.taskStatus || 'continued', team: e.team || '' })),
      };
      setLog(r.log || null);
      logIdRef.current = r.log?.id || null;
      setSaved(day);
      setDraft(day);
      setLoadKey((n) => n + 1);
    }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setLoading(false));
  }, [projectId, date]);

  const locked = !!log && log.status !== 'draft' && log.status !== 'rejected';
  const editable = runsSite && !!projectId && !locked && !loading;

  // Saves 3 seconds after the last change -- the whole day in one request.
  const auto = useAutosave<Day>({
    draft, saved, resetKey: `day-${projectId}-${date}-${loadKey}`, enabled: editable, label: 'daily log',
    save: async (_c, { draft: d }) => {
      const r: any = await api.dailyLogs.save({ projectId: Number(projectId), date, notes: d.notes, entries: d.entries.filter((e) => e.employeeId) });
      logIdRef.current = r?.log?.id || logIdRef.current;
      setLog(r?.log || null);
      return { ...d };
    },
  });

  // ---- rows: only the employees deployed to this project (Manpower -> Deployment),
  // those on the log first. Anyone already on the log stays visible so they can be taken off.
  const onSite = useMemo(() => new Set(assignments.filter((a) => a.projectId === projectId && a.startDate <= date && (!a.endDate || a.endDate >= date)).map((a) => a.employeeId)), [assignments, projectId, date]);
  const entryOf = (id: string) => draft.entries.find((e) => e.employeeId === id);
  const inLog = new Set(draft.entries.map((e) => e.employeeId));
  const q = query.trim().toLowerCase();
  const rows = employees
    .filter((e) => inLog.has(e.id) || onSite.has(e.id))
    .filter((e) => !q || [e.name, e.workerId, e.trade, e.designation].filter(Boolean).join(' ').toLowerCase().includes(q))
    .sort((a, b) => Number(inLog.has(b.id)) - Number(inLog.has(a.id)) || Number(onSite.has(b.id)) - Number(onSite.has(a.id)) || a.name.localeCompare(b.name));
  // Logged people who are no longer on the employee list still show, so nothing on the log is hidden.
  const orphans = draft.entries.filter((e) => !employees.some((x) => x.id === e.employeeId));

  const codeOf = (id?: string) => codes.find((c) => c.id === id);
  const lastCode = draft.entries.map((e) => e.csiCodeId).filter(Boolean).pop() || '';

  const setEntries = (fn: (e: Entry[]) => Entry[]) => setDraft((d) => ({ ...d, entries: fn(d.entries) }));
  /** Change a row; a row not on the log yet joins it (8 h, the last cost code used). */
  const patch = (id: string, p: Partial<Entry>) => setEntries((es) => (es.some((e) => e.employeeId === id)
    ? es.map((e) => (e.employeeId === id ? { ...e, ...p } : e))
    : [...es, { employeeId: id, hours: 8, taskStatus: 'continued', csiCodeId: lastCode, taskDetail: '', team: '', ...p }]));
  const remove = (id: string) => setEntries((es) => es.filter((e) => e.employeeId !== id));
  const setHours = (id: string, h: number) => (h > 0 ? patch(id, { hours: h }) : remove(id));
  const everyone = (p: Partial<Entry>) => setEntries((es) => es.map((e) => ({ ...e, ...p })));
  const addCrew = () => setEntries((es) => [...es, ...employees.filter((e) => onSite.has(e.id) && !es.some((x) => x.employeeId === e.id)).map((e) => ({ employeeId: e.id, hours: 8, taskStatus: 'continued', csiCodeId: lastCode, taskDetail: '', team: '' }))]);
  const addNote = (line: string) => setDraft((d) => ({ ...d, notes: d.notes.trim() ? `${d.notes.trim()}\n${line}` : line }));
  const totalHours = draft.entries.reduce((a, e) => a + (Number(e.hours) || 0), 0);
  const noCode = draft.entries.filter((e) => !e.csiCodeId).length;
  const crewMissing = employees.filter((e) => onSite.has(e.id) && !inLog.has(e.id)).length;

  /** Arrow keys / Enter move between rows in the same column, like a spreadsheet. */
  const move = (ev: React.KeyboardEvent<HTMLElement>, col: string, row: number) => {
    const dir = ev.key === 'ArrowDown' || (ev.key === 'Enter' && !ev.shiftKey) ? 1 : ev.key === 'ArrowUp' || (ev.key === 'Enter' && ev.shiftKey) ? -1 : 0;
    if (!dir) return;
    const next = sheetRef.current?.querySelector<HTMLElement>(`[data-cell="${col}-${row + dir}"]`);
    if (next) { ev.preventDefault(); next.focus(); if (next instanceof HTMLInputElement) next.select(); }
  };

  const submit = async () => {
    if (!draft.entries.length) { toast('⚠ Put at least one person on the log first'); return; }
    if (noCode) { toast(`⚠ ${noCode} ${noCode === 1 ? 'row has' : 'rows have'} no cost code yet`); return; }
    setSubmitting(true);
    try {
      const ok = await auto.saveNow();
      if (!ok || !logIdRef.current) throw new Error(auto.error || 'Could not save the log');
      const r: any = await api.dailyLogs.submit(logIdRef.current);
      setLog(r);
      toast('Submitted — the office gets a PDF + Excel copy by email');
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not submit')); }
    finally { setSubmitting(false); }
  };

  const statusStyle: Record<string, [string, string, string]> = {
    draft: ['var(--c-efede8)', 'var(--c-5c6b65)', 'Draft — not sent yet'], submitted: ['var(--c-fbf0cc)', 'var(--c-8a6d12)', 'Submitted — waiting for approval'],
    approved: ['var(--c-d2ead3)', 'var(--c-1e6b36)', 'Approved — timesheets created'], rejected: ['#F2DFD4', '#8E2E0A', 'Sent back — fix and submit again'],
  };
  const st = statusStyle[log?.status || 'draft'] || statusStyle.draft;
  const project = projects.find((p) => p.id === projectId);

  if (!runsSite) {
    return (
      <Card style={{ maxWidth: 480, padding: 22, display: 'grid', gap: 10 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, color: INK }}>This is the superintendent’s daily log</div>
        <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>
          It’s for whoever runs the site — the Site Superintendent role, or an employee whose designation is Superintendent.
          To see or approve daily logs, use <b style={{ color: INK }}>Manpower → Daily Log</b> and <b style={{ color: INK }}>Approvals</b>.
        </div>
        <Link to="/manpower_con" style={{ justifySelf: 'start', padding: '9px 18px', borderRadius: 999, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Open Manpower</Link>
      </Card>
    );
  }

  const row = (emp: Emp | undefined, id: string, i: number) => {
    const e = entryOf(id);
    const on = !!e;
    const code = codeOf(e?.csiCodeId);
    return (
      <div key={id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid ' + LINE, background: on ? (e!.csiCodeId ? '#F6FAF6' : '#FFF9E6') : 'var(--surface)', minWidth: 1100 }}>
        {/* worker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, flex: 'none', background: on ? '#2E8B57' : 'transparent', border: on ? 'none' : '1.5px solid rgba(var(--rgb-shade), .18)' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp?.name || 'Unknown worker'}</div>
            <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[emp?.workerId, emp?.trade || emp?.designation].filter(Boolean).join(' · ')}
              {!onSite.has(id) && <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--c-8a6d12)' }}>not deployed here</span>}
            </div>
          </div>
        </div>
        {/* hours */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input data-cell={`h-${i}`} type="number" min={0} max={24} step={0.5} disabled={!editable} value={on ? e!.hours ?? '' : ''} placeholder="0"
            onChange={(ev) => setHours(id, Math.min(24, Math.max(0, Number(ev.target.value) || 0)))} onKeyDown={(ev) => move(ev, 'h', i)}
            style={{ ...cellInput, width: 52, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} aria-label={`Hours for ${emp?.name || id}`} />
          {QUICK_HOURS.map((h) => <button key={h} type="button" disabled={!editable} onClick={() => setHours(id, on && e!.hours === h ? 0 : h)} style={cellBtn(on && Number(e!.hours) === h, !editable)}>{h}</button>)}
          {on && editable && <button type="button" title="Take off the log" onClick={() => remove(id)} style={{ ...cellBtn(false), color: '#8E2E0A', minWidth: 26, padding: 0 }}>×</button>}
        </div>
        {/* cost code */}
        <select data-cell={`c-${i}`} disabled={!editable} value={e?.csiCodeId || ''} onChange={(ev) => patch(id, { csiCodeId: ev.target.value })} onKeyDown={(ev) => move(ev, 'c', i)}
          title={code ? `${code.code} — ${code.division}` : ''}
          style={{ ...cellInput, borderColor: on && !e!.csiCodeId ? '#D9B650' : 'rgba(var(--rgb-shade), .12)', color: code ? INK : MUTED }}>
          <option value="">{on ? 'Pick a code…' : '—'}</option>
          {codes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
        </select>
        {/* task */}
        <div style={{ display: 'flex', gap: 3 }}>
          {STATUSES.map(([k, l]) => <button key={k} type="button" disabled={!editable || !on} onClick={() => patch(id, { taskStatus: k })} style={cellBtn(on && (e!.taskStatus || 'continued') === k, !editable || !on)}>{l}</button>)}
        </div>
        {/* team */}
        <div style={{ display: 'flex', gap: 3 }}>
          {TEAMS.map((t) => <button key={t} type="button" disabled={!editable || !on} onClick={() => patch(id, { team: e?.team === t ? '' : t })} style={cellBtn(on && e!.team === t, !editable || !on)}>{t}</button>)}
        </div>
        {/* work done */}
        <input data-cell={`w-${i}`} disabled={!editable} value={e?.taskDetail || ''} placeholder={on ? 'What they worked on' : ''}
          onChange={(ev) => (on || ev.target.value ? patch(id, { taskDetail: ev.target.value }) : undefined)} onKeyDown={(ev) => move(ev, 'w', i)} style={cellInput} />
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 14, paddingBottom: 90, animation: 'fadeIn 0.3s ease' }}>
      {/* project + day */}
      <Card style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'grid', gap: 4 }}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={{ ...cellInput, height: 38, fontSize: 14, fontWeight: 700 }}>
            {!projectId && <option value="">Choose a project…</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {project?.location && <div style={{ fontSize: 12, color: MUTED }}><MapLink address={project.location} iconSize={12}>{project.location} · Directions</MapLink></div>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={() => setDate(shift(date, -1))} style={{ ...pill(false), padding: '8px 12px' }} aria-label="Previous day">‹</button>
          <label style={{ position: 'relative', ...pill(true), padding: '8px 16px', minWidth: 150, textAlign: 'center' }}>
            {date === localISO() ? `Today · ${niceDate(date)}` : niceDate(date)}
            <input type="date" value={date} max={localISO()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Pick a date" />
          </label>
          <button type="button" onClick={() => date < localISO() && setDate(shift(date, 1))} style={{ ...pill(false), padding: '8px 12px', opacity: date < localISO() ? 1 : 0.4 }} aria-label="Next day">›</button>
          {date !== localISO() && <button type="button" onClick={() => setDate(localISO())} style={pill(false)}>Today</button>}
        </div>
      </Card>

      {loading ? <div style={{ fontSize: 13, color: MUTED, padding: 20 }}>Loading…</div> : !projectId ? null : (
        <>
          {/* status + sheet tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '6px 12px', borderRadius: 999, background: st[0], color: st[1], fontSize: 12.5, fontWeight: 700 }}>{st[2]}</span>
            <span style={{ fontSize: 12.5, color: MUTED, fontVariantNumeric: 'tabular-nums' }}><b style={{ color: INK }}>{draft.entries.length}</b> on the log · <b style={{ color: INK }}>{totalHours}</b> h{noCode ? <span style={{ color: 'var(--c-8a6d12)' }}> · {noCode} need a cost code</span> : null}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTED }}><b style={{ color: INK }}>{onSite.size}</b> deployed to this project</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person…" style={{ ...cellInput, width: 170, height: 32, borderRadius: 999, padding: '0 12px' }} />
          </div>
          {log?.status === 'rejected' && log.rejectionNote && <div style={{ fontSize: 13, color: '#8E2E0A', background: '#F2DFD4', borderRadius: 'var(--r-12)', padding: 12 }}>Sent back: {log.rejectionNote}</div>}

          {editable && (
            <Card style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--panel)' }}>
              {crewMissing > 0 && <button type="button" onClick={addCrew} style={pill(true)}>+ Put the crew on the log ({crewMissing}) · 8 h</button>}
              {draft.entries.length > 1 && (
                <>
                  <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em', marginLeft: 4 }}>Fill down</span>
                  {QUICK_HOURS.map((h) => <button key={h} type="button" onClick={() => everyone({ hours: h })} style={cellBtn(false)}>{h} h</button>)}
                  <select value="" onChange={(ev) => ev.target.value && everyone({ csiCodeId: ev.target.value })} style={{ ...cellInput, width: 180, height: 28 }}>
                    <option value="">Cost code for everyone…</option>
                    {codes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
                  </select>
                  {STATUSES.map(([k, l]) => <button key={k} type="button" onClick={() => everyone({ taskStatus: k })} style={cellBtn(false)}>{l}</button>)}
                  {TEAMS.map((t) => <button key={t} type="button" onClick={() => everyone({ team: t })} style={cellBtn(false)}>Team {t}</button>)}
                </>
              )}
              {crewMissing === 0 && draft.entries.length <= 1 && <span style={{ fontSize: 12.5, color: MUTED }}>Click an hours button on a row to put that person on the log. ↑ ↓ and Enter move between rows.</span>}
            </Card>
          )}

          {/* the sheet */}
          <Card style={{ overflow: 'hidden' }}>
            <div ref={sheetRef} style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '10px 14px', background: '#F4F1EA', fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.07em', minWidth: 1100, position: 'sticky', top: 0 }}>
                <span>Worker</span><span>Hours</span><span>Cost code</span><span>Task</span><span>Team</span><span>Work done</span>
              </div>
              {rows.map((emp, i) => row(emp, emp.id, i))}
              {orphans.map((e, k) => row(undefined, e.employeeId, rows.length + k))}
              {!rows.length && !orphans.length && (
                <div style={{ padding: 22, fontSize: 13, color: MUTED, textAlign: 'center', borderTop: '1px solid ' + LINE }}>
                  {q ? 'No one matches that search.' : 'Nobody is deployed to this project on this day. The office assigns the crew in Manpower → Deployment.'}
                </div>
              )}
            </div>
          </Card>

          {/* notes */}
          <Card style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK }}>Site notes</div>
            {editable && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUICK_NOTES.map((n) => <button key={n} type="button" onClick={() => addNote(n)} style={{ ...pill(false), padding: '5px 11px', fontSize: 12 }}>+ {n}</button>)}
              </div>
            )}
            <textarea disabled={!editable} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Anything else about today (optional)" rows={3}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), .12)', padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', color: INK }} />
          </Card>

          {/* save + submit */}
          <div style={{ position: 'sticky', bottom: 0, zIndex: 5, background: 'var(--surface)', border: '1px solid ' + LINE, borderRadius: 'var(--r-14)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 -6px 20px rgba(var(--rgb-ink), .06)' }}>
            {editable ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}><SaveBar auto={auto} /></div>
                <button type="button" onClick={submitting ? undefined : submit} style={{ padding: '10px 22px', borderRadius: 999, border: 'none', background: ACCENT, color: '#fff', fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Sending…' : `Submit day · ${totalHours} h`}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: MUTED }}>{locked ? 'This day has been submitted — the office can send it back if something needs changing.' : 'Read only.'}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

