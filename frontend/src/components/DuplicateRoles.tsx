import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

type Plan = { from: { key: string; name: string }; to: { key: string; name: string }; users: { id: string; name: string; email: string }[] }[];

/**
 * Duplicate roles (Nov 3 sync): the original roles and the access-matrix roles
 * overlap (two "Consultant", two "Subcontractor", PM, Super, Authority). Shows
 * exactly who would move to the matrix role before anything changes.
 */
export function DuplicateRoles({ canFix }: { canFix: boolean }) {
  const { toast } = useApp();
  const [plan, setPlan] = useState<Plan>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => { api.roles.duplicates().then((r) => setPlan(Array.isArray(r) ? r : [])).catch(() => setPlan([])); };
  useEffect(load, []);
  if (!plan.length) return null;
  const people = plan.reduce((n, p) => n + p.users.length, 0);
  const merge = async () => {
    if (!confirm(`Move ${people} ${people === 1 ? 'person' : 'people'} to the matching roles and remove ${plan.length} duplicate role${plan.length === 1 ? '' : 's'}? Their access becomes the new role’s.`)) return;
    setBusy(true);
    try { const r = await api.roles.mergeDuplicates(); toast(`Merged — ${r.moved ?? 0} moved, ${r.removed?.length ?? 0} duplicate role${r.removed?.length === 1 ? '' : 's'} removed`); setOpen(false); load(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not merged')); }
    finally { setBusy(false); }
  };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' };
  return (
    <div role="status" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 240 }}><b>{plan.length} duplicate role{plan.length === 1 ? '' : 's'}</b> — {plan.map((p) => `${p.from.name} → ${p.to.name}`).join(', ')}.</span>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...btn, background: 'var(--surface)', color: 'var(--ink)' }}>{open ? 'Hide' : 'See who moves'}</button>
        {canFix && <button type="button" disabled={busy} onClick={() => void merge()} style={btn}>{busy ? 'Merging…' : 'Merge duplicates'}</button>}
      </div>
      {open && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--ink)' }}>
          <thead><tr>{['From', 'To', 'People who move'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 6px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {plan.map((p) => (
              <tr key={p.from.key} style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.1)' }}>
                <td style={{ padding: '4px 6px' }}>{p.from.name}</td>
                <td style={{ padding: '4px 6px' }}>{p.to.name}</td>
                <td style={{ padding: '4px 6px' }}>{p.users.length ? p.users.map((u) => u.name || u.email).join(', ') : <i>nobody — the role is just removed</i>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
