import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import { ACCENT, BG, DANGER, INK, MUTED, Badge, Drawer, Label, btn, card, fmtDate, input, todayISO, type Project } from './manpowerUi';

interface Rider { id: string; routeId: string; employeeId: string; pickupPoint?: string; startDate: string; endDate?: string | null; byName?: string }
interface Route {
  id: string; name: string; vehicle?: string; capacity: number; driverEmployeeId?: string; projectId?: number; departureTime?: string; returnTime?: string;
  pickupPoints: string[]; status: 'active' | 'suspended'; notes?: string; riders: Rider[]; riderCount: number;
}
const activeStaff = (employees: Employee[]) => employees.filter((e) => !['resigned', 'terminated', 'contract_expired', 'demobilized'].includes(e.employmentStatus || 'active') && e.status !== 'inactive');

export function TransportModule({ employees, projects, canManage, onOpenEmployee }: { employees: Employee[]; projects: Project[]; canManage: boolean; onOpenEmployee: (id: string) => void }) {
  const [rows, setRows] = useState<Route[] | null>(null);
  const [editing, setEditing] = useState<Route | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = () => api.transport.routes().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const empName = (id?: string) => employees.find((e) => e.id === id)?.name;
  const projName = (id?: number) => projects.find((p) => p.id === id)?.name;
  const all = rows || [];
  const seats = all.filter((r) => r.status === 'active').reduce((s, r) => s + (r.capacity || 0), 0);
  const riding = all.reduce((s, r) => s + r.riderCount, 0);
  const opened = all.find((r) => r.id === openId);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        {([['Active routes', all.filter((r) => r.status === 'active').length], ['Seats', seats], ['Riding today', riding], ['Free seats', Math.max(seats - riding, 0)]] as [string, number][]).map(([l, n]) => (
          <div key={l} style={{ ...card, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{l}</div>
            <div style={{ fontFamily: BG, fontSize: 22, fontWeight: 700, color: INK }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 12, color: MUTED, alignSelf: 'center' }}>Company buses and vans taking staff between camps and sites.</div>
        {canManage && <div onClick={() => setEditing('new')} style={btn(true)}>+ Add route</div>}
      </div>
      {rows === null && <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {all.map((r) => {
          const full = r.capacity > 0 && r.riderCount >= r.capacity;
          return (
            <div key={r.id} onClick={() => setOpenId(r.id)} style={{ ...card, padding: '14px 16px', cursor: 'pointer', opacity: r.status === 'active' ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>{r.name}</div>
                {r.status === 'suspended' ? <Badge tone="grey">Suspended</Badge> : full ? <Badge tone="red">Full</Badge> : null}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{[r.vehicle, empName(r.driverEmployeeId) && `Driver ${empName(r.driverEmployeeId)}`].filter(Boolean).join(' · ') || 'No vehicle set'}</div>
              <div style={{ fontSize: 12.5, color: INK, marginTop: 8, lineHeight: 1.6 }}>
                {projName(r.projectId) && <div>To <b>{projName(r.projectId)}</b></div>}
                {(r.departureTime || r.returnTime) && <div>Leaves {r.departureTime || '—'} · returns {r.returnTime || '—'}</div>}
                {r.pickupPoints.length > 0 && <div style={{ color: MUTED }}>Stops: {r.pickupPoints.join(' → ')}</div>}
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUTED, marginBottom: 4 }}>
                  <span>{r.riderCount} riding</span><span>{r.capacity ? `${r.capacity} seats` : 'no seat limit'}</span>
                </div>
                {r.capacity > 0 && <div style={{ height: 6, borderRadius: 99, background: '#EFEDE8' }}><div style={{ width: `${Math.min(100, (r.riderCount / r.capacity) * 100)}%`, height: '100%', borderRadius: 99, background: full ? DANGER : ACCENT }} /></div>}
              </div>
            </div>
          );
        })}
      </div>
      {rows && !all.length && <div style={{ ...card, padding: '24px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No routes yet.</div>}

      {editing && <RouteForm route={editing === 'new' ? undefined : editing} employees={employees} projects={projects} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {opened && !editing && <RouteDrawer route={opened} employees={employees} projects={projects} canManage={canManage} onOpenEmployee={onOpenEmployee} onEdit={() => setEditing(opened)} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function RouteForm({ route, employees, projects, onClose, onSaved }: { route?: Route; employees: Employee[]; projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({
    name: route?.name || '', vehicle: route?.vehicle || '', capacity: String(route?.capacity ?? ''), driverEmployeeId: route?.driverEmployeeId || '',
    projectId: route?.projectId ? String(route.projectId) : '', departureTime: route?.departureTime || '', returnTime: route?.returnTime || '',
    pickupPoints: (route?.pickupPoints || []).join('\n'), notes: route?.notes || '',
  });
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    const body = {
      name: f.name, vehicle: f.vehicle || undefined, capacity: f.capacity === '' ? 0 : Number(f.capacity), driverEmployeeId: f.driverEmployeeId || undefined,
      projectId: f.projectId ? Number(f.projectId) : undefined, departureTime: f.departureTime || undefined, returnTime: f.returnTime || undefined,
      pickupPoints: f.pickupPoints.split('\n').map((s) => s.trim()).filter(Boolean), notes: f.notes || undefined,
    };
    try { route ? await api.transport.update(route.id, body) : await api.transport.create(body); toast(route ? 'Saved' : 'Route added'); onSaved(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
  };
  return (
    <Drawer title={route ? `Edit ${route.name}` : 'Add route'} width={520} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={submit} style={btn(true)}>Save</div></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Route name *" /><input value={f.name} onChange={set('name')} placeholder="e.g. Camp A → Tower site" style={input} /></div>
        <div><Label text="Vehicle" /><input value={f.vehicle} onChange={set('vehicle')} placeholder="e.g. Coaster LEB-1234" style={input} /></div>
        <div><Label text="Seats" /><input type="number" min={0} value={f.capacity} onChange={set('capacity')} style={input} /></div>
        <div><Label text="Driver" />
          <select value={f.driverEmployeeId} onChange={set('driverEmployeeId')} style={input}>
            <option value="">—</option>
            {activeStaff(employees).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div><Label text="Site (project)" />
          <select value={f.projectId} onChange={set('projectId')} style={input}>
            <option value="">—</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><Label text="Departs" /><input type="time" value={f.departureTime} onChange={set('departureTime')} style={input} /></div>
        <div><Label text="Returns" /><input type="time" value={f.returnTime} onChange={set('returnTime')} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Pick-up points (one per line, in order)" /><textarea value={f.pickupPoints} onChange={set('pickupPoints')} rows={3} style={{ ...input, resize: 'vertical' }} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><input value={f.notes} onChange={set('notes')} style={input} /></div>
      </div>
    </Drawer>
  );
}

function RouteDrawer({ route, employees, projects, canManage, onOpenEmployee, onEdit, onClose, onChanged }: {
  route: Route; employees: Employee[]; projects: Project[]; canManage: boolean; onOpenEmployee: (id: string) => void; onEdit: () => void; onClose: () => void; onChanged: () => Promise<unknown>;
}) {
  const { toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ employeeId: '', pickupPoint: route.pickupPoints[0] || '', startDate: todayISO() });
  const today = todayISO();
  const empName = (id?: string) => employees.find((e) => e.id === id)?.name || 'Unknown';
  const current = route.riders.filter((r) => r.startDate <= today);
  const upcoming = route.riders.filter((r) => r.startDate > today);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); await onChanged(); } catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
  };
  const remove = () => { if (confirm(`Delete ${route.name}?`)) run(() => api.transport.remove(route.id), 'Deleted').then(onClose); };
  const riderIds = new Set(route.riders.map((r) => r.employeeId));

  return (
    <Drawer title={route.name} subtitle={[route.vehicle, projects.find((p) => p.id === route.projectId)?.name].filter(Boolean).join(' · ')} width={540} onClose={onClose}
      footer={canManage ? <>
        {!route.riders.length && <div onClick={remove} style={{ ...btn(), color: DANGER }}>Delete</div>}
        <div onClick={() => run(() => api.transport.update(route.id, { status: route.status === 'active' ? 'suspended' : 'active' }), route.status === 'active' ? 'Suspended' : 'Reactivated')} style={btn()}>{route.status === 'active' ? 'Suspend' : 'Reactivate'}</div>
        <div onClick={onEdit} style={btn()}>Edit route</div>
        {route.status === 'active' && <div onClick={() => setAdding(true)} style={btn(true)}>+ Add rider</div>}
      </> : undefined}>
      <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.7, marginBottom: 14 }}>
        {route.driverEmployeeId && <div>Driver: <b>{empName(route.driverEmployeeId)}</b></div>}
        {(route.departureTime || route.returnTime) && <div>Leaves {route.departureTime || '—'}, returns {route.returnTime || '—'}</div>}
        {route.pickupPoints.length > 0 && <div>Stops: {route.pickupPoints.join(' → ')}</div>}
        <div>{route.riderCount} of {route.capacity || '∞'} seats taken</div>
        {route.notes && <div style={{ color: MUTED }}>{route.notes}</div>}
      </div>
      {adding && (
        <div style={{ ...card, padding: '14px 16px', borderColor: ACCENT, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}><Label text="Employee" />
              <select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} style={input}>
                <option value="">Select…</option>
                {activeStaff(employees).filter((e) => !riderIds.has(e.id)).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.workerId}</option>)}
              </select>
            </div>
            <div><Label text="Pick-up point" />
              {route.pickupPoints.length ? (
                <select value={f.pickupPoint} onChange={(e) => setF({ ...f, pickupPoint: e.target.value })} style={input}>{route.pickupPoints.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              ) : <input value={f.pickupPoint} onChange={(e) => setF({ ...f, pickupPoint: e.target.value })} style={input} />}
            </div>
            <div><Label text="From" /><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} style={input} /></div>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Someone already on another route is moved: their old seat ends the day before.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <div onClick={() => setAdding(false)} style={btn()}>Cancel</div>
            <div onClick={f.employeeId ? () => run(() => api.transport.addRider(route.id, { ...f, pickupPoint: f.pickupPoint || undefined }), 'Rider added').then(() => { setAdding(false); setF({ ...f, employeeId: '' }); }) : undefined} style={btn(true, !f.employeeId)}>Add</div>
          </div>
        </div>
      )}
      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Riders ({current.length})</div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {[...current, ...upcoming].map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
            <span onClick={() => onOpenEmployee(r.employeeId)} style={{ flex: 1, fontWeight: 600, color: INK, cursor: 'pointer' }}>{empName(r.employeeId)}</span>
            <span style={{ color: MUTED }}>{r.pickupPoint || '—'}</span>
            <span style={{ color: MUTED, fontSize: 11.5 }}>{r.startDate > today ? `from ${fmtDate(r.startDate)}` : `since ${fmtDate(r.startDate)}`}{r.endDate ? ` until ${fmtDate(r.endDate)}` : ''}</span>
            {canManage && !r.endDate && <span onClick={() => run(() => api.transport.endRider(r.id, r.startDate > today ? r.startDate : today), 'Removed from route')} style={{ color: DANGER, fontWeight: 700, cursor: 'pointer' }}>End</span>}
          </div>
        ))}
        {!route.riders.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Nobody on this route.</div>}
      </div>
    </Drawer>
  );
}

export function EmployeeTransportCard({ employee, canManage }: { employee: Employee; canManage: boolean }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<(Rider & { route?: Route })[] | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [f, setF] = useState({ routeId: '', pickupPoint: '', startDate: todayISO() });
  const load = () => {
    api.transport.forEmployee(employee.id).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
    api.transport.routes().then((r: any) => setRoutes(Array.isArray(r) ? r : [])).catch(() => {});
  };
  useEffect(() => { load(); setAssigning(false); }, [employee.id]);
  const today = todayISO();
  const current = (rows || []).find((r) => r.startDate <= today && (!r.endDate || r.endDate >= today));
  const past = (rows || []).filter((r) => r !== current);
  const chosen = routes.find((r) => r.id === f.routeId);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); setAssigning(false); load(); } catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
  };
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Transport</div>
        {canManage && routes.some((r) => r.status === 'active') && !assigning && <div onClick={() => setAssigning(true)} style={btn(!current)}>{current ? 'Change route' : '+ Assign route'}</div>}
      </div>
      {rows === null ? <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div> : current ? (
        <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.8 }}>
          <b>{current.route?.name}</b>{current.pickupPoint ? ` · picked up at ${current.pickupPoint}` : ''} · since {fmtDate(current.startDate)}
          {current.route?.departureTime && <div style={{ color: MUTED }}>Leaves {current.route.departureTime}{current.route.returnTime ? `, returns ${current.route.returnTime}` : ''}{current.route.vehicle ? ` · ${current.route.vehicle}` : ''}</div>}
          {canManage && <span onClick={() => run(() => api.transport.endRider(current.id, today), 'Removed from route')} style={{ fontSize: 12, fontWeight: 700, color: DANGER, cursor: 'pointer' }}>Stop transport</span>}
        </div>
      ) : <div style={{ fontSize: 12.5, color: MUTED }}>Not on company transport.</div>}
      {assigning && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'end', marginTop: 12 }}>
          <div><Label text="Route" />
            <select value={f.routeId} onChange={(e) => { const r = routes.find((x) => x.id === e.target.value); setF({ ...f, routeId: e.target.value, pickupPoint: r?.pickupPoints[0] || '' }); }} style={input}>
              <option value="">Select…</option>
              {routes.filter((r) => r.status === 'active' && r.id !== current?.routeId).map((r) => <option key={r.id} value={r.id}>{r.name} ({r.riderCount}/{r.capacity || '∞'})</option>)}
            </select>
          </div>
          <div><Label text="Pick-up" />
            {chosen?.pickupPoints.length ? <select value={f.pickupPoint} onChange={(e) => setF({ ...f, pickupPoint: e.target.value })} style={input}>{chosen.pickupPoints.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              : <input value={f.pickupPoint} onChange={(e) => setF({ ...f, pickupPoint: e.target.value })} style={input} />}
          </div>
          <div><Label text="From" /><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} style={input} /></div>
          <div onClick={() => setAssigning(false)} style={btn()}>Cancel</div>
          <div onClick={f.routeId ? () => run(() => api.transport.addRider(f.routeId, { employeeId: employee.id, pickupPoint: f.pickupPoint || undefined, startDate: f.startDate }), 'Route assigned') : undefined} style={btn(true, !f.routeId)}>Save</div>
        </div>
      )}
      {past.length > 0 && (
        <details style={{ marginTop: 8 }}><summary style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>Transport history ({past.length})</summary>
          {past.map((r) => <div key={r.id} style={{ fontSize: 12, padding: '3px 0' }}>{fmtDate(r.startDate)} – {r.endDate ? fmtDate(r.endDate) : 'ongoing'} · {r.route?.name}</div>)}
        </details>
      )}
    </div>
  );
}
