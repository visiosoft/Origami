import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import { ACCENT, ACCENT_BG, BG, DANGER, INK, MUTED, Badge, Drawer, Label, btn, card, fmtDate, input, todayISO } from './manpowerUi';

type Level = 'camp' | 'building' | 'floor' | 'room' | 'bed';
interface Unit { id: string; parentId?: string | null; level: Level; name: string; notes?: string; active: boolean }
interface Allocation { id: string; bedId: string; employeeId: string; checkIn: string; checkOut?: string | null; notes?: string; byName?: string; location?: string }
interface Complaint { id: string; unitId: string; title: string; description?: string; employeeId?: string; status: 'open' | 'in_progress' | 'resolved'; resolution?: string; reportedByName?: string; reportedAt: string; resolvedAt?: string }
interface Overview { units: Unit[]; allocations: Allocation[]; issues: Complaint[] }

const CHILD: Record<Level, Level[]> = { camp: ['building'], building: ['floor', 'room'], floor: ['room'], room: ['bed'], bed: [] };
const LEVEL_LABEL: Record<Level, string> = { camp: 'Camp', building: 'Building', floor: 'Floor', room: 'Room', bed: 'Bed' };
const C_STATUS: Record<string, { label: string; tone: 'amber' | 'blue' | 'green' }> = {
  open: { label: 'Open', tone: 'amber' }, in_progress: { label: 'In progress', tone: 'blue' }, resolved: { label: 'Resolved', tone: 'green' },
};
const activeStaff = (employees: Employee[]) => employees.filter((e) => !['resigned', 'terminated', 'contract_expired', 'demobilized'].includes(e.employmentStatus || 'active') && e.status !== 'inactive');

function pathOf(units: Unit[], id: string) {
  const byId = new Map(units.map((u) => [u.id, u]));
  const out: string[] = [];
  let u = byId.get(id);
  while (u) { out.unshift(u.name); u = u.parentId ? byId.get(u.parentId) : undefined; }
  return out.join(' › ');
}

// ------------------------------------------------------------------ module

export function AccommodationModule({ employees, canManage, onOpenEmployee }: { employees: Employee[]; canManage: boolean; onOpenEmployee: (id: string) => void }) {
  const { toast } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [view, setView] = useState<'rooms' | 'complaints'>('rooms');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<{ parent: Unit | null; level: Level } | null>(null);
  const [allocating, setAllocating] = useState<Unit | null>(null);
  const [reporting, setReporting] = useState(false);
  const [openComplaint, setOpenComplaint] = useState<Complaint | null>(null);
  const [query, setQuery] = useState('');
  const load = () => api.accommodation.overview().then((r: any) => setData(r?.units ? r : { units: [], allocations: [], issues: [] })).catch(() => setData({ units: [], allocations: [], issues: [] }));
  useEffect(() => { load(); }, []);

  if (!data) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>;
  const today = todayISO();
  const { units, allocations, issues } = data;
  const kids = (id: string | null) => units.filter((u) => (u.parentId || null) === id).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const bedsUnder = (id: string): Unit[] => { const u = units.find((x) => x.id === id); if (u?.level === 'bed') return [u]; return kids(id).flatMap((k) => bedsUnder(k.id)); };
  const occupant = (bedId: string) => allocations.find((a) => a.bedId === bedId && a.checkIn <= today);
  const reserved = (bedId: string) => allocations.find((a) => a.bedId === bedId && a.checkIn > today);
  const empName = (id?: string) => employees.find((e) => e.id === id)?.name || 'Unknown';
  const allBeds = units.filter((u) => u.level === 'bed' && u.active);
  const occupiedCount = allBeds.filter((b) => occupant(b.id)).length;
  const openIssues = issues.filter((i) => i.status !== 'resolved');
  const housedIds = new Set(allocations.filter((a) => a.checkIn <= today).map((a) => a.employeeId));
  const q = query.trim().toLowerCase();
  const match = (u: Unit): boolean => !q || u.name.toLowerCase().includes(q) || bedsUnder(u.id).some((b) => empName(occupant(b.id)?.employeeId).toLowerCase().includes(q)) || kids(u.id).some(match);

  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const removeUnit = async (u: Unit) => {
    if (!confirm(`Delete ${u.name} and everything inside it?`)) return;
    try { await api.accommodation.removeUnit(u.id); toast('Deleted'); load(); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not delete')); }
  };
  const toggleActive = async (u: Unit) => {
    try { await api.accommodation.updateUnit(u.id, { active: !u.active }); load(); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not update')); }
  };
  const checkout = async (a: Allocation) => {
    if (!confirm(`Check ${empName(a.employeeId)} out today?`)) return;
    try { await api.accommodation.checkout(a.id, today); toast('Checked out'); load(); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not check out')); }
  };

  const renderUnit = (u: Unit, depth: number): React.ReactNode => {
    if (!match(u)) return null;
    const beds = bedsUnder(u.id).filter((b) => b.active);
    const occ = beds.filter((b) => occupant(b.id)).length;
    const isRoom = u.level === 'room';
    const open = !collapsed.has(u.id);
    const childLevels = CHILD[u.level].filter((l) => l !== 'bed');
    return (
      <div key={u.id}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', paddingLeft: 14 + depth * 22, borderTop: '1px solid rgba(20,8,31,.05)', opacity: u.active ? 1 : 0.5, background: depth === 0 ? '#FBF9F4' : undefined }}>
          {!isRoom ? <span onClick={() => toggle(u.id)} style={{ width: 14, cursor: 'pointer', color: MUTED, fontSize: 11 }}>{open ? '▾' : '▸'}</span> : <span style={{ width: 14 }} />}
          <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', width: 62 }}>{LEVEL_LABEL[u.level]}</span>
          <span style={{ fontSize: 13, fontWeight: depth === 0 ? 700 : 600, color: INK }}>{u.name}</span>
          {!u.active && <Badge tone="grey">Out of use</Badge>}
          <span style={{ fontSize: 11.5, color: occ === beds.length && beds.length ? DANGER : MUTED }}>{beds.length ? `${occ}/${beds.length} beds` : 'no beds'}</span>
          {isRoom && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 8, flex: 1 }}>
              {kids(u.id).map((b) => {
                const a = occupant(b.id);
                const r = reserved(b.id);
                return (
                  <span key={b.id} onClick={() => (a ? onOpenEmployee(a.employeeId) : canManage && b.active ? setAllocating(b) : undefined)}
                    title={a ? `Since ${fmtDate(a.checkIn)}` : r ? `Reserved for ${empName(r.employeeId)} from ${fmtDate(r.checkIn)}` : b.active ? 'Free — click to allocate' : 'Out of use'}
                    style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 9px', borderRadius: 8, fontSize: 11.5, cursor: 'pointer',
                      background: a ? ACCENT_BG : b.active ? 'white' : '#EFEDE8', border: '1px ' + (a ? 'solid ' + ACCENT_BG : 'dashed rgba(20,8,31,.2)'), color: a ? ACCENT : MUTED }}>
                    <b>{b.name}</b>{a ? ` · ${empName(a.employeeId)}` : r ? ` · reserved` : b.active ? ' · free' : ''}
                    {a && canManage && <span onClick={(e) => { e.stopPropagation(); checkout(a); }} title="Check out" style={{ color: DANGER, fontWeight: 700 }}>⏏</span>}
                  </span>
                );
              })}
            </div>
          )}
          {!isRoom && <div style={{ flex: 1 }} />}
          {canManage && (
            <span style={{ display: 'flex', gap: 10, fontSize: 11.5, fontWeight: 700 }}>
              {childLevels.map((l) => <span key={l} onClick={() => setAdding({ parent: u, level: l })} style={{ color: ACCENT, cursor: 'pointer' }}>+ {LEVEL_LABEL[l]}</span>)}
              {isRoom && <span onClick={() => setAdding({ parent: u, level: 'bed' })} style={{ color: ACCENT, cursor: 'pointer' }}>+ Beds</span>}
              <span onClick={() => toggleActive(u)} style={{ color: MUTED, cursor: 'pointer' }}>{u.active ? 'Disable' : 'Enable'}</span>
              <span onClick={() => removeUnit(u)} style={{ color: DANGER, cursor: 'pointer' }}>×</span>
            </span>
          )}
        </div>
        {!isRoom && open && kids(u.id).filter((k) => k.level !== 'bed').map((k) => renderUnit(k, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        {([['Beds', allBeds.length], ['Occupied', occupiedCount], ['Free', allBeds.length - occupiedCount], ['Housed staff', housedIds.size], ['Open complaints', openIssues.length]] as [string, number][]).map(([l, n]) => (
          <div key={l} style={{ ...card, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{l}</div>
            <div style={{ fontFamily: BG, fontSize: 22, fontWeight: 700, color: l === 'Open complaints' && n ? DANGER : INK }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {([['rooms', 'Rooms & beds'], ['complaints', `Complaints${openIssues.length ? ` (${openIssues.length})` : ''}`]] as const).map(([k, l]) => (
          <div key={k} onClick={() => setView(k)} style={{ ...btn(view === k), padding: '6px 13px', fontSize: 12 }}>{l}</div>
        ))}
        {view === 'rooms' && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a room or person…" style={{ ...input, width: 200 }} />}
        <div style={{ flex: 1 }} />
        {view === 'rooms' && canManage && <div onClick={() => setAllocating({ id: '', level: 'bed', name: '', active: true })} style={btn()}>Allocate a bed</div>}
        {view === 'rooms' && canManage && <div onClick={() => setAdding({ parent: null, level: 'camp' })} style={btn(true)}>+ Camp</div>}
        {view === 'complaints' && <div onClick={() => setReporting(true)} style={btn(true)}>+ Report a problem</div>}
      </div>

      {view === 'rooms' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 760 }}>
            {kids(null).map((c) => renderUnit(c, 0))}
          </div></div>
          {!units.length && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No accommodation set up. Add a camp, then its buildings, rooms and beds.</div>}
        </div>
      )}

      {view === 'complaints' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          {issues.map((i) => (
            <div key={i.id} onClick={() => setOpenComplaint(i)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{i.title}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{pathOf(units, i.unitId)} · {fmtDate(i.reportedAt)} by {i.reportedByName || '—'}{i.employeeId ? ` for ${empName(i.employeeId)}` : ''}</div>
              </span>
              <Badge tone={C_STATUS[i.status].tone}>{C_STATUS[i.status].label}</Badge>
            </div>
          ))}
          {!issues.length && <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No maintenance complaints.</div>}
        </div>
      )}

      {adding && <AddUnitDrawer parent={adding.parent} level={adding.level} onClose={() => setAdding(null)} onDone={() => { setAdding(null); load(); }} />}
      {allocating && <AllocateDrawer bed={allocating.id ? allocating : null} units={units} allocations={allocations} employees={employees} onClose={() => setAllocating(null)} onDone={() => { setAllocating(null); load(); }} />}
      {reporting && <ReportDrawer units={units} employees={employees} onClose={() => setReporting(false)} onDone={() => { setReporting(false); load(); }} />}
      {openComplaint && <ComplaintDrawer c={openComplaint} units={units} employeeName={openComplaint.employeeId ? empName(openComplaint.employeeId) : undefined} canManage={canManage} onClose={() => setOpenComplaint(null)} onDone={() => { setOpenComplaint(null); load(); }} />}
    </div>
  );
}

function AddUnitDrawer({ parent, level, onClose, onDone }: { parent: Unit | null; level: Level; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [count, setCount] = useState(4);
  const submit = async () => {
    try {
      await api.accommodation.createUnit(level === 'bed' ? { parentId: parent?.id, level, count } : { parentId: parent?.id, level, name });
      toast(level === 'bed' ? `${count} bed(s) added` : `${LEVEL_LABEL[level]} added`); onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not add')); }
  };
  return (
    <Drawer title={level === 'bed' ? `Add beds to ${parent?.name}` : `Add ${LEVEL_LABEL[level].toLowerCase()}${parent ? ` to ${parent.name}` : ''}`} width={420} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={submit} style={btn(true)}>Add</div></>}>
      {level === 'bed' ? (
        <><Label text="How many beds" /><input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} style={input} />
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>Numbered after any beds already in the room.</div></>
      ) : (
        <><Label text="Name" /><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={{ camp: 'e.g. Labour Camp A', building: 'e.g. Block 1', floor: 'e.g. Ground floor', room: 'e.g. Room 101', bed: '' }[level]} style={input} /></>
      )}
    </Drawer>
  );
}

function AllocateDrawer({ bed, units, allocations, employees, fixedEmployeeId, onClose, onDone }: {
  bed: Unit | null; units: Unit[]; allocations: Allocation[]; employees: Employee[]; fixedEmployeeId?: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const today = todayISO();
  const [bedId, setBedId] = useState(bed?.id || '');
  const [employeeId, setEmployeeId] = useState(fixedEmployeeId || '');
  const [checkIn, setCheckIn] = useState(today);
  const [notes, setNotes] = useState('');
  const taken = new Set(allocations.map((a) => a.bedId));
  const freeBeds = units.filter((u) => u.level === 'bed' && u.active && !taken.has(u.id)).map((u) => ({ id: u.id, label: pathOf(units, u.id) })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const current = allocations.find((a) => a.employeeId === employeeId && a.checkIn <= today);
  const submit = async () => {
    try { await api.accommodation.allocate({ bedId, employeeId, checkIn, notes: notes || undefined }); toast(current ? 'Moved' : 'Bed allocated'); onDone(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not allocate')); }
  };
  return (
    <Drawer title={bed ? `Allocate ${pathOf(units, bed.id)}` : 'Allocate a bed'} width={480} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={bedId && employeeId ? submit : undefined} style={btn(true, !bedId || !employeeId)}>{current ? 'Move here' : 'Allocate'}</div></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {!bed && (
          <div><Label text={`Free bed (${freeBeds.length})`} />
            <select value={bedId} onChange={(e) => setBedId(e.target.value)} style={input}>
              <option value="">Select…</option>
              {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
        )}
        {!fixedEmployeeId && (
          <div><Label text="Employee" />
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={input}>
              <option value="">Select…</option>
              {activeStaff(employees).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.workerId}</option>)}
            </select>
          </div>
        )}
        {current && <div style={{ fontSize: 12, color: '#8A6D12', background: '#FBF3D6', padding: '8px 10px', borderRadius: 8 }}>Currently in {pathOf(units, current.bedId)} — they'll be checked out of it the day before.</div>}
        <div><Label text="Check-in" /><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={input} /></div>
        <div><Label text="Notes" /><input value={notes} onChange={(e) => setNotes(e.target.value)} style={input} /></div>
      </div>
    </Drawer>
  );
}

function ReportDrawer({ units, employees, fixedUnitId, fixedEmployeeId, onClose, onDone }: {
  units: Unit[]; employees: Employee[]; fixedUnitId?: string; fixedEmployeeId?: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [f, setF] = useState({ unitId: fixedUnitId || '', title: '', description: '', employeeId: fixedEmployeeId || '' });
  const places = units.filter((u) => u.level !== 'bed').map((u) => ({ id: u.id, label: pathOf(units, u.id) })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const submit = async () => {
    try { await api.accommodation.reportIssue({ ...f, description: f.description || undefined, employeeId: f.employeeId || undefined }); toast('Complaint logged'); onDone(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not log')); }
  };
  return (
    <Drawer title="Report a problem" subtitle="Leaks, power, AC, pests, broken furniture…" width={480} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={submit} style={btn(true)}>Log complaint</div></>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><Label text="Where" />
          <select value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })} style={input}>
            <option value="">Select…</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div><Label text="Problem" /><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. AC not cooling" style={input} /></div>
        <div><Label text="Details" /><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} /></div>
        {!fixedEmployeeId && (
          <div><Label text="Reported for (optional)" />
            <select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} style={input}>
              <option value="">—</option>
              {activeStaff(employees).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function ComplaintDrawer({ c, units, employeeName, canManage, onClose, onDone }: { c: Complaint; units: Unit[]; employeeName?: string; canManage: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [resolution, setResolution] = useState(c.resolution || '');
  const set = async (status: string) => {
    try { await api.accommodation.updateIssue(c.id, { status, resolution: resolution || undefined }); toast('Updated'); onDone(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not update')); }
  };
  return (
    <Drawer title={c.title} subtitle={pathOf(units, c.unitId)} width={480} onClose={onClose}
      footer={canManage ? <>
        {c.status === 'open' && <div onClick={() => set('in_progress')} style={btn()}>Mark in progress</div>}
        {c.status === 'resolved' && <div onClick={() => set('open')} style={btn()}>Reopen</div>}
        {c.status !== 'resolved' && <div onClick={() => set('resolved')} style={btn(true)}>Mark resolved</div>}
      </> : undefined}>
      <div style={{ marginBottom: 12 }}><Badge tone={C_STATUS[c.status].tone}>{C_STATUS[c.status].label}</Badge></div>
      <div style={{ ...card, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.8, marginBottom: 14 }}>
        <div>Reported {fmtDate(c.reportedAt)} by <b>{c.reportedByName || '—'}</b>{employeeName ? ` for ${employeeName}` : ''}</div>
        {c.description && <div style={{ whiteSpace: 'pre-wrap' }}>{c.description}</div>}
        {c.resolvedAt && <div>Resolved {fmtDate(c.resolvedAt)}</div>}
      </div>
      {canManage ? <><Label text="Resolution" /><textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} placeholder="What was done" style={{ ...input, resize: 'vertical' }} /></>
        : c.resolution && <div style={{ fontSize: 12.5 }}>Resolution: {c.resolution}</div>}
    </Drawer>
  );
}

// ------------------------------------------------------------------ profile

export function EmployeeHousingCard({ employee, employees, canManage }: { employee: Employee; employees: Employee[]; canManage: boolean }) {
  const { toast } = useApp();
  const [history, setHistory] = useState<Allocation[] | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [mode, setMode] = useState<'' | 'allocate' | 'report'>('');
  const load = () => {
    api.accommodation.forEmployee(employee.id).then((r: any) => setHistory(Array.isArray(r) ? r : [])).catch(() => setHistory([]));
    api.accommodation.overview().then((r: any) => setData(r?.units ? r : null)).catch(() => {});
  };
  useEffect(() => { load(); setMode(''); }, [employee.id]);
  const today = todayISO();
  const current = (history || []).find((a) => a.checkIn <= today && (!a.checkOut || a.checkOut >= today));
  const upcoming = (history || []).find((a) => a.checkIn > today);
  const past = (history || []).filter((a) => a !== current && a !== upcoming);
  const checkout = async () => {
    if (!current || !confirm('Check out today?')) return;
    try { await api.accommodation.checkout(current.id, today); toast('Checked out'); load(); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not check out')); }
  };
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Accommodation</div>
        {canManage && data && data.units.length > 0 && <div onClick={() => setMode('allocate')} style={btn(!current)}>{current ? 'Move' : '+ Allocate bed'}</div>}
      </div>
      {history === null ? <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div> : (
        <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.8 }}>
          {current ? <div><b>{current.location}</b> since {fmtDate(current.checkIn)}
            {canManage && <span onClick={checkout} style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: DANGER, cursor: 'pointer' }}>Check out</span>}
            <span onClick={() => setMode('report')} style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Report a problem</span>
          </div> : <div style={{ color: MUTED }}>Not in company accommodation.</div>}
          {upcoming && <div>From {fmtDate(upcoming.checkIn)}: <b>{upcoming.location}</b></div>}
          {past.length > 0 && (
            <details><summary style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>Previous stays ({past.length})</summary>
              {past.map((a) => <div key={a.id} style={{ fontSize: 12 }}>{fmtDate(a.checkIn)} – {fmtDate(a.checkOut)} · {a.location}</div>)}
            </details>
          )}
        </div>
      )}
      {mode === 'allocate' && data && <AllocateDrawer bed={null} units={data.units} allocations={data.allocations} employees={employees} fixedEmployeeId={employee.id} onClose={() => setMode('')} onDone={() => { setMode(''); load(); }} />}
      {mode === 'report' && data && current && <ReportDrawer units={data.units} employees={employees} fixedUnitId={data.units.find((u) => u.id === current.bedId)?.parentId || undefined} fixedEmployeeId={employee.id} onClose={() => setMode('')} onDone={() => setMode('')} />}
    </div>
  );
}
