import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { AutosaveProvider, SaveBar, useAutosave } from '../autosave';
import { ServerStatusBanner } from '../components/ServerStatusBanner';
import { LogoMark } from '../components/Logo';

// ------------------------------------------------------------------ shapes

interface Entry { employeeId: string; csiCodeId?: string; hours?: number; taskDetail?: string; taskStatus?: string; team?: string }
interface Day { notes: string; entries: Entry[] }
interface Log { id: string | null; status: string; rejectionNote?: string; submittedAt?: string; approvedByName?: string }
interface Emp { id: string; name: string; workerId?: string; tradeId?: string; trade?: string; employmentStatus?: string; status?: string }
interface Code { id: string; code: string; division: string; active: boolean }
interface Assign { employeeId: string; projectId: number; startDate: string; endDate?: string }

const INK = '#0B1A12';
const MUTED = '#5E7A71';
const ACCENT = '#173326';
const PAPER = '#F4F6F1';
const LINE = 'rgba(20,8,31,.10)';
const BG = "'Bricolage Grotesque', serif";
const LEFT = ['resigned', 'terminated', 'contract_expired', 'demobilized'];
const STATUSES: [string, string][] = [['start', 'Start'], ['continued', 'Continued'], ['completing', 'Completing']];
const QUICK_NOTES = ['Weather delay', 'Inspection passed', 'Inspection failed', 'Material delivered', 'Toolbox / safety talk', 'Visitor on site', 'Equipment issue', 'Waiting on another trade'];
const PROJECT_KEY = 'origami.fieldProject';

const localISO = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const shift = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return localISO(d); };
const niceDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// ------------------------------------------------------------------ small touch controls

function Chip({ on, onClick, children, wide }: { on?: boolean; onClick: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{
      minHeight: 40, padding: wide ? '0 16px' : '0 12px', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      border: '1px solid ' + (on ? ACCENT : LINE), background: on ? ACCENT : '#fff', color: on ? '#fff' : INK, whiteSpace: 'nowrap',
    }}>{children}</button>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>{children}</div>;
}

// ------------------------------------------------------------------ the page

/**
 * The daily log, made for a phone on site: pick the project, tap the crew in,
 * set hours and cost codes with taps rather than typing, add a note from
 * ready-made lines, submit. It saves by itself as you go, so a dropped signal
 * or a closed tab loses nothing. The same log the office sees under
 * Manpower -> Daily Log, and approving it there makes the timesheets.
 */
export function FieldDailyLog() {
  return <AutosaveProvider><FieldDailyLogInner /></AutosaveProvider>;
}

function FieldDailyLogInner() {
  const { can, currentUser, authUser, toast, toastMsg } = useApp();
  // For site superintendents (and administrators); the office works in Manpower -> Daily Log.
  const runsSite = !!authUser?.isSuperintendent || authUser?.roleKey === 'admin';
  const canEdit = can('manpower_con', 'manage');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [assignments, setAssignments] = useState<Assign[]>([]);
  const [projectId, setProjectId] = useState<number | ''>(() => { try { return Number(localStorage.getItem(PROJECT_KEY)) || ''; } catch { return ''; } });
  const [date, setDate] = useState(localISO());
  const [log, setLog] = useState<Log | null>(null);
  const [saved, setSaved] = useState<Day | null>(null);
  const [draft, setDraft] = useState<Day>({ notes: '', entries: [] });
  const [loadKey, setLoadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const logIdRef = useRef<string | null>(null);

  useEffect(() => {
    api.projects.list().then((r: any) => {
      const real = (Array.isArray(r) ? r : []).filter((p: any) => p.stage !== 'Kickoff').map((p: any) => ({ id: p.id, name: p.name }));
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
  const editable = canEdit && !!projectId && !locked && !loading;

  // Saves 3 seconds after the last tap -- the whole day in one request.
  const auto = useAutosave<Day>({
    draft, saved, resetKey: `day-${projectId}-${date}-${loadKey}`, enabled: editable, label: 'daily log',
    save: async (_c, { draft: d }) => {
      const r: any = await api.dailyLogs.save({ projectId: Number(projectId), date, notes: d.notes, entries: d.entries.filter((e) => e.employeeId) });
      logIdRef.current = r?.log?.id || logIdRef.current;
      setLog(r?.log || null);
      return { ...d };
    },
  });

  // ---- who's here
  const onSite = useMemo(() => new Set(assignments.filter((a) => a.projectId === projectId && a.startDate <= date && (!a.endDate || a.endDate >= date)).map((a) => a.employeeId)), [assignments, projectId, date]);
  const inLog = new Set(draft.entries.map((e) => e.employeeId));
  const crewMissing = employees.filter((e) => onSite.has(e.id) && !inLog.has(e.id));
  const others = employees.filter((e) => !inLog.has(e.id)).sort((a, b) => Number(onSite.has(b.id)) - Number(onSite.has(a.id)) || a.name.localeCompare(b.name));
  const empOf = (id: string) => employees.find((e) => e.id === id);
  const codeOf = (id?: string) => codes.find((c) => c.id === id);
  // The codes to offer as one-tap chips: the ones already used today, then the rest by order.
  const usedCodes = Array.from(new Set(draft.entries.map((e) => e.csiCodeId).filter(Boolean))) as string[];
  const chipCodes = [...usedCodes.map((id) => codeOf(id)).filter(Boolean) as Code[], ...codes.filter((c) => !usedCodes.includes(c.id))].slice(0, 4);

  const setEntries = (fn: (e: Entry[]) => Entry[]) => setDraft((d) => ({ ...d, entries: fn(d.entries) }));
  const patch = (id: string, p: Partial<Entry>) => setEntries((es) => es.map((e) => (e.employeeId === id ? { ...e, ...p } : e)));
  const addPeople = (ids: string[]) => setEntries((es) => [...es, ...ids.map((id) => ({ employeeId: id, hours: 8, taskStatus: 'continued', csiCodeId: usedCodes[0] || '', taskDetail: '', team: '' }))]);
  const remove = (id: string) => setEntries((es) => es.filter((e) => e.employeeId !== id));
  const everyone = (p: Partial<Entry>) => setEntries((es) => es.map((e) => ({ ...e, ...p })));
  const addNote = (line: string) => setDraft((d) => ({ ...d, notes: d.notes.trim() ? `${d.notes.trim()}\n${line}` : line }));
  const totalHours = draft.entries.reduce((a, e) => a + (Number(e.hours) || 0), 0);
  const noCode = draft.entries.filter((e) => !e.csiCodeId).length;

  const submit = async () => {
    if (!draft.entries.length) { toast('⚠ Add at least one worker first'); return; }
    if (noCode) { toast(`⚠ ${noCode} worker${noCode === 1 ? ' has' : 's have'} no cost code yet`); return; }
    setSubmitting(true);
    try {
      const ok = await auto.saveNow();
      if (!ok || !logIdRef.current) throw new Error(auto.error || 'Could not save the log');
      const r: any = await api.dailyLogs.submit(logIdRef.current);
      setLog(r);
      toast('Submitted for approval');
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not submit')); }
    finally { setSubmitting(false); }
  };

  const statusStyle: Record<string, [string, string, string]> = {
    draft: ['#EFEDE8', '#5C6B65', 'Draft — not sent yet'], submitted: ['#FBF0CC', '#8A6D12', 'Submitted — waiting for approval'],
    approved: ['#D2EAD3', '#1E6B36', 'Approved — timesheets created'], rejected: ['#F2DFD4', '#8E2E0A', 'Sent back — fix and submit again'],
  };
  const st = statusStyle[log?.status || 'draft'] || statusStyle.draft;

  if (!runsSite) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: 'grid', placeItems: 'center', padding: 16 }}>
        <div style={{ maxWidth: 440, background: '#fff', borderRadius: 16, border: '1px solid ' + LINE, padding: 22, display: 'grid', gap: 10 }}>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20 }}>This is the superintendent’s daily log</div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>
            It’s for whoever runs the site — the Site Superintendent role, or an employee whose designation is Superintendent.
            To see or approve daily logs, use <b style={{ color: INK }}>Manpower → Daily Log</b> and <b style={{ color: INK }}>Approvals</b>.
          </div>
          <Link to="/manpower_con" style={{ justifySelf: 'start', padding: '10px 18px', borderRadius: 999, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Open Manpower</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", paddingBottom: 120 }}>
      {/* header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '1px solid ' + LINE }}>
        <ServerStatusBanner />
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/dashboard" title="Back to the app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: MUTED, fontSize: 13, fontWeight: 700, gap: 6 }}>
            <LogoMark size={24} /> ←
          </Link>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 19, flex: 1 }}>Daily Log</div>
          <div style={{ fontSize: 12, color: MUTED, textAlign: 'right' }}>{currentUser?.name}</div>
        </div>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 12px', display: 'grid', gap: 8 }}>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={{ minHeight: 44, borderRadius: 10, border: '1px solid ' + LINE, padding: '0 12px', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, background: '#fff', color: INK }}>
            {!projectId && <option value="">Choose a project…</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px auto', gap: 8, alignItems: 'center' }}>
            <Chip onClick={() => setDate(shift(date, -1))}>‹</Chip>
            <label style={{ position: 'relative', minHeight: 44, display: 'grid', placeItems: 'center', borderRadius: 10, border: '1px solid ' + LINE, fontSize: 15, fontWeight: 700 }}>
              {date === localISO() ? `Today · ${niceDate(date)}` : niceDate(date)}
              <input type="date" value={date} max={localISO()} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Pick a date" />
            </label>
            <Chip onClick={() => date < localISO() && setDate(shift(date, 1))}>›</Chip>
            {date !== localISO() && <Chip onClick={() => setDate(localISO())}>Today</Chip>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 16px', display: 'grid', gap: 14 }}>
        {!canEdit && <div style={{ fontSize: 13, color: MUTED, background: '#fff', borderRadius: 12, padding: 14 }}>You can view logs here; filling them in needs Manpower access.</div>}
        {loading ? <div style={{ fontSize: 14, color: MUTED, padding: 20, textAlign: 'center' }}>Loading…</div> : !projectId ? null : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 12px', borderRadius: 999, background: st[0], color: st[1], fontSize: 13, fontWeight: 700 }}>{st[2]}</span>
              <span style={{ fontSize: 13, color: MUTED }}>{draft.entries.length} worker{draft.entries.length === 1 ? '' : 's'} · {totalHours} h</span>
            </div>
            {log?.status === 'rejected' && log.rejectionNote && <div style={{ fontSize: 14, color: '#8E2E0A', background: '#F2DFD4', borderRadius: 12, padding: 12 }}>Sent back: {log.rejectionNote}</div>}

            {/* crew */}
            {editable && crewMissing.length > 0 && (
              <button type="button" onClick={() => addPeople(crewMissing.map((e) => e.id))} style={{ minHeight: 52, borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                + Add today’s crew ({crewMissing.length}) · 8 h each
              </button>
            )}
            {editable && draft.entries.length > 1 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + LINE, padding: 14, display: 'grid', gap: 10 }}>
                <Label>Everyone</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[4, 8, 10].map((h) => <Chip key={h} onClick={() => everyone({ hours: h })}>{h} h</Chip>)}
                  {chipCodes.slice(0, 3).map((c) => <Chip key={c.id} onClick={() => everyone({ csiCodeId: c.id })}>{c.code}</Chip>)}
                </div>
              </div>
            )}

            {draft.entries.map((e) => {
              const emp = empOf(e.employeeId);
              const code = codeOf(e.csiCodeId);
              return (
                <div key={e.employeeId} style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + (e.csiCodeId ? LINE : '#EAD48A'), padding: 14, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{emp?.name || 'Unknown worker'}</div>
                      <div style={{ fontSize: 12.5, color: MUTED }}>{[emp?.workerId, emp?.trade, onSite.has(e.employeeId) ? 'deployed here' : 'not deployed here'].filter(Boolean).join(' · ')}</div>
                    </div>
                    {editable && <button type="button" onClick={() => remove(e.employeeId)} aria-label="Remove" style={{ minWidth: 40, minHeight: 40, borderRadius: 10, border: '1px solid ' + LINE, background: '#fff', color: '#8E2E0A', fontSize: 18, cursor: 'pointer' }}>×</button>}
                  </div>

                  <div>
                    <Label>Hours</Label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip onClick={() => editable && patch(e.employeeId, { hours: Math.max(0, (Number(e.hours) || 0) - 0.5) })}>−</Chip>
                      <div style={{ minWidth: 56, textAlign: 'center', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{e.hours ?? 0}</div>
                      <Chip onClick={() => editable && patch(e.employeeId, { hours: Math.min(24, (Number(e.hours) || 0) + 0.5) })}>+</Chip>
                      {[4, 8, 10, 12].map((h) => <Chip key={h} on={Number(e.hours) === h} onClick={() => editable && patch(e.employeeId, { hours: h })}>{h}</Chip>)}
                    </div>
                  </div>

                  <div>
                    <Label>Cost code {!e.csiCodeId && <span style={{ color: '#8A6D12', textTransform: 'none', letterSpacing: 0 }}>— pick one</span>}</Label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {chipCodes.map((c) => <Chip key={c.id} on={e.csiCodeId === c.id} onClick={() => editable && patch(e.employeeId, { csiCodeId: c.id })}>{c.code}</Chip>)}
                      <select disabled={!editable} value={code && !chipCodes.includes(code) ? code.id : ''} onChange={(ev) => ev.target.value && patch(e.employeeId, { csiCodeId: ev.target.value })}
                        style={{ minHeight: 40, borderRadius: 10, border: '1px solid ' + (code && !chipCodes.includes(code) ? ACCENT : LINE), padding: '0 10px', fontSize: 14, fontFamily: 'inherit', background: '#fff', color: INK, maxWidth: '100%' }}>
                        <option value="">Other code…</option>
                        {codes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
                      </select>
                    </div>
                    {code && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 5 }}>{code.code} — {code.division}</div>}
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                      <Label>Task</Label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {STATUSES.map(([k, l]) => <Chip key={k} on={(e.taskStatus || 'continued') === k} onClick={() => editable && patch(e.employeeId, { taskStatus: k })}>{l}</Chip>)}
                      </div>
                    </div>
                    <div>
                      <Label>Team</Label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['A', 'B', 'C', 'D'].map((t) => <Chip key={t} on={e.team === t} onClick={() => editable && patch(e.employeeId, { team: e.team === t ? '' : t })}>{t}</Chip>)}
                      </div>
                    </div>
                  </div>

                  {openDetail[e.employeeId] || e.taskDetail ? (
                    <textarea disabled={!editable} value={e.taskDetail || ''} onChange={(ev) => patch(e.employeeId, { taskDetail: ev.target.value })} placeholder="What they worked on (optional)" rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid ' + LINE, padding: 10, fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }} />
                  ) : editable && (
                    <button type="button" onClick={() => setOpenDetail((o) => ({ ...o, [e.employeeId]: true }))} style={{ justifySelf: 'start', border: 'none', background: 'none', color: ACCENT, fontWeight: 700, fontSize: 14, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add what they worked on</button>
                  )}
                </div>
              );
            })}

            {!draft.entries.length && !crewMissing.length && <div style={{ fontSize: 14, color: MUTED, background: '#fff', borderRadius: 14, padding: 16 }}>No one logged yet. Nobody is deployed to this project today — add people below.</div>}

            {editable && (adding ? (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + LINE, padding: 14, display: 'grid', gap: 8 }}>
                <Label>Add someone</Label>
                <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {others.map((e) => (
                    <button key={e.id} type="button" onClick={() => { addPeople([e.id]); setAdding(false); }} style={{ minHeight: 44, textAlign: 'left', borderRadius: 10, border: '1px solid ' + LINE, background: '#fff', padding: '0 12px', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', color: INK }}>
                      {e.name} <span style={{ color: MUTED, fontSize: 12.5 }}>{onSite.has(e.id) ? '· deployed here' : ''}</span>
                    </button>
                  ))}
                  {!others.length && <div style={{ fontSize: 13, color: MUTED }}>Everyone is already on the log.</div>}
                </div>
                <Chip onClick={() => setAdding(false)}>Close</Chip>
              </div>
            ) : (
              <Chip wide onClick={() => setAdding(true)}>+ Add someone else</Chip>
            ))}

            {/* notes */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + LINE, padding: 14, display: 'grid', gap: 10 }}>
              <Label>Site notes</Label>
              {editable && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {QUICK_NOTES.map((q) => <Chip key={q} onClick={() => addNote(q)}>+ {q}</Chip>)}
                </div>
              )}
              <textarea disabled={!editable} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Anything else about today (optional)" rows={4}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid ' + LINE, padding: 10, fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
          </>
        )}
      </div>

      {/* bottom bar */}
      {projectId && !loading && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: '#fff', borderTop: '1px solid ' + LINE, padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {editable ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}><SaveBar auto={auto} /></div>
                <button type="button" onClick={submitting ? undefined : submit} style={{ minHeight: 48, padding: '0 18px', borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Sending…' : 'Submit'}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 14, color: MUTED }}>{locked ? 'This day has been submitted — the office can send it back if something needs changing.' : 'Read only.'}</div>
            )}
          </div>
        </div>
      )}

      {toastMsg && <div style={{ position: 'fixed', left: '50%', bottom: 84, transform: 'translateX(-50%)', background: INK, color: '#fff', padding: '10px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600, zIndex: 30, maxWidth: 'calc(100vw - 32px)' }}>{toastMsg}</div>}
    </div>
  );
}
