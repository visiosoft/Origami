import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { EmployeeDirectory, type Employee, type Trade } from '../components/EmployeeDirectory';
import { DeploymentBoard } from '../components/Deployment';
import { WorkforceRequests } from '../components/WorkforceRequests';
import { Contractors } from '../components/Contractors';
import { DEFAULT_SETTINGS, localISO, type Assignment, type Contractor, type PayrollSettings } from '../components/manpowerUi';
import { PayrollRuns, PayrollSetup } from '../components/Payroll';
import { OvertimePanel } from '../components/Overtime';
import { AdvancesPanel } from '../components/Advances';
import { LeaveModule, LeaveSetup } from '../components/Leave';
import { ShiftRoster } from '../components/Shifts';
import { AssetRegister } from '../components/Assets';
import { AccommodationModule } from '../components/Accommodation';
import { TransportModule } from '../components/Transport';
import { TimesheetsModule } from '../components/Timesheets';
import { CostCodesSettings } from '../components/CostCodes';
import { SampleDataPanel, SubcontractorTradesSetup } from '../components/SubcontractorTrades';

const BG = "'Bricolage Grotesque', serif";
const INK = '#0B1A12';
const MUTED = '#7E9B93';
const PAPER = '#FBF8F2';
const ACCENT = '#173326';

const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.13)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

interface Project { id: number; name: string }
interface CsiCode { id: string; code: string; division: string; description?: string; active: boolean; order: number }
interface LaborEntry {
  id?: string; employeeId: string; csiCodeId?: string; hours?: number;
  taskDetail?: string; taskStatus?: string; team?: string;
}
interface DailyLog {
  id: string | null; projectId: number; date: string; status: string; notes?: string;
  supervisorId?: string; supervisorName?: string; submittedAt?: string;
  approvedById?: string; approvedByName?: string; approvedAt?: string; rejectionNote?: string;
}

const TAB_GROUPS = [
  { label: 'People', tabs: [['employees', 'Employees'], ['contractors', 'Contractors']] },
  { label: 'Operations', tabs: [['deployment', 'Deployment'], ['requests', 'Workforce Requests'], ['shifts', 'Shifts'], ['log', 'Daily Log'], ['approvals', 'Approvals'], ['timesheets', 'Timesheets']] },
  { label: 'Payroll', tabs: [['payroll', 'Payroll'], ['overtime', 'Overtime'], ['advances', 'Advances & Loans']] },
  { label: 'Employee Services', tabs: [['leave', 'Leave'], ['assets', 'Assets'], ['accommodation', 'Accommodation'], ['transport', 'Transport']] },
  { label: 'Setup', tabs: [['csi', 'Cost Codes'], ['sub_trades', 'Subcontractor Trades'], ['leave_setup', 'Leave & Holidays'], ['payroll_setup', 'Payroll Setup'], ['sample', 'Sample Data']] },
] as const;
type TabKey = typeof TAB_GROUPS[number]['tabs'][number][0];
const TAB_LABEL = Object.fromEntries(TAB_GROUPS.flatMap((g) => g.tabs.map(([k, l]) => [k, l]))) as Record<TabKey, string>;

/** One pill per group; the group holding the open screen shows it and is filled. Its screens open from a dropdown. */
function GroupMenu({ label, tabs, current, onPick }: {
  label: string; tabs: readonly (readonly [TabKey, string])[]; current: TabKey; onPick: (key: TabKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const active = tabs.find(([k]) => k === current);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', borderRadius: 10, cursor: 'pointer',
          fontSize: 14, whiteSpace: 'nowrap', userSelect: 'none',
          background: active ? ACCENT : '#fff', color: active ? '#fff' : INK,
          border: '1px solid ' + (active ? ACCENT : 'rgba(20,8,31,.12)'),
          boxShadow: active ? 'none' : '0 1px 2px rgba(20,8,31,.04)',
        }}
      >
        {active ? <><span style={{ color: 'rgba(255,255,255,.62)', fontWeight: 500 }}>{label}</span><span style={{ fontWeight: 700 }}>{active[1]}</span></>
          : <span style={{ fontWeight: 600 }}>{label}</span>}
        <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.8, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>▼</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 44, left: 0, zIndex: 50, minWidth: 210, background: '#fff', borderRadius: 12, border: '1px solid rgba(20,8,31,.1)', boxShadow: '0 12px 32px rgba(20,8,31,.14)', padding: 6 }}>
          {tabs.map(([key, name]) => (
            <div
              key={key}
              onClick={() => { onPick(key); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5,
                fontWeight: key === current ? 700 : 500, color: key === current ? ACCENT : INK, background: key === current ? '#EEF3EE' : undefined,
              }}
              onMouseEnter={(e) => { if (key !== current) e.currentTarget.style.background = '#F7F3EA'; }}
              onMouseLeave={(e) => { if (key !== current) e.currentTarget.style.background = ''; }}
            >
              <span style={{ flex: 1 }}>{name}</span>
              {key === current && <span style={{ fontSize: 12 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Who can still be logged against -- people who have left stay on record but out of the pickers. */
const LEFT = ['resigned', 'terminated', 'contract_expired', 'demobilized'];
const isWorking = (e: Employee) => !LEFT.includes(e.employmentStatus || '') && e.status !== 'inactive';

const STATUS_STYLE: Record<string, { bg: string; c: string }> = {
  draft: { bg: '#EFEDE8', c: '#5C6B65' },
  submitted: { bg: '#FBE9AE', c: '#8A6D12' },
  approved: { bg: '#D2EAD3', c: '#1E6B36' },
  rejected: { bg: '#F2DFD4', c: '#8E2E0A' },
  pending: { bg: '#FBE9AE', c: '#8A6D12' },
  denied: { bg: '#F2DFD4', c: '#8E2E0A' },
};
const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft;
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 9px', borderRadius: 999, background: s.bg, color: s.c, fontSize: 10.5, fontWeight: 700, textTransform: 'capitalize' }}>{status}</span>;
};

const todayISO = () => localISO();

export function Manpower() {
  const { toast, can, currentUser } = useApp();
  const canManage = can('manpower_con', 'manage');
  // Signing off and paying money is a finance permission, separate from HR's.
  const canFinance = can('fin_resources', 'manage');
  const [tab, setTab] = useState<TabKey>('employees');
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [csiCodes, setCsiCodes] = useState<CsiCode[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>(DEFAULT_SETTINGS);

  const reloadAssignments = () => api.assignments.list({ status: 'current' }).then((r: any) => setAssignments(Array.isArray(r) ? r : [])).catch(() => {});
  const reloadContractors = () => api.contractors.list().then((r: any) => setContractors(Array.isArray(r) ? r : [])).catch(() => {});
  /** Any screen can jump to someone's profile. */
  const openEmployee = (id: string) => { setOpenEmployeeId(id); setTab('employees'); };

  const reloadEmployees = () => api.employees.list().then((r: any) => setEmployees(Array.isArray(r) ? r : [])).catch(() => {});
  const reloadCsiCodes = () => api.csiCodes.list().then((r: any) => setCsiCodes(Array.isArray(r) ? r : [])).catch(() => {});
  /** Workers are classified by the same trade list as subcontractor companies. */
  const reloadTrades = () => api.subcontractorTrades.list().then((r: any) => setTrades((Array.isArray(r) ? r : []).map((t: any) => ({ id: t.id, name: `${t.code} ${t.name}`, active: t.active, order: t.order })))).catch(() => {});

  useEffect(() => {
    api.projects.list().then((r: any) => {
      const real = Array.isArray(r) ? r.filter((p: any) => p.stage !== 'Kickoff') : [];
      setProjects(real.map((p: any) => ({ id: p.id, name: p.name })));
    }).catch(() => {});
    reloadEmployees();
    reloadCsiCodes();
    reloadTrades();
    reloadAssignments();
    reloadContractors();
    api.payroll.settings().then((r: any) => { if (r && r.currency) setPayrollSettings(r); }).catch(() => {});
  }, []);

  const working = employees.filter(isWorking);

  return (
    <div style={{ padding: '28px 32px', background: PAPER, minHeight: '100%' }}>
      <h1 style={{ fontFamily: BG, fontWeight: 700, fontSize: 24, color: INK, margin: 0 }}>Manpower & Resources</h1>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: MUTED }}>Employees and contractor workers, project deployment, workforce requests, daily labor logs by cost code, timesheets and leave.</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, marginBottom: 22, flexWrap: 'wrap' }}>
        {TAB_GROUPS.map((g) => (
          <GroupMenu key={g.label} label={g.label} tabs={g.tabs} current={tab}
            onPick={(key) => { setTab(key); if (key === 'employees') setOpenEmployeeId(null); }} />
        ))}
      </div>
      <h2 style={{ fontFamily: BG, fontWeight: 700, fontSize: 19, color: INK, margin: '0 0 16px' }}>{TAB_LABEL[tab]}</h2>

      {tab === 'employees' && (
        <EmployeeDirectory employees={employees} trades={trades} projects={projects} assignments={assignments} contractors={contractors}
          reload={reloadEmployees} reloadAssignments={reloadAssignments} canManage={canManage} canFinance={canFinance} payrollSettings={payrollSettings}
          openId={openEmployeeId} onOpen={setOpenEmployeeId} />
      )}
      {tab === 'contractors' && (
        <Contractors employees={employees} trades={trades} projects={projects} assignments={assignments} canManage={canManage}
          reloadEmployees={async () => { await reloadEmployees(); await reloadContractors(); }} onOpenEmployee={openEmployee} />
      )}
      {tab === 'deployment' && (
        <DeploymentBoard employees={employees} trades={trades} projects={projects} assignments={assignments} canManage={canManage}
          reload={reloadAssignments} onOpenEmployee={openEmployee} />
      )}
      {tab === 'requests' && (
        <WorkforceRequests employees={employees} trades={trades} projects={projects} assignments={assignments} canManage={canManage}
          reloadAssignments={reloadAssignments} onOpenEmployee={openEmployee} />
      )}
      {tab === 'log' && <DailyLogTab projects={projects} employees={working} assignments={assignments} csiCodes={csiCodes.filter((c) => c.active)} canManage={canManage} toast={toast} />}
      {tab === 'approvals' && <ApprovalsTab projects={projects} employees={employees} csiCodes={csiCodes} canManage={canManage} toast={toast} currentUserId={currentUser?.id} />}
      {tab === 'timesheets' && <TimesheetsModule employees={employees} projects={projects} csiCodes={csiCodes} canManage={canManage} onOpenEmployee={openEmployee} />}
      {tab === 'leave' && <LeaveModule employees={employees} projects={projects} assignments={assignments} settings={payrollSettings} canManage={canManage} onOpenEmployee={openEmployee} />}
      {tab === 'shifts' && <ShiftRoster employees={employees} projects={projects} assignments={assignments} settings={payrollSettings} canManage={canManage} onOpenEmployee={openEmployee} />}
      {tab === 'assets' && <AssetRegister employees={employees} canManage={canManage} currency={payrollSettings.currency} onOpenEmployee={openEmployee} />}
      {tab === 'accommodation' && <AccommodationModule employees={employees} canManage={canManage} onOpenEmployee={openEmployee} />}
      {tab === 'transport' && <TransportModule employees={employees} projects={projects} canManage={canManage} onOpenEmployee={openEmployee} />}
      {tab === 'leave_setup' && <LeaveSetup canManage={canManage} />}
      {tab === 'sub_trades' && <SubcontractorTradesSetup canManage={canManage} />}
      {tab === 'sample' && <SampleDataPanel canManage={canManage} onChanged={async () => { await Promise.all([reloadEmployees(), reloadAssignments(), reloadContractors()]); }} />}
      {tab === 'csi' && <CostCodesSettings canManage={canManage} onChanged={reloadCsiCodes} />}
      {tab === 'payroll' && <PayrollRuns employees={employees} currency={payrollSettings.currency} canManage={canManage} canFinance={canFinance} />}
      {tab === 'overtime' && <OvertimePanel employees={employees} projects={projects} settings={payrollSettings} canManage={canManage} onOpenEmployee={openEmployee} />}
      {tab === 'advances' && <AdvancesPanel employees={employees} settings={payrollSettings} canManage={canManage} canFinance={canFinance} onOpenEmployee={openEmployee} />}
      {tab === 'payroll_setup' && <PayrollSetup settings={payrollSettings} onSettings={setPayrollSettings} canManage={canManage} />}
    </div>
  );
}

// -------------------------------------------------------------- Daily Log

function DailyLogTab({ projects, employees, assignments, csiCodes, canManage, toast }: {
  projects: Project[]; employees: Employee[]; assignments: Assignment[]; csiCodes: CsiCode[]; canManage: boolean; toast: (m: string) => void;
}) {
  const { authUser } = useApp();
  const runsSite = !!authUser?.isSuperintendent || authUser?.roleKey === 'admin';
  const [projectId, setProjectId] = useState<number | ''>('');
  const [date, setDate] = useState(todayISO());
  const [log, setLog] = useState<DailyLog | null>(null);
  const [entries, setEntries] = useState<LaborEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) { setLog(null); setEntries([]); return; }
    setLoading(true);
    api.dailyLogs.day(Number(projectId), date)
      .then((r: any) => { setLog(r.log); setEntries(r.entries || []); setNotes(r.log?.notes || ''); })
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setLoading(false));
  }, [projectId, date]);

  const locked = !!log && log.status !== 'draft' && log.status !== 'rejected';

  const addRow = () => setEntries((prev) => [...prev, { employeeId: '', csiCodeId: '', hours: undefined, taskDetail: '', taskStatus: 'start', team: '' }]);
  const patchRow = (i: number, patch: Partial<LaborEntry>) => setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const removeRow = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));

  // The crew deployed on this project that day comes first in the picker and can be added in one go.
  const onSite = new Set(assignments.filter((a) => a.projectId === projectId && a.startDate <= date && (!a.endDate || a.endDate >= date)).map((a) => a.employeeId));
  const crew = employees.filter((e) => onSite.has(e.id));
  const others = employees.filter((e) => !onSite.has(e.id));
  const missingCrew = crew.filter((e) => !entries.some((r) => r.employeeId === e.id));
  const addCrew = () => setEntries((prev) => [...prev, ...missingCrew.map((e) => ({ employeeId: e.id, csiCodeId: '', hours: 8, taskDetail: '', taskStatus: 'continued', team: '' }))]);

  const save = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const clean = entries.filter((e) => e.employeeId);
      const r: any = await api.dailyLogs.save({ projectId: Number(projectId), date, notes, entries: clean });
      setLog(r.log); setEntries(r.entries || []);
      toast('Saved');
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    finally { setSaving(false); }
  };

  const submit = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const clean = entries.filter((e) => e.employeeId);
      const r: any = await api.dailyLogs.save({ projectId: Number(projectId), date, notes, entries: clean });
      const submitted: any = await api.dailyLogs.submit(r.log.id);
      setLog(submitted);
      toast('Submitted for approval');
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not submit')); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={{ ...input, minWidth: 220 }}>
          <option value="">Select a project…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
        {log && <StatusBadge status={log.status} />}
        {log?.rejectionNote && <span style={{ fontSize: 11.5, color: '#8E2E0A' }}>Rejected: {log.rejectionNote}</span>}
        {runsSite && <a href="/daily-log" style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: ACCENT }}>Phone / tablet view →</a>}
      </div>

      {!projectId ? (
        <div style={{ fontSize: 12.5, color: MUTED, padding: '18px 0' }}>Pick a project and a date to view or start that day's log.</div>
      ) : loading ? (
        <div style={{ fontSize: 12.5, color: MUTED, padding: '18px 0' }}>Loading…</div>
      ) : (
        <div style={{ background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 80px 1.6fr 90px 70px 30px', gap: 8, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
            <span>Employee</span><span>CSI Code</span><span>Hours</span><span>Task Detail</span><span>Status</span><span>Team</span><span />
          </div>
          {entries.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 80px 1.6fr 90px 70px 30px', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
              <select disabled={locked || !canManage} value={row.employeeId} onChange={(e) => patchRow(i, { employeeId: e.target.value })} style={input}>
                <option value="">Select…</option>
                {crew.length > 0 && <optgroup label="Deployed on this project">{crew.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</optgroup>}
                <optgroup label={crew.length ? 'Others' : 'Employees'}>{others.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</optgroup>
              </select>
              <select disabled={locked || !canManage} value={row.csiCodeId || ''} onChange={(e) => patchRow(i, { csiCodeId: e.target.value })} style={input}>
                <option value="">Select…</option>
                {csiCodes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
              </select>
              <input disabled={locked || !canManage} type="number" min={0} step={0.5} value={row.hours ?? ''} onChange={(e) => patchRow(i, { hours: e.target.value ? Number(e.target.value) : undefined })} style={input} />
              <input disabled={locked || !canManage} value={row.taskDetail || ''} onChange={(e) => patchRow(i, { taskDetail: e.target.value })} placeholder="What they worked on" style={input} />
              <select disabled={locked || !canManage} value={row.taskStatus || 'start'} onChange={(e) => patchRow(i, { taskStatus: e.target.value })} style={input}>
                <option value="start">Start</option>
                <option value="continued">Continued</option>
                <option value="completing">Completing</option>
              </select>
              <select disabled={locked || !canManage} value={row.team || ''} onChange={(e) => patchRow(i, { team: e.target.value })} style={input}>
                <option value="">—</option>
                {['A', 'B', 'C', 'D'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {!locked && canManage && <span onClick={() => removeRow(i)} style={{ cursor: 'pointer', color: '#8E2E0A', fontSize: 13, textAlign: 'center' }}>×</span>}
            </div>
          ))}
          {!entries.length && <div style={{ padding: '16px 14px', fontSize: 12, color: MUTED }}>No workers logged yet.</div>}
          {!locked && canManage && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
              <div onClick={addRow} style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,.14)', color: ACCENT }}>+ Add worker</div>
              {missingCrew.length > 0 && <div onClick={addCrew} style={{ display: 'inline-block', marginLeft: 8, padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white' }}>+ Add deployed crew ({missingCrew.length})</div>}
            </div>
          )}

          <div style={{ padding: '14px', borderTop: '1px solid rgba(20,8,31,.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Notes</div>
            <textarea disabled={locked || !canManage} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...input, width: '100%', resize: 'vertical' }} />
          </div>

          {!locked && canManage && (
            <div style={{ display: 'flex', gap: 8, padding: '14px' }}>
              <div onClick={saving ? undefined : save} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', border: '1px solid rgba(20,8,31,.14)', color: ACCENT }}>{saving ? 'Saving…' : 'Save draft'}</div>
              <div onClick={saving ? undefined : submit} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: ACCENT, color: 'white' }}>{saving ? 'Submitting…' : 'Submit for approval'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Approvals

function ApprovalsTab({ projects, employees, csiCodes, canManage, toast, currentUserId }: {
  projects: Project[]; employees: Employee[]; csiCodes: CsiCode[]; canManage: boolean; toast: (m: string) => void; currentUserId?: string;
}) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [entriesByLog, setEntriesByLog] = useState<Record<string, LaborEntry[]>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name || id;
  const csiLabel = (id?: string) => { const c = csiCodes.find((x) => x.id === id); return c ? `${c.code} — ${c.division}` : '—'; };

  const reload = () => api.dailyLogs.list({ status: 'submitted' }).then((r: any) => setLogs(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { reload(); }, []);

  const open = async (log: DailyLog) => {
    if (openId === log.id) { setOpenId(null); return; }
    setOpenId(log.id);
    if (!entriesByLog[log.id!]) {
      const r: any = await api.dailyLogs.day(log.projectId, log.date);
      setEntriesByLog((prev) => ({ ...prev, [log.id!]: r.entries || [] }));
    }
  };

  const approve = async (id: string) => {
    try { await api.dailyLogs.approve(id); toast('Approved'); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not approve')); }
  };
  const reject = async (id: string) => {
    try { await api.dailyLogs.reject(id, note); setRejecting(null); setNote(''); toast('Rejected'); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not reject')); }
  };

  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden' }}>
      {!logs.length && <div style={{ padding: '20px 16px', fontSize: 12.5, color: MUTED }}>Nothing waiting for approval.</div>}
      {logs.map((log) => {
        const selfSubmitted = !!currentUserId && currentUserId === log.supervisorId;
        return (
          <div key={log.id} style={{ borderTop: '1px solid rgba(20,8,31,.05)' }}>
            <div onClick={() => open(log)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{projectName(log.projectId)} — {log.date}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>Submitted by {log.supervisorName || 'Unknown'}{log.submittedAt ? ` · ${new Date(log.submittedAt).toLocaleString()}` : ''}</div>
              </div>
              <StatusBadge status={log.status} />
            </div>
            {openId === log.id && (
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ border: '1px solid rgba(20,8,31,.08)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 70px 1.6fr', gap: 8, padding: '7px 12px', background: '#F7F3EA', fontSize: 10, fontWeight: 700, color: '#9c96a4', textTransform: 'uppercase' }}>
                    <span>Employee</span><span>CSI Code</span><span>Hours</span><span>Task Detail</span>
                  </div>
                  {(entriesByLog[log.id!] || []).map((e, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 70px 1.6fr', gap: 8, padding: '7px 12px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                      <span>{employeeName(e.employeeId)}</span><span>{csiLabel(e.csiCodeId)}</span><span>{e.hours ?? '—'}</span><span>{e.taskDetail || '—'}</span>
                    </div>
                  ))}
                </div>
                {canManage && !selfSubmitted && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div onClick={() => approve(log.id!)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white' }}>Approve</div>
                    {rejecting === log.id ? (
                      <>
                        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejecting…" style={{ ...input, flex: 1, minWidth: 180 }} />
                        <div onClick={() => reject(log.id!)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,.14)', color: '#8E2E0A' }}>Confirm reject</div>
                      </>
                    ) : (
                      <div onClick={() => { setRejecting(log.id); setNote(''); }} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,.14)', color: '#8E2E0A' }}>Reject</div>
                    )}
                  </div>
                )}
                {selfSubmitted && <div style={{ fontSize: 11.5, color: MUTED }}>You submitted this log — someone else needs to review it.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

