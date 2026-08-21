import { useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';
import {
  MODULES, TIERS, TIER_STYLE, STATUS_STYLE,
  type Role, type User, type Tier, type UserStatus,
} from '../data/users';

const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

const SECTIONS = [
  { group: 'Access', items: [{ key: 'users', label: 'Users' }, { key: 'roles', label: 'Roles & Permissions' }] },
];

export function Admin() {
  const isMobile = useWindowWidth() < 768;
  const { can } = useApp();
  const [active, setActive] = useState('users');
  const readOnly = !can('users', 'manage');

  const nav = (
    <div style={{ flexShrink: 0, width: isMobile ? '100%' : 240 }}>
      {SECTIONS.map((sec) => (
        <div key={sec.group} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93', padding: '0 12px 8px' }}>{sec.group}</div>
          {sec.items.map((it) => {
            const on = active === it.key;
            return (
              <div key={it.key} onClick={() => setActive(it.key)} style={{ padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', color: on ? '#0B1A12' : '#43514D', background: on ? '#E7F0E8' : 'transparent', borderLeft: '3px solid ' + (on ? '#2F7D4A' : 'transparent'), marginBottom: 2 }}>{it.label}</div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '4px 4px 40px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12', marginBottom: 4 }}>User Access &amp; Roles</div>
      <div style={{ fontSize: 13, color: '#5C6B65', marginBottom: 20 }}>Manage accounts (Internal, Client, Consultant) and the roles that control what each can see. New users are emailed a link to set their own password — until they use it, or sign in with Google, the account stays <strong>Pending</strong>.</div>
      {readOnly && <div style={{ fontSize: 12, color: '#8A6D12', background: '#FBE9AE', borderRadius: 8, padding: '8px 12px', marginBottom: 16, display: 'inline-block' }}>Your role has view-only access to this page.</div>}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 28, alignItems: 'flex-start' }}>
        {nav}
        <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
          {active === 'users' ? <UsersEditor readOnly={readOnly} /> : <RolesEditor readOnly={readOnly} />}
        </div>
      </div>
    </div>
  );
}

function pill(bg: string, color: string, label: string) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: bg, color }}>{label}</span>;
}

function UsersEditor({ readOnly }: { readOnly: boolean }) {
  const { users, roles, refreshAccess, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<User>>({ name: '', email: '', tier: 'internal', roleKey: '', status: 'pending' });
  // When the invitation email can't go out (Google not connected yet), we show
  // the link so an admin can pass it to the new user by other means.
  const [inviteNote, setInviteNote] = useState<{ email: string; sent: boolean; url?: string; error?: string } | null>(null);

  const rolesForTier = (tier: Tier) => roles.filter((r) => r.tier === tier);

  const saveNew = () => {
    if (!draft.name?.trim() || !draft.email?.trim() || !draft.roleKey) { toast('⚠ Name, email and role are required'); return; }
    api.users.create(draft)
      .then((res: any) => {
        const invite = res?.invite ?? { sent: false };
        setInviteNote({ email: draft.email!.trim(), ...invite });
        toast(invite.sent ? `Invitation emailed to ${draft.email!.trim()}` : 'User added — invitation not sent');
        setAdding(false);
        setDraft({ name: '', email: '', tier: 'internal', roleKey: '', status: 'pending' });
        refreshAccess();
      })
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Failed to add user')));
  };

  const resend = (u: User) => {
    api.users.resendInvite(u.id)
      .then((res: any) => {
        const invite = res?.invite ?? { sent: false };
        setInviteNote({ email: u.email, ...invite });
        toast(invite.sent ? `Invitation re-sent to ${u.email}` : 'Invitation not sent');
        refreshAccess();
      })
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Failed to send invitation')));
  };
  const patch = (u: User, p: Partial<User>) => {
    api.users.update(u.id, { ...u, ...p }).then(() => refreshAccess()).catch(() => toast('⚠ Failed to update'));
  };
  const del = (u: User) => { if (confirm(`Remove ${u.name}?`)) api.users.remove(u.id).then(() => { toast('User removed'); refreshAccess(); }).catch(() => toast('⚠ Failed')); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Users <span style={{ fontSize: 13, color: '#7E9B93', fontWeight: 600 }}>({users.length})</span></div>
        {!readOnly && <div onClick={() => setAdding((a) => !a)} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: adding ? '#EEF3EE' : '#173326', color: adding ? '#173326' : 'white' }}>{adding ? 'Cancel' : '+ Add user'}</div>}
      </div>

      {adding && !readOnly && (
        <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Name"><input style={{ ...inputStyle, width: 160 }} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Email"><input style={{ ...inputStyle, width: 200 }} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="Tier"><select style={{ ...inputStyle, width: 130 }} value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value as Tier, roleKey: '' })}>{TIERS.map((t) => <option key={t} value={t}>{TIER_STYLE[t].label}</option>)}</select></Field>
          <Field label="Role"><select style={{ ...inputStyle, width: 170 }} value={draft.roleKey} onChange={(e) => setDraft({ ...draft, roleKey: e.target.value })}><option value="">Select…</option>{rolesForTier(draft.tier as Tier).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></Field>
          <Field label="Status"><select style={{ ...inputStyle, width: 130 }} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as UserStatus })}>{(['active', 'pending', 'suspended'] as UserStatus[]).map((s) => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}</select></Field>
          <div onClick={saveNew} style={{ padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#2F7D4A', color: 'white' }}>Save</div>
        </div>
      )}

      {inviteNote && (
        <div style={{ background: inviteNote.sent ? '#D8ECD9' : '#FBE9AE', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: inviteNote.sent ? '#1E6B36' : '#8A6D12', flex: 1 }}>
              {inviteNote.sent
                ? `Invitation emailed to ${inviteNote.email} — they can set their password from the link.`
                : `Could not email ${inviteNote.email}${inviteNote.error ? ': ' + inviteNote.error : '.'}`}
            </div>
            <div onClick={() => setInviteNote(null)} style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D', cursor: 'pointer' }}>Dismiss</div>
          </div>
          {!inviteNote.sent && inviteNote.url && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8A6D12', marginBottom: 4 }}>Send them this link instead</div>
              <div style={{ fontSize: 11.5, color: '#0B1A12', wordBreak: 'break-all', background: 'white', borderRadius: 8, padding: '8px 10px' }}>{inviteNote.url}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map((u) => {
          const ts = TIER_STYLE[u.tier]; const ss = STATUS_STYLE[u.status];
          return (
            <div key={u.id} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 170, flex: '1 1 170px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12' }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: '#7E9B93' }}>{u.email}</div>
              </div>
              {readOnly ? (
                <>{pill(ts.bg, ts.color, ts.label)}{pill('#EDE3D0', '#0B1A12', roles.find((r) => r.key === u.roleKey)?.name || u.roleKey)}{pill(ss.bg, ss.color, ss.label)}</>
              ) : (
                <>
                  <select style={{ ...inputStyle, width: 130 }} value={u.tier} onChange={(e) => patch(u, { tier: e.target.value as Tier })}>{TIERS.map((t) => <option key={t} value={t}>{TIER_STYLE[t].label}</option>)}</select>
                  <select style={{ ...inputStyle, width: 170 }} value={u.roleKey} onChange={(e) => patch(u, { roleKey: e.target.value })}>{rolesForTier(u.tier).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}{!rolesForTier(u.tier).some((r) => r.key === u.roleKey) && <option value={u.roleKey}>{u.roleKey}</option>}</select>
                  <select style={{ ...inputStyle, width: 130 }} value={u.status} onChange={(e) => patch(u, { status: e.target.value as UserStatus })}>{(['active', 'pending', 'suspended'] as UserStatus[]).map((s) => <option key={s} value={s}>{STATUS_STYLE[s].label}</option>)}</select>
                  <div onClick={() => resend(u)} title={u.hasPassword ? 'Email a password reset link' : 'Re-send the invitation email'} style={{ fontSize: 12, fontWeight: 600, color: '#173326', cursor: 'pointer', padding: '6px 10px' }}>{u.hasPassword ? 'Reset password' : 'Resend invite'}</div>
                  <div onClick={() => del(u)} style={{ fontSize: 12, fontWeight: 600, color: '#8E2E0A', cursor: 'pointer', padding: '6px 10px' }}>Delete</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RolesEditor({ readOnly }: { readOnly: boolean }) {
  const { roles, refreshAccess, toast } = useApp();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = draft && draft.key === selectedKey ? draft : roles.find((r) => r.key === selectedKey) || null;

  const grouped = useMemo(() => {
    const byGroup: Record<string, typeof MODULES> = {};
    for (const m of MODULES) (byGroup[m.group] ||= []).push(m);
    return byGroup;
  }, []);

  const select = (r: Role) => { setSelectedKey(r.key); setDraft(JSON.parse(JSON.stringify(r))); };
  const setPerm = (moduleKey: string, action: 'view' | 'manage', val: boolean) => {
    if (!draft) return;
    const perms = { ...(draft.permissions || {}) };
    const prev = perms[moduleKey] || { view: false, manage: false };
    const cur = { view: prev.view, manage: prev.manage };
    cur[action] = val;
    if (action === 'manage' && val) cur.view = true;      // manage implies view
    if (action === 'view' && !val) cur.manage = false;    // no view ⇒ no manage
    perms[moduleKey] = cur;
    setDraft({ ...draft, permissions: perms });
  };
  const save = () => {
    if (!draft) return;
    setSaving(true);
    api.roles.update(draft.key, draft).then(() => { toast('Role saved'); refreshAccess(); }).catch(() => toast('⚠ Failed to save role')).finally(() => setSaving(false));
  };
  const addRole = () => {
    const name = prompt('New role name?'); if (!name) return;
    api.roles.create({ name, tier: 'internal', permissions: {} }).then(() => { toast('Role created'); refreshAccess(); }).catch(() => toast('⚠ Failed'));
  };
  const delRole = (r: Role) => { if (r.isSystem) { toast('System roles cannot be deleted'); return; } if (confirm(`Delete role "${r.name}"?`)) api.roles.remove(r.key).then(() => { toast('Role deleted'); setSelectedKey(null); setDraft(null); refreshAccess(); }).catch(() => toast('⚠ Failed')); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Roles &amp; Permissions</div>
        {!readOnly && <div onClick={addRole} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#D2EAD3', color: '#173326' }}>+ Add role</div>}
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* role list grouped by tier */}
        <div style={{ flex: '0 0 240px', minWidth: 220 }}>
          {TIERS.map((t) => (
            <div key={t} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: TIER_STYLE[t].color, marginBottom: 6 }}>{TIER_STYLE[t].label}</div>
              {roles.filter((r) => r.tier === t).map((r) => {
                const on = r.key === selectedKey;
                return (
                  <div key={r.key} onClick={() => select(r)} style={{ padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', color: on ? '#0B1A12' : '#43514D', background: on ? '#E7F0E8' : 'white', border: '1px solid rgba(20,8,31,0.06)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{r.name}</span>
                    {r.isSystem && <span style={{ fontSize: 8.5, color: '#7E9B93' }}>system</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* permission matrix for selected role */}
        <div style={{ flex: 1, minWidth: 280 }}>
          {!selected ? (
            <div style={{ fontSize: 13, color: '#7E9B93', padding: '20px 0' }}>Select a role to edit its permissions.</div>
          ) : (
            <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <input disabled={readOnly || selected.isSystem} value={selected.name} onChange={(e) => draft && setDraft({ ...draft, name: e.target.value })} style={{ ...inputStyle, width: '100%', fontWeight: 700, fontSize: 15 }} />
                  <input disabled={readOnly} value={selected.description || ''} placeholder="Description" onChange={(e) => draft && setDraft({ ...draft, description: e.target.value })} style={{ ...inputStyle, width: '100%', marginTop: 6, color: '#5C6B65' }} />
                </div>
                {pill(TIER_STYLE[selected.tier].bg, TIER_STYLE[selected.tier].color, TIER_STYLE[selected.tier].label)}
              </div>

              {selected.key === 'admin' ? (
                <div style={{ fontSize: 12.5, color: '#5C6B65', background: '#EEF3EE', borderRadius: 8, padding: '10px 12px' }}>The Administrator role always has full access to every module.</div>
              ) : (
                <div style={{ border: '1px solid rgba(20,8,31,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#F6F1E6', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7E9B93' }}>
                    <span style={{ flex: 1 }}>Module</span><span style={{ width: 56, textAlign: 'center' }}>View</span><span style={{ width: 66, textAlign: 'center' }}>Manage</span>
                  </div>
                  {Object.entries(grouped).map(([group, mods]) => (
                    <div key={group}>
                      <div style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 700, color: '#173326', background: '#FBF8F2' }}>{group}</div>
                      {mods.map((m) => {
                        const p = selected.permissions?.[m.key] || { view: false, manage: false };
                        return (
                          <div key={m.key} style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', borderTop: '1px solid rgba(20,8,31,0.04)' }}>
                            <span style={{ flex: 1, fontSize: 12.5, color: '#0B1A12' }}>{m.label}</span>
                            <span style={{ width: 56, textAlign: 'center' }}><input type="checkbox" disabled={readOnly} checked={!!p.view} onChange={(e) => setPerm(m.key, 'view', e.target.checked)} /></span>
                            <span style={{ width: 66, textAlign: 'center' }}><input type="checkbox" disabled={readOnly} checked={!!p.manage} onChange={(e) => setPerm(m.key, 'manage', e.target.checked)} /></span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {!readOnly && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <div onClick={saving ? undefined : save} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>{saving ? 'Saving…' : 'Save Role'}</div>
                  {!selected.isSystem && <div onClick={() => delRole(selected)} style={{ padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete role</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}
