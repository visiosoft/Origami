import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { SaveBar, useAutosave } from '../autosave';

const MUTED = '#7E9B93';
const INK = '#0B1A12';
const ACCENT = '#173326';
const card: React.CSSProperties = { background: 'white', border: '1px solid rgba(20,8,31,.09)', borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 12, alignContent: 'start' };
const title: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: INK };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 };
const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.13)', background: 'white', fontFamily: 'inherit', fontSize: 13, color: INK, outline: 'none' };
const chip = (on: boolean): React.CSSProperties => ({ padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (on ? ACCENT : 'rgba(20,8,31,.14)'), background: on ? ACCENT : 'white', color: on ? 'white' : INK });
const realEmail = (e?: string | null) => { const t = (e || '').trim(); return t && t !== '—' && t.includes('@') ? t : ''; };

interface Emp { id: string; name: string; email?: string; userId?: string }
type Dir = { projects: string[]; tier: string; goByName: string; pronouns: string };

/**
 * The People side of a record (same record): which projects they can see,
 * their access tier, and how to address them. Saves as you go. Found by the
 * employee (staff, workers) or the contractor (sub companies) it belongs to.
 */
export function DirectoryAccessCard({ employee, contractorId, canManage }: { employee?: Emp; contractorId?: string; canManage: boolean }) {
  const [person, setPerson] = useState<any | null | undefined>(undefined);
  const [projects, setProjects] = useState<string[]>([]);
  const [draft, setDraft] = useState<Dir>({ projects: [], tier: 'Internal', goByName: '', pronouns: '' });
  const [saved, setSaved] = useState<Dir | null>(null);
  const key = employee?.id || contractorId || '';
  useEffect(() => {
    api.people.list().then((r: any) => {
      const list = Array.isArray(r) ? r : [];
      const p = (employee ? list.find((x: any) => x.employeeId === employee.id) : list.find((x: any) => x.contractorId === contractorId && !x.employeeId)) || null;
      setPerson(p);
      if (p) { const d = { projects: p.projects || [], tier: p.tier || 'Internal', goByName: p.goByName || '', pronouns: p.pronouns || '' }; setDraft(d); setSaved(d); }
    }).catch(() => setPerson(null));
    api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).map((p: any) => p.name))).catch(() => { });
  }, [key]);
  const auto = useAutosave<Dir>({
    draft, saved, resetKey: 'dir-' + key + (person?.id ?? ''), enabled: canManage && !!person, label: 'directory',
    save: async (changes, { draft: d }) => { await api.people.update(person.id, changes); setSaved(d); return d; },
  });
  if (person === undefined) return <div style={card}><div style={title}>Directory &amp; access</div><div style={{ fontSize: 12, color: MUTED }}>Loading…</div></div>;
  if (!person) return <div style={card}><div style={title}>Directory &amp; access</div><div style={{ fontSize: 12, color: MUTED }}>Their People entry is being set up — refresh in a moment.</div></div>;
  const toggle = (name: string) => setDraft((d) => ({ ...d, projects: d.projects.includes(name) ? d.projects.filter((x) => x !== name) : [...d.projects, name] }));
  const company = !!contractorId && !employee;
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ ...title, flex: 1 }}>Directory &amp; access</div>
        {canManage && <SaveBar auto={auto} compact />}
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
        The same {company ? 'company' : 'person'} in People → {person.kind === 'Sub' ? 'Sub' : 'Staff'}. {company ? 'Firm name, contact, phone and email' : 'Name, email, phone and title'} come from this record.
      </div>
      {!company && (
        <div>
          <div style={label}>Access tier</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Internal', 'Client', 'Consultant'].map((t) => <span key={t} onClick={() => canManage && setDraft((d) => ({ ...d, tier: t }))} style={chip(draft.tier === t)}>{t}</span>)}
          </div>
        </div>
      )}
      <div>
        <div style={label}>Projects they’re on</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {projects.map((p) => <span key={p} onClick={() => canManage && toggle(p)} style={chip(draft.projects.includes(p))}>{p}</span>)}
          {!projects.length && <span style={{ fontSize: 12, color: MUTED }}>No projects yet.</span>}
        </div>
      </div>
      {!company && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div style={label}>Goes by</div><input disabled={!canManage} value={draft.goByName} onChange={(e) => setDraft({ ...draft, goByName: e.target.value })} placeholder="e.g. Jerry" style={input} /></div>
          <div><div style={label}>Pronouns</div><input disabled={!canManage} value={draft.pronouns} onChange={(e) => setDraft({ ...draft, pronouns: e.target.value })} placeholder="e.g. he/him" style={input} /></div>
        </div>
      )}
    </div>
  );
}

/** Whose login this is -- decides which roles fit. Staff = the office; the rest are People kinds. */
export type LoginKind = 'Staff' | 'Client' | 'Consultant' | 'Sub' | 'Authority' | 'Vendor';

/** The two ways a subcontractor can sign in (the admin picks per sub). */
const SUB_ROLE_TEXT: Record<string, [string, string]> = {
  vendor_portal: ['Subcontractor portal', 'Their subcontracts, bills, payments and shared files — nothing else in the app.'],
  subcontractor: ['Project access', 'Tasks, schedule and plan room on the projects ticked on this record.'],
};
const DEFAULT_ROLE: Record<string, string> = { Sub: 'vendor_portal', Client: 'client', Consultant: 'consultant', Authority: 'authority', Vendor: 'consultant' };

/**
 * A sign-in to the platform (administrators only), for anyone -- staff,
 * clients, subs, consultants: invite them by email with a role (they choose
 * their own password), change the role, resend or reset, or turn the login
 * off. Which roles are offered depends on who they are; a sub is either on
 * the Subcontractor portal or has project access.
 */
export function LoginCard({ employee, subject, kind = 'Staff', projects, onLink, onChanged }: {
  /** Staff / workers: their employee record (the link is saved there). */
  employee?: Emp;
  /** Anyone else: their People record. */
  subject?: { id: string | number; name: string; email?: string; userId?: string };
  kind?: LoginKind;
  /** The projects on their People record -- outside logins see only these. */
  projects?: string[];
  /** Save the login on the record (defaults to the employee record). */
  onLink?: (userId: string, email?: string) => Promise<unknown>;
  onChanged: () => Promise<unknown> | void;
}) {
  const { users, roles, refreshAccess, toast, authUser } = useApp();
  const who = (employee || subject)!;
  const isAdmin = authUser?.roleKey === 'admin';
  const link = onLink || (async (userId: string, email?: string) => api.employees.update(String(employee!.id), { userId, ...(email ? { email } : {}) }));
  const staff = kind === 'Staff';
  const options = roles.filter((r) =>
    staff ? r.tier === 'internal' && r.key !== 'vendor_portal'
      : kind === 'Client' ? r.tier === 'client'
        : kind === 'Sub' ? r.key === 'vendor_portal' || r.key === 'subcontractor'
          : r.tier === 'consultant' && r.key !== 'vendor_portal' && r.key !== 'subcontractor',
  ).sort((a, b) => (kind === 'Sub' ? (a.key === 'vendor_portal' ? -1 : b.key === 'vendor_portal' ? 1 : 0) : 0) || a.order - b.order);
  const nameOf = (key: string) => SUB_ROLE_TEXT[key]?.[0] || roles.find((r) => r.key === key)?.name || key;
  const hintOf = (key: string) => SUB_ROLE_TEXT[key]?.[1] || roles.find((r) => r.key === key)?.description || '';

  const byId = users.find((u) => u.id === who.userId);
  const byEmail = !byId && realEmail(who.email) ? users.find((u) => u.email?.trim().toLowerCase() === realEmail(who.email).toLowerCase()) : undefined;
  const user = byId || byEmail;
  const [email, setEmail] = useState(realEmail(who.email));
  const [roleKey, setRoleKey] = useState(staff ? '' : DEFAULT_ROLE[kind] || '');
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  useEffect(() => { setEmail(realEmail(who.email)); setRoleKey(staff ? '' : DEFAULT_ROLE[kind] || ''); setInviteLink(''); }, [who.id]);
  // A login that already exists under their email is theirs: link it to the record once.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!isAdmin || !byEmail || linked.current === byEmail.id) return;
    linked.current = byEmail.id;
    void Promise.resolve(link(byEmail.id)).then(() => onChanged()).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byEmail?.id, isAdmin]);
  if (!isAdmin) return null;

  const status = !user ? 'none' : user.status === 'suspended' ? 'off' : user.hasPassword ? 'active' : 'invited';
  const STATUS: Record<string, [string, string, string]> = {
    none: ['No login yet', '#EFEDE8', '#5C6B65'], invited: ['Invited — hasn’t set a password', '#FBF0CC', '#8A6D12'],
    active: ['Can sign in', '#D2EAD3', '#1E6B36'], off: ['Login turned off', '#F2DFD4', '#8E2E0A'],
  };
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await refreshAccess(); await onChanged(); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); } finally { setBusy(false); } };
  const showInvite = (inv?: { sent: boolean; url?: string; error?: string }) => {
    if (inv?.sent) { setInviteLink(''); toast('Invitation emailed'); } else { setInviteLink(inv?.url || ''); toast(inv?.error ? '⚠ ' + inv.error : 'Login created — send them the link below'); }
  };
  const invite = () => run(async () => {
    const role = options.find((r) => r.key === roleKey);
    if (!email.trim() || !role) throw new Error('Pick a role and enter their email');
    const created: any = await api.users.create({ name: who.name, email: email.trim(), roleKey: role.key, tier: role.tier });
    await link(created.id, realEmail(who.email) ? undefined : email.trim());
    showInvite(created.invite);
  });
  const setRole = (key: string) => run(async () => {
    const role = options.find((r) => r.key === key);
    if (!user || !role) return;
    await api.users.update(user.id, { roleKey: role.key, tier: role.tier });
    if (who.userId !== user.id) await link(user.id);
    toast(`Now: ${nameOf(role.key)}`);
  });
  const setOn = (on: boolean) => run(async () => { if (!user) return; await api.users.update(user.id, { status: on ? (user.hasPassword ? 'active' : 'pending') : 'suspended' }); toast(on ? 'Login turned back on' : 'Login turned off'); });
  const resend = () => run(async () => { if (!user) return; const r: any = await api.users.resendInvite(user.id); showInvite(r.invite); });
  const [text, bg, fg] = STATUS[status];
  const current = user?.roleKey || roleKey;
  const noProjects = !staff && current !== 'vendor_portal' && projects !== undefined && projects.length === 0;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ ...title, flex: 1 }}>Login</div>
        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>{text}</span>
      </div>
      {status === 'none' ? (
        <>
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>Give {who.name.split(' ')[0]} a sign-in. They get an email to choose their own password.</div>
          <div><div style={label}>Email they’ll sign in with</div><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={staff ? 'name@origamidb.com' : 'name@company.com'} style={input} /></div>
          <div>
            <div style={label}>{kind === 'Sub' ? 'What they get' : 'Role'}</div>
            <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} style={input}>
              {staff && <option value="">Choose a role…</option>}
              {options.map((r) => <option key={r.key} value={r.key}>{nameOf(r.key)}</option>)}
            </select>
            {roleKey && hintOf(roleKey) && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 5, lineHeight: 1.45 }}>{hintOf(roleKey)}</div>}
          </div>
          {noProjects && <div style={{ fontSize: 11.5, color: '#8A6D12', lineHeight: 1.45 }}>No projects ticked on this record yet — they’ll sign in to an empty screen until you add one.</div>}
          <div onClick={busy ? undefined : invite} style={{ justifySelf: 'start', padding: '8px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white', opacity: busy || !roleKey || !email.trim() ? 0.55 : 1 }}>{busy ? 'Sending…' : 'Send invitation'}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: INK }}>Signs in as <b>{user!.email}</b></div>
          <div>
            <div style={label}>{kind === 'Sub' ? 'What they get' : 'Role'}</div>
            <select value={user!.roleKey} disabled={busy} onChange={(e) => setRole(e.target.value)} style={input}>
              {!options.some((r) => r.key === user!.roleKey) && <option value={user!.roleKey}>{nameOf(user!.roleKey)}</option>}
              {options.map((r) => <option key={r.key} value={r.key}>{nameOf(r.key)}</option>)}
            </select>
            {hintOf(user!.roleKey) && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 5, lineHeight: 1.45 }}>{hintOf(user!.roleKey)}</div>}
          </div>
          {noProjects && <div style={{ fontSize: 11.5, color: '#8A6D12', lineHeight: 1.45 }}>No projects ticked on this record — they won’t see any until you add one.</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status === 'invited' && <span onClick={busy ? undefined : resend} style={chip(false)}>Resend invitation</span>}
            {status === 'active' && <span onClick={busy ? undefined : resend} style={chip(false)}>Send password reset</span>}
            {status === 'off'
              ? <span onClick={busy ? undefined : () => setOn(true)} style={chip(false)}>Turn login back on</span>
              : <span onClick={busy ? undefined : () => { if (confirm(`Turn off ${who.name}'s login? Their records stay; they just can't sign in.`)) setOn(false); }} style={{ ...chip(false), color: '#8E2E0A' }}>Turn login off</span>}
          </div>
        </>
      )}
      {inviteLink && (
        <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
          The email couldn’t be sent from here — send them this link to set a password:
          <input readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} style={{ ...input, marginTop: 6, fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}
