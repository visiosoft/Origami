import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee, Trade } from './EmployeeDirectory';
import { isDeployable } from './Deployment';
import {
  ACCENT, BG, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, todayISO,
  type Assignment, type Project,
} from './manpowerUi';

interface Line { id?: string; tradeId: string; designation?: string; quantity: number; allocated?: number; available?: number; shortage?: number; surplus?: number }
interface WorkforceRequest {
  id: string; projectId: number; workArea?: string; requiredDate: string; durationDays?: number; lines: Line[];
  notes?: string; status: string; requestedById?: string; requestedByName?: string; submittedAt?: string;
  decidedByName?: string; decidedAt?: string; decisionNote?: string; createdAt: string;
  totals: { required: number; allocated: number; shortage: number };
}

const STATUS: Record<string, { label: string; tone: 'grey' | 'amber' | 'green' | 'red' | 'blue' }> = {
  draft: { label: 'Draft', tone: 'grey' },
  submitted: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'blue' },
  rejected: { label: 'Rejected', tone: 'red' },
  fulfilled: { label: 'Fulfilled', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
};
const OPEN = ['submitted', 'approved'];

interface Ctx { employees: Employee[]; trades: Trade[]; projects: Project[]; assignments: Assignment[] }

export function WorkforceRequests(props: Ctx & { canManage: boolean; reloadAssignments: () => Promise<unknown> | void; onOpenEmployee: (id: string) => void }) {
  const { trades, projects, canManage } = props;
  const [requests, setRequests] = useState<WorkforceRequest[] | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [projectFilter, setProjectFilter] = useState<number | ''>('');
  const [editing, setEditing] = useState<Partial<WorkforceRequest> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => api.workforceRequests.list().then((r: any) => setRequests(Array.isArray(r) ? r : [])).catch(() => setRequests([]));
  useEffect(() => { load(); }, []);

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
  const tradeName = (id: string) => trades.find((t) => t.id === id)?.name || 'Unknown trade';

  const all = requests || [];
  const shown = all.filter((r) => (statusFilter === 'open' ? OPEN.includes(r.status) : !statusFilter || r.status === statusFilter) && (!projectFilter || r.projectId === projectFilter));
  const open = all.filter((r) => OPEN.includes(r.status));
  const sum = (k: 'required' | 'allocated' | 'shortage') => open.reduce((s, r) => s + r.totals[k], 0);
  const opened = all.find((r) => r.id === openId);

  const Stat = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
    <div style={{ ...card, padding: '12px 16px', minWidth: 140, flex: 1 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED }}>{label}</div>
      <div style={{ fontFamily: BG, fontSize: 24, fontWeight: 700, color: tone || INK, marginTop: 2 }}>{value}</div>
    </div>
  );

  const cols = 'minmax(170px,1.4fr) 110px minmax(200px,2fr) 170px 150px';

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Open requests" value={open.length} />
        <Stat label="Workers required" value={sum('required')} />
        <Stat label="Allocated" value={sum('allocated')} tone="#1E6B36" />
        <Stat label="Shortage" value={sum('shortage')} tone={sum('shortage') ? DANGER : INK} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="open">Open (awaiting approval + approved)</option>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value ? Number(e.target.value) : '')} style={{ ...input, width: 'auto' }}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={() => setEditing({ requiredDate: todayISO(), lines: [{ tradeId: '', quantity: 1 }] })} style={btn(true)}>+ New request</div>}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            <div style={headRow(cols)}><span>Project</span><span>Needed by</span><span>Workforce</span><span>Allocated</span><span>Status</span></div>
            {requests === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((r) => {
              const pct = r.totals.required ? Math.round((r.totals.allocated / r.totals.required) * 100) : 0;
              const s = STATUS[r.status] || STATUS.draft;
              return (
                <div key={r.id} onClick={() => setOpenId(r.id)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{projectName(r.projectId)}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{r.workArea ? `${r.workArea} · ` : ''}by {r.requestedByName || 'Unknown'}</div>
                  </span>
                  <span style={{ fontSize: 12.5, color: r.requiredDate < todayISO() && OPEN.includes(r.status) ? DANGER : INK }}>{fmtDate(r.requiredDate)}</span>
                  <span style={{ fontSize: 12.5, color: INK }}>{r.lines.map((l) => `${l.quantity} ${tradeName(l.tradeId)}`).join(', ')}</span>
                  <span>
                    <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 4 }}>{r.totals.allocated} of {r.totals.required}{r.totals.shortage ? ` · short ${r.totals.shortage}` : ''}</div>
                    <div style={{ height: 6, borderRadius: 999, background: '#EFEDE8', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#1E6B36' : ACCENT }} />
                    </div>
                  </span>
                  <span><Badge tone={s.tone}>{s.label}</Badge></span>
                </div>
              );
            })}
            {requests && !shown.length && (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
                {all.length ? 'No requests match these filters.' : 'No workforce requests yet — a project raises one to ask for workers by trade.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <RequestEditor request={editing} projects={projects} trades={trades}
          onClose={() => setEditing(null)}
          onSaved={async (id) => { setEditing(null); await load(); setOpenId(id); }} />
      )}
      {opened && !editing && (
        <RequestDetail {...props} request={opened} projectName={projectName} tradeName={tradeName}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing(opened)}
          onChanged={async () => { await load(); await props.reloadAssignments(); }}
          onDeleted={async () => { setOpenId(null); await load(); }} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ editor

function RequestEditor({ request, projects, trades, onClose, onSaved }: {
  request: Partial<WorkforceRequest>; projects: Project[]; trades: Trade[]; onClose: () => void; onSaved: (id: string) => void;
}) {
  const { toast } = useApp();
  const [projectId, setProjectId] = useState<number | ''>(request.projectId ?? '');
  const [workArea, setWorkArea] = useState(request.workArea || '');
  const [requiredDate, setRequiredDate] = useState(request.requiredDate || todayISO());
  const [durationDays, setDurationDays] = useState<string>(request.durationDays != null ? String(request.durationDays) : '');
  const [notes, setNotes] = useState(request.notes || '');
  const [lines, setLines] = useState<Line[]>((request.lines || []).map((l) => ({ id: l.id, tradeId: l.tradeId, designation: l.designation, quantity: l.quantity })));
  const [saving, setSaving] = useState(false);
  const activeTrades = trades.filter((t) => t.active);

  const patch = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const save = async (submit: boolean) => {
    if (!projectId) { toast('⚠ Pick a project'); return; }
    const clean = lines.filter((l) => l.tradeId);
    if (!clean.length) { toast('⚠ Add at least one trade'); return; }
    if (clean.some((l) => !Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1)) { toast('⚠ Each line needs at least 1 worker'); return; }
    setSaving(true);
    const body = {
      projectId: Number(projectId), workArea: workArea || undefined, requiredDate, notes: notes || undefined,
      durationDays: durationDays ? Number(durationDays) : undefined,
      lines: clean.map((l) => ({ ...l, quantity: Number(l.quantity) })),
    };
    try {
      let saved: any;
      if (request.id) {
        saved = await api.workforceRequests.update(request.id, body);
        if (submit) saved = await api.workforceRequests.submit(request.id);
      } else {
        saved = await api.workforceRequests.create({ ...body, submit });
      }
      toast(submit ? 'Request submitted for approval' : 'Draft saved');
      onSaved(saved.id);
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    finally { setSaving(false); }
  };

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  return (
    <Drawer title={request.id ? 'Edit workforce request' : 'New workforce request'} subtitle="Ask for workers by trade. HR approves, then allocates people from the available pool."
      onClose={onClose}
      footer={<>
        <div onClick={onClose} style={btn()}>Cancel</div>
        <div onClick={saving ? undefined : () => save(false)} style={btn(false, saving)}>Save draft</div>
        <div onClick={saving ? undefined : () => save(true)} style={btn(true, saving)}>{saving ? 'Saving…' : 'Submit for approval'}</div>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div>
          <Label text="Project *" />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} style={input}>
            <option value="">Select…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label text="Work area / zone" /><input value={workArea} onChange={(e) => setWorkArea(e.target.value)} style={input} /></div>
        <div><Label text="Needed by *" /><input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} style={input} /></div>
        <div><Label text="For how long (days)" /><input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} style={input} /></div>
      </div>

      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Workers needed <span style={{ fontSize: 12, color: MUTED, fontFamily: 'inherit' }}>{total} total</span></div>
      <div style={{ ...card, overflow: 'hidden', marginBottom: 12 }}>
        <div style={headRow('1.3fr 1.3fr 90px 30px')}><span>Trade</span><span>Designation</span><span>How many</span><span /></div>
        {lines.map((l, i) => (
          <div key={i} style={bodyRow('1.3fr 1.3fr 90px 30px')}>
            <select value={l.tradeId} onChange={(e) => patch(i, { tradeId: e.target.value })} style={input}>
              <option value="">Select…</option>
              {activeTrades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input value={l.designation || ''} onChange={(e) => patch(i, { designation: e.target.value })} placeholder="Optional" style={input} />
            <input type="number" min={1} value={l.quantity} onChange={(e) => patch(i, { quantity: e.target.value === '' ? ('' as any) : Number(e.target.value) })} style={input} />
            <span onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: DANGER, textAlign: 'center' }}>×</span>
          </div>
        ))}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
          <span onClick={() => setLines((ls) => [...ls, { tradeId: '', quantity: 1 }])} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Add trade</span>
        </div>
      </div>
      <Label text="Notes" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
    </Drawer>
  );
}

// ------------------------------------------------------------------ detail

function RequestDetail(props: Ctx & {
  request: WorkforceRequest; canManage: boolean; projectName: (id: number) => string; tradeName: (id: string) => string;
  onClose: () => void; onEdit: () => void; onChanged: () => Promise<unknown>; onDeleted: () => void; onOpenEmployee: (id: string) => void;
}) {
  const { request: r, employees, assignments, canManage, projectName, tradeName, onClose, onEdit, onChanged, onDeleted, onOpenEmployee } = props;
  const { toast, currentUser } = useApp();
  const [linked, setLinked] = useState<Assignment[]>([]);
  const [note, setNote] = useState('');
  const [allocating, setAllocating] = useState<Line | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.assignments.list({ workforceRequestId: r.id }).then((x: any) => setLinked(Array.isArray(x) ? x : [])).catch(() => setLinked([]));
  }, [r.id, r.totals.allocated]);

  const mine = !!currentUser?.id && currentUser.id === r.requestedById;
  const s = STATUS[r.status] || STATUS.draft;
  const empName = (id: string) => employees.find((e) => e.id === id)?.name || 'Unknown';

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); toast(done); setNote(''); await onChanged(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not update the request')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm('Delete this request?')) return;
    try { await api.workforceRequests.remove(r.id); onDeleted(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not delete')); }
  };

  const cols = '1.3fr 1fr 80px 80px 80px 110px' + (r.status === 'approved' && canManage ? ' 90px' : '');

  return (
    <Drawer title={`${projectName(r.projectId)}${r.workArea ? ` · ${r.workArea}` : ''}`} width={720}
      subtitle={`Needed by ${fmtDate(r.requiredDate)}${r.durationDays ? ` for ${r.durationDays} days` : ''} · requested by ${r.requestedByName || 'Unknown'}`}
      onClose={onClose}
      footer={canManage ? <>
        {['draft', 'rejected'].includes(r.status) && <>
          <div onClick={remove} style={{ ...btn(), color: DANGER }}>Delete</div>
          <div onClick={onEdit} style={btn()}>Edit</div>
          <div onClick={busy ? undefined : () => act(() => api.workforceRequests.submit(r.id), 'Submitted for approval')} style={btn(true, busy)}>Submit</div>
        </>}
        {r.status === 'submitted' && !mine && <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={{ ...input, width: 200 }} />
          <div onClick={busy ? undefined : () => act(() => api.workforceRequests.reject(r.id, note), 'Rejected')} style={{ ...btn(false, busy), color: DANGER }}>Reject</div>
          <div onClick={busy ? undefined : () => act(() => api.workforceRequests.approve(r.id, note), 'Approved')} style={btn(true, busy)}>Approve</div>
        </>}
        {r.status === 'submitted' && mine && <span style={{ fontSize: 12, color: MUTED, alignSelf: 'center' }}>You raised this request — someone else approves it.</span>}
        {['submitted', 'approved'].includes(r.status) && (
          <div onClick={busy ? undefined : () => { if (confirm('Cancel this request? Workers already allocated stay deployed.')) act(() => api.workforceRequests.cancel(r.id), 'Cancelled'); }} style={btn(false, busy)}>Cancel request</div>
        )}
        {r.status === 'approved' && <div onClick={busy ? undefined : () => act(() => api.workforceRequests.fulfill(r.id), 'Marked fulfilled')} style={btn(true, busy)}>Mark fulfilled</div>}
      </> : undefined}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <Badge tone={s.tone}>{s.label}</Badge>
        {r.decidedByName && <span style={{ fontSize: 12, color: MUTED }}>{r.status === 'rejected' ? 'Rejected' : r.status === 'cancelled' ? 'Cancelled' : 'Decided'} by {r.decidedByName}{r.decidedAt ? ` on ${fmtDate(r.decidedAt)}` : ''}</span>}
      </div>
      {r.decisionNote && <div style={{ padding: '10px 12px', borderRadius: 10, background: r.status === 'rejected' ? '#F7ECE6' : '#F3F8F3', fontSize: 12.5, color: INK, marginBottom: 14 }}>{r.decisionNote}</div>}
      {r.notes && <div style={{ fontSize: 12.5, color: INK, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{r.notes}</div>}

      <div style={{ ...card, overflow: 'hidden', marginBottom: 18 }}>
        <div style={headRow(cols)}><span>Trade</span><span>Designation</span><span>Required</span><span>Allocated</span><span>In pool</span><span>Gap</span>{r.status === 'approved' && canManage && <span />}</div>
        {r.lines.map((l) => (
          <div key={l.id} style={bodyRow(cols)}>
            <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{tradeName(l.tradeId)}</span>
            <span style={{ fontSize: 12.5 }}>{l.designation || '—'}</span>
            <span style={{ fontSize: 13 }}>{l.quantity}</span>
            <span style={{ fontSize: 13, color: '#1E6B36', fontWeight: 700 }}>{l.allocated ?? 0}</span>
            <span style={{ fontSize: 13 }}>{l.available ?? 0}</span>
            <span>{l.shortage ? <Badge tone="red">Short {l.shortage}</Badge> : l.surplus ? <Badge tone="amber">+{l.surplus} over</Badge> : <Badge tone="green">Covered</Badge>}</span>
            {r.status === 'approved' && canManage && (
              <span onClick={() => setAllocating(l)} style={{ fontSize: 12, fontWeight: 700, color: l.shortage ? ACCENT : MUTED, cursor: 'pointer' }}>Allocate</span>
            )}
          </div>
        ))}
      </div>
      {r.status === 'submitted' && <div style={{ fontSize: 12, color: MUTED, marginTop: -8, marginBottom: 14 }}>Workers can be allocated once the request is approved.</div>}

      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Allocated workers</div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {linked.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
            <span onClick={() => onOpenEmployee(a.employeeId)} style={{ flex: 1, fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer' }}>{empName(a.employeeId)}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{tradeName(a.tradeId || '')} · from {fmtDate(a.startDate)}</span>
            {a.current ? <Badge tone="green">On site</Badge> : <Badge tone="grey">Ended</Badge>}
          </div>
        ))}
        {!linked.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Nobody allocated yet.</div>}
      </div>

      {allocating && (
        <AllocateDrawer employees={employees} assignments={assignments} request={r} line={allocating} tradeName={tradeName}
          onClose={() => setAllocating(null)}
          onDone={async () => { setAllocating(null); await onChanged(); }} />
      )}
    </Drawer>
  );
}

function AllocateDrawer({ employees, assignments, request, line, tradeName, onClose, onDone }: {
  employees: Employee[]; assignments: Assignment[]; request: WorkforceRequest; line: Line; tradeName: (id: string) => string;
  onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(request.requiredDate > todayISO() ? request.requiredDate : todayISO());
  const [otherTrades, setOtherTrades] = useState(false);
  const [saving, setSaving] = useState(false);

  const deployed = useMemo(() => new Set(assignments.filter((a) => a.current && a.assignmentType === 'regular').map((a) => a.employeeId)), [assignments]);
  const pool = employees.filter((e) => isDeployable(e) && !deployed.has(e.id) && (otherTrades || e.tradeId === line.tradeId));
  const need = line.shortage ?? line.quantity;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async () => {
    if (!picked.size) { toast('⚠ Pick at least one worker'); return; }
    setSaving(true);
    try {
      await api.workforceRequests.allocate(request.id, { lineId: line.id!, employeeIds: Array.from(picked), startDate });
      toast(`${picked.size} allocated and deployed`);
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not allocate')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title={`Allocate ${tradeName(line.tradeId)}`} width={520}
      subtitle={`${need} still needed. Picking someone deploys them to this project from the start date.`}
      onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Allocating…' : `Allocate ${picked.size || ''}`}</div></>}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 180 }}><Label text="Start date" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} /></div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: INK, paddingBottom: 8 }}>
          <input type="checkbox" checked={otherTrades} onChange={(e) => setOtherTrades(e.target.checked)} /> Show other trades too
        </label>
        <span style={{ fontSize: 12, color: picked.size > need ? '#8A6D12' : MUTED, paddingBottom: 8 }}>{picked.size} of {need} picked{picked.size > need ? ' — more than needed' : ''}</span>
      </div>
      <div style={{ ...card, maxHeight: 420, overflowY: 'auto', borderColor: LINE }}>
        {pool.map((e) => (
          <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', background: picked.has(e.id) ? '#F3F8F3' : 'transparent' }}>
            <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
            <span style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{e.name}</span>
              <span style={{ fontSize: 11.5, color: MUTED }}> · {e.workerId}{e.skillLevel ? ` · ${e.skillLevel.replace('_', '-')}` : ''}{e.yearsExperience != null ? ` · ${e.yearsExperience} yrs` : ''}{e.contractorId ? ' · contractor' : ''}{otherTrades && e.tradeId !== line.tradeId ? ` · ${e.trade || 'other trade'}` : ''}</span>
            </span>
          </label>
        ))}
        {!pool.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>No available {tradeName(line.tradeId)} workers — everyone in this trade is deployed. This shortage has to be covered from elsewhere.</div>}
      </div>
    </Drawer>
  );
}
