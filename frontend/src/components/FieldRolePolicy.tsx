import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

type Plan = { key: string; name: string; changes: { key: string; from: string; to: string }[] }[];

/** "fin:subcontractor_financials" -> "Subcontractor financials"; module keys as written. */
const nice = (k: string) => {
  const s = k.replace(/^fin:/, '').replace(/_/g, ' ');
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/\bmbbl\b/i, 'MBBL');
};

/**
 * Field roles and money (Nov 10 sync): shows, role by role, what the access
 * sheet's rule for superintendents, foremen and labour would change -- no
 * estimates or financials beyond their own entries, People and Projects view
 * only -- and applies it only when an admin presses the button.
 */
export function FieldRolePolicy({ canFix, onApplied }: { canFix: boolean; onApplied?: () => void }) {
  const { toast } = useApp();
  const [plan, setPlan] = useState<Plan>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => { api.roles.fieldPolicy().then((r) => setPlan(Array.isArray(r) ? r : [])).catch(() => setPlan([])); };
  useEffect(load, []);
  if (!plan.length) return null;
  const n = plan.reduce((a, p) => a + p.changes.length, 0);
  const apply = async () => {
    if (!confirm(`Change ${n} setting${n === 1 ? '' : 's'} on ${plan.map((p) => p.name).join(', ')}? Everyone with these roles gets the new access straight away.`)) return;
    setBusy(true);
    try { await api.roles.applyFieldPolicy(); toast('Field roles updated'); setOpen(false); load(); onApplied?.(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not applied')); }
    finally { setBusy(false); }
  };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' };
  return (
    <div role="status" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 240 }}>
          <b>{plan.map((p) => p.name).join(', ')}</b> still {plan.length === 1 ? 'allows' : 'allow'} estimates or financial figures. The access sheet keeps field roles to their own entries (reimbursables, timesheets, projected labour) and lets them view, not change, People and Projects.
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...btn, background: 'var(--surface)', color: 'var(--ink)' }}>{open ? 'Hide' : `See the ${n} changes`}</button>
        {canFix && <button type="button" disabled={busy} onClick={() => void apply()} style={btn}>{busy ? 'Applying…' : 'Apply to field roles'}</button>}
      </div>
      {open && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--ink)' }}>
          <thead><tr>{['Role', 'Area', 'Now', 'After'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 6px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {plan.flatMap((p) => p.changes.map((c, i) => (
              <tr key={p.key + c.key} style={{ borderTop: i ? undefined : '1px solid rgba(var(--rgb-shade), 0.1)' }}>
                <td style={{ padding: '3px 6px', fontWeight: i ? 400 : 700 }}>{i ? '' : p.name}</td>
                <td style={{ padding: '3px 6px' }}>{nice(c.key)}</td>
                <td style={{ padding: '3px 6px' }}>{c.from}</td>
                <td style={{ padding: '3px 6px', fontWeight: 700 }}>{c.to}</td>
              </tr>
            )))}
          </tbody>
        </table>
      )}
    </div>
  );
}
