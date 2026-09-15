import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 12.5,
  fontFamily: 'inherit', color: '#0B1A12', outline: 'none',
};

interface Grant {
  id: number; name: string; email: string; tier: string; createdAt: string; expiresAt: string;
  createdBy: string; revokedAt: string; lastUsedAt: string; expired: boolean; hasFullAccount: boolean;
}

/**
 * Time-limited guest logins for this project, in place of standing
 * passwords -- a link that's good for a set number of days, revocable at
 * any point, with the option to upgrade a frequent partner to a real
 * account instead of re-granting them over and over.
 */
export function GuestAccessPanel({ projectId }: { projectId: number }) {
  const { toast } = useApp();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'client' | 'consultant'>('client');
  const [days, setDays] = useState(10);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api.guestAccess.list(projectId).then((r) => setGrants(r)).catch(() => { }).finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const create = () => {
    if (!name.trim() || !email.trim()) { toast('Name and email are required'); return; }
    setCreating(true);
    api.guestAccess.create({ name: name.trim(), email: email.trim(), tier, projectId, days })
      .then((res) => {
        setNewLink(res.link);
        setName('');
        setEmail('');
        toast(res.emailSent ? 'Guest access granted — link emailed' : `Guest access granted, but the email didn't send${res.emailError ? ` (${res.emailError})` : ''} — copy the link below`);
        load();
      })
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setCreating(false));
  };

  const revoke = (id: number) => {
    if (!confirm('Revoke this access link? It stops working immediately.')) return;
    setBusyId(id);
    api.guestAccess.revoke(id).then(() => { toast('Revoked'); load(); }).catch((e: Error) => toast('⚠ ' + e.message)).finally(() => setBusyId(null));
  };

  const promote = (id: number) => {
    setBusyId(id);
    api.guestAccess.promote(id)
      .then((res) => toast(res?.sent ? `Invitation sent to ${res.to}` : 'Could not send the invitation'))
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setBusyId(null));
  };

  const copy = (link: string) => {
    navigator.clipboard?.writeText(link).then(() => toast('Link copied')).catch(() => { });
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 4 }}>Guest Access</div>
      <div style={{ fontSize: 12, color: '#9AA39D', marginBottom: 16, lineHeight: 1.5, maxWidth: 560 }}>
        Grant a client or consultant a time-limited login instead of a standing password. They land in the ordinary
        app, scoped to this project. Revoke a link any time, or upgrade a frequent partner to a full account.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8, padding: 14, background: '#FBF8F2', borderRadius: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', marginBottom: 3 }}>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ ...input, width: 160 }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', marginBottom: 3 }}>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" style={{ ...input, width: 200 }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', marginBottom: 3 }}>Tier</div>
          <select value={tier} onChange={(e) => setTier(e.target.value as 'client' | 'consultant')} style={{ ...input, width: 120 }}>
            <option value="client">Client</option>
            <option value="consultant">Consultant</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', marginBottom: 3 }}>Days</div>
          <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value) || 10)} style={{ ...input, width: 70 }} />
        </div>
        <div onClick={creating ? undefined : create} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: creating ? 'default' : 'pointer', background: creating ? '#9AB0A4' : '#173326', color: 'white' }}>
          {creating ? 'Granting…' : 'Grant access'}
        </div>
      </div>

      {newLink && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9, background: '#D2EAD3', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1C5230' }}>Link:</span>
          <span style={{ fontSize: 11.5, color: '#1C5230', wordBreak: 'break-all', flex: 1, minWidth: 200 }}>{newLink}</span>
          <span onClick={() => copy(newLink)} style={{ fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</span>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: '#9AA39D' }}>Loading…</div>
      ) : grants.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No guest access granted on this project yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {grants.map((g) => {
            const status = g.revokedAt ? 'Revoked' : g.expired ? 'Expired' : 'Active';
            const statusColor = status === 'Active' ? { bg: '#D2EAD3', c: '#1C5230' } : status === 'Expired' ? { bg: '#EFEDE8', c: '#7E9B93' } : { bg: '#F2DFD4', c: '#8E2E0A' };
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12' }}>{g.name} <span style={{ fontWeight: 500, color: '#7E9B93' }}>· {g.tier}</span></div>
                  <div style={{ fontSize: 11, color: '#7E9B93' }}>{g.email}</div>
                </div>
                <span style={{ fontSize: 10.5, color: '#7E9B93' }}>Expires {new Date(g.expiresAt).toLocaleDateString()}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: statusColor.bg, color: statusColor.c }}>{status}</span>
                {!g.hasFullAccount && status !== 'Revoked' && (
                  <span onClick={busyId ? undefined : () => promote(g.id)} style={{ fontSize: 11, fontWeight: 700, color: '#173326', cursor: busyId ? 'default' : 'pointer' }}>Make full account</span>
                )}
                {status === 'Active' && (
                  <span onClick={busyId ? undefined : () => revoke(g.id)} style={{ fontSize: 11, fontWeight: 700, color: '#8E2E0A', cursor: busyId ? 'default' : 'pointer' }}>Revoke</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
