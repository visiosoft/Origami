import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { estimateWaiting } from '../../data/estimateWaiting';
import { usd } from './financeUi';

type Est = { id: string; number: string; rev: number; title?: string | null; status: string; estimateDate?: string | null; sentAt?: string | null; totalProject: number | null; totalBuild: number | null; designCost: number | null; high: number | null };

/**
 * Nov 17 (Edward): pre-construction in Financials. Every estimate and revision
 * side by side -- from the early low/high range to the refined numbers -- and
 * the pre-construction / design fees billed from one before the contract is
 * signed. Those invoices sit outside the contract value.
 */
export function PreconPanel({ projectId, canInvoice, onInvoiced }: { projectId: number; canInvoice: boolean; onInvoiced: (invoiceId: string) => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<Est[] | null>(null);
  const [billing, setBilling] = useState<Est | null>(null);
  const [lines, setLines] = useState<{ description: string; amount: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.finance.estimates(projectId).then((r: any) => setRows(Array.isArray(r?.rows) ? r.rows : [])).catch(() => setRows([]));
  }, [projectId]);

  const start = (e: Est) => {
    setBilling(e);
    setLines([{ description: `Design / pre-construction fee — ${e.number} Rev ${e.rev}`, amount: e.designCost ? String(e.designCost) : '' }]);
  };
  const create = async () => {
    if (!billing) return;
    const clean = lines.map((l) => ({ description: l.description.trim(), amount: Number(l.amount) })).filter((l) => l.description && l.amount > 0);
    if (!clean.length) { toast('⚠ Add a fee with an amount'); return; }
    setBusy(true);
    try {
      const inv = await api.finance.createPreconInvoice(projectId, { estimateLabel: `${billing.number} Rev ${billing.rev}`, lines: clean });
      setBilling(null); toast('Draft invoice made — check it and issue it'); onInvoiced(inv.id);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not make the invoice')); }
    finally { setBusy(false); }
  };

  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
  const td = { padding: '8px 10px', fontSize: 12.5, textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
  const box = { boxSizing: 'border-box' as const, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), .14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13 };
  return (
    <div className="precon-panel" style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Every estimate and revision side by side. Bill pre-construction or design fees from one while the contract is negotiated — those invoices don’t count against, or lock, the contract value.</div>
      {rows === null ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</div>
        : !rows.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No estimates on this project yet — start one in Estimating.</div> : (
          <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 12, border: '1px solid rgba(var(--rgb-shade), .06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Estimate</th><th style={{ ...th, textAlign: 'left' }}>Status</th><th style={th}>Build</th><th style={th}>Range high</th><th style={th}>Design / precon fee</th><th style={th}>Total project</th><th style={th} /></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} style={{ borderTop: '1px solid rgba(var(--rgb-shade), .05)' }}>
                    <td style={{ ...td, textAlign: 'left' }}><b>{e.number} · Rev {e.rev}</b>{e.title ? <span style={{ color: 'var(--muted)' }}> {e.title}</span> : null}</td>
                    <td style={{ ...td, textAlign: 'left', color: estimateWaiting(e).late ? '#8A4B12' : 'var(--body)' }}>{estimateWaiting(e).label}</td>
                    <td style={td}>{e.totalBuild == null ? '—' : usd(e.totalBuild)}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{e.high ? usd(e.high) : '—'}</td>
                    <td style={td}>{e.designCost == null ? '—' : usd(e.designCost)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{e.totalProject == null ? '—' : usd(e.totalProject)}</td>
                    <td style={td}>{canInvoice && <button type="button" onClick={() => start(e)} style={{ ...box, cursor: 'pointer', fontWeight: 700, borderRadius: 999 }}>Invoice precon fees…</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {billing && (
        <div role="dialog" aria-label="Invoice pre-construction fees" style={{ display: 'grid', gap: 8, padding: 14, borderRadius: 12, background: 'var(--panel)' }}>
          <b style={{ fontSize: 13.5 }}>Pre-construction fees from {billing.number} Rev {billing.rev}</b>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input aria-label="Fee description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} style={{ ...box, flex: '1 1 280px' }} />
              <input aria-label="Amount" inputMode="decimal" placeholder="Amount" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} style={{ ...box, width: 130 }} />
              {lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ ...box, cursor: 'pointer' }} aria-label="Remove fee">✕</button>}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setLines([...lines, { description: '', amount: '' }])} style={{ ...box, cursor: 'pointer' }}>+ Another fee</button>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setBilling(null)} style={{ ...box, cursor: 'pointer', borderRadius: 999 }}>Cancel</button>
              <button type="button" disabled={busy} onClick={create} style={{ ...box, cursor: 'pointer', borderRadius: 999, background: 'var(--ink)', color: '#fff', border: 0, fontWeight: 700 }}>{busy ? 'Making…' : 'Make the draft invoice'}</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
