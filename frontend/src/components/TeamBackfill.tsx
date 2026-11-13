import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

type Plan = { projectId: number; projectName: string; dealName: string; roles: Record<string, string> }[];

/**
 * Projects converted before the CRM team carried over (Nov 13): lists them,
 * and "Copy the CRM team" sets each project's team from its lead -- their
 * open tasks given to those roles then go to those people. Administrators.
 */
export function TeamBackfill() {
  const { toast } = useApp();
  const [plan, setPlan] = useState<Plan>([]);
  const [busy, setBusy] = useState(false);
  const load = () => { api.pipeline.teamBackfill().then((r) => setPlan(Array.isArray(r) ? r : [])).catch(() => setPlan([])); };
  useEffect(load, []);
  if (!plan.length) return null;
  const apply = async () => {
    if (!confirm(`Copy the CRM team onto ${plan.length} project${plan.length === 1 ? '' : 's'}? Open tasks given to those roles, with no one on them, go to those people.`)) return;
    setBusy(true);
    try { const r = await api.pipeline.applyTeamBackfill(); toast(`${r.changed ?? 0} project${r.changed === 1 ? '' : 's'} updated, ${r.filled ?? 0} task${r.filled === 1 ? '' : 's'} assigned`); load(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not changed')); }
    finally { setBusy(false); }
  };
  return (
    <div role="status" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 240 }}><b>{plan.length} project{plan.length === 1 ? '' : 's'} don’t have their CRM team yet</b> ({plan.slice(0, 3).map((p) => p.projectName).join(', ')}{plan.length > 3 ? '…' : ''}). Copying it lets tasks given to a role fill in.</span>
      <button type="button" disabled={busy} onClick={() => void apply()} style={{ padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Copying…' : 'Copy the CRM team'}</button>
    </div>
  );
}
