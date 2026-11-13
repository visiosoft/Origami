import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

type Plan = { id: number; name: string; projects: { id: number; name: string }[]; unmatched: string[] }[];

/**
 * People still linked to projects by name (Nov 13): renaming a project cut
 * them off. Lists what each name becomes -- and names that match no project,
 * to fix by hand -- and changes nothing until someone who manages People
 * presses the button.
 */
export function PeopleProjectFix({ onDone }: { onDone?: () => void }) {
  const { toast } = useApp();
  const [plan, setPlan] = useState<Plan>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => { api.people.projectIdPlan().then((r) => setPlan(Array.isArray(r) ? r : [])).catch(() => setPlan([])); };
  useEffect(load, []);
  if (!plan.length) return null;
  const bad = plan.filter((p) => p.unmatched.length).length;
  const apply = async () => {
    if (!confirm(`Link ${plan.length} ${plan.length === 1 ? 'person' : 'people'} to their projects by id? Names that match no project stay listed, without access.`)) return;
    setBusy(true);
    try { const r = await api.people.applyProjectIds(); toast(`${r.changed ?? 0} updated`); setOpen(false); load(); onDone?.(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not changed')); }
    finally { setBusy(false); }
  };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' };
  return (
    <div role="status" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 240 }}><b>{plan.length} {plan.length === 1 ? 'person is' : 'people are'} linked to projects by name.</b> Linking by project means renaming a project no longer cuts them off.{bad ? ` ${bad} have names that match no project — fix those after.` : ''}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...btn, background: 'var(--surface)', color: 'var(--ink)' }}>{open ? 'Hide' : 'See the changes'}</button>
        <button type="button" disabled={busy} onClick={() => void apply()} style={btn}>{busy ? 'Updating…' : 'Link by project'}</button>
      </div>
      {open && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--ink)' }}>
          <thead><tr>{['Person', 'Projects', 'Names matching no project'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 6px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {plan.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.1)' }}>
                <td style={{ padding: '4px 6px', fontWeight: 700 }}>{p.name}</td>
                <td style={{ padding: '4px 6px' }}>{p.projects.map((x) => x.name).join(', ') || '—'}</td>
                <td style={{ padding: '4px 6px', color: p.unmatched.length ? '#8E2E0A' : 'var(--muted)' }}>{p.unmatched.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
