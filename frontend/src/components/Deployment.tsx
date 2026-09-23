import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee, Trade } from './EmployeeDirectory';
import {
  ACCENT, ACCENT_BG, BG, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow,
  input, todayISO, type Assignment, type Project,
} from './manpowerUi';

const LEFT = ['resigned', 'terminated', 'contract_expired', 'demobilized'];
export const lifecycle = (e: Employee) => e.employmentStatus || (e.status === 'inactive' ? 'resigned' : 'active');
export const isDeployable = (e: Employee) => lifecycle(e) === 'active';
export const isLeft = (e: Employee) => LEFT.includes(lifecycle(e));

const END_REASON: Record<string, { label: string; tone: 'blue' | 'grey' | 'red' }> = {
  transfer: { label: 'Transferred', tone: 'blue' },
  completed: { label: 'Released', tone: 'grey' },
  demobilized: { label: 'Demobilized', tone: 'red' },
};

interface Ctx {
  employees: Employee[]; trades: Trade[]; projects: Project[]; assignments: Assignment[];
}
const helpers = ({ employees, trades, projects, assignments }: Ctx) => {
  const empById = new Map(employees.map((e) => [e.id, e]));
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
  const tradeName = (id?: string) => trades.find((t) => t.id === id)?.name;
  const regularOf = new Map(assignments.filter((a) => a.current && a.assignmentType === 'regular').map((a) => [a.employeeId, a]));
  const available = employees.filter((e) => isDeployable(e) && !regularOf.has(e.id));
  return { empById, projectName, tradeName, regularOf, available };
};

// ------------------------------------------------------------------ board

export function DeploymentBoard(props: Ctx & { canManage: boolean; reload: () => Promise<unknown> | void; onOpenEmployee: (id: string) => void }) {
  const { employees, trades, projects, assignments, canManage, reload, onOpenEmployee } = props;
  const { empById, projectName, tradeName, available } = helpers(props);
  const [view, setView] = useState<'projects' | 'available' | 'history'>('projects');
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<number | ''>('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [assigning, setAssigning] = useState<{ projectId?: number; employeeIds?: string[] } | null>(null);
  const [transferring, setTransferring] = useState<Assignment | null>(null);
  const [releasing, setReleasing] = useState<Assignment | null>(null);
  const [history, setHistory] = useState<Assignment[] | null>(null);

  const current = assignments.filter((a) => a.current);
  useEffect(() => {
    if (view !== 'history') return;
    api.assignments.list({ status: 'ended' }).then((r: any) => setHistory(Array.isArray(r) ? r : [])).catch(() => setHistory([]));
  }, [view, assignments]);

  const q = query.trim().toLowerCase();
  const matchesEmp = (e?: Employee) => !!e && (!q || [e.name, e.workerId, e.designation].some((v) => (v || '').toLowerCase().includes(q)))
    && (!tradeFilter || e.tradeId === tradeFilter);

  const deployedIds = new Set(current.map((a) => a.employeeId));
  const onTemp = new Set(current.filter((a) => a.assignmentType === 'temporary').map((a) => a.employeeId));
  const staffedProjects = new Set(current.map((a) => a.projectId));

  const byProject = useMemo(() => {
    const rows = current.filter((a) => (!projectFilter || a.projectId === projectFilter) && matchesEmp(empById.get(a.employeeId)));
    const groups = new Map<number, Assignment[]>();
    for (const a of rows) groups.set(a.projectId, [...(groups.get(a.projectId) || []), a]);
    return Array.from(groups.entries()).sort((x, y) => projectName(x[0]).localeCompare(projectName(y[0])));
  }, [current, projectFilter, q, tradeFilter, employees, projects]);

  const Stat = ({ label, value, onClick, active }: { label: string; value: number; onClick?: () => void; active?: boolean }) => (
    <div onClick={onClick} style={{ ...card, padding: '12px 16px', cursor: onClick ? 'pointer' : 'default', borderColor: active ? ACCENT : LINE, minWidth: 140, flex: 1 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED }}>{label}</div>
      <div style={{ fontFamily: BG, fontSize: 24, fontWeight: 700, color: INK, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Deployed" value={deployedIds.size} onClick={() => setView('projects')} active={view === 'projects'} />
        <Stat label="Available" value={available.length} onClick={() => setView('available')} active={view === 'available'} />
        <Stat label="On temporary cover" value={onTemp.size} />
        <Stat label="Projects staffed" value={staffedProjects.size} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {([['projects', 'By project'], ['available', 'Available workers'], ['history', 'Movement history']] as const).map(([k, l]) => (
          <div key={k} onClick={() => setView(k)} style={{ ...btn(view === k), padding: '6px 13px', fontSize: 12 }}>{l}</div>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search worker…" style={{ ...input, width: 200 }} />
        {view === 'projects' && (
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : '')} style={{ ...input, width: 'auto' }}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All trades</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={() => setAssigning({ projectId: projectFilter || undefined })} style={btn(true)}>+ Deploy workers</div>}
      </div>

      {view === 'projects' && (
        byProject.length ? byProject.map(([projectId, rows]) => {
          const mix = new Map<string, number>();
          rows.forEach((a) => { const n = tradeName(a.tradeId) || 'No trade'; mix.set(n, (mix.get(n) || 0) + 1); });
          const cols = 'minmax(180px,1.6fr) 1fr 1fr 1fr 110px 130px' + (canManage ? ' 150px' : '');
          return (
            <div key={projectId} style={{ ...card, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK }}>{projectName(projectId)}</div>
                <span style={{ fontSize: 12, color: MUTED }}>{rows.length} worker{rows.length === 1 ? '' : 's'}</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {Array.from(mix.entries()).map(([n, c]) => <span key={n} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: ACCENT_BG, color: ACCENT }}>{c} {n}</span>)}
                </div>
                <div style={{ flex: 1 }} />
                {canManage && <span onClick={() => setAssigning({ projectId })} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Add to this project</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 820 }}>
                  <div style={headRow(cols)}><span>Worker</span><span>Trade</span><span>Designation</span><span>Work area</span><span>Since</span><span>Type</span>{canManage && <span />}</div>
                  {rows.map((a) => {
                    const e = empById.get(a.employeeId);
                    return (
                      <div key={a.id} style={bodyRow(cols)}>
                        <span onClick={() => onOpenEmployee(a.employeeId)} style={{ cursor: 'pointer', minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{e?.name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>{e?.workerId}{e?.contractorId ? ' · Contractor' : ''}</div>
                        </span>
                        <span style={{ fontSize: 12.5 }}>{tradeName(a.tradeId) || '—'}</span>
                        <span style={{ fontSize: 12.5 }}>{a.designation || '—'}</span>
                        <span style={{ fontSize: 12.5 }}>{a.workArea || '—'}</span>
                        <span style={{ fontSize: 12, color: MUTED }}>{fmtDate(a.startDate)}</span>
                        <span>{a.assignmentType === 'temporary' ? <Badge tone="amber">Temp · to {fmtDate(a.endDate)}</Badge> : <Badge tone="green">Regular</Badge>}</span>
                        {canManage && (
                          <span style={{ display: 'flex', gap: 10 }}>
                            {a.assignmentType === 'regular' && <span onClick={() => setTransferring(a)} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Transfer</span>}
                            <span onClick={() => setReleasing(a)} style={{ fontSize: 12, fontWeight: 700, color: DANGER, cursor: 'pointer' }}>Release</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }) : (
          <div style={{ ...card, padding: '30px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
            {current.length ? 'Nobody matches these filters.' : 'Nobody is deployed yet — use "Deploy workers" to put people on a project.'}
          </div>
        )
      )}

      {view === 'available' && (() => {
        const rows = available.filter(matchesEmp);
        const cols = 'minmax(180px,1.6fr) 1fr 1fr 1fr' + (canManage ? ' 100px' : '');
        return (
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={headRow(cols)}><span>Worker</span><span>Trade</span><span>Skill level</span><span>Designation</span>{canManage && <span />}</div>
            {rows.map((e) => (
              <div key={e.id} style={bodyRow(cols)}>
                <span onClick={() => onOpenEmployee(e.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{e.workerId}{e.contractorId ? ' · Contractor' : ''}</div>
                </span>
                <span style={{ fontSize: 12.5 }}>{tradeName(e.tradeId) || e.trade || '—'}</span>
                <span style={{ fontSize: 12.5, textTransform: 'capitalize' }}>{(e.skillLevel || '—').replace('_', '-')}</span>
                <span style={{ fontSize: 12.5 }}>{e.designation || '—'}</span>
                {canManage && <span onClick={() => setAssigning({ employeeIds: [e.id] })} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Deploy</span>}
              </div>
            ))}
            {!rows.length && <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>{available.length ? 'Nobody matches these filters.' : 'Every active worker is deployed.'}</div>}
          </div>
        );
      })()}

      {view === 'history' && (() => {
        const rows = (history || []).filter((a) => matchesEmp(empById.get(a.employeeId)));
        const cols = 'minmax(170px,1.4fr) 1.3fr 1fr 190px 120px 1fr';
        return (
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 820 }}>
                <div style={headRow(cols)}><span>Worker</span><span>Project</span><span>Work area</span><span>Period</span><span>Outcome</span><span>By</span></div>
                {history === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
                {rows.map((a) => {
                  const r = END_REASON[a.endReason || ''] || { label: 'Ended', tone: 'grey' as const };
                  return (
                    <div key={a.id} style={bodyRow(cols)}>
                      <span onClick={() => onOpenEmployee(a.employeeId)} style={{ fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer' }}>{empById.get(a.employeeId)?.name || 'Unknown'}</span>
                      <span style={{ fontSize: 12.5 }}>{projectName(a.projectId)}</span>
                      <span style={{ fontSize: 12.5 }}>{a.workArea || '—'}</span>
                      <span style={{ fontSize: 12, color: MUTED }}>{fmtDate(a.startDate)} → {fmtDate(a.endDate)}</span>
                      <span><Badge tone={r.tone}>{r.label}</Badge></span>
                      <span style={{ fontSize: 12, color: MUTED }}>{a.endedByName || '—'}</span>
                    </div>
                  );
                })}
                {history && !rows.length && <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No completed or transferred assignments yet.</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {assigning && (
        <AssignDrawer {...props} defaults={assigning} onClose={() => setAssigning(null)} onDone={async () => { setAssigning(null); await reload(); }} />
      )}
      {transferring && (
        <TransferDrawer projects={projects} assignment={transferring} employee={empById.get(transferring.employeeId)} projectName={projectName}
          onClose={() => setTransferring(null)} onDone={async () => { setTransferring(null); await reload(); }} />
      )}
      {releasing && (
        <ReleaseDrawer assignment={releasing} employee={empById.get(releasing.employeeId)} projectName={projectName}
          onClose={() => setReleasing(null)} onDone={async () => { setReleasing(null); await reload(); }} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ assign

export function AssignDrawer(props: Ctx & {
  defaults: { projectId?: number; employeeIds?: string[]; type?: 'regular' | 'temporary' }; onClose: () => void; onDone: () => void;
}) {
  const { employees, trades, projects, defaults, onClose, onDone } = props;
  const { toast } = useApp();
  const { tradeName, regularOf, projectName } = helpers(props);
  const [projectId, setProjectId] = useState<number | ''>(defaults.projectId ?? '');
  const [workArea, setWorkArea] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [type, setType] = useState<'regular' | 'temporary'>(defaults.type || 'regular');
  const [endDate, setEndDate] = useState('');
  const [designation, setDesignation] = useState('');
  const [notes, setNotes] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set(defaults.employeeIds || []));
  const [query, setQuery] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // Regular deployment draws from the free pool; temporary cover can borrow someone already deployed.
  const pool = employees.filter((e) => isDeployable(e) && (type === 'temporary' || !regularOf.has(e.id) || picked.has(e.id)));
  const q = query.trim().toLowerCase();
  const shown = pool.filter((e) => (!q || [e.name, e.workerId].some((v) => (v || '').toLowerCase().includes(q))) && (!tradeFilter || e.tradeId === tradeFilter));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async () => {
    if (!projectId) { toast('⚠ Pick a project'); return; }
    if (!picked.size) { toast('⚠ Pick at least one worker'); return; }
    if (type === 'temporary' && !endDate) { toast('⚠ Temporary cover needs an end date'); return; }
    setSaving(true);
    try {
      await api.assignments.assign({
        employeeIds: Array.from(picked), projectId: Number(projectId), workArea: workArea || undefined, startDate,
        assignmentType: type, endDate: endDate || undefined, designation: designation || undefined, notes: notes || undefined,
      });
      toast(`${picked.size} worker${picked.size === 1 ? '' : 's'} deployed to ${projectName(Number(projectId))}`);
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not deploy')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer
      title="Deploy workers" subtitle="Put one or more people on a project. Someone already deployed has to be transferred instead."
      onClose={onClose}
      footer={<>
        <div onClick={onClose} style={btn()}>Cancel</div>
        <div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Deploying…' : `Deploy ${picked.size || ''} worker${picked.size === 1 ? '' : 's'}`}</div>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <Label text="Project *" />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={input}>
            <option value="">Select…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label text="Work area / zone" /><input value={workArea} onChange={(e) => setWorkArea(e.target.value)} placeholder="e.g. Tower A" style={input} /></div>
        <div><Label text="Start date" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} /></div>
        <div>
          <Label text="Type" />
          <select value={type} onChange={(e) => setType(e.target.value as any)} style={input}>
            <option value="regular">Regular deployment</option>
            <option value="temporary">Temporary cover</option>
          </select>
        </div>
        <div><Label text={type === 'temporary' ? 'End date *' : 'Planned end (optional)'} /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={input} /></div>
        <div><Label text="Designation on site" /><input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Defaults to their own" style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><input value={notes} onChange={(e) => setNotes(e.target.value)} style={input} /></div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, flex: 1 }}>Workers <span style={{ fontSize: 12, color: MUTED, fontFamily: 'inherit', fontWeight: 600 }}>{picked.size} selected</span></div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" style={{ ...input, width: 150 }} />
        <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All trades</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div style={{ ...card, maxHeight: 360, overflowY: 'auto' }}>
        {shown.map((e) => {
          const on = regularOf.get(e.id);
          return (
            <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', background: picked.has(e.id) ? '#F3F8F3' : 'transparent' }}>
              <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{e.name}</span>
                <span style={{ fontSize: 11.5, color: MUTED }}> · {e.workerId} · {tradeName(e.tradeId) || e.trade || 'No trade'}{e.skillLevel ? ` (${e.skillLevel.replace('_', '-')})` : ''}</span>
              </span>
              {on && <span style={{ fontSize: 11, color: '#8A6D12' }}>on {projectName(on.projectId)}</span>}
            </label>
          );
        })}
        {!shown.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>{pool.length ? 'Nobody matches.' : 'No available workers — everyone active is already deployed.'}</div>}
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ transfer / release

export function TransferDrawer({ projects, assignment, employee, projectName, onClose, onDone }: {
  projects: Project[]; assignment: Assignment; employee?: Employee; projectName: (id: number) => string;
  onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [projectId, setProjectId] = useState<number | ''>('');
  const [workArea, setWorkArea] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [designation, setDesignation] = useState(assignment.designation || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!projectId) { toast('⚠ Pick where they are going'); return; }
    setSaving(true);
    try {
      await api.assignments.transfer(assignment.id, { projectId: Number(projectId), workArea: workArea || undefined, startDate, designation: designation || undefined, notes: notes || undefined });
      toast(`${employee?.name || 'Worker'} transferred to ${projectName(Number(projectId))}`);
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not transfer')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title={`Transfer ${employee?.name || 'worker'}`} subtitle={`Currently on ${projectName(assignment.projectId)}${assignment.workArea ? ` · ${assignment.workArea}` : ''} since ${fmtDate(assignment.startDate)}. The current assignment closes on the effective date.`}
      width={480} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Transferring…' : 'Transfer'}</div></>}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <Label text="To project *" />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={input}>
            <option value="">Select…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === assignment.projectId ? ' (same project, different area)' : ''}</option>)}
          </select>
        </div>
        <div><Label text="Work area / zone" /><input value={workArea} onChange={(e) => setWorkArea(e.target.value)} style={input} /></div>
        <div><Label text="Effective date" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} /></div>
        <div><Label text="Designation on new site" /><input value={designation} onChange={(e) => setDesignation(e.target.value)} style={input} /></div>
        <div><Label text="Reason / notes" /><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} /></div>
      </div>
    </Drawer>
  );
}

export function ReleaseDrawer({ assignment, employee, projectName, onClose, onDone }: {
  assignment: Assignment; employee?: Employee; projectName: (id: number) => string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [endDate, setEndDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api.assignments.release(assignment.id, { endDate, notes: notes || undefined });
      toast(`${employee?.name || 'Worker'} released from ${projectName(assignment.projectId)}`);
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not release')); }
    finally { setSaving(false); }
  };
  return (
    <Drawer title={`Release ${employee?.name || 'worker'}`} subtitle={`Ends their stint on ${projectName(assignment.projectId)} and returns them to the available pool.`}
      width={440} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Releasing…' : 'Release'}</div></>}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div><Label text="Last day on the project" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={input} /></div>
        <div><Label text="Notes" /><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} /></div>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ profile tab

export function EmployeeDeploymentPanel(props: Ctx & { employee: Employee; canManage: boolean; onChanged: () => Promise<unknown> | void }) {
  const { employee, projects, canManage, onChanged } = props;
  const { toast } = useApp();
  const { projectName, tradeName } = helpers(props);
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [transferring, setTransferring] = useState<Assignment | null>(null);
  const [releasing, setReleasing] = useState<Assignment | null>(null);

  const load = () => api.assignments.list({ employeeId: employee.id }).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, [employee.id]);
  const refresh = async () => { await load(); await onChanged(); };

  const current = (rows || []).filter((a) => a.current);
  const past = (rows || []).filter((a) => !a.current);
  const hasRegular = current.some((a) => a.assignmentType === 'regular');

  const demobilize = async () => {
    if (!confirm(`Demobilize ${employee.name}? Every open assignment ends today and their status becomes Demobilized.`)) return;
    try { await api.assignments.demobilize(employee.id, { date: todayISO() }); toast(`${employee.name} demobilized`); await refresh(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not demobilize')); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Current assignment</div>
        {canManage && isDeployable(employee) && <div onClick={() => setAssigning(true)} style={btn(!hasRegular)}>{hasRegular ? '+ Temporary cover' : '+ Deploy to project'}</div>}
        {canManage && !isLeft(employee) && current.length > 0 && <div onClick={demobilize} style={{ ...btn(), color: DANGER }}>Demobilize</div>}
      </div>
      {rows === null ? <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div> : current.length ? current.map((a) => (
        <div key={a.id} style={{ ...card, padding: '14px 16px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{projectName(a.projectId)}{a.workArea ? ` · ${a.workArea}` : ''}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
              {[a.designation, tradeName(a.tradeId), `since ${fmtDate(a.startDate)}`, a.endDate && `until ${fmtDate(a.endDate)}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          {a.assignmentType === 'temporary' ? <Badge tone="amber">Temporary</Badge> : <Badge tone="green">Regular</Badge>}
          {canManage && a.assignmentType === 'regular' && <span onClick={() => setTransferring(a)} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Transfer</span>}
          {canManage && <span onClick={() => setReleasing(a)} style={{ fontSize: 12, fontWeight: 700, color: DANGER, cursor: 'pointer' }}>Release</span>}
        </div>
      )) : (
        <div style={{ ...card, padding: '18px 16px', fontSize: 12.5, color: MUTED, marginBottom: 10 }}>
          {isDeployable(employee) ? 'Not on any project — available for deployment.' : 'Not deployed.'}
        </div>
      )}

      <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, margin: '20px 0 10px' }}>Assignment history</div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {past.map((a) => {
          const r = END_REASON[a.endReason || ''] || { label: 'Ended', tone: 'grey' as const };
          return (
            <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: '1px solid rgba(20,8,31,.05)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{projectName(a.projectId)}{a.workArea ? ` · ${a.workArea}` : ''}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{fmtDate(a.startDate)} → {fmtDate(a.endDate)}{a.designation ? ` · ${a.designation}` : ''}{a.assignmentType === 'temporary' ? ' · temporary' : ''}</div>
              </div>
              <Badge tone={r.tone}>{r.label}</Badge>
            </div>
          );
        })}
        {rows && !past.length && <div style={{ padding: '16px', fontSize: 12.5, color: MUTED }}>No past assignments.</div>}
      </div>

      {assigning && (
        <AssignDrawer {...props} defaults={{ employeeIds: [employee.id], type: hasRegular ? 'temporary' : 'regular' }} onClose={() => setAssigning(false)} onDone={async () => { setAssigning(false); await refresh(); }} />
      )}
      {transferring && (
        <TransferDrawer projects={projects} assignment={transferring} employee={employee} projectName={projectName}
          onClose={() => setTransferring(null)} onDone={async () => { setTransferring(null); await refresh(); }} />
      )}
      {releasing && (
        <ReleaseDrawer assignment={releasing} employee={employee} projectName={projectName}
          onClose={() => setReleasing(null)} onDone={async () => { setReleasing(null); await refresh(); }} />
      )}
    </div>
  );
}
