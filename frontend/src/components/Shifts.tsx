import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import {
  ACCENT, BG, DANGER, INK, LINE, MUTED, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, money, todayISO,
  type Assignment, type PayrollSettings, type Project,
} from './manpowerUi';

export interface ShiftTemplate { id: string; name: string; code?: string; kind: string; startTime: string; endTime: string; allowancePerDay: number; color?: string; active: boolean; order: number }
export interface ShiftAssignment { id: string; employeeId: string; templateIds: string[]; rotateEveryDays?: number | null; startDate: string; endDate?: string | null; notes?: string; createdByName?: string; endedByName?: string; createdAt: string }

const KINDS: [string, string][] = [['day', 'Day'], ['night', 'Night'], ['twelve_hour', '12-hour'], ['weekend', 'Weekend'], ['emergency', 'Emergency']];
const DAY = 86400000;
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);

/** Mirrors the server: which shift a (possibly rotating) assignment puts someone on for a date. */
export function shiftOn(a: Pick<ShiftAssignment, 'templateIds' | 'rotateEveryDays' | 'startDate' | 'endDate'>, date: string): string | null {
  if (!a.templateIds?.length || date < a.startDate || (a.endDate && date > a.endDate)) return null;
  if (a.templateIds.length === 1) return a.templateIds[0];
  const every = Math.max(1, Number(a.rotateEveryDays) || 7);
  return a.templateIds[Math.floor(daysBetween(a.startDate, date) / every) % a.templateIds.length];
}

const mondayOf = (d: string) => { const dow = new Date(d + 'T00:00:00').getDay(); return addDays(d, -((dow + 6) % 7)); };
const hours = (t: ShiftTemplate) => `${t.startTime}–${t.endTime}`;
const describe = (a: ShiftAssignment, byId: Map<string, ShiftTemplate>) => {
  const names = a.templateIds.map((id) => byId.get(id)?.name || id);
  return names.length > 1 ? `Rotating ${names.join(' → ')} every ${a.rotateEveryDays} day${a.rotateEveryDays === 1 ? '' : 's'}` : names[0];
};

function Chip({ t, faded }: { t?: ShiftTemplate; faded?: boolean }) {
  if (!t) return null;
  return (
    <span title={`${t.name} ${hours(t)}`} style={{ display: 'inline-grid', placeItems: 'center', minWidth: 30, height: 22, padding: '0 5px', borderRadius: 6, background: t.color || ACCENT, color: 'white', fontSize: 10.5, fontWeight: 700, opacity: faded ? 0.45 : 1 }}>
      {t.code || t.name.slice(0, 2)}
    </span>
  );
}

function useShiftData(from: string, to: string) {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [assigns, setAssigns] = useState<ShiftAssignment[] | null>(null);
  const [leave, setLeave] = useState<{ employeeId: string; startDate: string; endDate: string; status: string; type: string }[]>([]);
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);
  const load = async () => {
    const [t, a, l] = await Promise.all([
      api.shifts.templates().catch(() => []),
      api.shifts.assignments({ from, to }).catch(() => []),
      api.leave.calendar(from, to).catch(() => ({ requests: [], holidays: [] })),
    ]) as any[];
    setTemplates(Array.isArray(t) ? t : []);
    setAssigns(Array.isArray(a) ? a : []);
    setLeave((l?.requests || []).filter((r: any) => r.status === 'approved'));
    setHolidays(l?.holidays || []);
  };
  useEffect(() => { load(); }, [from, to]);
  return { templates, assigns, leave, holidays, reload: load };
}

// ------------------------------------------------------------------ roster

export function ShiftRoster({ employees, projects, assignments, settings, canManage, onOpenEmployee }: {
  employees: Employee[]; projects: Project[]; assignments: Assignment[]; settings: PayrollSettings; canManage: boolean; onOpenEmployee: (id: string) => void;
}) {
  const [view, setView] = useState<'roster' | 'types'>('roster');
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [weeks, setWeeks] = useState(1);
  const [projectId, setProjectId] = useState<number | ''>('');
  const [query, setQuery] = useState('');
  const [onlyRostered, setOnlyRostered] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<string[] | null>(null);
  const days = useMemo(() => Array.from({ length: 7 * weeks }, (_, i) => addDays(weekStart, i)), [weekStart, weeks]);
  const from = days[0];
  const to = days[days.length - 1];
  const { templates, assigns, leave, holidays, reload } = useShiftData(from, to);
  const tById = new Map(templates.map((t) => [t.id, t]));
  const holidayOn = new Map(holidays.map((h) => [h.date, h.name]));
  const today = todayISO();

  const onProject = new Set(assignments.filter((a) => a.current && (!projectId || a.projectId === projectId)).map((a) => a.employeeId));
  const q = query.trim().toLowerCase();
  const people = employees
    .filter((e) => !['resigned', 'terminated', 'contract_expired', 'demobilized'].includes(e.employmentStatus || 'active') && e.status !== 'inactive')
    .filter((e) => (!projectId || onProject.has(e.id)) && (!q || e.name.toLowerCase().includes(q) || (e.workerId || '').toLowerCase().includes(q)))
    .filter((e) => !onlyRostered || (assigns || []).some((a) => a.employeeId === e.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cellFor = (empId: string, d: string) => {
    const dayOff = settings.weekendDays.includes(new Date(d + 'T00:00:00').getDay()) || holidayOn.has(d);
    const off = !dayOff && leave.find((l) => l.employeeId === empId && l.startDate <= d && l.endDate >= d);
    if (off) return { leave: off.type };
    const a = (assigns || []).find((x) => x.employeeId === empId && shiftOn(x, d));
    return a ? { template: tById.get(shiftOn(a, d)!) } : {};
  };
  const onToday = (id: string) => tById.get(((assigns || []).map((a) => a.employeeId === id ? shiftOn(a, today) : null).find(Boolean)) || '');
  const counts = templates.map((t) => ({ t, n: people.filter((e) => onToday(e.id)?.id === t.id).length })).filter((x) => x.n);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const cellW = weeks === 1 ? 84 : 44;
  const cols = `${canManage ? '28px ' : ''}minmax(170px, 1.2fr) repeat(${days.length}, ${cellW}px)`;

  if (view === 'types') return <><Switch view={view} setView={setView} /><ShiftTemplates canManage={canManage} currency={settings.currency} /></>;

  return (
    <div>
      <Switch view={view} setView={setView} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div onClick={() => setWeekStart(addDays(weekStart, -7))} style={{ ...btn(), padding: '6px 11px' }}>‹</div>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, minWidth: 190, textAlign: 'center' }}>{fmtDate(from)} – {fmtDate(to)}</div>
        <div onClick={() => setWeekStart(addDays(weekStart, 7))} style={{ ...btn(), padding: '6px 11px' }}>›</div>
        <div onClick={() => setWeekStart(mondayOf(today))} style={{ ...btn(), padding: '6px 11px' }}>This week</div>
        <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
          <option value={1}>1 week</option><option value={2}>2 weeks</option><option value={4}>4 weeks</option>
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={{ ...input, width: 'auto' }}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" style={{ ...input, width: 160 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: INK }}><input type="checkbox" checked={onlyRostered} onChange={(e) => setOnlyRostered(e.target.checked)} />Only rostered</label>
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={() => setAssigning(picked.size ? Array.from(picked) : [])} style={btn(true)}>{picked.size ? `Assign shift to ${picked.size}` : '+ Assign shift'}</div>}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: 11.5, color: MUTED }}>
        <span style={{ fontWeight: 700, color: INK }}>Today:</span>
        {counts.length ? counts.map(({ t, n }) => <span key={t.id} style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Chip t={t} /> {n}</span>) : <span>nobody rostered</span>}
        <span>· {people.filter((e) => !onToday(e.id)).length} without a shift</span>
      </div>

      <div style={{ ...card, overflow: 'auto' }}>
        <div style={{ minWidth: (canManage ? 28 : 0) + 170 + days.length * cellW + 40 }}>
          <div style={{ ...headRow(cols), padding: '6px 14px' }}>
            {canManage && <input type="checkbox" checked={!!people.length && people.every((e) => picked.has(e.id))} onChange={(e) => setPicked(e.target.checked ? new Set(people.map((p) => p.id)) : new Set())} />}
            <span>Employee</span>
            {days.map((d) => {
              const dt = new Date(d + 'T00:00:00');
              const off = settings.weekendDays.includes(dt.getDay()) || holidayOn.has(d);
              return (
                <span key={d} title={holidayOn.get(d) || ''} style={{ textAlign: 'center', color: holidayOn.has(d) ? DANGER : d === today ? ACCENT : off ? '#b5afbd' : undefined, textTransform: 'none', letterSpacing: 0 }}>
                  {weeks === 1 ? dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : <>{'SMTWTFS'[dt.getDay()]}<br />{dt.getDate()}</>}
                </span>
              );
            })}
          </div>
          {assigns === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
          {assigns && people.map((e) => (
            <div key={e.id} style={{ ...bodyRow(cols), padding: '6px 14px', background: picked.has(e.id) ? '#F3F8F3' : undefined }}>
              {canManage && <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />}
              <span onClick={() => onOpenEmployee(e.id)} style={{ cursor: 'pointer', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{e.workerId}{e.designation ? ` · ${e.designation}` : ''}</div>
              </span>
              {days.map((d) => {
                const c = cellFor(e.id, d);
                return (
                  <span key={d} style={{ textAlign: 'center', background: d === today ? '#F3F8F3' : undefined, borderRadius: 6, padding: '3px 0' }}>
                    {c.leave ? <span title={`${c.leave} leave`} style={{ fontSize: 10, fontWeight: 700, color: '#3C5C8A', background: '#D8E2F0', padding: '3px 5px', borderRadius: 6 }}>{weeks === 1 ? 'Leave' : 'L'}</span>
                      : c.template ? <Chip t={c.template} /> : <span style={{ color: '#d3cfd8' }}>·</span>}
                  </span>
                );
              })}
            </div>
          ))}
          {assigns && !people.length && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>Nobody matches.</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        {templates.filter((t) => t.active).map((t) => <span key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: INK }}><Chip t={t} />{t.name} · {hours(t)}</span>)}
      </div>

      {assigning && (
        <AssignShiftDrawer employees={employees} templates={templates} preselected={assigning} onClose={() => setAssigning(null)}
          onDone={async () => { setAssigning(null); setPicked(new Set()); await reload(); }} />
      )}
    </div>
  );
}

function Switch({ view, setView }: { view: string; setView: (v: 'roster' | 'types') => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {([['roster', 'Roster'], ['types', 'Shift types']] as const).map(([k, l]) => (
        <div key={k} onClick={() => setView(k)} style={{ ...btn(view === k), padding: '6px 13px', fontSize: 12 }}>{l}</div>
      ))}
    </div>
  );
}

export function AssignShiftDrawer({ employees, templates, preselected, onClose, onDone }: {
  employees: Employee[]; templates: ShiftTemplate[]; preselected: string[]; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [ids, setIds] = useState<string[]>(preselected);
  const [adding, setAdding] = useState('');
  const [rotation, setRotation] = useState<string[]>([templates.find((t) => t.active)?.id || '']);
  const [every, setEvery] = useState(7);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const active = templates.filter((t) => t.active);
  const byId = new Map(templates.map((t) => [t.id, t]));
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name || id;
  const preview = Array.from({ length: 14 }, (_, i) => addDays(startDate, i));

  const submit = async () => {
    setSaving(true);
    try {
      await api.shifts.assign({ employeeIds: ids, templateIds: rotation.filter(Boolean), rotateEveryDays: rotation.length > 1 ? every : undefined, startDate, endDate: endDate || undefined, notes: notes || undefined });
      toast(`Shift assigned to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`);
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not assign')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Assign shift" subtitle="Whatever shift these people were on ends the day before the new one starts." width={560} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving || !ids.length ? undefined : submit} style={btn(true, saving || !ids.length)}>{saving ? 'Saving…' : 'Assign'}</div></>}>
      <Label text={`People (${ids.length})`} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {ids.map((id) => (
          <span key={id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: '#EFEDE8', fontSize: 12 }}>
            {nameOf(id)}<span onClick={() => setIds(ids.filter((x) => x !== id))} style={{ cursor: 'pointer', color: MUTED }}>×</span>
          </span>
        ))}
      </div>
      <select value={adding} onChange={(e) => { if (e.target.value) setIds([...ids, e.target.value]); setAdding(''); }} style={{ ...input, marginBottom: 16 }}>
        <option value="">+ Add someone…</option>
        {employees.filter((e) => !ids.includes(e.id) && !['resigned', 'terminated', 'contract_expired', 'demobilized'].includes(e.employmentStatus || 'active')).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.workerId}</option>)}
      </select>

      <Label text={rotation.length > 1 ? 'Rotation (in order)' : 'Shift'} />
      {rotation.map((id, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
          {rotation.length > 1 && <span style={{ width: 18, fontSize: 12, color: MUTED }}>{i + 1}.</span>}
          <select value={id} onChange={(e) => setRotation(rotation.map((x, j) => (j === i ? e.target.value : x)))} style={input}>
            {active.map((t) => <option key={t.id} value={t.id}>{t.name} · {hours(t)}</option>)}
          </select>
          {rotation.length > 1 && <span onClick={() => setRotation(rotation.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: DANGER }}>×</span>}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
        <span onClick={() => setRotation([...rotation, active.find((t) => !rotation.includes(t.id))?.id || active[0]?.id])} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>
          {rotation.length > 1 ? '+ Add to rotation' : '+ Make it a rotation'}
        </span>
        {rotation.length > 1 && <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>switch every <input type="number" min={1} max={90} value={every} onChange={(e) => setEvery(Number(e.target.value))} style={{ ...input, width: 64 }} /> days</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><Label text="From" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} /></div>
        <div><Label text="Until (optional)" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={input} /></div>
      </div>
      <Label text="Notes" />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...input, marginBottom: 16 }} />

      <Label text="Next two weeks" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {preview.map((d) => {
          const t = byId.get(shiftOn({ templateIds: rotation.filter(Boolean), rotateEveryDays: every, startDate, endDate: endDate || null }, d) || '');
          return (
            <div key={d} style={{ textAlign: 'center', padding: '5px 0', borderRadius: 8, background: '#F7F3EA' }}>
              <div style={{ fontSize: 10, color: MUTED }}>{new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>
              <div style={{ marginTop: 3 }}>{t ? <Chip t={t} /> : <span style={{ color: '#ccc' }}>·</span>}</div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ setup

function ShiftTemplates({ canManage, currency }: { canManage: boolean; currency: string }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<ShiftTemplate[]>([]);
  const [name, setName] = useState('');
  const load = () => api.shifts.templates().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); if (msg) toast(msg); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    load();
  };
  const upd = (t: ShiftTemplate, patch: Partial<ShiftTemplate>) => run(() => api.shifts.updateTemplate(t.id, patch));
  const cols = 'minmax(150px,1.4fr) 70px 44px 120px 96px 96px 130px 56px 26px';
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 6px' }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK }}>Shift types</div>
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>A shift allowance is paid ({currency}) for every day someone works that shift, on their payslip.</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 880 }}>
          <div style={headRow(cols)}><span>Name</span><span>Code</span><span>Color</span><span>Kind</span><span>Starts</span><span>Ends</span><span>Allowance / day</span><span>Active</span><span /></div>
          {rows.map((t) => (
            <div key={t.id} style={bodyRow(cols)}>
              <input disabled={!canManage} defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && upd(t, { name: e.target.value.trim() })} style={input} />
              <input disabled={!canManage} defaultValue={t.code} onBlur={(e) => e.target.value !== (t.code || '') && upd(t, { code: e.target.value.trim() })} style={input} />
              <input disabled={!canManage} type="color" value={t.color || '#173326'} onChange={(e) => upd(t, { color: e.target.value })} style={{ width: 32, height: 28, border: 'none', background: 'none', padding: 0 }} />
              <select disabled={!canManage} value={t.kind} onChange={(e) => upd(t, { kind: e.target.value })} style={input}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input disabled={!canManage} type="time" defaultValue={t.startTime} onBlur={(e) => e.target.value && e.target.value !== t.startTime && upd(t, { startTime: e.target.value })} style={input} />
              <input disabled={!canManage} type="time" defaultValue={t.endTime} onBlur={(e) => e.target.value && e.target.value !== t.endTime && upd(t, { endTime: e.target.value })} style={input} />
              <input disabled={!canManage} type="number" min={0} defaultValue={t.allowancePerDay || 0} onBlur={(e) => Number(e.target.value || 0) !== (t.allowancePerDay || 0) && upd(t, { allowancePerDay: Number(e.target.value || 0) })} style={input} />
              <input disabled={!canManage} type="checkbox" checked={t.active} onChange={(e) => upd(t, { active: e.target.checked })} />
              {canManage ? <span onClick={() => { if (confirm(`Remove ${t.name}?`)) run(() => api.shifts.removeTemplate(t.id), 'Removed'); }} style={{ cursor: 'pointer', color: DANGER }}>×</span> : <span />}
            </div>
          ))}
        </div>
      </div>
      {canManage && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid ' + LINE }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramadan day shift" style={{ ...input, maxWidth: 260 }} />
          <div onClick={() => name.trim() && run(() => api.shifts.createTemplate({ name: name.trim() }), 'Shift added').then(() => setName(''))} style={btn(true)}>+ Add shift</div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ profile

export function EmployeeShiftPanel({ employee, employees, canManage, currency }: { employee: Employee; employees: Employee[]; canManage: boolean; currency: string }) {
  const { toast } = useApp();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [rows, setRows] = useState<ShiftAssignment[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const load = () => {
    api.shifts.templates().then((r: any) => setTemplates(Array.isArray(r) ? r : [])).catch(() => {});
    api.shifts.assignments({ employeeId: employee.id }).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  };
  useEffect(() => { load(); }, [employee.id]);
  const byId = new Map(templates.map((t) => [t.id, t]));
  const today = todayISO();
  const current = (rows || []).find((a) => a.startDate <= today && (!a.endDate || a.endDate >= today));
  const upcoming = (rows || []).filter((a) => a.startDate > today);
  const past = (rows || []).filter((a) => a.endDate && a.endDate < today);
  const todayT = current ? byId.get(shiftOn(current, today) || '') : undefined;
  const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); load(); } catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
  };

  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Shift</div>
        {canManage && <div onClick={() => setAssigning(true)} style={btn(true)}>{current || upcoming.length ? 'Change shift' : '+ Assign shift'}</div>}
      </div>
      {rows === null ? <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div> : !current && !upcoming.length ? (
        <div style={{ fontSize: 12.5, color: MUTED }}>Not on a shift roster.</div>
      ) : (
        <>
          {current && (
            <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.7 }}>
              <b>{describe(current, byId)}</b> since {fmtDate(current.startDate)}{current.endDate ? `, until ${fmtDate(current.endDate)}` : ''}
              {todayT && <> · today {todayT.name} {hours(todayT)}{todayT.allowancePerDay ? ` · ${money(todayT.allowancePerDay, currency)}/day allowance` : ''}</>}
              {canManage && <span onClick={() => act(() => api.shifts.end(current.id, today), 'Shift ended today')} style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: DANGER, cursor: 'pointer' }}>End today</span>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, margin: '10px 0' }}>
            {next7.map((d) => {
              const a = (rows || []).find((x) => shiftOn(x, d));
              const t = a ? byId.get(shiftOn(a, d)!) : undefined;
              return (
                <div key={d} style={{ textAlign: 'center', padding: '5px 0', borderRadius: 8, background: d === today ? '#DCE7DE' : '#F7F3EA' }}>
                  <div style={{ fontSize: 10, color: MUTED }}>{new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>
                  <div style={{ marginTop: 3 }}>{t ? <Chip t={t} /> : <span style={{ color: '#ccc' }}>·</span>}</div>
                </div>
              );
            })}
          </div>
          {upcoming.map((a) => (
            <div key={a.id} style={{ fontSize: 12.5, color: INK, padding: '4px 0' }}>
              From {fmtDate(a.startDate)}: <b>{describe(a, byId)}</b>
              {canManage && <span onClick={() => act(() => api.shifts.remove(a.id), 'Removed')} style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: DANGER, cursor: 'pointer' }}>Remove</span>}
            </div>
          ))}
        </>
      )}
      {past.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>Shift history ({past.length})</summary>
          {past.map((a) => <div key={a.id} style={{ fontSize: 12, color: INK, padding: '4px 0' }}>{fmtDate(a.startDate)} – {fmtDate(a.endDate)} · {describe(a, byId)}</div>)}
        </details>
      )}
      {assigning && <AssignShiftDrawer employees={employees} templates={templates} preselected={[employee.id]} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); load(); }} />}
    </div>
  );
}
