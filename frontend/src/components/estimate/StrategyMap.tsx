import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { STRATEGY_LABEL } from '../../data/estimateCalc';

type Plan = { total: number; estimates: number; groups: { from: string; to: string | null; count: number; samples: string[] }[] };
const OLD_LABEL: Record<string, string> = { subcontract: 'Subcontract', owner: 'Owner', contract_required: 'Contract Required', other: 'Other' };

/**
 * Estimate lines still on the performing strategies used before Nov 13
 * (Edward's list replaced them). Shows exactly how many move where, and
 * changes nothing until someone who edits estimates presses the button.
 */
export function StrategyMap() {
  const { toast } = useApp();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => { api.finance.strategyMap().then((r) => setPlan(r && r.total ? r : null)).catch(() => setPlan(null)); };
  useEffect(load, []);
  if (!plan) return null;
  const apply = async () => {
    if (!confirm(`Move ${plan.total} estimate line${plan.total === 1 ? '' : 's'} to the new performing strategies? Amounts don’t change.`)) return;
    setBusy(true);
    try { const r = await api.finance.applyStrategyMap(); toast(`${r.changed ?? 0} line${r.changed === 1 ? '' : 's'} updated`); setOpen(false); load(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not changed')); }
    finally { setBusy(false); }
  };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' };
  return (
    <div role="status" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 240 }}><b>{plan.total} line{plan.total === 1 ? '' : 's'} on {plan.estimates} estimate{plan.estimates === 1 ? '' : 's'} use the old performing strategies.</b> They move to the new list; amounts don’t change.</span>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...btn, background: 'var(--surface)', color: 'var(--ink)' }}>{open ? 'Hide' : 'See the changes'}</button>
        <button type="button" disabled={busy} onClick={() => void apply()} style={btn}>{busy ? 'Updating…' : 'Update strategies'}</button>
      </div>
      {open && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--ink)' }}>
          <thead><tr>{['Now', 'After', 'Lines', 'For example'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 6px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {plan.groups.map((g) => (
              <tr key={`${g.from}>${g.to}`} style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.1)' }}>
                <td style={{ padding: '4px 6px' }}>{OLD_LABEL[g.from] || g.from}</td>
                <td style={{ padding: '4px 6px', fontWeight: 700 }}>{g.to ? STRATEGY_LABEL[g.to as keyof typeof STRATEGY_LABEL] || g.to : '(blank — pick one)'}</td>
                <td style={{ padding: '4px 6px', fontVariantNumeric: 'tabular-nums' }}>{g.count}</td>
                <td style={{ padding: '4px 6px', color: 'var(--muted)' }}>{g.samples.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
