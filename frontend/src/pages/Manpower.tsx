import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { EmployeeDirectory, type Employee, type Trade } from '../components/EmployeeDirectory';
import { DeploymentBoard } from '../components/Deployment';
import { WorkforceRequests } from '../components/WorkforceRequests';
import { Contractors } from '../components/Contractors';
import { localISO, type Assignment, type Contractor } from '../components/manpowerUi';

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
interface LeaveRequest {
  id: string; employeeId: string; type: string; startDate: string; endDate: string;
  hours?: number; reason?: string; status: string; requestedBy?: string; requestedAt?: string;
  decidedBy?: string; decidedAt?: string; note?: string;
}

const TAB_GROUPS = [
  { label: 'People', tabs: [['employees', 'Employees'], ['contractors', 'Contractors']] },
  { label: 'Operations', tabs: [['deployment', 'Deployment'], ['requests', 'Workforce Requests'], ['log', 'Daily Log'], ['approvals', 'Approvals'], ['timesheets', 'Timesheets']] },
  { label: 'Employee services', tabs: [['leave', 'Leave']] },
  { label: 'Setup', tabs: [['csi', 'Cost Codes'], ['trades', 'Trades']] },
] as const;
type TabKey = typeof TAB_GROUPS[number]['tabs'][number][0];

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
const startOfWeek = (d: Date) => { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); return x; };
const fmt = (d: Date) => localISO(d);

export function Manpower() {
  const { toast, can, currentUser } = useApp();
  const canManage = can('manpower_con', 'manage');
  const [tab, setTab] = useState<TabKey>('employees');
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [csiCodes, setCsiCodes] = useState<CsiCode[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);

  const reloadAssignments = () => api.assignments.list({ status: 'current' }).then((r: any) => setAssignments(Array.isArray(r) ? r : [])).catch(() => {});
  const reloadContractors = () => api.contractors.list().then((r: any) => setContractors(Array.isArray(r) ? r : [])).catch(() => {});
  /** Any screen can jump to someone's profile. */
  const openEmployee = (id: string) => { setOpenEmployeeId(id); setTab('employees'); };

  const reloadEmployees = () => api.employees.list().then((r: any) => setEmployees(Array.isArray(r) ? r : [])).catch(() => {});
  const reloadCsiCodes = () => api.csiCodes.list().then((r: any) => setCsiCodes(Array.isArray(r) ? r : [])).catch(() => {});
  const reloadTrades = () => api.trades.list().then((r: any) => setTrades(Array.isArray(r) ? r : [])).catch(() => {});

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
  }, []);

  const working = employees.filter(isWorking);

  return (
    <div style={{ padding: '28px 32px', background: PAPER, minHeight: '100%' }}>
      <h1 style={{ fontFamily: BG, fontWeight: 700, fontSize: 24, color: INK, margin: 0 }}>Manpower & Resources</h1>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: MUTED }}>Employees and contractor workers, project deployment, workforce requests, daily labor logs by cost code, timesheets and leave.</p>

      <div style={{ display: 'flex', gap: 22, marginTop: 18, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {TAB_GROUPS.map((g) => (
          <div key={g.label}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9AA39D', marginBottom: 6 }}>{g.label}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {g.tabs.map(([key, label]) => (
                <div
                  key={key}
                  onClick={() => { setTab(key); if (key === 'employees') setOpenEmployeeId(null); }}
                  style={{
                    padding: '8px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    background: tab === key ? ACCENT : '#fff', color: tab === key ? '#fff' : '#43514D',
                    border: '1px solid ' + (tab === key ? ACCENT : 'rgba(20,8,31,.14)'),
                  }}
                >{label}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {tab === 'employees' && (
        <EmployeeDirectory employees={employees} trades={trades} projects={projects} assignments={assignments} contractors={contractors}
          reload={reloadEmployees} reloadAssignments={reloadAssignments} canManage={canManage} openId={openEmployeeId} onOpen={setOpenEmployeeId} />
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
      {tab === 'timesheets' && <TimesheetsTab employees={employees} csiCodes={csiCodes} toast={toast} />}
      {tab === 'leave' && <LeaveTab employees={working} canManage={canManage} toast={toast} />}
      {tab === 'csi' && <CsiCodesTab csiCodes={csiCodes} reload={reloadCsiCodes} canManage={canManage} toast={toast} />}
      {tab === 'trades' && <TradesTab trades={trades} reload={reloadTrades} canManage={canManage} toast={toast} />}
    </div>
  );
}

// -------------------------------------------------------------- Daily Log

function DailyLogTab({ projects, employees, assignments, csiCodes, canManage, toast }: {
  projects: Project[]; employees: Employee[]; assignments: Assignment[]; csiCodes: CsiCode[]; canManage: boolean; toast: (m: string) => void;
}) {
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
      {hint && <div style={{ fontSize: 10, color: '#9AA39D', marginBottom: 3 }}>{hint}</div>}
      {children}
    </div>
  );
}

// -------------------------------------------------------------- CSI Codes

function CsiCodesTab({ csiCodes, reload, canManage, toast }: {
  csiCodes: CsiCode[]; reload: () => void; canManage: boolean; toast: (m: string) => void;
}) {
  const [draftCode, setDraftCode] = useState('');
  const [draftDivision, setDraftDivision] = useState('');

  const add = async () => {
    if (!draftCode.trim() || !draftDivision.trim()) return;
    try {
      await api.csiCodes.create({ code: draftCode.trim(), division: draftDivision.trim(), order: csiCodes.length });
      setDraftCode(''); setDraftDivision('');
      reload();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not add')); }
  };
  const update = async (c: CsiCode, patch: Partial<CsiCode>) => {
    try { await api.csiCodes.update(c.id, patch); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this CSI code?')) return;
    try { await api.csiCodes.remove(id); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not remove')); }
  };

  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 30px', gap: 8, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
        <span>Code</span><span>Division</span><span>Active</span><span />
      </div>
      {csiCodes.map((c) => (
        <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 30px', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
          <span style={{ fontSize: 12.5, color: INK }}>{c.code}</span>
          <span style={{ fontSize: 12.5, color: INK }}>{c.division}</span>
          <input type="checkbox" disabled={!canManage} checked={c.active} onChange={(e) => update(c, { active: e.target.checked })} />
          {canManage && <span onClick={() => remove(c.id)} style={{ cursor: 'pointer', color: '#8E2E0A', fontSize: 13, textAlign: 'center' }}>×</span>}
        </div>
      ))}
      {canManage && (
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 120px', gap: 8, padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.06)' }}>
          <input value={draftCode} onChange={(e) => setDraftCode(e.target.value)} placeholder="e.g. 09 00 00" style={input} />
          <input value={draftDivision} onChange={(e) => setDraftDivision(e.target.value)} placeholder="e.g. Finishes" style={input} />
          <div onClick={add} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white', textAlign: 'center' }}>+ Add code</div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Trades

function TradesTab({ trades, reload, canManage, toast }: {
  trades: Trade[]; reload: () => void; canManage: boolean; toast: (m: string) => void;
}) {
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    try { await api.trades.create({ name: name.trim(), order: trades.length }); setName(''); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not add')); }
  };
  const update = async (t: Trade, patch: Partial<Trade>) => {
    try { await api.trades.update(t.id, patch); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this trade? Employees already classified under it keep the name on their record.')) return;
    try { await api.trades.remove(id); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not remove')); }
  };

  return (
    <div style={{ background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden', maxWidth: 560 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 30px', gap: 8, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
        <span>Trade</span><span>Active</span><span />
      </div>
      {trades.map((t) => (
        <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 30px', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
          <span style={{ fontSize: 12.5, color: INK, opacity: t.active ? 1 : 0.5 }}>{t.name}</span>
          <input type="checkbox" disabled={!canManage} checked={t.active} onChange={(e) => update(t, { active: e.target.checked })} />
          {canManage && <span onClick={() => remove(t.id)} style={{ cursor: 'pointer', color: '#8E2E0A', fontSize: 13, textAlign: 'center' }}>×</span>}
        </div>
      ))}
      {canManage && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.06)' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="e.g. Tile Setter" style={input} />
          <div onClick={add} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white', textAlign: 'center' }}>+ Add trade</div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Timesheets

function TimesheetsTab({ employees, csiCodes, toast }: { employees: Employee[]; csiCodes: CsiCode[]; toast: (m: string) => void }) {
  const [employeeId, setEmployeeId] = useState('');
  const [weekStart, setWeekStart] = useState(fmt(startOfWeek(new Date())));
  const [rows, setRows] = useState<any[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(false);

  const weekEnd = fmt(new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 86400000));

  useEffect(() => {
    if (!employeeId) { setRows([]); setTotalHours(0); return; }
    setLoading(true);
    api.timesheets.forEmployee(employeeId, weekStart, weekEnd)
      .then((r: any) => { setRows(r.rows || []); setTotalHours(r.totalHours || 0); })
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setLoading(false));
  }, [employeeId, weekStart]);

  const csiLabel = (id?: string) => { const c = csiCodes.find((x) => x.id === id); return c ? c.code : '—'; };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ ...input, minWidth: 220 }}>
          <option value="">Select an employee…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} style={input} />
        <span style={{ fontSize: 12, color: MUTED }}>week through {weekEnd}</span>
      </div>
      {!employeeId ? (
        <div style={{ fontSize: 12.5, color: MUTED }}>Pick an employee and a week to see their rolled-up hours.</div>
      ) : loading ? (
        <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>
      ) : (
        <div style={{ background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1.6fr 90px 70px 100px', gap: 8, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
            <span>Date</span><span>Project</span><span>CSI Code</span><span>Hours</span><span>Status</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1.6fr 90px 70px 100px', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
              <span style={{ fontSize: 12 }}>{r.date}</span>
              <span style={{ fontSize: 12.5 }}>{r.projectName}</span>
              <span style={{ fontSize: 12 }}>{csiLabel(r.csiCodeId)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.hours}</span>
              <StatusBadge status={r.status} />
            </div>
          ))}
          {!rows.length && <div style={{ padding: '16px 14px', fontSize: 12, color: MUTED }}>Nothing logged for this employee that week.</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 14px', borderTop: '1px solid rgba(20,8,31,.06)', fontSize: 13, fontWeight: 700, color: INK }}>
            Total: {totalHours} hrs
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Leave

function LeaveTab({ employees, canManage, toast }: { employees: Employee[]; canManage: boolean; toast: (m: string) => void }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: '', type: 'PTO', startDate: todayISO(), endDate: todayISO(), hours: '', reason: '' });

  const reload = () => api.leaveRequests.list().then((r: any) => setRequests(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { reload(); }, []);

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name || id;

  const submit = async () => {
    if (!form.employeeId || !form.startDate || !form.endDate) { toast('⚠ Pick an employee and dates'); return; }
    try {
      await api.leaveRequests.create({ ...form, hours: form.hours ? Number(form.hours) : undefined });
      setShowForm(false);
      setForm({ employeeId: '', type: 'PTO', startDate: todayISO(), endDate: todayISO(), hours: '', reason: '' });
      reload();
      toast('Leave request submitted');
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not submit')); }
  };

  const decide = async (id: string, decision: 'approve' | 'deny') => {
    try { await (decision === 'approve' ? api.leaveRequests.approve(id) : api.leaveRequests.deny(id)); reload(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not update')); }
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div onClick={() => setShowForm((v) => !v)} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white' }}>
          {showForm ? 'Cancel' : '+ Request leave'}
        </div>
      </div>
      {showForm && (
        <div style={{ background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Field label="Employee">
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} style={input}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={input}>
              <option value="PTO">PTO</option><option value="Sick">Sick</option><option value="Unpaid">Unpaid</option><option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Start date"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={input} /></Field>
          <Field label="End date"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={input} /></Field>
          <Field label="Hours (optional, partial day)"><input type="number" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} style={input} /></Field>
          <Field label="Reason"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={input} /></Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <div onClick={submit} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white' }}>Submit request</div>
          </div>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 100px 100px 90px 1fr', gap: 8, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
          <span>Employee</span><span>Type</span><span>Start</span><span>End</span><span>Status</span><span>Actions</span>
        </div>
        {requests.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 100px 100px 90px 1fr', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
            <span style={{ fontSize: 12.5 }}>{employeeName(r.employeeId)}</span>
            <span style={{ fontSize: 12 }}>{r.type}</span>
            <span style={{ fontSize: 12 }}>{r.startDate}</span>
            <span style={{ fontSize: 12 }}>{r.endDate}</span>
            <StatusBadge status={r.status} />
            {canManage && r.status === 'pending' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <div onClick={() => decide(r.id, 'approve')} style={{ padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white' }}>Approve</div>
                <div onClick={() => decide(r.id, 'deny')} style={{ padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,.14)', color: '#8E2E0A' }}>Deny</div>
              </div>
            ) : <span style={{ fontSize: 11, color: MUTED }}>{r.decidedBy ? `by ${r.decidedBy}` : ''}</span>}
          </div>
        ))}
        {!requests.length && <div style={{ padding: '16px 14px', fontSize: 12, color: MUTED }}>No leave requests yet.</div>}
      </div>
    </div>
  );
}
