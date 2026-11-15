import { useEffect, useRef, useState } from 'react';
import { api, viewAs } from '../api';

/** Start or stop viewing as: everything is fetched again as that role or person. */
const switchTo = (v: string | null) => { viewAs.set(v); window.location.reload(); };

/**
 * View as (Nov 13): an administrator picks a role, or a person, and sees the
 * app as them -- their menus, projects and data -- read-only. The server
 * answers as that role or person and refuses changes.
 */
export function ViewAsPicker() {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<{ key: string; name: string; tier: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; roleKey: string; tier: string; status: string }[]>([]);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    (api.roles.list() as Promise<any>).then((r) => setRoles(Array.isArray(r) ? r : [])).catch(() => undefined);
    (api.users.list() as Promise<any>).then((r) => setUsers(Array.isArray(r) ? r : [])).catch(() => undefined);
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const qn = q.trim().toLowerCase();
  const people = users.filter((u) => u.roleKey !== 'admin' && u.status !== 'suspended' && (!qn || `${u.name} ${u.email}`.toLowerCase().includes(qn))).slice(0, 30);
  const roleRows = roles.filter((r) => r.key !== 'admin' && (!qn || r.name.toLowerCase().includes(qn)));
  const tierLabel: Record<string, string> = { internal: 'Staff', client: 'Client', consultant: 'Outside' };
  return (
    <div ref={box} className="view-as">
      <button type="button" className="view-as-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)} title="See the app as a role or a person (read-only)">View as…</button>
      {open && (
        <div className="view-as-pop" role="dialog" aria-label="View as">
          <input autoFocus placeholder="Find a role or person…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a role or person" />
          <div className="view-as-list">
            {roleRows.length > 0 && <div className="view-as-head">Roles</div>}
            {roleRows.map((r) => <button key={r.key} type="button" onClick={() => switchTo(`role:${r.key}`)}>{r.name}<span>{tierLabel[r.tier] || r.tier}</span></button>)}
            {people.length > 0 && <div className="view-as-head">People</div>}
            {people.map((u) => <button key={u.id} type="button" onClick={() => switchTo(`person:${u.id}`)}>{u.name}<span>{u.email}</span></button>)}
            {!roleRows.length && !people.length && <div className="view-as-empty">Nothing matches.</div>}
          </div>
          <div className="view-as-note">Read-only: you see what they see, and nothing can be changed.</div>
        </div>
      )}
    </div>
  );
}

/** The yellow bar while viewing as someone, with Stop. */
export function ViewAsBanner({ as, tier }: { as: string; tier?: string }) {
  return (
    <div className="view-as-banner" role="status">
      <span>Viewing as <b>{as}</b>{tier === 'client' || tier === 'consultant' ? ' (outside account — only the projects they’re linked to)' : ''} — read only.</span>
      <button type="button" onClick={() => switchTo(null)}>Stop viewing as</button>
    </div>
  );
}
