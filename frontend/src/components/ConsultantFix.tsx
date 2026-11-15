import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

type Plan = { id: number; nameNow: string; nameAfter: string; company: string }[];

/**
 * Consultants saved the old way (Nov 10 sync): the firm as their name and the
 * person as "primary contact". Lists exactly how each would be rewritten --
 * the person's name as the name, the firm as their company -- and changes
 * nothing until someone who manages People presses the button.
 */
export function ConsultantFix({ onDone }: { onDone?: () => void }) {
  const { toast } = useApp();
  const [plan, setPlan] = useState<Plan>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => { api.people.consultantFix().then((r) => setPlan(Array.isArray(r) ? r : [])).catch(() => setPlan([])); };
  useEffect(load, []);
  if (!plan.length) return null;
  const apply = async () => {
    if (!confirm(`Rename ${plan.length} consultant${plan.length === 1 ? '' : 's'} to the person, with the firm as their company?`)) return;
    setBusy(true);
    try { const r = await api.people.applyConsultantFix(); toast(`${r.changed ?? 0} consultant${r.changed === 1 ? '' : 's'} updated`); setOpen(false); load(); onDone?.(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not changed')); }
    finally { setBusy(false); }
  };
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' };
  return (
    <div role="status" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 240 }}><b>{plan.length} consultant{plan.length === 1 ? ' is' : 's are'} saved with the firm as the name.</b> Consultants are people now: the person becomes the name, the firm their company.</span>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...btn, background: 'var(--surface)', color: 'var(--ink)' }}>{open ? 'Hide' : 'See the changes'}</button>
        <button type="button" disabled={busy} onClick={() => void apply()} style={btn}>{busy ? 'Updating…' : 'Update consultants'}</button>
      </div>
      {open && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5, color: 'var(--ink)' }}>
          <thead><tr>{['Name now', 'Name after', 'Firm (company)'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '4px 6px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {plan.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.1)' }}>
                <td style={{ padding: '4px 6px' }}>{p.nameNow}</td>
                <td style={{ padding: '4px 6px', fontWeight: 700 }}>{p.nameAfter}</td>
                <td style={{ padding: '4px 6px' }}>{p.company}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
