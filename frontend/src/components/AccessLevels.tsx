import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { parseCsv } from '../data/csv';
import { EXTENT_LABEL, LEVELS, LEVEL_HINT, LEVEL_LABEL, LEVEL_SHORT, OVERALL_KEY, dataTypeLabel, levelOf, type Extent, type Level } from '../data/accessLevels';
import { MODULES, TIER_STYLE, type Role, type RolePermissions, type Tier, type User } from '../data/users';
import { Drawer } from './manpowerUi';

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
      {!data ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div> : (
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

/**
 * Import the PEOPLE ACCESS sheet: read it, preview the roles (and what each
 * maps onto) and the accounts, then apply -- creating roles, and accounts with
 * an invite.
 */
export function AccessImport({ roles, onClose, onDone }: { roles: Role[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [plan, setPlan] = useState<any | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [invite, setInvite] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any | null>(null);

  const preview = async (r: string[][], m: Record<string, string>, opts = { invite, updateExisting }) => {
    setBusy(true);
    try { const p = await api.roles.importMatrix(r, { dryRun: true, mapping: m, ...opts }); setPlan(p); setMapping(Object.fromEntries(p.roles.map((x: any) => [x.sheetKey, x.target]))); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not read the sheet')); }
    finally { setBusy(false); }
  };
  const pick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      // Excel goes through the connected Google account (as the People import does); CSV is read here.
      const text = /\.csv$/i.test(file.name) ? await file.text() : ((await api.people.importConvert(file)) as any)?.csv ?? '';
      const r = parseCsv(String(text));
      setRows(r);
      await preview(r, {});
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not read the file')); setBusy(false); }
  };
  const apply = async () => {
    if (!rows) return;
    setBusy(true);
    try { const r = await api.roles.importMatrix(rows, { dryRun: false, mapping, invite, updateExisting }); setDone(r); toast('Access sheet imported'); onDone(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Import failed')); }
    finally { setBusy(false); }
  };
  const target = (tier: Tier) => roles.filter((r) => r.tier === tier || r.key === 'admin');
  const ACTION: Record<string, string> = { create: 'New role', update: 'Update role', keep_admin: 'Administrator (full access)', skip: 'Skip' };

  return (
    <Drawer title="Import access sheet" subtitle="The PEOPLE ACCESS spreadsheet: roles across, data types down. Nothing changes until you press Import." width={860} onClose={onClose}
      footer={!done ? <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Email new accounts an invite</label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={updateExisting} onChange={(e) => { setUpdateExisting(e.target.checked); if (rows) void preview(rows, mapping, { invite, updateExisting: e.target.checked }); }} /> Move existing accounts to the sheet’s role</label>
        <span style={{ flex: 1 }} />
        <button type="button" className="ab-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ab-btn is-dark" disabled={!plan || busy} onClick={apply}>{busy ? 'Working…' : 'Import'}</button>
      </div> : <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="ab-btn is-dark" onClick={onClose}>Done</button></div>}>
      <div style={{ display: 'grid', gap: 14 }}>
        {!plan && (
          <label className="ab-btn" style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            {busy ? 'Reading…' : 'Choose the spreadsheet (.xlsx or .csv)'}
            <input type="file" accept=".xlsx,.xls,.ods,.csv" style={{ display: 'none' }} onChange={(e) => { void pick(e.target.files?.[0] || null); e.target.value = ''; }} aria-label="Access sheet" />
          </label>
        )}
        {done && (
          <div className="ab-note">
            <b>Imported.</b> {done.roles.filter((r: any) => r.action === 'create' || r.action === 'update').length} roles set up.
            {(done.results || []).length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{done.results.map((r: any) => <li key={r.email}>{r.email} — {r.result}</li>)}</ul>}
          </div>
        )}
        {plan && (
          <>
            <div style={{ fontSize: 13, color: 'var(--body)' }}>{plan.roles.length} roles · {plan.dataTypes.length} data types · {plan.users.length} accounts named. Passwords in the sheet are ignored — new accounts get an invite to set their own.</div>
            <table className="ab-imp">
              <thead><tr><th>Role in the sheet</th><th>Type</th><th>Overall</th><th>Becomes</th></tr></thead>
              <tbody>
                {plan.roles.map((r: any) => (
                  <tr key={r.sheetKey}>
                    <td><b>{r.name}</b><small>{[r.rank, r.classification].filter(Boolean).join(' · ')}</small></td>
                    <td>{TIER_STYLE[r.tier as Tier]?.label || r.tier}</td>
                    <td>{r.overall?.level ? `${LEVEL_LABEL[r.overall.level as Level]} · ${r.extent === 'assigned' ? 'Assigned' : 'Portfolio'}` : '—'}</td>
                    <td>
                      <select disabled={!!done} value={mapping[r.sheetKey] || 'new'} onChange={(e) => { const m = { ...mapping, [r.sheetKey]: e.target.value }; setMapping(m); if (rows) void preview(rows, m); }} aria-label={`What ${r.name} becomes`}>
                        <option value="new">{roles.some((x) => x.key === r.sheetKey) ? 'Update its role' : 'New role'}</option>
                        {target(r.tier).filter((x) => x.key !== r.sheetKey).map((x) => <option key={x.key} value={x.key}>{x.key === 'admin' ? 'Administrator (full access)' : `Existing: ${x.name}`}</option>)}
                        <option value="skip">Skip</option>
                      </select>
                      <small>{ACTION[r.action] || r.action}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="ab-imp">
              <thead><tr><th>Account</th><th>Role</th><th>What happens</th></tr></thead>
              <tbody>
                {plan.users.map((u: any) => (
                  <tr key={u.email}>
                    <td>{u.email}{u.alsoIn.length > 0 && <small>also listed for {u.alsoIn.join(', ')} — one account gets one role</small>}</td>
                    <td>{u.roleName}</td>
                    <td>{u.action === 'create' ? (invite ? 'Create · invite' : 'Create (no email)') : u.action === 'update' ? `Move from ${u.current}` : u.action === 'skip' ? 'Skip' : `No change${u.note ? ' — ' + u.note : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.unmatched.length > 0 && <div className="ab-note is-warn">Rows not recognised (left out): {plan.unmatched.join(' · ')}</div>}
          </>
        )}
      </div>
    </Drawer>
  );
}
