import { useState } from 'react';
import { api } from '../api';
import type { User } from '../data/users';

/**
 * The internal team on a pursuit. Kept separate from the client-side contacts:
 * these are Origami people, picked from the platform's own user list.
 */
export const INTERNAL_ROLES: { key: string; label: string; hint: string }[] = [
  { key: 'projectManager', label: 'Project Manager', hint: 'Owns the pursuit and the client relationship.' },
  { key: 'projectCoordinator', label: 'Project Coordinator', hint: 'Runs scheduling and intake follow-up.' },
  { key: 'estimator', label: 'Estimator', hint: 'Prices the work and owns the proposal numbers.' },
  { key: 'superintendent', label: 'Superintendent', hint: 'Runs the site once the job starts.' },
  { key: 'foreman', label: 'Foreman', hint: 'Leads the crew day to day.' },
  { key: 'designer', label: 'Designer', hint: 'Owns the design package.' },
  { key: 'architect', label: 'Architect', hint: 'Architect of record, if internal.' },
];

interface Props {
  deal: { id: string; roles?: Record<string, string> };
  users: User[];
  draft?: Record<string, string>;
  onChange: (roles: Record<string, string>) => void;
  onSaved: (roles: Record<string, string>) => void;
}

export function RoleAssignments({ deal, users, draft, onChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The draft is held by the parent so switching tabs doesn't discard edits.
  const roles = draft ?? deal.roles ?? {};
  const internal = users.filter((u) => u.tier === 'internal' && u.status !== 'suspended');

  const set = (key: string, value: string) => onChange({ ...roles, [key]: value });

  const save = () => {
    setSaving(true);
    setError('');
    api.pipeline.setRoles(deal.id, roles)
      .then(() => onSaved(roles))
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const assignedCount = INTERNAL_ROLES.filter((r) => (roles[r.key] || '').trim()).length;

  return (
    <div style={{ padding: '14px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#173326', marginBottom: 4 }}>
        Internal Team
      </div>
      <div style={{ fontSize: 11.5, color: '#7E9B93', marginBottom: 14, lineHeight: 1.5 }}>
        Who from Origami is on this pursuit. {assignedCount} of {INTERNAL_ROLES.length} assigned — every change is recorded in the Audit Trail.
      </div>

      {internal.length === 0 && (
        <div style={{ padding: '11px 13px', borderRadius: 9, background: '#FBF8F2', fontSize: 12, color: '#7E9B93', lineHeight: 1.5, marginBottom: 14 }}>
          No internal users yet. Add them under <b style={{ color: '#173326' }}>People</b> and they will appear here.
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 13px', borderRadius: 9, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', fontSize: 12, fontWeight: 600, color: '#8E2E0A', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {INTERNAL_ROLES.map((role) => (
          <div key={role.key}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#43514D' }}>{role.label}</label>
            <select
              value={roles[role.key] || ''}
              onChange={(e) => set(role.key, e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' }}
            >
              <option value="">Unassigned</option>
              {/* A person who left still shows on the pursuit that named them. */}
              {roles[role.key] && !internal.some((u) => u.id === roles[role.key]) && (
                <option value={roles[role.key]}>{roles[role.key]} (no longer active)</option>
              )}
              {internal.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <div style={{ fontSize: 10.5, color: '#9AA39D', marginTop: 3 }}>{role.hint}</div>
          </div>
        ))}
      </div>

      <div
        onClick={saving ? undefined : save}
        style={{ marginTop: 18, padding: '10px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, textAlign: 'center', cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}
      >
        {saving ? 'Saving…' : 'Save role assignments'}
      </div>
    </div>
  );
}
