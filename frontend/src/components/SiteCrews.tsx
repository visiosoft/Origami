import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { useSupervisors } from './Deployment';

type Assign = { id: string; employeeId: string; projectId: number; supervisorId?: string | null; status?: string; endDate?: string | null; current?: boolean; designation?: string };
type Emp = { id: string; name: string; trade?: string; designation?: string };
const NONE = '';
const pill = (dark?: boolean) => ({ padding: '6px 12px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), .14)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' });

/**
 * Site crews (Nov 17, Astrid / Edward): on this project, which workers report
 * to which supervisor. A supervisor's daily report lists only his crew.
 * Workers come from Manpower → Deployment (deployed on this project).
 */
export function SiteCrews({ projectId }: { projectId: number }) {
  const { can, toast } = useApp();
  const canEdit = can('projects', 'manage') || can('manpower_con', 'manage') || can('pm', 'manage');
  const staff = useSupervisors();
  const [rows, setRows] = useState<Assign[] | null>(null);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [team, setTeam] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => (api.assignments.list({ projectId, status: 'current' }) as Promise<any>).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => {
    void load();
    (api.employees.list() as Promise<any>).then((r) => setEmps(Array.isArray(r) ? r : [])).catch(() => setEmps([]));
    api.projectTeam.get(projectId).then((r) => setTeam(r.roles || {})).catch(() => setTeam({}));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (id: string) => emps.find((e) => e.id === id)?.name || 'Worker';
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name || 'Someone';
  // Columns: the project's own superintendent and foreman, anyone already leading a crew here, and any added now.
  const supervisors = useMemo(() => {
    const ids = [team.superintendent, team.foreman, ...(rows || []).map((a) => a.supervisorId), ...extra].filter((x): x is string => !!x);
    return [...new Set(ids)];
  }, [team, rows, extra]);
  const crewOf = (sid: string) => (rows || []).filter((a) => (a.supervisorId || NONE) === sid);

  const move = async (ids: string[], to: string) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      await api.assignments.setSupervisor(ids, to || null);
      toast(to ? `${ids.length} worker${ids.length === 1 ? '' : 's'} now in ${staffName(to)}’s crew` : 'Taken out of the crew');
      setPicked(new Set()); await load();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };

  if (rows === null) return null;
  const col = (sid: string, title: string, sub: string) => {
    const list = crewOf(sid);
    return (
      <div key={sid || 'none'} className="crew-col" aria-label={title} role="group" style={{ flex: '1 1 220px', minWidth: 200, border: '1px solid rgba(var(--rgb-shade), .08)', borderRadius: 12, padding: 10, background: sid ? 'var(--surface)' : 'var(--panel)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
          <b style={{ fontSize: 13, color: 'var(--ink)' }}>{title}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub} · {list.length}</span>
        </div>
        {!list.length && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>{sid ? 'No one yet — tick workers and press “Put in this crew”.' : 'Everyone deployed here is in a crew.'}</div>}
        {list.map((a) => (
          <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px', fontSize: 12.5 }}>
            {canEdit && <input type="checkbox" checked={picked.has(a.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} aria-label={`Pick ${nameOf(a.employeeId)}`} />}
            <span style={{ flex: 1, minWidth: 0 }}>{nameOf(a.employeeId)}<span style={{ color: 'var(--muted)' }}>{a.designation ? ` · ${a.designation}` : ''}</span></span>
          </label>
        ))}
        {canEdit && sid && picked.size > 0 && (
          <button type="button" disabled={busy} style={{ ...pill(true), marginTop: 6 }} onClick={() => move([...picked], sid)}>Put in this crew ({picked.size})</button>
        )}
        {canEdit && !sid && picked.size > 0 && (
          <button type="button" disabled={busy} style={{ ...pill(), marginTop: 6 }} onClick={() => move([...picked], '')}>Take out of their crew ({picked.size})</button>
        )}
      </div>
    );
  };

  return (
    <section className="site-crews" aria-label="Site crews" style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14, 14px)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ fontSize: 14, color: 'var(--ink)' }}>Site crews</b>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Who reports to whom on this project. A supervisor’s daily report lists only his crew.</span>
        <span style={{ flex: 1 }} />
        {canEdit && (
          <select aria-label="Add a supervisor" value="" onChange={(e) => { if (e.target.value) setExtra((x) => [...x, e.target.value]); }} style={{ ...pill(), fontWeight: 600 }}>
            <option value="">+ Add a supervisor…</option>
            {staff.filter((s) => !supervisors.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      {!rows.length ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No workers deployed on this project yet — deploy them in Manpower → Deployment, then put them in a crew here.</div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {supervisors.map((sid) => col(sid, `${staffName(sid)}’s crew`, sid === team.superintendent ? 'Superintendent' : sid === team.foreman ? 'Foreman' : 'Supervisor'))}
          {col(NONE, 'Not in a crew yet', 'only the office sees them')}
        </div>
      )}
      {canEdit && rows.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>Tick workers in any column, then press “Put in this crew” under the supervisor they report to.</div>}
    </section>
  );
}
