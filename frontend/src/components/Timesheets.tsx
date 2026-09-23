import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, todayISO, type Project } from './manpowerUi';

export interface CsiCode { id: string; code: string; division: string; active: boolean }
interface LeaveType { id: string; name: string; active: boolean; trackBalance: boolean }
type Kind = 'project' | 'internal' | 'leave';
interface Day { hours: number; note?: string }
interface Line {
  id?: string; kind: Kind; projectId?: number | null; csiCodeId?: string | null; category?: string | null; leaveTypeId?: string | null;
  description?: string | null; days: Record<string, Day>; leaveRequestIds?: string[];
}
interface Sheet {
  id: string; employeeId: string; weekStart: string; status: 'draft' | 'submitted' | 'approved' | 'rejected'; totalHours: number; notes?: string;
  submittedAt?: string; submittedByName?: string; decidedAt?: string; decidedByName?: string; decisionNote?: string; lines?: Line[];
}
interface WeekData {
  employee: { id: string; name: string; workerId?: string; payType?: string; designation?: string };
  weekStart: string; dates: string[]; sheet: Sheet | null; lines: Line[];
  holidays: { date: string; name: string }[];
  otherLeave: { id: string; type: string; startDate: string; endDate: string; status: string; days: number }[];
  logged: { date: string; projectName: string; hours: number; taskDetail?: string; status: string }[];
  standardDayHours: number; halfDayHours: number; weekendDays: number[];
  canEdit: boolean; canReview: boolean; canReopen: boolean;
}

export const INTERNAL_CATEGORIES: [string, string][] = [
  ['office', 'Office & admin'], ['estimating', 'Estimating & bidding'], ['design', 'Design & drafting'],
  ['meetings', 'Meetings'], ['travel', 'Travel'], ['other', 'Other internal'],
];
const KIND_STYLE: Record<Kind, { label: string; bg: string; c: string }> = {
  project: { label: 'Project', bg: '#DCE7DE', c: ACCENT },
  internal: { label: 'Internal', bg: '#D8E2F0', c: '#3C5C8A' },
  leave: { label: 'Leave', bg: '#FBE9AE', c: '#8A6D12' },
};
const STATUS: Record<string, { label: string; tone: 'grey' | 'amber' | 'green' | 'red' }> = {
  draft: { label: 'Draft', tone: 'grey' }, submitted: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' }, rejected: { label: 'Sent back', tone: 'red' },
};
export const StatusBadge = ({ status }: { status?: string }) => {
  const s = STATUS[status || ''] || { label: 'Not started', tone: 'grey' as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
};

const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const mondayOf = (d: string) => { const dow = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, -((dow + 6) % 7)); };
const r2 = (n: number) => Math.round(n * 100) / 100;
const lineTotal = (l: Line) => r2(Object.values(l.days).reduce((a, d) => a + (Number(d.hours) || 0), 0));
const dayLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const dayNum = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// ------------------------------------------------------------------ the weekly grid

export function TimesheetEditor({ employeeId, weekStart, onWeek, projects, csiCodes, onChanged, compact }: {
  employeeId: string; weekStart: string; onWeek: (w: string) => void; projects: Project[]; csiCodes: CsiCode[];
  onChanged?: () => void; compact?: boolean;
}) {
  const { toast } = useApp();
  const [data, setData] = useState<WeekData | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noteCell, setNoteCell] = useState<{ i: number; date: string } | null>(null);
  const [decision, setDecision] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const w = await api.timesheets.week(employeeId, weekStart) as WeekData;
      setData(w);
      setLines(w.lines.map((l) => ({ ...l, days: { ...l.days } })));
      setNotes(w.sheet?.notes || '');
      setDirty(false); setNoteCell(null); setDecision('');
    } catch (e: any) { setError(e.message || 'Could not load this week'); setData(null); }
  };
  useEffect(() => { load(); }, [employeeId, weekStart]);
  useEffect(() => { api.leave.types().then((r: any) => setLeaveTypes(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  useEffect(() => {
    api.leave.balances(Number(weekStart.slice(0, 4)), employeeId)
      .then((r: any) => setBalances(Object.fromEntries((Array.isArray(r) ? r : []).filter((b: any) => b.trackBalance).map((b: any) => [b.leaveTypeId, b.available - b.pending]))))
      .catch(() => {});
  }, [employeeId, weekStart.slice(0, 4)]);

  const dates = data?.dates || Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const holidayOn = new Map((data?.holidays || []).map((h) => [h.date, h.name]));
  const off = (d: string) => !!data && (data.weekendDays.includes(new Date(d + 'T00:00:00Z').getUTCDay()) || holidayOn.has(d));
  const editable = !!data?.canEdit;
  const dayTotal = (d: string, kinds?: Kind[]) => r2(lines.filter((l) => !kinds || kinds.includes(l.kind)).reduce((a, l) => a + (Number(l.days[d]?.hours) || 0), 0));
  const workTotal = r2(dates.reduce((a, d) => a + dayTotal(d, ['project', 'internal']), 0));
  const leaveTotal = r2(dates.reduce((a, d) => a + dayTotal(d, ['leave']), 0));
  const loggedByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data?.logged || []) m.set(r.date, r2((m.get(r.date) || 0) + (r.hours || 0)));
    return m;
  }, [data]);

  const patch = (i: number, p: Partial<Line>) => { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l))); setDirty(true); };
  const setHours = (i: number, date: string, v: string) => {
    setLines((ls) => ls.map((l, j) => {
      if (j !== i) return l;
      const days = { ...l.days };
      const hours = v === '' ? 0 : Number(v);
      if (!hours && !days[date]?.note) delete days[date]; else days[date] = { ...days[date], hours };
      return { ...l, days };
    }));
    setDirty(true);
  };
  const setNote = (i: number, date: string, note: string) => {
    setLines((ls) => ls.map((l, j) => {
      if (j !== i) return l;
      const days = { ...l.days };
      const cur = days[date] || { hours: 0 };
      if (!note && !cur.hours) delete days[date]; else days[date] = { ...cur, note: note || undefined };
      return { ...l, days };
    }));
    setDirty(true);
  };
  const addLine = (kind: Kind) => {
    const base: Line = { kind, days: {} };
    if (kind === 'project') base.projectId = projects[0]?.id ?? null;
    if (kind === 'internal') base.category = 'office';
    if (kind === 'leave') base.leaveTypeId = leaveTypes.find((t) => t.active)?.id || null;
    setLines((ls) => [...ls, base]);
    setDirty(true);
  };
  const copyLastWeek = async () => {
    try {
      const prev = await api.timesheets.week(employeeId, addDays(weekStart, -7)) as WeekData;
      const rows = prev.lines.filter((l) => l.kind !== 'leave').map((l) => ({ kind: l.kind, projectId: l.projectId, csiCodeId: l.csiCodeId, category: l.category, description: l.description, days: {} }));
      if (!rows.length) { toast('Nothing on last week to copy'); return; }
      setLines((ls) => [...ls, ...rows.filter((r) => !ls.some((l) => l.kind === r.kind && l.projectId === r.projectId && l.category === r.category && l.csiCodeId === r.csiCodeId))]);
      setDirty(true);
      toast(`Copied ${rows.length} row(s) from last week — add this week's hours`);
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not copy')); }
  };

  const payload = () => ({
    employeeId, weekStart: data?.weekStart || weekStart, notes,
    lines: lines.map((l) => ({ id: l.id, kind: l.kind, projectId: l.projectId, csiCodeId: l.csiCodeId, category: l.category, leaveTypeId: l.leaveTypeId, description: l.description, days: l.days })),
  });
  const save = async (quiet = false) => {
    setBusy(true);
    try {
      const w = await api.timesheets.save(payload()) as WeekData;
      setData(w); setLines(w.lines.map((l) => ({ ...l, days: { ...l.days } }))); setDirty(false);
      if (!quiet) toast('Saved');
      onChanged?.();
      return w;
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); return null; }
    finally { setBusy(false); }
  };
  const submit = async () => {
    const w = dirty || !data?.sheet ? await save(true) : data;
    if (!w?.sheet) return;
    if (!confirm(`Submit ${w.employee.name}'s timesheet for ${fmtDate(w.weekStart)} for approval? It can't be changed while it's being reviewed.`)) return;
    setBusy(true);
    try { await api.timesheets.submit(w.sheet.id); toast('Submitted for approval'); await load(); onChanged?.(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not submit')); }
    finally { setBusy(false); }
  };
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); await load(); onChanged?.(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
    finally { setBusy(false); }
  };

  if (error) return <div style={{ ...card, padding: 18, fontSize: 13, color: DANGER }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>;
  const sheet = data.sheet;
  const cols = `minmax(${compact ? 240 : 300}px, 1.6fr) repeat(7, 64px) 64px 28px`;
  const projectName = (id?: number | null) => projects.find((p) => p.id === id)?.name || (id ? `Project ${id}` : '—');
  const nc = noteCell && lines[noteCell.i] ? noteCell : null;

  return (
    <div>
      {/* week bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div onClick={() => onWeek(addDays(data.weekStart, -7))} style={{ ...btn(), padding: '6px 11px' }}>‹</div>
        <div style={{ fontFamily: BG, fontSize: 16, fontWeight: 700, color: INK, minWidth: 200, textAlign: 'center' }}>{fmtDate(dates[0])} – {fmtDate(dates[6])}</div>
        <div onClick={() => onWeek(addDays(data.weekStart, 7))} style={{ ...btn(), padding: '6px 11px' }}>›</div>
        {data.weekStart !== mondayOf(todayISO()) && <div onClick={() => onWeek(mondayOf(todayISO()))} style={{ ...btn(), padding: '6px 11px' }}>This week</div>}
        <StatusBadge status={sheet?.status} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUTED }}>Work <b style={{ color: INK }}>{workTotal} h</b>{leaveTotal ? <> · Leave <b style={{ color: INK }}>{leaveTotal} h</b></> : null}</span>
      </div>

      {/* status banners */}
      {sheet?.status === 'rejected' && (
        <div style={{ ...card, padding: '10px 14px', marginBottom: 12, background: '#F7ECE6', borderColor: '#EBCFC0', fontSize: 12.5, color: DANGER }}>
          <b>Sent back by {sheet.decidedByName}</b>{sheet.decidedAt ? ` on ${fmtDate(sheet.decidedAt)}` : ''}: {sheet.decisionNote}. Fix it and submit again.
        </div>
      )}
      {sheet?.status === 'draft' && sheet.decisionNote && (
        <div style={{ ...card, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: MUTED }}>{sheet.decisionNote}</div>
      )}
      {sheet?.status === 'submitted' && (
        <div style={{ ...card, padding: '10px 14px', marginBottom: 12, background: '#FBF3D6', borderColor: '#F0E0A6', fontSize: 12.5, color: '#8A6D12' }}>
          Submitted {sheet.submittedAt ? fmtDate(sheet.submittedAt) : ''} by {sheet.submittedByName} — waiting for HR or {data.employee.name.split(' ')[0]}'s manager to review.
        </div>
      )}
      {sheet?.status === 'approved' && (
        <div style={{ ...card, padding: '10px 14px', marginBottom: 12, background: '#EEF6EF', borderColor: '#CFE3D2', fontSize: 12.5, color: '#1E6B36' }}>
          Approved by <b>{sheet.decidedByName}</b>{sheet.decidedAt ? ` on ${fmtDate(sheet.decidedAt)}` : ''}{sheet.decisionNote ? ` — ${sheet.decisionNote}` : ''}. These hours go to payroll{data.employee.payType === 'monthly' ? ' (salaried: pay is the salary, hours record where the time went)' : ''}.
        </div>
      )}

      {/* grid */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: (compact ? 240 : 300) + 7 * 64 + 64 + 28 + 60 }}>
            <div style={{ ...headRow(cols), alignItems: 'end' }}>
              <span>Work</span>
              {dates.map((d) => (
                <span key={d} title={holidayOn.get(d) || ''} style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, color: holidayOn.has(d) ? DANGER : d === todayISO() ? ACCENT : undefined }}>
                  <div style={{ fontSize: 11 }}>{dayLabel(d)}</div><div style={{ fontSize: 10, fontWeight: 600 }}>{dayNum(d)}</div>
                </span>
              ))}
              <span style={{ textAlign: 'right' }}>Total</span><span />
            </div>

            {lines.map((l, i) => {
              const ks = KIND_STYLE[l.kind];
              const bal = l.kind === 'leave' && l.leaveTypeId ? balances[l.leaveTypeId] : undefined;
              return (
                <div key={i} style={{ ...bodyRow(cols), alignItems: 'start', padding: '8px 14px' }}>
                  <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: ks.bg, color: ks.c, flexShrink: 0 }}>{ks.label}</span>
                      {l.kind === 'project' && (
                        <select disabled={!editable} value={l.projectId ?? ''} onChange={(e) => patch(i, { projectId: e.target.value ? Number(e.target.value) : null })} style={{ ...input, padding: '5px 8px', fontSize: 12.5 }}>
                          <option value="">Pick a project…</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      {l.kind === 'internal' && (
                        <select disabled={!editable} value={l.category || ''} onChange={(e) => patch(i, { category: e.target.value })} style={{ ...input, padding: '5px 8px', fontSize: 12.5 }}>
                          {INTERNAL_CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      )}
                      {l.kind === 'leave' && (
                        <select disabled={!editable || !!l.leaveRequestIds?.length} value={l.leaveTypeId || ''} onChange={(e) => patch(i, { leaveTypeId: e.target.value })} style={{ ...input, padding: '5px 8px', fontSize: 12.5 }}>
                          {leaveTypes.filter((t) => t.active || t.id === l.leaveTypeId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                    </div>
                    {l.kind === 'project' && (
                      <select disabled={!editable} value={l.csiCodeId || ''} onChange={(e) => patch(i, { csiCodeId: e.target.value || null })} style={{ ...input, padding: '4px 8px', fontSize: 12 }}>
                        <option value="">Cost code (optional)</option>
                        {csiCodes.filter((c) => c.active || c.id === l.csiCodeId).map((c) => <option key={c.id} value={c.id}>{c.code} {c.division}</option>)}
                      </select>
                    )}
                    <input disabled={!editable} value={l.description || ''} onChange={(e) => patch(i, { description: e.target.value })}
                      placeholder={l.kind === 'leave' ? 'Reason (optional)' : 'What you worked on'} style={{ ...input, padding: '4px 8px', fontSize: 12 }} />
                    {l.kind === 'leave' && (
                      <div style={{ fontSize: 11, color: MUTED }}>
                        {data.standardDayHours} h = full day, {data.halfDayHours} h or less = half day.{bal != null ? ` ${bal} day(s) available.` : ''}
                        {l.leaveRequestIds?.length ? ' Leave request raised.' : ' Becomes a leave request when you submit.'}
                      </div>
                    )}
                  </div>
                  {dates.map((d) => {
                    const cell = l.days[d];
                    const isNote = nc?.i === i && nc?.date === d;
                    return (
                      <div key={d} style={{ display: 'grid', gap: 2, justifyItems: 'center', background: off(d) ? '#F6F2EA' : undefined, borderRadius: 6, padding: '2px 0' }}>
                        <input disabled={!editable} type="number" min={0} max={24} step={0.25} value={cell?.hours || ''} onChange={(e) => setHours(i, d, e.target.value)}
                          style={{ ...input, width: 54, padding: '5px 4px', textAlign: 'center', fontSize: 13, background: cell?.hours ? 'white' : off(d) ? '#F6F2EA' : 'white' }} />
                        {(editable || cell?.note) && (
                          <span onClick={() => setNoteCell(isNote ? null : { i, date: d })} title={cell?.note || 'Add a note for this day'}
                            style={{ fontSize: 10, cursor: 'pointer', color: cell?.note ? ACCENT : '#c8c3cf', fontWeight: cell?.note ? 700 : 400 }}>{cell?.note ? '● note' : '+ note'}</span>
                        )}
                      </div>
                    );
                  })}
                  <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, paddingTop: 6 }}>{lineTotal(l) || '—'}</span>
                  {editable && !l.leaveRequestIds?.length
                    ? <span onClick={() => { setLines((ls) => ls.filter((_, j) => j !== i)); setDirty(true); setNoteCell(null); }} title="Remove row" style={{ cursor: 'pointer', color: DANGER, paddingTop: 6 }}>×</span>
                    : <span />}
                </div>
              );
            })}

            {!lines.length && (
              <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
                {editable ? 'No rows yet — add the projects you worked on, internal work, or leave.' : 'Nothing entered for this week.'}
              </div>
            )}

            {/* daily totals */}
            <div style={{ ...bodyRow(cols), background: '#FBF9F4', fontWeight: 700 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Day total</span>
              {dates.map((d) => {
                const t = dayTotal(d);
                const over = dayTotal(d, ['project', 'internal']) > data.standardDayHours;
                return <span key={d} title={over ? 'Over a standard day — overtime' : ''} style={{ textAlign: 'center', fontSize: 13, color: t > 24 ? DANGER : over ? '#8A6D12' : INK }}>{t || '—'}{over ? <div style={{ fontSize: 9.5 }}>OT</div> : null}</span>;
              })}
              <span style={{ textAlign: 'right', fontSize: 13 }}>{r2(workTotal + leaveTotal)}</span><span />
            </div>
            {loggedByDay.size > 0 && (
              <div style={{ ...bodyRow(cols), fontSize: 11.5, color: MUTED }}>
                <span title="Hours a supervisor put on the daily log -- for comparison">From daily logs (supervisor)</span>
                {dates.map((d) => <span key={d} style={{ textAlign: 'center' }}>{loggedByDay.get(d) || '—'}</span>)}
                <span style={{ textAlign: 'right' }}>{r2(Array.from(loggedByDay.values()).reduce((a, b) => a + b, 0))}</span><span />
              </div>
            )}
          </div>
        </div>

        {nc && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid ' + LINE, background: '#FBF9F4' }}>
            <Label text={`Note — ${dayLabel(nc.date)} ${dayNum(nc.date)} · ${lines[nc.i].kind === 'project' ? projectName(lines[nc.i].projectId) : KIND_STYLE[lines[nc.i].kind].label}`} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus disabled={!editable} value={lines[nc.i].days[nc.date]?.note || ''} onChange={(e) => setNote(nc.i, nc.date, e.target.value)} placeholder="e.g. Site visit with the client, left early for inspection" style={input} />
              <div onClick={() => setNoteCell(null)} style={btn()}>Done</div>
            </div>
          </div>
        )}

        {editable && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid ' + LINE }}>
            <div onClick={() => addLine('project')} style={btn()}>+ Project work</div>
            <div onClick={() => addLine('internal')} style={btn()}>+ Internal work</div>
            <div onClick={() => addLine('leave')} style={btn()}>+ Leave</div>
            <div onClick={copyLastWeek} style={{ ...btn(), color: MUTED }}>Copy last week's rows</div>
          </div>
        )}
      </div>

      {data.otherLeave.length > 0 && (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
          Also booked on the Leave screen this week: {data.otherLeave.map((l) => `${l.type} ${fmtDate(l.startDate)}${l.endDate !== l.startDate ? '–' + fmtDate(l.endDate) : ''} (${l.status})`).join('; ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 14, alignItems: 'end' }}>
        <div>
          <Label text="Note to the reviewer" />
          <textarea disabled={!editable} value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} rows={2} placeholder="Anything they should know about this week" style={{ ...input, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {editable && <div onClick={busy || !dirty ? undefined : () => save()} style={btn(false, busy || !dirty)}>{dirty ? 'Save draft' : 'Saved'}</div>}
          {editable && sheet?.id && !dirty && !lines.length && <div onClick={() => act(() => api.timesheets.remove(sheet.id), 'Deleted')} style={{ ...btn(), color: DANGER }}>Delete</div>}
          {editable && <div onClick={busy ? undefined : submit} style={btn(true, busy || !(workTotal + leaveTotal))}>Submit for approval</div>}
        </div>
      </div>

      {data.canReview && (
        <div style={{ ...card, padding: '14px 16px', marginTop: 14, borderColor: ACCENT }}>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Review</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <div style={{ flex: 1, minWidth: 240 }}><Label text="Note (required to send back)" /><input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="e.g. Tuesday's hours look short" style={input} /></div>
            <div onClick={busy ? undefined : () => act(() => api.timesheets.reject(sheet!.id, decision), 'Sent back')} style={{ ...btn(false, busy), color: DANGER }}>Send back</div>
            <div onClick={busy ? undefined : () => act(() => api.timesheets.approve(sheet!.id, decision), 'Approved')} style={btn(true, busy)}>Approve</div>
          </div>
        </div>
      )}
      {data.canReopen && !data.canReview && (
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <span onClick={() => { const why = prompt('Why is this timesheet being reopened?'); if (why) act(() => api.timesheets.reopen(sheet!.id, why), 'Reopened for correction'); }}
            style={{ fontSize: 12, fontWeight: 700, color: MUTED, cursor: 'pointer' }}>Reopen for correction</span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ HR: review queue, all sheets, enter for someone

export function TimesheetsModule({ employees, projects, csiCodes, canManage, onOpenEmployee }: {
  employees: Employee[]; projects: Project[]; csiCodes: CsiCode[]; canManage: boolean; onOpenEmployee: (id: string) => void;
}) {
  const [view, setView] = useState<'review' | 'all' | 'projects'>('review');
  const [rows, setRows] = useState<Sheet[] | null>(null);
  const [from, setFrom] = useState(addDays(mondayOf(todayISO()), -28));
  const [to, setTo] = useState(addDays(mondayOf(todayISO()), 6));
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ employeeId: string; weekStart: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState({ employeeId: '', weekStart: mondayOf(todayISO()) });

  const load = () => api.timesheets.list(view === 'review' ? { status: 'submitted' } : { from, to, status: status || undefined })
    .then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { setRows(null); load(); }, [view, from, to, status]);

  const emp = (id: string) => employees.find((e) => e.id === id);
  const q = query.trim().toLowerCase();
  const shown = (rows || []).filter((s) => !q || (emp(s.employeeId)?.name || '').toLowerCase().includes(q));
  const staff = employees.filter((e) => !e.contractorId && !['resigned', 'terminated', 'contract_expired', 'demobilized'].includes(e.employmentStatus || 'active'));
  const cols = 'minmax(180px,1.4fr) 170px 90px 90px 150px 160px';

  // approved hours by project across the range
  const byProject = useMemo(() => {
    const m = new Map<string, { hours: number; people: Set<string> }>();
    for (const s of rows || []) {
      if (s.status !== 'approved') continue;
      for (const l of s.lines || []) {
        if (l.kind === 'leave') continue;
        const key = l.kind === 'project' ? `p:${l.projectId}` : `i:${l.category}`;
        const cur = m.get(key) || { hours: 0, people: new Set<string>() };
        cur.hours = r2(cur.hours + Object.entries(l.days).filter(([d]) => d >= from && d <= to).reduce((a, [, d]) => a + (d.hours || 0), 0));
        cur.people.add(s.employeeId);
        m.set(key, cur);
      }
    }
    return Array.from(m.entries()).map(([k, v]) => ({
      label: k.startsWith('p:') ? projects.find((p) => String(p.id) === k.slice(2))?.name || `Project ${k.slice(2)}` : `Internal — ${INTERNAL_CATEGORIES.find(([c]) => c === k.slice(2))?.[1] || k.slice(2)}`,
      ...v,
    })).sort((a, b) => b.hours - a.hours);
  }, [rows, from, to, projects]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {([['review', 'To review'], ['all', 'All timesheets'], ['projects', 'Hours by project']] as const).map(([k, l]) => (
          <div key={k} onClick={() => setView(k)} style={{ ...btn(view === k), padding: '6px 13px', fontSize: 12 }}>{l}{k === 'review' && view !== 'review' ? '' : ''}</div>
        ))}
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={() => setPicking(true)} style={btn(true)}>+ Enter time for someone</div>}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, lineHeight: 1.6, maxWidth: 820 }}>
        Staff fill in their own week under <b>My Timesheet</b> — projects, internal work and leave, with notes — and submit it. HR or their reporting manager approves it here
        (leave on a timesheet needs HR). Approved hours are what payroll pays for those days, in place of daily-log hours.
      </div>

      {view !== 'review' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: MUTED }}>Weeks from</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...input, width: 150 }} />
          <span style={{ fontSize: 12, color: MUTED }}>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...input, width: 150 }} />
          {view === 'all' && (
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 'auto' }}>
              <option value="">All statuses</option>
              {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          )}
          {view === 'all' && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search person…" style={{ ...input, width: 180 }} />}
        </div>
      )}

      {view === 'projects' ? (
        <div style={{ ...card, overflow: 'hidden', maxWidth: 760 }}>
          <div style={headRow('1fr 110px 90px')}><span>Where the time went (approved)</span><span style={{ textAlign: 'right' }}>Hours</span><span style={{ textAlign: 'right' }}>People</span></div>
          {byProject.map((r) => (
            <div key={r.label} style={bodyRow('1fr 110px 90px')}>
              <span style={{ fontSize: 13, color: INK }}>{r.label}</span>
              <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{r.hours}</span>
              <span style={{ textAlign: 'right', fontSize: 12.5, color: MUTED }}>{r.people.size}</span>
            </div>
          ))}
          {rows && !byProject.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>No approved timesheet hours in this range.</div>}
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 860 }}>
              <div style={headRow(cols)}><span>Person</span><span>Week</span><span style={{ textAlign: 'right' }}>Work h</span><span style={{ textAlign: 'right' }}>Leave h</span><span>Status</span><span>Submitted</span></div>
              {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
              {shown.map((s) => {
                const e = emp(s.employeeId);
                const leaveH = r2((s.lines || []).filter((l) => l.kind === 'leave').reduce((a, l) => a + lineTotal(l), 0));
                return (
                  <div key={s.id} onClick={() => setOpen({ employeeId: s.employeeId, weekStart: s.weekStart })} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                    <span>
                      <span onClick={(ev) => { ev.stopPropagation(); onOpenEmployee(s.employeeId); }} style={{ fontSize: 13, fontWeight: 600, color: INK }}>{e?.name || s.employeeId}</span>
                      <div style={{ fontSize: 11, color: MUTED }}>{e?.designation || ''}</div>
                    </span>
                    <span style={{ fontSize: 12.5 }}>{fmtDate(s.weekStart)} – {fmtDate(addDays(s.weekStart, 6))}</span>
                    <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{r2(s.totalHours - leaveH)}</span>
                    <span style={{ textAlign: 'right', fontSize: 12.5, color: leaveH ? INK : MUTED }}>{leaveH || '—'}</span>
                    <span><StatusBadge status={s.status} /></span>
                    <span style={{ fontSize: 12, color: MUTED }}>{s.submittedAt ? `${fmtDate(s.submittedAt)} · ${s.submittedByName}` : '—'}</span>
                  </div>
                );
              })}
              {rows && !shown.length && (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
                  {view === 'review' ? 'Nothing waiting for review.' : 'No timesheets in this range.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {picking && (
        <Drawer title="Enter time for someone" subtitle="For staff without a login, or to fix a week on their behalf." width={440} onClose={() => setPicking(false)}
          footer={<><div onClick={() => setPicking(false)} style={btn()}>Cancel</div><div onClick={() => { if (pick.employeeId) { setOpen({ ...pick, weekStart: mondayOf(pick.weekStart) }); setPicking(false); } }} style={btn(true, !pick.employeeId)}>Open week</div></>}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div><Label text="Employee" />
              <select value={pick.employeeId} onChange={(e) => setPick({ ...pick, employeeId: e.target.value })} style={input}>
                <option value="">Select…</option>
                {staff.map((e) => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` · ${e.designation}` : ''}</option>)}
              </select>
            </div>
            <div><Label text="Any day in the week" /><input type="date" value={pick.weekStart} onChange={(e) => setPick({ ...pick, weekStart: e.target.value })} style={input} /></div>
          </div>
        </Drawer>
      )}
      {open && (
        <Drawer title={`${emp(open.employeeId)?.name || 'Timesheet'} — timesheet`} width={1180} onClose={() => { setOpen(null); load(); }}>
          <TimesheetEditor employeeId={open.employeeId} weekStart={open.weekStart} onWeek={(w) => setOpen({ ...open, weekStart: w })}
            projects={projects} csiCodes={csiCodes} onChanged={load} compact />
        </Drawer>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ recent weeks for one person

export function RecentTimesheets({ employeeId, onPick, refreshKey }: { employeeId: string; onPick: (weekStart: string) => void; refreshKey?: number }) {
  const [rows, setRows] = useState<Sheet[]>([]);
  useEffect(() => {
    api.timesheets.list({ employeeId, from: addDays(mondayOf(todayISO()), -84) }).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => {});
  }, [employeeId, refreshKey]);
  if (!rows.length) return null;
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 6px', fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK }}>Recent weeks</div>
      {rows.slice(0, 12).map((s) => (
        <div key={s.id} onClick={() => onPick(s.weekStart)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', fontSize: 12.5 }}>
          <span style={{ flex: 1 }}>{fmtDate(s.weekStart)} – {fmtDate(addDays(s.weekStart, 6))}</span>
          <b>{s.totalHours} h</b>
          <StatusBadge status={s.status} />
        </div>
      ))}
    </div>
  );
}
