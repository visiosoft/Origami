import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import {
  ACCENT, DANGER, INK, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, localISO, money, todayISO,
  type PayrollSettings, type Project,
} from './manpowerUi';

interface OT {
  id: string; employeeId: string; projectId?: number; date: string; hours: number; otType: string; rate?: number; reason?: string;
  status: string; source: string; requestedById?: string; requestedByName?: string; decidedByName?: string; decidedAt?: string;
  decisionNote?: string; baseRate?: number; multiplier?: number; amount?: number; payrollRunId?: string;
}

const TYPES: [string, string][] = [['normal', 'Normal'], ['weekend', 'Weekend'], ['holiday', 'Holiday'], ['night', 'Night']];
const STATUS: Record<string, { label: string; tone: 'amber' | 'green' | 'red' | 'grey' | 'blue' }> = {
  pending: { label: 'Awaiting approval', tone: 'amber' }, approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' }, cancelled: { label: 'Cancelled', tone: 'grey' },
};
const statusOf = (o: OT) => (o.status === 'approved' && o.payrollRunId ? { label: 'Paid in payroll', tone: 'blue' as const } : STATUS[o.status] || STATUS.pending);

const hourlyOf = (e: Employee | undefined, s: PayrollSettings) => {
  if (!e) return 0;
  if (e.overtimeRate) return e.overtimeRate;
  const r = Number(e.payRate) || 0;
  return e.payType === 'hourly' ? r : e.payType === 'daily' ? r / s.standardDayHours : r / (s.monthDays * s.standardDayHours);
};

export function OvertimePanel({ employees, projects, settings, canManage, employeeId, onOpenEmployee }: {
  employees: Employee[]; projects: Project[]; settings: PayrollSettings; canManage: boolean;
  /** When set, the panel is embedded in that employee's profile. */
  employeeId?: string; onOpenEmployee?: (id: string) => void;
}) {
  const { currentUser } = useApp();
  const cur = settings.currency;
  const [rows, setRows] = useState<OT[] | null>(null);
  const [status, setStatus] = useState(employeeId ? '' : 'pending');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => api.overtime.list({ employeeId, status: status || undefined }).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, [employeeId, status]);

  const empById = new Map(employees.map((e) => [e.id, e]));
  const projectName = (id?: number) => (id ? projects.find((p) => p.id === id)?.name || `Project ${id}` : '—');
  const q = query.trim().toLowerCase();
  const shown = (rows || []).filter((o) => !q || (empById.get(o.employeeId)?.name || '').toLowerCase().includes(q));
  const pendingHours = shown.filter((o) => o.status === 'pending').reduce((a, o) => a + o.hours, 0);
  const unpaid = shown.filter((o) => o.status === 'approved' && !o.payrollRunId);
  const cols = (employeeId ? '' : 'minmax(160px,1.4fr) ') + '110px 1fr 70px 100px 120px 150px';
  const opened = rows?.find((o) => o.id === openId);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        {!employeeId && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" style={{ ...input, width: 200 }} />}
        <span style={{ fontSize: 12, color: MUTED }}>
          {pendingHours ? `${pendingHours} h awaiting approval · ` : ''}{unpaid.length ? `${money(unpaid.reduce((a, o) => a + (o.amount || 0), 0), cur)} approved, not yet in payroll` : ''}
        </span>
        <div style={{ flex: 1 }} />
        {!employeeId && canManage && <div onClick={() => setImporting(true)} style={btn()}>From daily logs…</div>}
        <div onClick={() => setAdding(true)} style={btn(true)}>+ Request overtime</div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: employeeId ? 640 : 860 }}>
            <div style={headRow(cols)}>{!employeeId && <span>Employee</span>}<span>Date</span><span>Project</span><span>Hours</span><span>Type</span><span>Amount</span><span>Status</span></div>
            {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((o) => {
              const s = statusOf(o);
              return (
                <div key={o.id} onClick={() => setOpenId(o.id)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                  {!employeeId && <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{empById.get(o.employeeId)?.name || 'Unknown'}</span>}
                  <span style={{ fontSize: 12.5 }}>{fmtDate(o.date)}</span>
                  <span style={{ fontSize: 12.5 }}>{projectName(o.projectId)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{o.hours}</span>
                  <span style={{ fontSize: 12.5, textTransform: 'capitalize' }}>{o.otType}</span>
                  <span style={{ fontSize: 12.5 }}>{o.amount != null ? money(o.amount, cur) : <span style={{ color: MUTED }}>on approval</span>}</span>
                  <span><Badge tone={s.tone}>{s.label}</Badge></span>
                </div>
              );
            })}
            {rows && !shown.length && <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>{status === 'pending' ? 'No overtime waiting for approval.' : 'No overtime here yet.'}</div>}
          </div>
        </div>
      </div>

      {adding && <RequestDrawer employees={employees} projects={projects} settings={settings} employeeId={employeeId} onClose={() => setAdding(false)} onDone={async () => { setAdding(false); await load(); }} />}
      {importing && <ImportDrawer employees={employees} projects={projects} onClose={() => setImporting(false)} onDone={async () => { setImporting(false); setStatus('pending'); await load(); }} />}
      {opened && (
        <DetailDrawer o={opened} employee={empById.get(opened.employeeId)} projectName={projectName} settings={settings} canManage={canManage}
          currentUserId={currentUser?.id} onOpenEmployee={onOpenEmployee} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}

function RequestDrawer({ employees, projects, settings, employeeId, onClose, onDone }: {
  employees: Employee[]; projects: Project[]; settings: PayrollSettings; employeeId?: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [f, setF] = useState({ employeeId: employeeId || '', date: todayISO(), hours: '2', otType: 'normal', projectId: '', rate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const emp = employees.find((e) => e.id === f.employeeId);
  const base = Number(f.rate) || hourlyOf(emp, settings);
  const mult = settings.otMultipliers[f.otType as keyof PayrollSettings['otMultipliers']] ?? 1.5;
  const estimate = base * mult * (Number(f.hours) || 0);

  const submit = async () => {
    if (!f.employeeId) { toast('⚠ Pick the employee'); return; }
    setSaving(true);
    try {
      await api.overtime.create({
        employeeId: f.employeeId, date: f.date, hours: Number(f.hours), otType: f.otType,
        projectId: f.projectId ? Number(f.projectId) : undefined, rate: f.rate ? Number(f.rate) : undefined, reason: f.reason || undefined,
      });
      toast('Overtime requested');
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not request overtime')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Request overtime" subtitle="Approved overtime is priced on approval and paid in the next payroll run." width={500} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Saving…' : 'Submit request'}</div></>}>
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
        <div><Label text="Date worked" /><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} style={input} /></div>
        <div><Label text="Hours" /><input type="number" min={0.5} max={16} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} style={input} /></div>
        <div><Label text="Type" /><select value={f.otType} onChange={(e) => setF({ ...f, otType: e.target.value })} style={input}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l} (×{settings.otMultipliers[k as 'normal']})</option>)}</select></div>
        <div><Label text="Project" /><select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} style={input}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text={`Hourly base override (${settings.currency}, optional)`} /><input type="number" min={0} value={f.rate} placeholder={base ? `Their rate: ${Math.round(base * 100) / 100}` : ''} onChange={(e) => setF({ ...f, rate: e.target.value })} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Reason" /><textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} placeholder="e.g. Slab pour ran late" style={{ ...input, resize: 'vertical' }} /></div>
      </div>
      {emp && (
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: '#F3F8F3', fontSize: 12.5, color: INK }}>
          Estimated {money(estimate, settings.currency)} — {f.hours || 0} h × {money(base, settings.currency)} × {mult}. {!base && <b style={{ color: DANGER }}>{emp.name} has no pay rate set yet.</b>}
        </div>
      )}
    </Drawer>
  );
}

function ImportDrawer({ employees, projects, onClose, onDone }: { employees: Employee[]; projects: Project[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const d = new Date();
  const [from, setFrom] = useState(localISO(new Date(d.getFullYear(), d.getMonth(), 1)));
  const [to, setTo] = useState(todayISO());
  const [items, setItems] = useState<any[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const name = (id: string) => employees.find((e) => e.id === id)?.name || 'Unknown';

  useEffect(() => {
    setItems(null);
    api.overtime.suggestions(from, to).then((r: any) => { const list = Array.isArray(r) ? r : []; setItems(list); setPicked(new Set(list.map((_: any, i: number) => i))); }).catch(() => setItems([]));
  }, [from, to]);

  const create = async () => {
    const chosen = (items || []).filter((_, i) => picked.has(i));
    if (!chosen.length) { toast('⚠ Nothing selected'); return; }
    setSaving(true);
    try {
      await api.overtime.bulk(chosen.map((x) => ({ employeeId: x.employeeId, date: x.date, hours: x.overtimeHours, otType: x.otType, projectId: x.projectId, source: 'daily_log', reason: `${x.loggedHours} h logged in the daily log` })));
      toast(`${chosen.length} overtime request${chosen.length === 1 ? '' : 's'} raised`);
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not raise overtime')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Overtime from daily logs" subtitle="Hours beyond a standard day in approved daily logs that nobody has raised overtime for yet. Selected rows become overtime requests awaiting approval." width={640} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : create} style={btn(true, saving)}>{saving ? 'Raising…' : `Raise ${picked.size} request${picked.size === 1 ? '' : 's'}`}</div></>}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div><Label text="From" /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={input} /></div>
        <div><Label text="To" /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={input} /></div>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={headRow('30px 1.4fr 110px 1fr 80px 90px')}><span /><span>Employee</span><span>Date</span><span>Project</span><span>Logged</span><span>Overtime</span></div>
        {items === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Looking…</div>}
        {(items || []).map((x, i) => (
          <label key={i} style={{ ...bodyRow('30px 1.4fr 110px 1fr 80px 90px'), cursor: 'pointer' }}>
            <input type="checkbox" checked={picked.has(i)} onChange={() => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />
            <span style={{ fontSize: 13, color: INK }}>{name(x.employeeId)}</span>
            <span style={{ fontSize: 12.5 }}>{fmtDate(x.date)}{x.otType === 'weekend' ? ' · weekend' : ''}</span>
            <span style={{ fontSize: 12.5 }}>{x.projectId ? projects.find((p) => p.id === x.projectId)?.name : 'Several'}</span>
            <span style={{ fontSize: 12.5 }}>{x.loggedHours} h</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{x.overtimeHours} h</span>
          </label>
        ))}
        {items && !items.length && <div style={{ padding: 18, fontSize: 12.5, color: MUTED }}>No unclaimed extra hours in approved daily logs for these dates.</div>}
      </div>
    </Drawer>
  );
}

function DetailDrawer({ o, employee, projectName, settings, canManage, currentUserId, onOpenEmployee, onClose, onChanged }: {
  o: OT; employee?: Employee; projectName: (id?: number) => string; settings: PayrollSettings; canManage: boolean; currentUserId?: string;
  onOpenEmployee?: (id: string) => void; onClose: () => void; onChanged: () => Promise<unknown>;
}) {
  const { toast } = useApp();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const cur = settings.currency;
  const s = statusOf(o);
  const own = !!currentUserId && (currentUserId === o.requestedById || currentUserId === employee?.userId);
  const base = o.baseRate ?? (o.rate || hourlyOf(employee, settings));
  const mult = o.multiplier ?? settings.otMultipliers[o.otType as 'normal'];

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); await onChanged(); onClose(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
    finally { setBusy(false); }
  };

  return (
    <Drawer title={`${employee?.name || 'Overtime'} — ${o.hours} h`} subtitle={`${fmtDate(o.date)} · ${projectName(o.projectId)} · ${o.otType} overtime`} width={480} onClose={onClose}
      footer={<>
        {['pending', 'approved'].includes(o.status) && !o.payrollRunId && <div onClick={busy ? undefined : () => act(() => api.overtime.cancel(o.id), 'Cancelled')} style={btn(false, busy)}>Cancel request</div>}
        {o.status === 'pending' && canManage && !own && <>
          <div onClick={busy ? undefined : () => act(() => api.overtime.reject(o.id, note), 'Rejected')} style={{ ...btn(false, busy), color: DANGER }}>Reject</div>
          <div onClick={busy ? undefined : () => act(() => api.overtime.approve(o.id, note), 'Approved')} style={btn(true, busy)}>Approve</div>
        </>}
      </>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge tone={s.tone}>{s.label}</Badge>
        {o.source === 'daily_log' && <Badge tone="grey">From daily log</Badge>}
        {onOpenEmployee && <span onClick={() => onOpenEmployee(o.employeeId)} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Open profile →</span>}
      </div>
      <div style={{ ...card, padding: '12px 14px', marginBottom: 14, fontSize: 12.5, lineHeight: 1.8 }}>
        <div>Requested by <b>{o.requestedByName || 'Unknown'}</b></div>
        {o.reason && <div>Reason: {o.reason}</div>}
        <div>{o.status === 'approved' ? 'Priced at' : 'Would be priced at'} <b>{o.hours} h × {money(base, cur)} × {mult}</b> = <b style={{ color: ACCENT }}>{money(o.amount ?? o.hours * base * mult, cur)}</b></div>
        {o.decidedByName && <div>{o.status === 'rejected' ? 'Rejected' : o.status === 'cancelled' ? 'Cancelled' : 'Approved'} by <b>{o.decidedByName}</b> on {fmtDate(o.decidedAt)}{o.decisionNote ? ` — ${o.decisionNote}` : ''}</div>}
      </div>
      {o.status === 'pending' && canManage && !own && (
        <><Label text="Note (optional)" /><input value={note} onChange={(e) => setNote(e.target.value)} style={input} /></>
      )}
      {o.status === 'pending' && own && <div style={{ fontSize: 12, color: MUTED }}>You raised this (or it's your own overtime) — someone else approves it.</div>}
      {o.status === 'pending' && !canManage && <div style={{ fontSize: 12, color: MUTED }}>Waiting for a supervisor or HR to approve.</div>}
      {o.status === 'approved' && !o.payrollRunId && <div style={{ fontSize: 12, color: MUTED }}>Will be paid in the next payroll run that covers {fmtDate(o.date)}.</div>}
    </Drawer>
  );
}
