import { useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import {
  MODULES, TIERS, TIER_STYLE, STATUS_STYLE, FIN_ACTIONS,
  type Role, type User, type Tier, type UserStatus,
} from '../data/users';
import './AccessBoard.css';

type Perms = Role['permissions'];
type Level = 0 | 1 | 2;
const TONES = ['#F3D9B1', '#CFE0CC', '#F2CFC4', '#D5DCE8', '#F5E3A1', '#E3D3EC', '#CFE5E4', '#EBD8C8'];
const toneFor = (s: string) => TONES[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const LEVEL_LABEL = ['No access', 'Can view', 'Can manage'];
const levelOf = (p?: { view?: boolean; manage?: boolean }): Level => (p?.manage ? 2 : p?.view ? 1 : 0);
const seen = (iso?: string) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return '';
  if (mins < 10) return 'Active now';
  if (mins < 60) return `Active ${mins} min ago`;
  const h = Math.round(mins / 60); if (h < 24) return `Active ${h} h ago`;
  const d = Math.round(h / 24); if (d < 45) return `Active ${d} d ago`;
  return 'Active ' + new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const BLANK: Partial<User> = { name: '', email: '', tier: 'internal', roleKey: '', status: 'pending' };

/**
 * User Access & Roles in the New look: people on the left (role picked
 * inline, invite / reset / remove), and on the right a grid of what each role
 * can do -- one column per role, one switch per module (no access, view,
 * manage). Grid edits collect until "Save changes".
 */
export function AccessBoard({ readOnly }: { readOnly: boolean }) {
  const { users, roles, refreshAccess, toast } = useApp();

  // ---- people ----
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<User>>(BLANK);
  const [saving, setSaving] = useState(false);
  const [inviteNote, setInviteNote] = useState<{ email: string; sent: boolean; url?: string; error?: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const rolesForTier = (t: Tier) => roles.filter((r) => r.tier === t).sort((a, b) => a.order - b.order);
  const roleName = (k: string) => roles.find((r) => r.key === k)?.name || k;
  const needle = q.trim().toLowerCase();
  const shownUsers = users
    .filter((u) => (tierFilter === 'all' || u.tier === tierFilter) && (!needle || `${u.name} ${u.email} ${roleName(u.roleKey)}`.toLowerCase().includes(needle)))
    .sort((a, b) => Number(a.roleKey !== 'admin') - Number(b.roleKey !== 'admin') || a.name.localeCompare(b.name));
  const activeCount = users.filter((u) => u.status === 'active').length;
  const pendingCount = users.filter((u) => u.status === 'pending' || u.invitePending).length;

  const saveNew = () => {
    if (saving) return;
    if (!draft.name?.trim() || !draft.email?.trim() || !draft.roleKey) { toast('⚠ Name, email and role are required'); return; }
    if (users.some((u) => u.email.trim().toLowerCase() === draft.email!.trim().toLowerCase())) { toast('⚠ That email already has an account'); return; }
    setSaving(true);
    api.users.create(draft)
      .then((res: any) => {
        const invite = res?.invite ?? { sent: false };
        setInviteNote({ email: draft.email!.trim(), ...invite });
        toast(invite.sent ? `Invitation emailed to ${draft.email!.trim()}` : 'User added — invitation not sent');
        setAdding(false); setDraft(BLANK); refreshAccess();
      })
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Failed to add user')))
      .finally(() => setSaving(false));
  };
  const resend = (u: User) => api.users.resendInvite(u.id)
    .then((res: any) => { const invite = res?.invite ?? { sent: false }; setInviteNote({ email: u.email, ...invite }); toast(invite.sent ? `Email sent to ${u.email}` : 'Email not sent'); refreshAccess(); })
    .catch((e: Error) => toast('⚠ ' + (e.message || 'Failed to send')));
  const patch = (u: User, p: Partial<User>) => api.users.update(u.id, { ...u, ...p })
    .then(() => { refreshAccess(); toast('User updated'); })
    .catch((e: Error) => { toast('⚠ ' + (e.message || 'Failed to update')); refreshAccess(); });
  const del = (u: User) => { if (confirm(`Remove ${u.name}? They will no longer be able to sign in.`)) api.users.remove(u.id).then(() => { toast('User removed'); refreshAccess(); }).catch(() => toast('⚠ Failed')); };

  // ---- roles grid ----
  const [tier, setTier] = useState<Tier>('internal');
  const [drafts, setDrafts] = useState<Record<string, Perms>>({});
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleModal, setRoleModal] = useState<{ key: string | null; name: string; description: string } | null>(null);

  const tierRoles = rolesForTier(tier);
  const permsOf = (r: Role): Perms => drafts[r.key] ?? r.permissions ?? {};
  const groups = useMemo(() => {
    const m: [string, typeof MODULES][] = [];
    for (const mod of MODULES) { const g = m.find(([k]) => k === mod.group); if (g) g[1].push(mod); else m.push([mod.group, [mod]]); }
    return m;
  }, []);
  const dirtyKeys = Object.keys(drafts).filter((k) => JSON.stringify(drafts[k]) !== JSON.stringify(roles.find((r) => r.key === k)?.permissions ?? {}));
  const edit = (r: Role, key: string, next: { view: boolean; manage: boolean }) => {
    if (readOnly || r.key === 'admin') return;
    setDrafts((d) => ({ ...d, [r.key]: { ...permsOf(r), [key]: next } }));
  };
  const cycle = (r: Role, key: string) => {
    const lv = ((levelOf(permsOf(r)[key]) + 1) % 3) as Level;
    edit(r, key, { view: lv >= 1, manage: lv === 2 });
  };
  const setGroup = (r: Role, mods: typeof MODULES, lv: Level) => {
    if (readOnly || r.key === 'admin') return;
    setDrafts((d) => {
      const p = { ...permsOf(r) };
      for (const m of mods) p[m.key] = { view: lv >= 1, manage: lv === 2 };
      return { ...d, [r.key]: p };
    });
  };
  const saveRoles = async () => {
    setSavingRoles(true);
    try {
      for (const k of dirtyKeys) { const r = roles.find((x) => x.key === k); if (r) await api.roles.update(k, { ...r, permissions: drafts[k] }); }
      toast(dirtyKeys.length === 1 ? 'Role saved' : `${dirtyKeys.length} roles saved`);
      setDrafts({}); refreshAccess();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Failed to save roles')); }
    finally { setSavingRoles(false); }
  };
  const saveRoleModal = () => {
    if (!roleModal) return;
    const name = roleModal.name.trim(); if (!name) { toast('⚠ Give the role a name'); return; }
    const req = roleModal.key
      ? (() => { const r = roles.find((x) => x.key === roleModal.key)!; return api.roles.update(r.key, { ...r, name, description: roleModal.description }); })()
      : api.roles.create({ name, description: roleModal.description, tier, permissions: {} });
    req.then(() => { toast(roleModal.key ? 'Role updated' : 'Role created'); setRoleModal(null); refreshAccess(); }).catch((e: Error) => toast('⚠ ' + (e.message || 'Failed')));
  };
  const deleteRole = (r: Role) => {
    if (r.isSystem) { toast('System roles cannot be deleted'); return; }
    const n = users.filter((u) => u.roleKey === r.key).length;
    if (n) { toast(`⚠ ${n} ${n === 1 ? 'person still has' : 'people still have'} this role — move them first`); return; }
    if (confirm(`Delete role "${r.name}"?`)) api.roles.remove(r.key).then(() => { toast('Role deleted'); setRoleModal(null); refreshAccess(); }).catch(() => toast('⚠ Failed'));
  };

  const Switch = ({ r, k, label }: { r: Role; k: string; label: string }) => {
    if (r.key === 'admin') return <span className="ab-check" title="Administrators can do everything" />;
    const lv = levelOf(permsOf(r)[k]);
    return (
      <button type="button" className={'ab-switch is-' + lv} disabled={readOnly}
        title={`${r.name} · ${label}: ${LEVEL_LABEL[lv]}${readOnly ? '' : ' — click to change'}`} aria-label={`${r.name}, ${label}: ${LEVEL_LABEL[lv]}`}
        onClick={() => cycle(r, k)}><i /></button>
    );
  };

  return (
    <div className="ab">
      <div className="ab-top">
        <div>
          <p>Who can sign in, and what each role is allowed to see and change.{readOnly && <b> Your role can view this page but not change it.</b>}</p>
        </div>
        {!readOnly && <button type="button" className="ab-invite" onClick={() => { setAdding((a) => !a); setDraft(BLANK); }}>{adding ? 'Cancel' : '+ Invite person'}</button>}
      </div>

      <div className="ab-grid">
        {/* People */}
        <section className="ab-card ab-people">
          <div className="ab-card-head">
            <div>
              <h2>People</h2>
              <span className="ab-sub">{users.length} accounts · {activeCount} active{pendingCount ? ` · ${pendingCount} invite${pendingCount === 1 ? '' : 's'} pending` : ''}</span>
            </div>
          </div>
          <div className="ab-tools">
            <div className="ab-seg">
              {(['all', ...TIERS] as (Tier | 'all')[]).map((t) => (
                <button type="button" key={t} className={tierFilter === t ? 'is-on' : ''} onClick={() => setTierFilter(t)}>
                  {t === 'all' ? 'All' : TIER_STYLE[t].label}<i>{t === 'all' ? users.length : users.filter((u) => u.tier === t).length}</i>
                </button>
              ))}
            </div>
            <input className="ab-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" />
          </div>

          {adding && !readOnly && (
            <div className="ab-form">
              <div className="ab-form-grid">
                <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></label>
                <label>Email<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
                <label>Type<select value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value as Tier, roleKey: '' })}>{TIERS.map((t) => <option key={t} value={t}>{TIER_STYLE[t].label}</option>)}</select></label>
                <label>Role<select value={draft.roleKey} onChange={(e) => setDraft({ ...draft, roleKey: e.target.value })}><option value="">Choose…</option>{rolesForTier(draft.tier as Tier).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
              </div>
              <div className="ab-form-foot">
                <span>They'll get an email with a link to set their password.</span>
                <button type="button" className="ab-btn is-dark" disabled={saving} onClick={saveNew}>{saving ? 'Sending…' : 'Send invite'}</button>
              </div>
            </div>
          )}

          {inviteNote && (
            <div className={'ab-note' + (inviteNote.sent ? '' : ' is-warn')}>
              <div className="ab-note-row">
                <span>{inviteNote.sent ? `Email sent to ${inviteNote.email} — they can set their password from the link.` : `Could not email ${inviteNote.email}${inviteNote.error ? ': ' + inviteNote.error : '.'}`}</span>
                <button type="button" className="ab-link" onClick={() => setInviteNote(null)}>Dismiss</button>
              </div>
              {!inviteNote.sent && inviteNote.url && <div className="ab-note-url"><small>Send them this link instead</small>{inviteNote.url}</div>}
            </div>
          )}

          <div className="ab-list">
            {!shownUsers.length && <div className="ab-empty">No one matches.</div>}
            {shownUsers.map((u, i) => {
              const status = u.status === 'suspended' ? <span className="ab-pill is-grey">Suspended</span>
                : u.status === 'pending' || u.invitePending ? <span className="ab-pill is-yellow"><i />Invite pending</span>
                  : <span className="ab-seen">{seen(u.lastLogin) || 'Active'}</span>;
              const open = editing === u.id;
              return (
                <div key={u.id} className={'ab-person' + (open ? ' is-open' : '')} style={{ animationDelay: Math.min(i, 12) * 0.03 + 's' }}>
                  <div className="ab-person-row">
                    <span className="ab-avatar" style={{ background: toneFor(u.name) }}>{initials(u.name)}</span>
                    <span className="ab-who">
                      <b>{u.name}</b>
                      <small>{u.email}{u.tier !== 'internal' ? ` · ${TIER_STYLE[u.tier].label}` : ''}</small>
                      <span className="ab-status">{status}</span>
                    </span>
                    {u.roleKey === 'admin' || readOnly
                      ? <span className={'ab-role' + (u.roleKey === 'admin' ? ' is-owner' : '')}>{u.roleKey === 'admin' && <i />}{roleName(u.roleKey)}</span>
                      : (
                        <select className="ab-role-select" value={u.roleKey} onChange={(e) => patch(u, { roleKey: e.target.value })} aria-label={`Role for ${u.name}`}>
                          {rolesForTier(u.tier).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                          {!rolesForTier(u.tier).some((r) => r.key === u.roleKey) && <option value={u.roleKey}>{u.roleKey}</option>}
                        </select>
                      )}
                    {!readOnly && (
                      <span className="ab-actions">
                        <button type="button" className="ab-icon" title={u.hasPassword ? 'Email a password reset link' : 'Re-send the invitation'} onClick={() => resend(u)}>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="m3 7 9 6 9-6" /></svg>
                        </button>
                        <button type="button" className={'ab-icon' + (open ? ' is-on' : '')} title="Edit details" onClick={() => setEditing(open ? null : u.id)}>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                        </button>
                        <button type="button" className="ab-icon is-danger" title="Remove" onClick={() => del(u)}>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                        </button>
                      </span>
                    )}
                  </div>
                  {open && !readOnly && (
                    <div className="ab-edit">
                      {/* Name and email save when you leave the field, only if they changed. */}
                      <label>Name<input defaultValue={u.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.name) patch(u, { name: v }); else e.target.value = u.name; }} /></label>
                      <label>Email<input defaultValue={u.email} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.email) patch(u, { email: v }); else e.target.value = u.email; }} /></label>
                      <label>Type<select value={u.tier} onChange={(e) => patch(u, { tier: e.target.value as Tier })}>{TIERS.map((t) => <option key={t} value={t}>{TIER_STYLE[t].label}</option>)}</select></label>
                      <label>Status<select value={u.status} onChange={(e) => patch(u, { status: e.target.value as UserStatus })}>{(['active', 'pending', 'suspended'] as UserStatus[]).map((s) => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}</select></label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* What each role can do */}
        <section className="ab-card ab-roles">
          <div className="ab-card-head">
            <div>
              <h2>What each role can do</h2>
              <span className="ab-sub">Administrators can do everything. Click a switch to change it: off, view, manage.</span>
            </div>
            {!readOnly && <button type="button" className="ab-btn" onClick={() => setRoleModal({ key: null, name: '', description: '' })}>+ Role</button>}
          </div>
          <div className="ab-tools">
            <div className="ab-seg">
              {TIERS.map((t) => (
                <button type="button" key={t} className={tier === t ? 'is-on' : ''} onClick={() => setTier(t)}>{TIER_STYLE[t].label}<i>{rolesForTier(t).length}</i></button>
              ))}
            </div>
            <span className="ab-legend"><span className="ab-switch is-0"><i /></span>Off<span className="ab-switch is-1"><i /></span>View<span className="ab-switch is-2"><i /></span>Manage</span>
          </div>

          <div className="ab-matrix-wrap">
            <table className="ab-matrix">
              <thead>
                <tr>
                  <th className="ab-mod">Permission</th>
                  {tierRoles.map((r) => (
                    <th key={r.key}>
                      <button type="button" className="ab-role-head" disabled={readOnly && r.key !== 'admin'}
                        onClick={() => r.key !== 'admin' && !readOnly && setRoleModal({ key: r.key, name: r.name, description: r.description || '' })}
                        title={r.description || r.name}>
                        <span>{r.name}</span>
                        <small>{users.filter((u) => u.roleKey === r.key).length} people</small>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([g, mods]) => {
                  const isClosed = closed.has(g);
                  return [
                    <tr key={'g' + g} className="ab-group">
                      <td className="ab-mod">
                        <button type="button" onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
                          <span className={'ab-caret' + (isClosed ? '' : ' is-open')}>›</span>{g}<small>{mods.length}</small>
                        </button>
                      </td>
                      {tierRoles.map((r) => {
                        const p = permsOf(r);
                        const on = mods.filter((m) => levelOf(p[m.key]) > 0).length;
                        const all = mods.every((m) => levelOf(p[m.key]) === 2);
                        return (
                          <td key={r.key}>
                            {r.key === 'admin' ? <small className="ab-count">All</small> : (
                              <button type="button" className="ab-count" disabled={readOnly} title={readOnly ? '' : all ? 'Turn the whole group off' : 'Allow managing the whole group'}
                                onClick={() => setGroup(r, mods, all ? 0 : 2)}>{on}/{mods.length}</button>
                            )}
                          </td>
                        );
                      })}
                    </tr>,
                    ...(isClosed ? [] : mods.map((m) => (
                      <tr key={m.key}>
                        <td className="ab-mod">{m.label}</td>
                        {tierRoles.map((r) => <td key={r.key}><Switch r={r} k={m.key} label={m.label} /></td>)}
                      </tr>
                    ))),
                  ];
                })}
                {tier === 'internal' && [
                  <tr key="gfin" className="ab-group">
                    <td className="ab-mod"><button type="button" onClick={() => setClosed((s) => { const n = new Set(s); if (n.has('$fin')) n.delete('$fin'); else n.add('$fin'); return n; })}>
                      <span className={'ab-caret' + (closed.has('$fin') ? '' : ' is-open')}>›</span>Finance actions<small>{FIN_ACTIONS.length}</small></button></td>
                    {tierRoles.map((r) => <td key={r.key} />)}
                  </tr>,
                  ...(closed.has('$fin') ? [] : FIN_ACTIONS.map(([key, name, hint]) => (
                    <tr key={key}>
                      <td className="ab-mod">{name}<small>{hint}</small></td>
                      {tierRoles.map((r) => {
                        if (r.key === 'admin') return <td key={r.key}><span className="ab-check" /></td>;
                        const p = permsOf(r); const own = p[key];
                        const on = own ? !!own.manage : !!p.fin_project?.manage;
                        return (
                          <td key={r.key}>
                            <button type="button" className={'ab-toggle' + (on ? ' is-on' : '') + (own ? '' : ' is-inherited')} disabled={readOnly}
                              title={`${r.name} · ${name}: ${on ? 'allowed' : 'not allowed'}${own ? '' : ' (follows Project Finance “manage”)'}`}
                              onClick={() => edit(r, key, { view: !on || !!own?.view, manage: !on })}><i /></button>
                          </td>
                        );
                      })}
                    </tr>
                  ))),
                ]}
              </tbody>
            </table>
          </div>

          {dirtyKeys.length > 0 && (
            <div className="ab-savebar">
              <span>Unsaved changes in {dirtyKeys.map((k) => roleName(k)).join(', ')}</span>
              <button type="button" className="ab-btn" onClick={() => setDrafts({})} disabled={savingRoles}>Discard</button>
              <button type="button" className="ab-btn is-yellow" onClick={saveRoles} disabled={savingRoles}>{savingRoles ? 'Saving…' : 'Save changes'}</button>
            </div>
          )}
        </section>
      </div>

      {roleModal && (
        <div className="ab-modal-bg" onClick={() => setRoleModal(null)}>
          <div className="ab-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={roleModal.key ? 'Edit role' : 'New role'}>
            <h3>{roleModal.key ? 'Edit role' : `New ${TIER_STYLE[tier].label.toLowerCase()} role`}</h3>
            {(() => { const r = roleModal.key ? roles.find((x) => x.key === roleModal.key) : null; return (
              <>
                <label>Name<input value={roleModal.name} disabled={!!r?.isSystem} onChange={(e) => setRoleModal({ ...roleModal, name: e.target.value })} autoFocus /></label>
                {r?.isSystem && <small className="ab-sub">Built-in role — its name can't change.</small>}
                <label>Description<input value={roleModal.description} onChange={(e) => setRoleModal({ ...roleModal, description: e.target.value })} placeholder="What this role is for" /></label>
                {!roleModal.key && <small className="ab-sub">It starts with no access; switch on what it needs in the grid.</small>}
                <div className="ab-modal-foot">
                  {r && !r.isSystem && <button type="button" className="ab-btn is-danger" onClick={() => deleteRole(r)}>Delete role</button>}
                  <span style={{ flex: 1 }} />
                  <button type="button" className="ab-btn" onClick={() => setRoleModal(null)}>Cancel</button>
                  <button type="button" className="ab-btn is-dark" onClick={saveRoleModal}>{roleModal.key ? 'Save' : 'Create role'}</button>
                </div>
              </>
            ); })()}
          </div>
        </div>
      )}
    </div>
  );
}
