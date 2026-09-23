import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import {
  ACCENT, BG, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, localISO, money, todayISO,
  type Assignment, type PayrollSettings, type Project,
} from './manpowerUi';

export interface LeaveType { id: string; name: string; paid: boolean; trackBalance: boolean; annualDays: number; carryForwardMax: number; encashable: boolean; color?: string; active: boolean; order: number }
interface LeaveRequest {
  id: string; employeeId: string; leaveTypeId: string; type: string; startDate: string; endDate: string; halfDay?: boolean; days: number;
  reason?: string; status: string; requestedBy?: string; requestedById?: string; requestedAt?: string; decidedBy?: string; decidedAt?: string; note?: string;
}
interface Balance { leaveTypeId: string; name: string; trackBalance: boolean; paid: boolean; encashable: boolean; entitlement: number; carriedForward: number; adjusted: number; encashed: number; used: number; pending: number; available: number }
interface Holiday { id: string; date: string; name: string }

const STATUS: Record<string, { label: string; tone: 'amber' | 'green' | 'red' | 'grey' }> = {
  pending: { label: 'Awaiting approval', tone: 'amber' }, approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' }, cancelled: { label: 'Cancelled', tone: 'grey' },
};
const typeColor = (t?: LeaveType) => t?.color || '#7E9B93';
const Dot = ({ color }: { color: string }) => <span style={{ width: 9, height: 9, borderRadius: 999, background: color, display: 'inline-block', flexShrink: 0 }} />;
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

function useTypes() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const load = () => api.leave.types().then((r: any) => setTypes(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { load(); }, []);
  return { types, reload: load };
}

// ------------------------------------------------------------------ module

export function LeaveModule({ employees, projects, assignments, settings, canManage, onOpenEmployee }: {
  employees: Employee[]; projects: Project[]; assignments: Assignment[]; settings: PayrollSettings; canManage: boolean; onOpenEmployee: (id: string) => void;
}) {
  const [view, setView] = useState<'requests' | 'calendar' | 'balances'>('requests');
  const { types } = useTypes();
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['requests', 'Requests'], ['calendar', 'Calendar'], ['balances', 'Balances']] as const).map(([k, l]) => (
          <div key={k} onClick={() => setView(k)} style={{ ...btn(view === k), padding: '6px 13px', fontSize: 12 }}>{l}</div>
        ))}
      </div>
      {view === 'requests' && <LeaveRequests employees={employees} types={types} canManage={canManage} onOpenEmployee={onOpenEmployee} />}
      {view === 'calendar' && <LeaveCalendar employees={employees} projects={projects} assignments={assignments} types={types} settings={settings} onOpenEmployee={onOpenEmployee} />}
      {view === 'balances' && <BalancesOverview employees={employees} onOpenEmployee={onOpenEmployee} />}
    </div>
  );
}

function LeaveRequests({ employees, types, canManage, onOpenEmployee, employeeId }: {
  employees: Employee[]; types: LeaveType[]; canManage: boolean; onOpenEmployee?: (id: string) => void; employeeId?: string;
}) {
  const [rows, setRows] = useState<LeaveRequest[] | null>(null);
  const [status, setStatus] = useState(employeeId ? '' : 'pending');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = () => api.leave.requests({ employeeId, status: status || undefined }).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, [employeeId, status]);

  const empById = new Map(employees.map((e) => [e.id, e]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const q = query.trim().toLowerCase();
  const shown = (rows || []).filter((r) => !q || (empById.get(r.employeeId)?.name || '').toLowerCase().includes(q));
  const cols = (employeeId ? '' : 'minmax(150px,1.3fr) ') + '150px 210px 80px 160px';
  const opened = rows?.find((r) => r.id === openId);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        {!employeeId && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" style={{ ...input, width: 200 }} />}
        <div style={{ flex: 1 }} />
        <div onClick={() => setAdding(true)} style={btn(true)}>+ Request leave</div>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: employeeId ? 600 : 780 }}>
            <div style={headRow(cols)}>{!employeeId && <span>Employee</span>}<span>Type</span><span>Dates</span><span>Days</span><span>Status</span></div>
            {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((r) => {
              const t = typeById.get(r.leaveTypeId);
              const s = STATUS[r.status] || STATUS.pending;
              return (
                <div key={r.id} onClick={() => setOpenId(r.id)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                  {!employeeId && <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{empById.get(r.employeeId)?.name || 'Unknown'}</span>}
                  <span style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5 }}><Dot color={typeColor(t)} />{t?.name || r.type}{t && !t.paid ? <span style={{ fontSize: 10.5, color: MUTED }}>unpaid</span> : null}</span>
                  <span style={{ fontSize: 12.5 }}>{r.startDate === r.endDate ? fmtDate(r.startDate) + (r.halfDay ? ' (half)' : '') : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.days}</span>
                  <span><Badge tone={s.tone}>{s.label}</Badge></span>
                </div>
              );
            })}
            {rows && !shown.length && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>{status === 'pending' ? 'No leave waiting for approval.' : 'No leave here.'}</div>}
          </div>
        </div>
      </div>
      {adding && <RequestLeaveDrawer employees={employees} types={types} employeeId={employeeId} onClose={() => setAdding(false)} onDone={async () => { setAdding(false); await load(); }} />}
      {opened && <LeaveDetail r={opened} employee={empById.get(opened.employeeId)} type={typeById.get(opened.leaveTypeId)} canManage={canManage} onOpenEmployee={onOpenEmployee} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

export function RequestLeaveDrawer({ employees, types, employeeId, onClose, onDone }: {
  employees: Employee[]; types: LeaveType[]; employeeId?: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [f, setF] = useState({ employeeId: employeeId || '', leaveTypeId: types.find((t) => t.active)?.id || '', startDate: todayISO(), endDate: todayISO(), halfDay: false, reason: '' });
  const [preview, setPreview] = useState<{ days: number; balances: (Balance & { year: number })[] } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!f.employeeId || !f.leaveTypeId || !f.startDate || !f.endDate) { setPreview(null); return; }
    const t = setTimeout(() => {
      api.leave.preview(f).then((r: any) => { setPreview(r); setPreviewError(''); }).catch((e: Error) => { setPreview(null); setPreviewError(e.message); });
    }, 250);
    return () => clearTimeout(t);
  }, [f.employeeId, f.leaveTypeId, f.startDate, f.endDate, f.halfDay]);

  const submit = async () => {
    setSaving(true);
    try { await api.leave.create({ ...f, reason: f.reason || undefined }); toast('Leave requested'); onDone(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not request leave')); }
    finally { setSaving(false); }
  };
  const single = f.startDate === f.endDate;

  return (
    <Drawer title="Request leave" subtitle="Weekends and public holidays inside the dates don't count against the balance." width={500} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Submitting…' : 'Submit request'}</div></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {!employeeId && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Label text="Employee" />
            <select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} style={input}>
              <option value="">Select…</option>
              {employees.filter((e) => !e.contractorId).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.workerId}</option>)}
            </select>
          </div>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <Label text="Type of leave" />
          <select value={f.leaveTypeId} onChange={(e) => setF({ ...f, leaveTypeId: e.target.value })} style={input}>
            {types.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}{t.paid ? '' : ' (unpaid)'}</option>)}
          </select>
        </div>
        <div><Label text="First day" /><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate })} style={input} /></div>
        <div><Label text="Last day" /><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value, halfDay: false })} style={input} /></div>
        {single && <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: INK }}><input type="checkbox" checked={f.halfDay} onChange={(e) => setF({ ...f, halfDay: e.target.checked })} />Half day only</label>}
        <div style={{ gridColumn: '1 / -1' }}><Label text="Reason" /><textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} /></div>
      </div>
      {(preview || previewError) && (
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: previewError ? '#F7ECE6' : '#F3F8F3', fontSize: 12.5, color: previewError ? DANGER : INK, lineHeight: 1.6 }}>
          {previewError || (
            <>
              <b>{days(preview!.days)}</b> of leave.
              {preview!.balances.map((b) => (
                <div key={b.year}>{b.year}: {b.available} available{b.pending ? `, ${b.pending} already pending` : ''} → <b style={{ color: b.available - b.pending - preview!.days < 0 ? DANGER : ACCENT }}>{Math.round((b.available - b.pending - preview!.days) * 10) / 10} left after this</b></div>
              ))}
              {!preview!.balances.length && <div style={{ color: MUTED }}>This type has no yearly balance.</div>}
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

function LeaveDetail({ r, employee, type, canManage, onOpenEmployee, onClose, onChanged }: {
  r: LeaveRequest; employee?: Employee; type?: LeaveType; canManage: boolean; onOpenEmployee?: (id: string) => void; onClose: () => void; onChanged: () => Promise<unknown>;
}) {
  const { toast, currentUser } = useApp();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const s = STATUS[r.status] || STATUS.pending;
  const own = !!currentUser?.id && (currentUser.id === r.requestedById || currentUser.id === employee?.userId);
  const canCancel = r.status === 'pending' || (r.status === 'approved' && r.startDate > todayISO());
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); await onChanged(); onClose(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
    finally { setBusy(false); }
  };
  return (
    <Drawer title={`${employee?.name || 'Leave'} — ${type?.name || r.type} leave`} width={480} onClose={onClose}
      subtitle={`${fmtDate(r.startDate)}${r.startDate !== r.endDate ? ' – ' + fmtDate(r.endDate) : r.halfDay ? ' (half day)' : ''} · ${days(r.days)}`}
      footer={<>
        {canCancel && <div onClick={busy ? undefined : () => act(() => api.leave.cancel(r.id), 'Cancelled')} style={btn(false, busy)}>Cancel leave</div>}
        {r.status === 'pending' && canManage && !own && <>
          <div onClick={busy ? undefined : () => act(() => api.leave.reject(r.id, note), 'Rejected')} style={{ ...btn(false, busy), color: DANGER }}>Reject</div>
          <div onClick={busy ? undefined : () => act(() => api.leave.approve(r.id, note), 'Approved')} style={btn(true, busy)}>Approve</div>
        </>}
      </>}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <Badge tone={s.tone}>{s.label}</Badge>
        {type && !type.paid && <Badge tone="grey">Unpaid</Badge>}
        {onOpenEmployee && <span onClick={() => onOpenEmployee(r.employeeId)} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Open profile →</span>}
      </div>
      <div style={{ ...card, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.8, marginBottom: 14 }}>
        <div>Requested by <b>{r.requestedBy || 'Unknown'}</b>{r.requestedAt ? ` on ${fmtDate(r.requestedAt)}` : ''}</div>
        {r.reason && <div>Reason: {r.reason}</div>}
        {r.decidedBy && <div>{s.label} by <b>{r.decidedBy}</b>{r.decidedAt ? ` on ${fmtDate(r.decidedAt)}` : ''}{r.note ? ` — ${r.note}` : ''}</div>}
      </div>
      {r.status === 'pending' && canManage && !own && <><Label text="Note (optional)" /><input value={note} onChange={(e) => setNote(e.target.value)} style={input} /></>}
      {r.status === 'pending' && own && <div style={{ fontSize: 12, color: MUTED }}>You raised this, or it's your own leave — someone else decides it.</div>}
      {r.status === 'pending' && !canManage && <div style={{ fontSize: 12, color: MUTED }}>Waiting for HR to decide.</div>}
    </Drawer>
  );
}

// ------------------------------------------------------------------ calendar

function LeaveCalendar({ employees, projects, assignments, types, settings, onOpenEmployee }: {
  employees: Employee[]; projects: Project[]; assignments: Assignment[]; types: LeaveType[]; settings: PayrollSettings; onOpenEmployee: (id: string) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [projectId, setProjectId] = useState<number | ''>('');
  const [everyone, setEveryone] = useState(false);
  const [data, setData] = useState<{ requests: LeaveRequest[]; holidays: Holiday[] } | null>(null);
  const from = localISO(new Date(month.y, month.m, 1));
  const to = localISO(new Date(month.y, month.m + 1, 0));
  useEffect(() => { setData(null); api.leave.calendar(from, to).then((r: any) => setData(r)).catch(() => setData({ requests: [], holidays: [] })); }, [from, to]);

  const dates = useMemo(() => { const out: string[] = []; for (let d = 1; d <= new Date(month.y, month.m + 1, 0).getDate(); d++) out.push(localISO(new Date(month.y, month.m, d))); return out; }, [month]);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const holidayOn = new Map((data?.holidays || []).map((h) => [h.date, h.name]));
  const onProject = new Set(assignments.filter((a) => a.current && (!projectId || a.projectId === projectId)).map((a) => a.employeeId));
  const withLeave = new Set((data?.requests || []).map((r) => r.employeeId));
  const people = employees
    .filter((e) => !e.contractorId && (!projectId || onProject.has(e.id)) && (everyone || withLeave.has(e.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const today = todayISO();
  const offToday = new Set((data?.requests || []).filter((r) => r.status === 'approved' && r.startDate <= today && r.endDate >= today && (!projectId || onProject.has(r.employeeId))).map((r) => r.employeeId)).size;
  const cell = 28;
  const shiftMonth = (n: number) => setMonth(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div onClick={() => shiftMonth(-1)} style={{ ...btn(), padding: '6px 11px' }}>‹</div>
        <div style={{ fontFamily: BG, fontSize: 16, fontWeight: 700, color: INK, minWidth: 150, textAlign: 'center' }}>{new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <div onClick={() => shiftMonth(1)} style={{ ...btn(), padding: '6px 11px' }}>›</div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={{ ...input, width: 'auto' }}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: INK }}><input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />Show everyone</label>
        <span style={{ fontSize: 12, color: MUTED }}>{offToday} off today{projectId ? ' on this project' : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {types.filter((t) => t.active).map((t) => <span key={t.id} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11.5, color: INK }}><Dot color={typeColor(t)} />{t.name}</span>)}
        <span style={{ fontSize: 11.5, color: MUTED }}>Faded = awaiting approval · shaded columns = weekend / holiday</span>
      </div>
      <div style={{ ...card, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${dates.length}, ${cell}px)`, minWidth: 180 + dates.length * cell }}>
          <div style={{ position: 'sticky', left: 0, background: '#F7F3EA', zIndex: 1, padding: '8px 12px', fontSize: 10.5, fontWeight: 700, color: '#9c96a4', textTransform: 'uppercase' }}>Employee</div>
          {dates.map((d) => {
            const dow = new Date(d + 'T00:00:00').getDay();
            const off = settings.weekendDays.includes(dow) || holidayOn.has(d);
            return (
              <div key={d} title={holidayOn.get(d) || ''} style={{ background: d === today ? '#DCE7DE' : off ? '#EFEAE0' : '#F7F3EA', textAlign: 'center', padding: '4px 0', fontSize: 10, color: holidayOn.has(d) ? DANGER : '#6b6478', fontWeight: 700 }}>
                <div>{'SMTWTFS'[dow]}</div><div>{Number(d.slice(8))}</div>
              </div>
            );
          })}
          {people.map((e) => (
            <div key={e.id} style={{ display: 'contents' }}>
              <div onClick={() => onOpenEmployee(e.id)} style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1, padding: '6px 12px', fontSize: 12.5, color: INK, borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
              {dates.map((d) => {
                const r = (data?.requests || []).find((x) => x.employeeId === e.id && x.startDate <= d && x.endDate >= d);
                const dow = new Date(d + 'T00:00:00').getDay();
                const off = settings.weekendDays.includes(dow) || holidayOn.has(d);
                const t = r ? typeById.get(r.leaveTypeId) : undefined;
                return (
                  <div key={d} title={r ? `${t?.name || r.type} · ${STATUS[r.status]?.label}` : ''} style={{ borderTop: '1px solid rgba(20,8,31,.05)', background: off ? '#F6F2EA' : 'white', display: 'grid', placeItems: 'center' }}>
                    {r && !off && <span style={{ width: r.halfDay ? 11 : 22, height: 16, borderRadius: 4, background: typeColor(t), opacity: r.status === 'pending' ? 0.4 : 1 }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {data && !people.length && <div style={{ padding: 18, fontSize: 12.5, color: MUTED }}>{everyone ? 'Nobody to show.' : 'Nobody has leave this month. Tick "Show everyone" to see the full team.'}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ balances

function BalancesOverview({ employees, onOpenEmployee }: { employees: Employee[]; onOpenEmployee: (id: string) => void }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<{ employeeId: string; balances: Balance[] }[] | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => { setRows(null); api.leave.balances(year).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [year]);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const typesShown = rows?.[0]?.balances || [];
  const q = query.trim().toLowerCase();
  const shown = (rows || []).filter((r) => !q || (empById.get(r.employeeId)?.name || '').toLowerCase().includes(q)).sort((a, b) => (empById.get(a.employeeId)?.name || '').localeCompare(empById.get(b.employeeId)?.name || ''));
  const cols = `minmax(170px,1.4fr) repeat(${Math.max(typesShown.length, 1)}, 120px)`;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" style={{ ...input, width: 200 }} />
        <span style={{ fontSize: 12, color: MUTED }}>Days available (of the year's allowance). Open someone to adjust or encash.</span>
      </div>
      <div style={{ ...card, overflow: 'auto' }}>
        <div style={{ minWidth: 170 + typesShown.length * 120 }}>
          <div style={headRow(cols)}><span>Employee</span>{typesShown.map((b) => <span key={b.leaveTypeId}>{b.name}</span>)}</div>
          {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
          {shown.map((r) => (
            <div key={r.employeeId} onClick={() => onOpenEmployee(r.employeeId)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{empById.get(r.employeeId)?.name || r.employeeId}</span>
              {r.balances.map((b) => (
                <span key={b.leaveTypeId} style={{ fontSize: 12.5 }}>
                  <b style={{ color: b.available < 0 ? DANGER : INK }}>{b.available}</b>
                  <span style={{ color: MUTED }}> / {Math.round((b.entitlement + b.carriedForward + b.adjusted) * 10) / 10}</span>
                  {b.pending ? <span style={{ color: '#8A6D12', fontSize: 11 }}> ({b.pending} pending)</span> : null}
                </span>
              ))}
            </div>
          ))}
          {rows && !shown.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Nobody on staff yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ profile tab

export function EmployeeLeavePanel({ employee, employees, canManage, currency }: { employee: Employee; employees: Employee[]; canManage: boolean; currency: string }) {
  const { toast } = useApp();
  const { types } = useTypes();
  const [year, setYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [action, setAction] = useState<{ kind: 'adjust' | 'encash'; b: Balance } | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [key, setKey] = useState(0);

  const load = () => {
    api.leave.balances(year, employee.id).then((r: any) => setBalances(Array.isArray(r) ? r : [])).catch(() => setBalances([]));
    api.leave.adjustments(employee.id).then((r: any) => setAdjustments(Array.isArray(r) ? r : [])).catch(() => {});
    setKey((k) => k + 1);
  };
  useEffect(() => { load(); }, [employee.id, year]);

  const submit = async () => {
    if (!action) return;
    try {
      if (action.kind === 'adjust') await api.leave.adjust({ employeeId: employee.id, leaveTypeId: action.b.leaveTypeId, year, days: Number(amount), note });
      else await api.leave.encash({ employeeId: employee.id, leaveTypeId: action.b.leaveTypeId, year, days: Number(amount) });
      toast(action.kind === 'adjust' ? 'Balance adjusted' : 'Encashment recorded — it will be paid in the next payroll run');
      setAction(null); setAmount(''); setNote(''); load();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
  };

  const tracked = (balances || []).filter((b) => b.trackBalance);
  const untracked = (balances || []).filter((b) => !b.trackBalance && (b.used || b.pending));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Leave balances</div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {balances === null ? <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
          {tracked.map((b) => (
            <div key={b.leaveTypeId} style={{ ...card, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: INK }}><Dot color={typeColor(types.find((t) => t.id === b.leaveTypeId))} />{b.name}</div>
              <div style={{ fontFamily: BG, fontSize: 24, fontWeight: 700, color: b.available < 0 ? DANGER : INK, marginTop: 4 }}>{b.available} <span style={{ fontSize: 12, color: MUTED, fontFamily: 'inherit', fontWeight: 600 }}>days left</span></div>
              <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.6, marginTop: 2 }}>
                {b.entitlement} allowance{b.carriedForward ? ` + ${b.carriedForward} carried` : ''}{b.adjusted ? ` ${b.adjusted > 0 ? '+' : '−'} ${Math.abs(b.adjusted)} adjusted` : ''} · {b.used} taken{b.encashed ? ` · ${b.encashed} encashed` : ''}{b.pending ? ` · ${b.pending} pending` : ''}
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <span onClick={() => { setAction({ kind: 'adjust', b }); setAmount(''); }} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Adjust</span>
                  {b.encashable && <span onClick={() => { setAction({ kind: 'encash', b }); setAmount(''); }} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Encash</span>}
                </div>
              )}
            </div>
          ))}
          {untracked.map((b) => (
            <div key={b.leaveTypeId} style={{ ...card, padding: '12px 14px' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{b.name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{b.used} taken{b.pending ? ` · ${b.pending} pending` : ''} · no yearly limit</div>
            </div>
          ))}
        </div>
      )}
      {action && (
        <div style={{ ...card, padding: '14px 16px', borderColor: ACCENT }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>{action.kind === 'adjust' ? `Adjust ${action.b.name} balance for ${year}` : `Encash ${action.b.name} days`}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ width: 150 }}><Label text={action.kind === 'adjust' ? 'Days (+ add, − remove)' : `Days (max ${Math.max(0, action.b.available - action.b.pending)})`} /><input type="number" step={0.5} value={amount} onChange={(e) => setAmount(e.target.value)} style={input} /></div>
            {action.kind === 'adjust' && <div style={{ flex: 1, minWidth: 200 }}><Label text="Reason" /><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Days worked on a holiday" style={input} /></div>}
            <div onClick={submit} style={btn(true)}>Save</div>
            <div onClick={() => setAction(null)} style={btn()}>Cancel</div>
          </div>
          {action.kind === 'encash' && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Valued at the employee's daily rate and paid ({currency}) in the next payroll run.</div>}
        </div>
      )}
      <div>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, marginBottom: 10 }}>Leave history</div>
        <LeaveRequests key={key} employees={employees} types={types} canManage={canManage} employeeId={employee.id} />
      </div>
      {adjustments.length > 0 && (
        <div>
          <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, marginBottom: 10 }}>Balance adjustments</div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {adjustments.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                <span style={{ width: 110, color: MUTED }}>{a.year} · {a.kind === 'carry_forward' ? 'Carried' : a.kind === 'encashment' ? 'Encashed' : 'Adjusted'}</span>
                <span style={{ flex: 1 }}>{types.find((t) => t.id === a.leaveTypeId)?.name} — {a.note}{a.amount ? ` · ${money(a.amount, currency)}${a.payrollRunId ? ' (paid)' : ' (next payroll)'}` : ''}</span>
                <b style={{ color: a.days < 0 ? DANGER : '#1E6B36' }}>{a.days > 0 ? '+' : ''}{a.days}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ setup

export function LeaveSetup({ canManage }: { canManage: boolean }) {
  const { toast } = useApp();
  const { types, reload } = useTypes();
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newType, setNewType] = useState('');
  const [hol, setHol] = useState({ date: '', name: '' });
  const loadHolidays = () => api.leave.holidays(year).then((r: any) => setHolidays(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { loadHolidays(); }, [year]);

  const run = async (fn: () => Promise<unknown>, msg?: string, after?: () => void) => {
    try { await fn(); if (msg) toast(msg); after?.(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); reload(); }
  };
  const upd = (t: LeaveType, patch: Partial<LeaveType>) => run(() => api.leave.updateType(t.id, patch), undefined, reload);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const cols = 'minmax(140px,1.3fr) 44px 70px 70px 100px 110px 90px 60px 26px';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 6px' }}>
          <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK }}>Leave types</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>Types with a yearly balance are capped by it; others (maternity, unpaid…) just record the days. Unpaid leave is deducted from salaried staff's pay.</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={headRow(cols)}><span>Name</span><span>Color</span><span>Paid</span><span>Balance</span><span>Days / year</span><span>Carry-forward</span><span>Encashable</span><span>Active</span><span /></div>
            {types.map((t) => (
              <div key={t.id} style={bodyRow(cols)}>
                <input disabled={!canManage} defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && upd(t, { name: e.target.value.trim() })} style={input} />
                <input disabled={!canManage} type="color" value={t.color || '#7E9B93'} onChange={(e) => upd(t, { color: e.target.value })} style={{ width: 32, height: 28, border: 'none', background: 'none', padding: 0 }} />
                <input type="checkbox" disabled={!canManage} checked={t.paid} onChange={(e) => upd(t, { paid: e.target.checked })} />
                <input type="checkbox" disabled={!canManage} checked={t.trackBalance} onChange={(e) => upd(t, { trackBalance: e.target.checked })} />
                <input disabled={!canManage || !t.trackBalance} type="number" min={0} defaultValue={t.annualDays} onBlur={(e) => num(e.target.value) !== t.annualDays && upd(t, { annualDays: num(e.target.value) })} style={input} />
                <input disabled={!canManage || !t.trackBalance} type="number" min={0} defaultValue={t.carryForwardMax} onBlur={(e) => num(e.target.value) !== t.carryForwardMax && upd(t, { carryForwardMax: num(e.target.value) })} style={input} title="Most days that can move to next year" />
                <input type="checkbox" disabled={!canManage || !t.trackBalance} checked={t.encashable} onChange={(e) => upd(t, { encashable: e.target.checked })} />
                <input type="checkbox" disabled={!canManage} checked={t.active} onChange={(e) => upd(t, { active: e.target.checked })} />
                {canManage ? <span onClick={() => { if (confirm(`Remove ${t.name}?`)) run(() => api.leave.removeType(t.id), 'Removed', reload); }} style={{ cursor: 'pointer', color: DANGER }}>×</span> : <span />}
              </div>
            ))}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid ' + LINE }}>
            <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. Hajj leave" style={{ ...input, maxWidth: 260 }} />
            <div onClick={() => newType.trim() && run(() => api.leave.createType({ name: newType.trim() }), 'Leave type added', () => { setNewType(''); reload(); })} style={btn(true)}>+ Add type</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 8px' }}>
            <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Public holidays</div>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...input, width: 'auto' }}>{[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, padding: '0 16px 8px' }}>Not counted as leave days; overtime worked on them is holiday overtime.</div>
          {holidays.map((h) => (
            <div key={h.id} style={{ display: 'flex', gap: 10, padding: '8px 16px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
              <span style={{ width: 110, color: MUTED }}>{fmtDate(h.date)}</span><span style={{ flex: 1, color: INK }}>{h.name}</span>
              {canManage && <span onClick={() => run(() => api.leave.removeHoliday(h.id), undefined, loadHolidays)} style={{ cursor: 'pointer', color: DANGER }}>×</span>}
            </div>
          ))}
          {!holidays.length && <div style={{ padding: '8px 16px', fontSize: 12, color: MUTED }}>No holidays set for {year}.</div>}
          {canManage && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid ' + LINE }}>
              <input type="date" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} style={{ ...input, width: 150 }} />
              <input value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} placeholder="e.g. Independence Day" style={input} />
              <div onClick={() => run(() => api.leave.addHoliday(hol), 'Holiday added', () => { setHol({ date: '', name: '' }); loadHolidays(); })} style={btn(true)}>Add</div>
            </div>
          )}
          {canManage && (
            <div style={{ padding: '0 16px 12px' }}>
              <span onClick={() => run(async () => { const r: any = await api.leave.addUsFederalHolidays(year); toast(r.added ? `Added ${r.added} US federal holiday(s) for ${year}` : `All US federal holidays for ${year} are already on the calendar`); }, undefined, loadHolidays)}
                style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Add all US federal holidays for {year}</span>
            </div>
          )}
        </div>

        {canManage && (
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK }}>Year-end carry-forward</div>
            <div style={{ fontSize: 12, color: MUTED, margin: '6px 0 12px', lineHeight: 1.6 }}>
              Moves each person's unused days into next year, up to each type's carry-forward limit. Running it again replaces the previous result, so it's safe to re-run after late leave approvals.
            </div>
            <div onClick={() => { const y = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0); if (confirm(`Carry unused ${y} leave into ${y + 1}?`)) run(async () => { const r: any = await api.leave.carryForward(y); toast(`${r.carried} balance(s) carried into ${r.year} — ${r.days} days in total`); }); }} style={btn(true)}>
              Carry {new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0)} forward
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
