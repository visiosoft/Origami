import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { EXTENT_LABEL, LEVELS, LEVEL_HINT, LEVEL_LABEL, LEVEL_SHORT, OVERALL_KEY, dataTypeLabel, levelOf, type Extent, type Level } from '../data/accessLevels';
import { MODULES, type RolePermissions, type User } from '../data/users';
import { Drawer } from './manpowerUi';
import { Skeleton } from './Skeleton';

/**
 * One cell of the access grid for a role that uses levels: the level (Block …
 * Full edit) and the extent (A = assigned projects, P = portfolio). Inherited
 * from the role's overall access unless set here.
 */
export function LevelCell({ perms, k, label, roleName, readOnly, onChange }: {
  perms: RolePermissions; k: string; label: string; roleName: string; readOnly: boolean;
  onChange: (level: Level | '', extent: Extent | '') => void;
}) {
  const cur = levelOf(perms, k);
  const own = perms[k];
  const title = `${roleName} · ${label}: ${cur.level ? LEVEL_LABEL[cur.level] : 'not set'}${cur.extent ? ' · ' + EXTENT_LABEL[cur.extent] : ''}${cur.own ? '' : ' (from overall access)'}${own?.note ? ' — ' + own.note : ''}`;
  return (
    <span className={'ab-lv is-' + (cur.level || 'none') + (cur.own ? '' : ' is-inherited')} title={title}>
      <select disabled={readOnly} value={own?.level || ''} onChange={(e) => onChange(e.target.value as Level | '', (own?.extent as Extent) || '')} aria-label={`${roleName}, ${label}: access`}>
        {k !== OVERALL_KEY && <option value="">{cur.level && !cur.own ? `↳ ${LEVEL_SHORT[cur.level]}` : '—'}</option>}
        {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_SHORT[l]}</option>)}
      </select>
      <button type="button" disabled={readOnly} className="ab-lv-ext" title={cur.extent ? EXTENT_LABEL[cur.extent] + ' — click to switch' : 'Extent'}
        onClick={() => onChange((own?.level as Level) || (k === OVERALL_KEY ? cur.level || 'view' : ''), cur.extent === 'portfolio' ? 'assigned' : 'portfolio')}>
        {cur.extent === 'portfolio' ? 'P' : cur.extent === 'assigned' ? 'A' : '·'}
      </button>
    </span>
  );
}

/** Every data type a role (or a person) can be set for: overall, the menu, and any others in the role (financial items…). */
function dataTypes(perms: RolePermissions) {
  const menu = MODULES.map((m) => ({ key: m.key, label: m.label, group: m.group }));
  const extra = Object.keys(perms).filter((k) => k !== OVERALL_KEY && !menu.some((m) => m.key === k))
    .map((k) => ({ key: k, label: dataTypeLabel(k, MODULES), group: k.startsWith('fin:') ? 'Financial items (hidden per item in the next release)' : 'Other data types' }));
  return [{ key: OVERALL_KEY, label: 'Overall access', group: 'Overall' }, ...menu, ...extra];
}

/**
 * A person's own access: each data type shows their role's setting; change it
 * for this person only. Anything changed from the role shows in red.
 */
export function UserAccessDrawer({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.users.access>> | null>(null);
  const [draft, setDraft] = useState<Record<string, { level?: string; extent?: string }>>({});
  const [busy, setBusy] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);
  useEffect(() => { api.users.access(user.id).then((d) => { setData(d); setDraft(d.overrides || {}); }).catch((e: Error) => toast('⚠ ' + (e.message || 'Could not load'))); }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => (data ? dataTypes(data.rolePermissions) : []), [data]);
  const groups = useMemo(() => {
    const out: [string, typeof rows][] = [];
    for (const r of rows) { if (onlyChanged && !draft[r.key]) continue; const g = out.find(([n]) => n === r.group); if (g) g[1].push(r); else out.push([r.group, [r]]); }
    return out;
  }, [rows, draft, onlyChanged]);
  const set = (key: string, p: { level?: string; extent?: string }) => setDraft((d) => {
    const next = { ...d };
    const v = { ...(next[key] || {}), ...p };
    if (!v.level) delete v.level;
    if (!v.extent) delete v.extent;
    if (Object.keys(v).length) next[key] = v; else delete next[key];
    return next;
  });
  const save = async () => {
    setBusy(true);
    try { await api.users.setAccess(user.id, draft); toast(`Access saved for ${user.name}`); onSaved(); onClose(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };
  const changed = Object.keys(draft).length;
  return (
    <Drawer title={`Access — ${user.name}`} subtitle={data ? `Role: ${data.roleName}. Change any line for this person only; changed lines show in red. Takes effect when they next sign in.` : 'Loading…'} width={640} onClose={onClose}
      footer={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: changed ? '#B42318' : 'var(--muted)', fontWeight: 600 }}>{changed ? `${changed} changed from the role` : 'Same as the role'}</span>
        <span style={{ flex: 1 }} />
        {changed > 0 && <button type="button" className="ab-btn" onClick={() => setDraft({})}>Reset all to role</button>}
        <button type="button" className="ab-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ab-btn is-dark" disabled={busy || !data} onClick={save}>{busy ? 'Saving…' : 'Save access'}</button>
      </div>}>
      {!data ? <Skeleton label="Loading…" /> : (
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: 'var(--body)' }}>
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /> Show only what’s changed
          </label>
          {groups.map(([g, list]) => (
            <div key={g}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{g}</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {list.map((r) => {
                  const role = levelOf(data.rolePermissions, r.key);
                  const mine = draft[r.key];
                  const lv = (mine?.level as Level) || role.level;
                  const ex = (mine?.extent as Extent) || role.extent;
                  return (
                    <div key={r.key} className={'ab-acc-row' + (mine ? ' is-changed' : '')}>
                      <span className="ab-acc-name" title={lv ? LEVEL_HINT[lv] : ''}>{r.label}</span>
                      <span className="ab-acc-def">Role: {role.level ? LEVEL_LABEL[role.level] : '—'}{role.extent ? ` · ${role.extent === 'assigned' ? 'Assigned' : 'Portfolio'}` : ''}</span>
                      <select value={mine?.level || ''} onChange={(e) => set(r.key, { level: e.target.value })} aria-label={`${r.label} access for ${user.name}`}>
                        <option value="">Same as role</option>
                        {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                      </select>
                      <select value={mine?.extent || ''} onChange={(e) => set(r.key, { extent: e.target.value })} aria-label={`${r.label} extent for ${user.name}`}>
                        <option value="">{ex ? `Same (${ex === 'assigned' ? 'Assigned' : 'Portfolio'})` : 'Same as role'}</option>
                        <option value="assigned">Assigned projects</option>
                        <option value="portfolio">Portfolio</option>
                      </select>
                      {lv && <span className="ab-acc-now">{LEVEL_SHORT[lv]}{ex ? ` · ${ex === 'assigned' ? 'A' : 'P'}` : ''}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
