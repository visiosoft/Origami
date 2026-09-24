import { useEffect, useState } from 'react';
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

interface Emp { id: string; name: string; email?: string; userId?: string }
type Dir = { projects: string[]; tier: string; goByName: string; pronouns: string };

/**
 * The People side of this employee (same record): which projects they can
 * see, their access tier, and how to address them. Saves as you go.
 */
export function DirectoryAccessCard({ employee, canManage }: { employee: Emp; canManage: boolean }) {
  const [person, setPerson] = useState<any | null | undefined>(undefined);
  const [projects, setProjects] = useState<string[]>([]);
  const [draft, setDraft] = useState<Dir>({ projects: [], tier: 'Internal', goByName: '', pronouns: '' });
  const [saved, setSaved] = useState<Dir | null>(null);
  useEffect(() => {
    api.people.list().then((r: any) => {
      const p = (Array.isArray(r) ? r : []).find((x: any) => x.employeeId === employee.id) || null;
      setPerson(p);
      if (p) { const d = { projects: p.projects || [], tier: p.tier || 'Internal', goByName: p.goByName || '', pronouns: p.pronouns || '' }; setDraft(d); setSaved(d); }
    }).catch(() => setPerson(null));
    api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).map((p: any) => p.name))).catch(() => { });
  }, [employee.id]);
  const auto = useAutosave<Dir>({
    draft, saved, resetKey: 'dir-' + employee.id + (person?.id ?? ''), enabled: canManage && !!person, label: 'directory',
    save: async (changes, { draft: d }) => { await api.people.update(person.id, changes); setSaved(d); return d; },
  });
  if (person === undefined) return <div style={card}><div style={title}>Directory &amp; access</div><div style={{ fontSize: 12, color: MUTED }}>Loading…</div></div>;
  if (!person) return <div style={card}><div style={title}>Directory &amp; access</div><div style={{ fontSize: 12, color: MUTED }}>Their People entry is being set up — refresh in a moment.</div></div>;
  const toggle = (name: string) => setDraft((d) => ({ ...d, projects: d.projects.includes(name) ? d.projects.filter((x) => x !== name) : [...d.projects, name] }));
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ ...title, flex: 1 }}>Directory &amp; access</div>
        {canManage && <SaveBar auto={auto} compact />}
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>The same person in People → {person.kind === 'Sub' ? 'Sub' : 'Staff'}. Name, email, phone and title come from this record.</div>
      <div>
        <div style={label}>Access tier</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Internal', 'Client', 'Consultant'].map((t) => <span key={t} onClick={() => canManage && setDraft((d) => ({ ...d, tier: t }))} style={chip(draft.tier === t)}>{t}</span>)}
        </div>
      </div>
      <div>
        <div style={label}>Projects they can access</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {projects.map((p) => <span key={p} onClick={() => canManage && toggle(p)} style={chip(draft.projects.includes(p))}>{p}</span>)}
          {!projects.length && <span style={{ fontSize: 12, color: MUTED }}>No projects yet.</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><div style={label}>Goes by</div><input disabled={!canManage} value={draft.goByName} onChange={(e) => setDraft({ ...draft, goByName: e.target.value })} placeholder="e.g. Jerry" style={input} /></div>
        <div><div style={label}>Pronouns</div><input disabled={!canManage} value={draft.pronouns} onChange={(e) => setDraft({ ...draft, pronouns: e.target.value })} placeholder="e.g. he/him" style={input} /></div>
      </div>
    </div>
  );
}

/**
 * Their sign-in to the platform (administrators only): invite them by email
 * with a role, change the role, or turn the login off when they leave.
 */
export function LoginCard({ employee, onChanged }: { employee: Emp; onChanged: () => Promise<unknown> | void }) {
  const { users, roles, refreshAccess, toast, authUser } = useApp();
  const isAdmin = authUser?.roleKey === 'admin';
  const user = users.find((u) => u.id === employee.userId) || (employee.email ? users.find((u) => u.email?.trim().toLowerCase() === employee.email!.trim().toLowerCase()) : undefined);
  const staffRoles = roles.filter((r) => r.tier === 'internal' && r.key !== 'vendor_portal').sort((a, b) => a.order - b.order);
  const [email, setEmail] = useState(employee.email || '');
  const [roleKey, setRoleKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  useEffect(() => { setEmail(employee.email || ''); setRoleKey(''); setLink(''); }, [employee.id]);
  if (!isAdmin) return null;

  const status = !user ? 'none' : user.status === 'suspended' ? 'off' : user.hasPassword ? 'active' : 'invited';
  const STATUS: Record<string, [string, string, string]> = {
    none: ['No login yet', '#EFEDE8', '#5C6B65'], invited: ['Invited — hasn’t set a password', '#FBF0CC', '#8A6D12'],
    active: ['Can sign in', '#D2EAD3', '#1E6B36'], off: ['Login turned off', '#F2DFD4', '#8E2E0A'],
  };
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); await refreshAccess(); await onChanged(); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); } finally { setBusy(false); } };
  const showInvite = (inv?: { sent: boolean; url?: string; error?: string }) => {
    if (inv?.sent) { setLink(''); toast('Invitation emailed'); } else { setLink(inv?.url || ''); toast(inv?.error ? '⚠ ' + inv.error : 'Login created — send them the link below'); }
  };
  const invite = () => run(async () => {
    const role = staffRoles.find((r) => r.key === roleKey);
    if (!email.trim() || !role) throw new Error('Pick a role and enter their email');
    const created: any = await api.users.create({ name: employee.name, email: email.trim(), roleKey: role.key, tier: role.tier });
    await api.employees.update(employee.id, { userId: created.id, ...(employee.email ? {} : { email: email.trim() }) });
    showInvite(created.invite);
  });
  const setRole = (key: string) => run(async () => {
    const role = staffRoles.find((r) => r.key === key);
    if (!user || !role) return;
    await api.users.update(user.id, { roleKey: role.key, tier: role.tier });
    if (employee.userId !== user.id) await api.employees.update(employee.id, { userId: user.id });
    toast(`Role changed to ${role.name}`);
  });
  const setOn = (on: boolean) => run(async () => { if (!user) return; await api.users.update(user.id, { status: on ? (user.hasPassword ? 'active' : 'pending') : 'suspended' }); toast(on ? 'Login turned back on' : 'Login turned off'); });
  const resend = () => run(async () => { if (!user) return; const r: any = await api.users.resendInvite(user.id); showInvite(r.invite); });
  const [text, bg, fg] = STATUS[status];

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ ...title, flex: 1 }}>Login</div>
        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>{text}</span>
      </div>
      {status === 'none' ? (
        <>
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>Give {employee.name.split(' ')[0]} a sign-in. They get an email to choose their own password.</div>
          <div><div style={label}>Email they’ll sign in with</div><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@origamidb.com" style={input} /></div>
          <div>
            <div style={label}>Role</div>
            <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} style={input}>
              <option value="">Choose a role…</option>
              {staffRoles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </div>
          <div onClick={busy ? undefined : invite} style={{ justifySelf: 'start', padding: '8px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white', opacity: busy || !roleKey || !email.trim() ? 0.55 : 1 }}>{busy ? 'Sending…' : 'Send invitation'}</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: INK }}>Signs in as <b>{user!.email}</b></div>
          <div>
            <div style={label}>Role</div>
            <select value={user!.roleKey} disabled={busy} onChange={(e) => setRole(e.target.value)} style={input}>
              {!staffRoles.some((r) => r.key === user!.roleKey) && <option value={user!.roleKey}>{user!.roleKey}</option>}
              {staffRoles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status === 'invited' && <span onClick={busy ? undefined : resend} style={chip(false)}>Resend invitation</span>}
            {status === 'active' && <span onClick={busy ? undefined : resend} style={chip(false)}>Send password reset</span>}
            {status === 'off'
              ? <span onClick={busy ? undefined : () => setOn(true)} style={chip(false)}>Turn login back on</span>
              : <span onClick={busy ? undefined : () => { if (confirm(`Turn off ${employee.name}'s login? Their records stay; they just can't sign in.`)) setOn(false); }} style={{ ...chip(false), color: '#8E2E0A' }}>Turn login off</span>}
          </div>
        </>
      )}
      {link && (
        <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
          The email couldn’t be sent from here — send them this link to set a password:
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ ...input, marginTop: 6, fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}
