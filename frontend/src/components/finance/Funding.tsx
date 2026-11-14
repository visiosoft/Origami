import { useEffect, useState } from 'react';
import { api, type FundingView } from '../../api';
import { useApp } from '../../AppContext';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, Drawer, Label, btn, card, fmtDate, input } from '../manpowerUi';
import { failed, usd, usd0 } from './financeUi';
import { Skeleton } from '../Skeleton';

type Edit = { id?: string; kind: string; name: string; approvedAmount: string; notes: string };

/**
 * Funding (Batch 6): where the project's money comes from -- a construction
 * loan, the owner's cash, another source -- with what each approved, what's
 * been invoiced to it and paid, and the gap against the contract. Owner
 * invoices and approved change orders are tagged "Paid from" a source.
 */
export function FundingPanel({ projectId }: { projectId: number }) {
  const { toast } = useApp();
  const [v, setV] = useState<FundingView | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  useEffect(() => { api.finance.funding(projectId).then(setV).catch((e) => failed(toast, e)); }, [projectId, toast]);
  if (!v) return <Skeleton label="Loading funding…" />;
  const save = async () => {
    if (!edit) return;
    try { setV(await api.finance.saveFunding(projectId, { ...edit, approvedAmount: Number(edit.approvedAmount) })); setEdit(null); toast('Funding saved'); }
    catch (e) { failed(toast, e); }
  };
  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}? Invoices and change orders paid from it go back to “not assigned”.`)) return;
    try { setV(await api.finance.removeFunding(id)); setEdit(null); } catch (e) { failed(toast, e); }
  };
  const assign = async (d: { invoiceId?: string; changeOrderId?: string }, fundingSourceId: string) => {
    try { setV(await api.finance.assignFunding(projectId, { ...d, fundingSourceId: fundingSourceId || null })); } catch (e) { failed(toast, e); }
  };
  const picker = (value: string | null, onPick: (id: string) => void, label: string) => (
    <select aria-label={label} value={value || ''} disabled={!v.canManage} onChange={(e) => onPick(e.target.value)} style={{ ...input, width: 'auto', minWidth: 180, padding: '5px 8px', fontSize: 12 }}>
      <option value="">Not assigned</option>
      {v.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
  const gapTone = v.gap > 0.005 ? DANGER : 'var(--c-1e6b36)';
  return (
    <div style={{ display: 'grid', gap: 14 }} aria-label="Funding">
      <div style={{ ...card, padding: '14px 18px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12.5 }}><span style={{ color: MUTED }}>Contract with approved changes </span><b>{usd0(v.revisedContract)}</b></span>
        <span style={{ fontSize: 12.5 }}><span style={{ color: MUTED }}>Funding approved </span><b>{usd0(v.approved)}</b></span>
        <span style={{ fontSize: 13, fontWeight: 700, color: gapTone }} aria-label="Funding gap">
          {v.gap > 0.005 ? `${usd0(v.gap)} still to cover` : v.gap < -0.005 ? `Funded ${usd0(-v.gap)} beyond the contract` : 'Fully funded'}
        </span>
        <span style={{ flex: 1 }} />
        {v.canManage && <div onClick={() => setEdit({ kind: 'loan', name: '', approvedAmount: '', notes: '' })} style={btn(true)}>+ Add funding source</div>}
      </div>

      {!v.sources.length ? (
        <div style={{ ...card, padding: 16, fontSize: 12.5, color: MUTED }}>No funding sources yet. Add the construction loan, the owner’s cash and anything else paying for this project to see what’s left in each and the gap to cover.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {v.sources.map((s) => {
            const used = s.approved > 0 ? Math.min(s.invoiced / s.approved, 1) : 0;
            return (
              <div key={s.id} style={{ ...card, padding: '14px 16px', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <b style={{ flex: 1, fontFamily: BG, fontSize: 15 }}>{s.name}</b>
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: 'uppercase' }}>{s.kindLabel}</span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'var(--c-efede8)', overflow: 'hidden' }}><div style={{ width: `${used * 100}%`, height: '100%', background: s.over ? DANGER : ACCENT }} /></div>
                {([['Approved', s.approved], ['Invoiced', s.invoiced], ['Paid', s.paid]] as [string, number][]).map(([l, n]) => (
                  <div key={l} style={{ display: 'flex', fontSize: 12.5 }}><span style={{ flex: 1, color: MUTED }}>{l}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(n)}</span></div>
                ))}
                <div style={{ display: 'flex', fontSize: 12.5, fontWeight: 700, color: s.over ? DANGER : INK }}><span style={{ flex: 1 }}>{s.over ? 'Over by' : 'Left'}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(Math.abs(s.left))}</span></div>
                {s.changeOrders > 0 && <div style={{ fontSize: 11.5, color: MUTED }}>Change orders paid from it: {usd(s.changeOrders)}</div>}
                {s.notes && <div style={{ fontSize: 11.5, color: MUTED, whiteSpace: 'pre-wrap' }}>{s.notes}</div>}
                {v.canManage && <div onClick={() => setEdit({ id: s.id, kind: s.kind, name: s.name, approvedAmount: String(s.approved), notes: s.notes || '' })} style={{ ...btn(), justifySelf: 'start' }}>Edit</div>}
              </div>
            );
          })}
        </div>
      )}

      {(v.invoices.length > 0 || v.changeOrders.length > 0) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 700, borderBottom: '1px solid ' + LINE, display: 'flex', gap: 8 }}>
            <span style={{ flex: 1 }}>Paid from</span>
            {v.unassignedCount > 0 && <span style={{ color: 'var(--c-8a6d12)', fontWeight: 600 }}>{v.unassignedCount} invoice{v.unassignedCount === 1 ? '' : 's'} not assigned · {usd(v.unassignedInvoiced)}</span>}
          </div>
          {v.invoices.map((i) => (
            <div key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid ' + LINE, fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 180 }}><b>{i.number || 'Invoice'}</b> <span style={{ color: MUTED }}>{fmtDate(i.date)}</span></span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(i.total)}</span>
              {picker(i.fundingSourceId, (id) => assign({ invoiceId: i.id }, id), `Paid from for ${i.number || i.id}`)}
            </div>
          ))}
          {v.changeOrders.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid ' + LINE, fontSize: 12.5, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 180 }}><b>{c.number}</b> <span style={{ color: MUTED }}>{c.title}</span></span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(c.amount)}</span>
              {picker(c.fundingSourceId, (id) => assign({ changeOrderId: c.id }, id), `Paid from for ${c.number}`)}
            </div>
          ))}
        </div>
      )}

      {edit && (
        <Drawer title={edit.id ? 'Edit funding source' : 'Add funding source'} onClose={() => setEdit(null)}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Label text="Kind" />
            <select aria-label="Funding kind" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} style={input}>
              {v.kinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <Label text="Name" />
            <input aria-label="Funding name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={input} placeholder="e.g. Bank of the West construction loan" />
            <Label text="Amount approved" />
            <input aria-label="Amount approved" type="number" value={edit.approvedAmount} onChange={(e) => setEdit({ ...edit, approvedAmount: e.target.value })} style={input} />
            <Label text="Notes" />
            <textarea aria-label="Funding notes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} style={{ ...input, minHeight: 70 }} placeholder="Draw schedule, lender contact…" />
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={save} style={btn(true)}>Save</div>
              {edit.id && <div onClick={() => remove(edit.id!, edit.name)} style={{ ...btn(), color: DANGER }}>Remove</div>}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
