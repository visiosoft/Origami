import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { PROJECT_ROLES } from '../data/projectRoles';

type Summary = { key: string; label: string; userId: string | null; name: string | null; waiting: number }[];

/**
 * The project's internal team (Nov 13): who fills each role. Tasks given to
 * a role (Project Manager, Admin, Architect...) go to that person on their
 * own; a role nobody fills is marked with the tasks waiting on it.
 */
export function ProjectTeam({ projectId }: { projectId: number }) {
  const { can, toast } = useApp();
  const canEdit = can('projects', 'manage') || can('pm', 'manage');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => api.projectTeam.get(projectId).then((r) => { setSummary(r.summary); setRoles(r.roles || {}); }).catch(() => setSummary([]));
  useEffect(() => { void load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (api.users.directory() as Promise<any>).then((l) => setStaff((Array.isArray(l) ? l : []).filter((u: any) => u.status !== 'suspended').map((u: any) => ({ id: String(u.id), name: String(u.name) })))).catch(() => undefined); }, []);
  if (!summary) return null;
  const dirty = PROJECT_ROLES.some((r) => (roles[r.key] || '') !== (summary.find((s) => s.key === r.key)?.userId || ''));
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.projectTeam.set(projectId, Object.fromEntries(PROJECT_ROLES.map((x) => [x.key, roles[x.key] || ''])));
      setSummary(r.summary); setRoles(r.roles || {});
      toast(r.filled ? `Team saved — ${r.filled} task${r.filled === 1 ? '' : 's'} assigned` : 'Team saved');
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };
  const unfilled = summary.filter((s) => !s.userId && s.waiting).length;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14, 14px)', padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ fontSize: 14, color: 'var(--ink)' }}>Project team</b>
        <span style={{ fontSize: 12, color: unfilled ? '#9A5B00' : 'var(--muted)' }}>{unfilled ? `${unfilled} role${unfilled === 1 ? '' : 's'} with tasks waiting and no one in them` : 'Tasks given to a role go to the person in it.'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
        {summary.map((s) => (
          <label key={s.key} style={{ display: 'grid', gap: 3, fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
            <span>{s.label}{!s.userId && s.waiting > 0 && <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: '#FBEFD5', color: '#7A4B00', fontSize: 10.5 }}>{s.waiting} waiting</span>}</span>
            <select aria-label={s.label} disabled={!canEdit} value={roles[s.key] || ''} onChange={(e) => setRoles((r) => ({ ...r, [s.key]: e.target.value }))}
              style={{ font: 'inherit', fontSize: 13, fontWeight: 500, padding: '7px 9px', borderRadius: 9, border: `1px solid ${!roles[s.key] && s.waiting ? '#E0B25C' : 'rgba(var(--rgb-shade), 0.15)'}`, background: 'var(--surface)', color: 'var(--ink)' }}>
              <option value="">— No one —</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              {roles[s.key] && !staff.some((u) => u.id === roles[s.key]) && <option value={roles[s.key]}>{s.name || roles[s.key]}</option>}
            </select>
          </label>
        ))}
      </div>
      {canEdit && <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}><button type="button" disabled={!dirty || busy} onClick={() => void save()} style={{ padding: '8px 16px', borderRadius: 999, border: 0, background: 'var(--forest)', color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.5 }}>{busy ? 'Saving…' : 'Save team'}</button></div>}
    </div>
  );
}
