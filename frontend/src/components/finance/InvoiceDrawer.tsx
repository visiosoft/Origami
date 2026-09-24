import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { Attachments } from '../Attachments';
import { ACCENT, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, btn, card, fmtDate, input, todayISO } from '../manpowerUi';
import {
  ApprovalTrail, InvoiceBadge, PAYMENT_METHODS, ReasonBox, failed, pct, usd,
  type Invoice, type InvoiceLine, type Overview, type Reimbursable, type Row,
} from './financeUi';

type LineKind = InvoiceLine['kind'];

/** A line as edited in the draft form -- numbers kept as typed text until saved. */
interface EditLine {
  id?: string; kind: LineKind; targetType?: string | null; phaseId?: string | null; taskId?: string | null;
  description: string; contractValue: number | null; prevBilled: number; current: string; amount: string;
  quantity: string; unit: string; rate: string; retentionApplies: boolean; taxable: boolean;
  reimbursableId?: string | null; retentionReleaseId?: string | null;
}

// Cents helpers mirroring the server's money.ts -- the preview only; the server recomputes on save and issue.
const c = (n: number | string | null | undefined) => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100 + (v >= 0 ? 1e-9 : -1e-9)) : 0; };
const pctOfC = (cents: number, p: number) => { const x = (cents * p) / 100; return Math.sign(x) * Math.round(Math.abs(x)); };
const d = (cents: number) => cents / 100;
const isWork = (k: LineKind) => k === 'progress' || k === 'manual';
const KIND_BADGE: Record<LineKind, [string, 'green' | 'blue' | 'amber' | 'grey' | 'red']> = {
  progress: ['SOV', 'green'], manual: ['Item', 'blue'], adjustment: ['Adj.', 'amber'], reimbursable: ['Reimb.', 'grey'], retention_release: ['Retention', 'blue'],
};

/** Items that can carry a progress line, as the server's billableItems(). */
function billable(o: Overview): Row[] {
  const out: Row[] = [];
  if (o.sov.lump) out.push(o.sov.lump);
  for (const g of o.sov.groups) for (const r of g.rows) {
    if (r.kind === 'phase') { if (r.valueFromTasks) out.push(...(r.children || []).filter((x) => x.value != null)); else if (r.value != null) out.push(r); }
    else out.push(r);
  }
  return out.filter((r) => r.value && !r.deleted);
}
const keyOf = (x: { targetType?: string | null; kind?: string; phaseId?: string | null; taskId?: string | null; id?: string }) =>
  x.targetType === 'project' || x.kind === 'project' ? 'project' : x.taskId ? `task:${x.taskId}` : x.phaseId && x.targetType !== 'task' ? `phase:${x.phaseId}` : x.kind === 'task' ? `task:${x.id}` : `phase:${x.id}`;

const toEdit = (l: InvoiceLine): EditLine => ({
  id: l.id, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, description: l.description || '',
  contractValue: l.contractValue, prevBilled: l.prevBilled || 0, current: l.currentProgressPct != null ? String(l.currentProgressPct) : '',
  amount: String(l.amount ?? ''), quantity: l.quantity != null ? String(l.quantity) : '', unit: l.unit || '', rate: l.rate != null ? String(l.rate) : '',
  retentionApplies: l.retentionApplies, taxable: l.taxable, reimbursableId: l.reimbursableId, retentionReleaseId: l.retentionReleaseId,
});

const docName = (inv: Invoice) => inv.kind === 'credit' ? (inv.creditType === 'write_off' ? 'Write-off' : 'Credit note') : inv.kind === 'retention' ? 'Retention invoice' : 'Invoice';

export function InvoiceDrawer({ invoiceId, overview, onClose, onChanged }: { invoiceId: string; overview: Overview; onClose: () => void; onChanged: () => void }) {
  const { toast } = useApp();
  const [currentId, setCurrentId] = useState(invoiceId);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const load = () => api.finance.invoice(currentId).then((r: any) => { setInv(r); setError(''); }).catch((e: any) => setError(e.message || 'Could not load the invoice'));
  useEffect(() => { setInv(null); load(); }, [currentId]);
  const apply = (r: any) => { setInv(r); onChanged(); };
  const fail = (e: any) => {
    failed(toast, e);
    if (/since you opened it|changed by/i.test(e?.message || '')) load();
  };

  const title = inv ? (inv.issuedNumber || `Draft ${docName(inv).toLowerCase()}`) : 'Invoice';
  const subtitle = inv ? `${overview.project.name} · ${inv.kind === 'progress' ? 'Progress claim' : docName(inv)}${inv.creditFor ? ` against ${inv.creditFor.issuedNumber}` : ''}${inv.status === 'issued' ? ` · issued ${fmtDate(inv.issuedAt)} by ${inv.issuedByName || '—'}` : ''}` : '';
  return (
    <Drawer title={title} subtitle={subtitle} width={1060} onClose={onClose}>
      {error && <div style={{ fontSize: 13, color: DANGER }}>{error}</div>}
      {!inv && !error && <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>}
      {inv && inv.creditFor && <div onClick={() => setCurrentId(inv.creditFor!.id)} style={{ fontSize: 12.5, color: ACCENT, cursor: 'pointer', marginBottom: 12 }}>← Back to {inv.creditFor.issuedNumber}</div>}
      {inv && inv.status === 'draft' && <DraftEditor key={inv.id} inv={inv} overview={overview} onSaved={apply} onFail={fail} onDeleted={() => { onChanged(); if (inv.creditFor) setCurrentId(inv.creditFor.id); else onClose(); }} />}
      {inv && inv.status !== 'draft' && <IssuedView key={inv.id} inv={inv} overview={overview} onChanged={apply} onFail={fail} onOpen={setCurrentId} />}
    </Drawer>
  );
}

// ------------------------------------------------------------------ draft

function DraftEditor({ inv, overview, onSaved, onFail, onDeleted }: {
  inv: Invoice; overview: Overview; onSaved: (i: Invoice) => void; onFail: (e: any) => void; onDeleted: () => void;
}) {
  const { toast } = useApp();
  const r = overview.rights;
  const isCredit = inv.kind === 'credit';
  const canEdit = r.prepareInvoice;
  const [h, setH] = useState(() => ({
    invoiceDate: inv.invoiceDate || '', dueDate: inv.dueDate || '', periodStart: inv.periodStart || '', periodEnd: inv.periodEnd || '',
    reference: inv.reference || '', poNumber: inv.poNumber || '', description: inv.description || '', billToName: inv.billToName || '',
    billToEmail: inv.billToEmail || '', billToAddress: inv.billToAddress || '', retentionPct: String(inv.retentionPct ?? 0), taxPct: String(inv.taxPct ?? 0), notes: inv.notes || '',
  }));
  const [lines, setLines] = useState<EditLine[]>(() => (inv.lines || []).map(toEdit));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<null | 'sov' | 'reimb'>(null);
  const [reimbs, setReimbs] = useState<Reimbursable[]>([]);
  const [step, setStep] = useState<null | 'request' | 'return'>(null);
  useEffect(() => { setLines((inv.lines || []).map(toEdit)); setDirty(false); }, [inv.version]);
  useEffect(() => { if (!isCredit && r.viewReimbursables) api.finance.reimbursables(inv.projectId).then((x: any) => setReimbs(Array.isArray(x) ? x : [])).catch(() => {}); }, [inv.projectId]);

  const items = useMemo(() => billable(overview), [overview]);
  const byKey = useMemo(() => new Map(items.map((x) => [keyOf({ kind: x.kind, id: x.id }), x])), [items]);
  const setHead = (k: keyof typeof h) => (e: any) => { setH({ ...h, [k]: e.target.value }); setDirty(true); };
  const patch = (i: number, p: Partial<EditLine>) => { setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l))); setDirty(true); };

  // Live preview: each line's amount, retention, net and tax, the way the server will compute them.
  const invRet = Number(h.retentionPct) || 0;
  const invTax = Number(h.taxPct) || 0;
  const figures = lines.map((l) => {
    const item = l.kind === 'progress' ? byKey.get(keyOf(l)) : undefined;
    const amountC = l.kind === 'manual' && l.quantity !== '' && l.rate !== '' ? Math.round(Number(l.quantity) * c(l.rate)) : c(l.amount);
    const orig = inv.lines?.find((x) => x.id === l.id);
    const retPct = isCredit ? Number(orig?.retentionPct) || 0 : item?.fin?.retentionPctOverride != null ? Number(item.fin.retentionPctOverride) : invRet;
    const taxPct = isCredit ? Number(orig?.taxPct) || 0 : item?.fin?.taxPctOverride != null ? Number(item.fin.taxPctOverride) : invTax;
    const retC = isWork(l.kind) && l.retentionApplies ? pctOfC(amountC, retPct) : 0;
    const netC = amountC - retC;
    const taxC = l.taxable ? pctOfC(netC, taxPct) : 0;
    return { amountC, retC, netC, taxC, retPct, taxPct };
  });
  const tot = figures.reduce((a, f, i) => {
    const k = lines[i].kind;
    return {
      work: a.work + (isWork(k) ? f.amountC : 0), ret: a.ret + f.retC, adj: a.adj + (k === 'adjustment' ? f.amountC : 0), tax: a.tax + f.taxC,
      reimb: a.reimb + (k === 'reimbursable' ? f.amountC : 0), rel: a.rel + (k === 'retention_release' ? f.amountC : 0),
    };
  }, { work: 0, ret: 0, adj: 0, tax: 0, reimb: 0, rel: 0 });
  const totalC = tot.work - tot.ret + tot.adj + tot.reimb + tot.rel + tot.tax;

  const payload = () => ({
    version: inv.version, ...h,
    ...(isCredit ? {} : {
      lines: lines.map((l) => ({
        id: l.id, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, description: l.description,
        amount: l.kind === 'manual' && l.quantity !== '' && l.rate !== '' ? undefined : Number(l.amount), quantity: l.quantity, unit: l.unit, rate: l.rate,
        retentionApplies: l.retentionApplies, taxable: l.taxable, reimbursableId: l.reimbursableId, retentionReleaseId: l.retentionReleaseId,
      })),
    }),
  });
  const save = async () => {
    setBusy(true);
    try { const x = await api.finance.updateInvoice(inv.id, payload()) as Invoice; onSaved(x); setDirty(false); toast('Draft saved'); return x; }
    catch (e) { onFail(e); return null; }
    finally { setBusy(false); }
  };
  const issue = async () => {
    const current = dirty ? await save() : inv;
    if (!current) return;
    if (!current.lines?.length) { toast('⚠ Add at least one line before issuing.'); return; }
    if (!window.confirm(`Issue this ${docName(current).toLowerCase()} for ${usd(current.total)}? It gets its number now and can't be edited afterwards -- only voided.`)) return;
    setBusy(true);
    try { onSaved(await api.finance.issueInvoice(inv.id, current.version) as Invoice); toast(`${docName(current)} issued`); }
    catch (e) { onFail(e); }
    finally { setBusy(false); }
  };
  const requestApproval = async (comment: string) => {
    const current = dirty ? await save() : inv;
    if (!current) return;
    try { onSaved(await api.finance.requestApproval(inv.id, { version: current.version, comment }) as Invoice); setStep(null); toast('Sent for approval'); }
    catch (e) { onFail(e); }
  };
  const returnIt = async (comment: string) => {
    try { onSaved(await api.finance.returnDraft(inv.id, { version: inv.version, comment }) as Invoice); setStep(null); toast('Returned to the preparer'); }
    catch (e) { onFail(e); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this draft?')) return;
    try { await api.finance.deleteInvoice(inv.id); toast('Draft deleted'); onDeleted(); } catch (e) { onFail(e); }
  };

  const addProgress = (x: Row) => {
    const phaseId = x.kind === 'phase' ? x.id : x.kind === 'task' ? x.phaseId || null : null;
    setLines([...lines, {
      kind: 'progress', targetType: x.kind, phaseId, taskId: x.kind === 'task' ? x.id : null, description: x.name, contractValue: x.value,
      prevBilled: x.invoiced, current: '', amount: String(Math.max(x.billable, 0) || ''), quantity: '', unit: '', rate: '', retentionApplies: true, taxable: invTax > 0,
    }]);
    setPicking(null); setDirty(true);
  };
  const addReimb = (x: Reimbursable) => {
    setLines([...lines, {
      kind: 'reimbursable', reimbursableId: x.id, description: `${x.number} ${x.description}`, contractValue: null, prevBilled: 0, current: '',
      amount: String(x.billAmount), quantity: '', unit: '', rate: '', retentionApplies: false, taxable: x.taxable,
    }]);
    setPicking(null); setDirty(true);
  };
  const addManual = () => { setLines([...lines, { kind: 'manual', description: '', contractValue: null, prevBilled: 0, current: '', amount: '', quantity: '1', unit: '', rate: '', retentionApplies: true, taxable: invTax > 0 }]); setDirty(true); };
  const addAdjustment = () => { setLines([...lines, { kind: 'adjustment', description: '', contractValue: null, prevBilled: 0, current: '', amount: '', quantity: '', unit: '', rate: '', retentionApplies: false, taxable: false }]); setDirty(true); };
  const onInvoice = new Set(lines.filter((l) => l.kind === 'progress').map((l) => keyOf(l)));
  const reimbsOn = new Set(lines.filter((l) => l.reimbursableId).map((l) => l.reimbursableId));
  const readyReimbs = reimbs.filter((x) => x.status === 'approved' && x.billable && !x.invoiceId && !reimbsOn.has(x.id));
  const locked = isCredit || !canEdit;
  const fixedAmount = (l: EditLine) => l.kind === 'reimbursable' || l.kind === 'retention_release';

  const cols = 'minmax(200px,2.2fr) 105px 80px 90px 120px 95px 70px 110px 28px';
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {isCredit && (
        <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, background: '#EEF3F8' }}>
          <b>{inv.creditType === 'write_off' ? 'Write-off' : 'Credit note'}</b> against {inv.creditFor?.issuedNumber}: {inv.creditReason}.
          {inv.creditType === 'write_off' ? ' Clears the unpaid balance as a loss; the work stays billed.' : ' Reverses the lines below (retention and tax at their original rates); the work becomes billable again.'}
        </div>
      )}
      {inv.approvalRequestedAt && (
        <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, background: '#FBF3DC' }}>
          Sent for approval by <b>{inv.approvalRequestedBy}</b> on {fmtDate(inv.approvalRequestedAt)}.{r.issueInvoice ? ' Issue it, or return it with what needs changing.' : ' Waiting for someone who can issue invoices.'}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        <div><Label text="Date" /><input disabled={!canEdit} type="date" value={h.invoiceDate} onChange={setHead('invoiceDate')} style={input} /></div>
        {!isCredit && <>
          <div><Label text="Due date" /><input disabled={!canEdit} type="date" value={h.dueDate} onChange={setHead('dueDate')} style={input} /></div>
          <div><Label text="Period from" /><input disabled={!canEdit} type="date" value={h.periodStart} onChange={setHead('periodStart')} style={input} /></div>
          <div><Label text="Period to" /><input disabled={!canEdit} type="date" value={h.periodEnd} onChange={setHead('periodEnd')} style={input} /></div>
          <div><Label text="Retention %" /><input disabled={!canEdit} type="number" min={0} max={100} value={h.retentionPct} onChange={setHead('retentionPct')} style={input} /></div>
          <div><Label text="Tax %" /><input disabled={!canEdit} type="number" min={0} max={100} value={h.taxPct} onChange={setHead('taxPct')} style={input} /></div>
          <div><Label text="Reference / contract" /><input disabled={!canEdit} value={h.reference} onChange={setHead('reference')} style={input} /></div>
          <div><Label text="Client PO" /><input disabled={!canEdit} value={h.poNumber} onChange={setHead('poNumber')} style={input} /></div>
          <div><Label text="Bill to" /><input disabled={!canEdit} value={h.billToName} onChange={setHead('billToName')} style={input} /></div>
          <div><Label text="Billing email" /><input disabled={!canEdit} value={h.billToEmail} onChange={setHead('billToEmail')} style={input} /></div>
          <div style={{ gridColumn: 'span 2' }}><Label text="Billing address" /><input disabled={!canEdit} value={h.billToAddress} onChange={setHead('billToAddress')} style={input} /></div>
        </>}
        <div style={{ gridColumn: '1 / -1' }}><Label text="Description" /><input disabled={!canEdit} value={h.description} onChange={setHead('description')} placeholder="e.g. Progress claim #3 — work to 30 September" style={input} /></div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 960 }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '8px 12px', background: '#FBF9F4', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Line</span><span style={{ textAlign: 'right' }}>Value / qty</span><span style={{ textAlign: 'right' }}>Prev %</span><span style={{ textAlign: 'right' }}>To date %</span>
              <span style={{ textAlign: 'right' }}>This claim</span><span style={{ textAlign: 'right' }}>Retention</span><span style={{ textAlign: 'center' }}>Tax</span><span style={{ textAlign: 'right' }}>Net + tax</span><span />
            </div>
            {lines.map((l, i) => {
              const f = figures[i];
              const valueC = c(l.contractValue);
              const prevPct = valueC ? (c(l.prevBilled) / valueC) * 100 : 0;
              const toDatePct = valueC ? ((c(l.prevBilled) + f.amountC) / valueC) * 100 : 0;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '7px 12px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                    <Badge tone={KIND_BADGE[l.kind][1]}>{KIND_BADGE[l.kind][0]}</Badge>
                    {locked ? <span style={{ fontSize: 12.5 }}>{l.description}</span>
                      : <input value={l.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder={l.kind === 'adjustment' ? 'What the adjustment is for' : 'Description'} style={{ ...input, padding: '5px 7px', fontSize: 12.5 }} />}
                  </span>
                  {l.kind === 'progress' ? <span style={{ textAlign: 'right', fontSize: 12.5 }}>{usd(l.contractValue)}</span>
                    : l.kind === 'manual' && !locked ? <span style={{ display: 'flex', gap: 3 }}>
                      <input type="number" value={l.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} title="Quantity" style={{ ...input, padding: '5px 5px', fontSize: 12, width: 44 }} />
                      <input type="number" value={l.rate} onChange={(e) => patch(i, { rate: e.target.value })} title="Rate" placeholder="rate" style={{ ...input, padding: '5px 5px', fontSize: 12 }} />
                    </span> : <span />}
                  <span style={{ textAlign: 'right', fontSize: 12.5, color: MUTED }}>{l.kind === 'progress' && !isCredit ? pct(Math.round(prevPct * 100) / 100) : ''}</span>
                  {l.kind === 'progress' && !locked
                    ? <input type="number" min={0} max={100} value={l.current !== '' ? l.current : String(Math.round(toDatePct * 100) / 100)}
                      onChange={(e) => {
                        const p = e.target.value;
                        const amt = p === '' ? '' : String(d(pctOfC(valueC, Number(p)) - c(l.prevBilled)));
                        patch(i, { current: p, amount: amt });
                      }} style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />
                    : <span />}
                  {locked || fixedAmount(l) || (l.kind === 'manual' && l.quantity !== '' && l.rate !== '')
                    ? <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: f.amountC < 0 ? DANGER : INK }}>{usd(d(f.amountC))}</span>
                    : <input type="number" value={l.amount} onChange={(e) => patch(i, { amount: e.target.value, current: '' })} placeholder={l.kind === 'adjustment' ? '− for a discount' : ''}
                      style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />}
                  <span style={{ textAlign: 'right', fontSize: 12, display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {isWork(l.kind) && !locked && <input type="checkbox" checked={l.retentionApplies} onChange={(e) => patch(i, { retentionApplies: e.target.checked })} title="Retention applies" />}
                    {f.retC ? `${f.retC > 0 ? '−' : '+'}${usd(d(Math.abs(f.retC)))}` : '—'}
                  </span>
                  <span style={{ textAlign: 'center' }}><input type="checkbox" disabled={locked} checked={l.taxable} onChange={(e) => patch(i, { taxable: e.target.checked })} title={`Taxable at ${pct(f.taxPct)}`} /></span>
                  <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{usd(d(f.netC + f.taxC))}</span>
                  {!locked ? <span onClick={() => { setLines(lines.filter((_, j) => j !== i)); setDirty(true); }} title="Remove line" style={{ cursor: 'pointer', color: MUTED, textAlign: 'center', fontSize: 16 }}>×</span> : <span />}
                </div>
              );
            })}
            {!lines.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No lines yet.</div>}
          </div>
        </div>
        {!isCredit && canEdit && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid ' + LINE, flexWrap: 'wrap', position: 'relative' }}>
            <div onClick={() => setPicking(picking === 'sov' ? null : 'sov')} style={btn()}>+ Schedule-of-values line</div>
            <div onClick={addManual} style={btn()}>+ Manual item</div>
            {r.viewReimbursables && <div onClick={() => setPicking(picking === 'reimb' ? null : 'reimb')} style={btn()}>+ Reimbursable{readyReimbs.length ? ` (${readyReimbs.length})` : ''}</div>}
            <div onClick={addAdjustment} style={btn()}>+ Adjustment</div>
            {picking === 'sov' && (
              <div style={{ position: 'absolute', top: 46, left: 12, zIndex: 5, ...card, boxShadow: '0 12px 30px rgba(20,8,31,.15)', maxHeight: 320, overflowY: 'auto', minWidth: 460 }}>
                {items.filter((x) => !onInvoice.has(keyOf({ kind: x.kind, id: x.id })) && (x.value || 0) > x.invoiced).map((x) => (
                  <div key={x.kind + x.id} onClick={() => addProgress(x)} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', fontSize: 12.5 }}>
                    <span style={{ flex: 1 }}>{x.name}</span>
                    <span style={{ color: MUTED }}>{usd(x.invoiced)} of {usd(x.value)}</span>
                    {x.billable > 0 && <b style={{ color: '#8A6D12' }}>{usd(x.billable)} ready</b>}
                  </div>
                ))}
                {!items.some((x) => !onInvoice.has(keyOf({ kind: x.kind, id: x.id })) && (x.value || 0) > x.invoiced) && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>Every item with a value is on this invoice or fully billed.</div>}
              </div>
            )}
            {picking === 'reimb' && (
              <div style={{ position: 'absolute', top: 46, left: 12, zIndex: 5, ...card, boxShadow: '0 12px 30px rgba(20,8,31,.15)', maxHeight: 320, overflowY: 'auto', minWidth: 460 }}>
                {readyReimbs.map((x) => (
                  <div key={x.id} onClick={() => addReimb(x)} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', fontSize: 12.5 }}>
                    <b style={{ color: ACCENT }}>{x.number}</b><span style={{ flex: 1 }}>{x.description}</span><b>{usd(x.billAmount)}</b>
                  </div>
                ))}
                {!readyReimbs.length && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>No approved reimbursables waiting to be billed.</div>}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div><Label text="Notes on the document" /><textarea disabled={!canEdit} rows={4} value={h.notes} onChange={setHead('notes')} placeholder="Payment instructions, remarks…" style={{ ...input, resize: 'vertical' }} /></div>
        <Totals work={d(tot.work)} ret={d(tot.ret)} adj={d(tot.adj)} reimb={d(tot.reimb)} rel={d(tot.rel)} tax={d(tot.tax)} total={d(totalC)} credit={isCredit} note={dirty ? 'Preview -- saved when you save or issue.' : undefined} />
      </div>

      {step === 'request' && <ReasonBox title="Send for approval" confirm="Send" onCancel={() => setStep(null)} onSubmit={(v) => requestApproval(v.comment)} fields={[{ key: 'comment', label: 'Note for the approver', type: 'textarea' }]} />}
      {step === 'return' && <ReasonBox title="Return to the preparer" confirm="Return" onCancel={() => setStep(null)} onSubmit={(v) => returnIt(v.comment)} fields={[{ key: 'comment', label: 'What needs changing', type: 'textarea', required: true }]} />}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid ' + LINE, paddingTop: 14, flexWrap: 'wrap' }}>
        {canEdit && <div onClick={remove} style={{ ...btn(), color: DANGER, marginRight: 'auto' }}>Delete draft</div>}
        <div onClick={() => printInvoice({ ...inv, ...h, retentionPct: invRet, taxPct: invTax } as any, overview, true)} style={btn()}>Preview</div>
        {canEdit && <div onClick={busy ? undefined : save} style={btn(false, busy || !dirty)}>Save draft</div>}
        {r.issueInvoice && inv.approvalRequestedAt && <div onClick={() => setStep('return')} style={btn()}>Return</div>}
        {r.issueInvoice
          ? <div onClick={busy ? undefined : issue} style={btn(true, busy)}>Issue {docName(inv).toLowerCase()}</div>
          : canEdit && !inv.approvalRequestedAt && <div onClick={() => setStep('request')} style={btn(true)}>Send for approval</div>}
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
        Drafts don't reserve work: when issued, every line is checked again against what has been invoiced by then, and the number is assigned.
        Contract work is always pre-tax; retention is held from each claim, and tax is charged on the amount after retention. Reimbursables and retention releases are billed outside the contract.
      </div>
      <ApprovalTrail items={inv.approvals} />
    </div>
  );
}

function Totals({ work, ret, adj, reimb = 0, rel = 0, tax, total, paid, credited, outstanding, note, credit }: {
  work: number; ret: number; adj: number; reimb?: number; rel?: number; tax: number; total: number; paid?: number; credited?: number; outstanding?: number; note?: string; credit?: boolean;
}) {
  const row = (l: string, v: string, strong = false, tone?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: strong ? 14 : 12.5, fontWeight: strong ? 700 : 500, color: tone || INK }}><span>{l}</span><span>{v}</span></div>
  );
  return (
    <div style={{ ...card, padding: '12px 16px' }}>
      {work || (!credit && !reimb && !rel) ? row('Contract work', usd(work)) : null}
      {ret ? row(ret > 0 ? 'Retention held' : 'Retention reversed', ret > 0 ? `−${usd(ret)}` : `+${usd(-ret)}`) : (!credit && work ? row('Retention held', usd(0)) : null)}
      {rel ? row('Retention released', usd(rel)) : null}
      {reimb ? row('Reimbursables', usd(reimb)) : null}
      {adj ? row('Adjustments', usd(adj)) : null}
      {row('Tax', usd(tax))}
      <div style={{ borderTop: '1px solid ' + LINE, margin: '6px 0' }} />
      {row(credit ? 'Total credit' : 'Total due', usd(total), true)}
      {credited ? row('Credited', usd(credited)) : null}
      {paid != null && row('Received', usd(paid))}
      {outstanding != null && row(outstanding < 0 ? 'Credit due to client' : 'Client owes', usd(Math.abs(outstanding)), true, outstanding > 0 ? DANGER : '#1E6B36')}
      {note && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{note}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ issued / void

function IssuedView({ inv, overview, onChanged, onFail, onOpen }: { inv: Invoice; overview: Overview; onChanged: (i: Invoice) => void; onFail: (e: any) => void; onOpen: (id: string) => void }) {
  const { toast } = useApp();
  const r = overview.rights;
  const live = inv.status === 'issued';
  const isCredit = inv.kind === 'credit';
  const [pay, setPay] = useState<{ date: string; amount: string; method: string; bankRef: string; txnRef: string; notes: string } | null>(null);
  const [step, setStep] = useState<null | 'void' | 'credit' | 'writeoff' | { voidPayment: any }>(null);
  const [creditAmts, setCreditAmts] = useState<Record<string, string>>({});
  const [creditReason, setCreditReason] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => {}); }, []);

  const record = async () => {
    if (!pay) return;
    try { onChanged(await api.finance.recordPayment(inv.id, { ...pay, amount: Number(pay.amount) }) as Invoice); setPay(null); toast('Payment recorded'); }
    catch (e) { onFail(e); }
  };
  const voidPayment = async (p: any, reason: string) => {
    try { onChanged(await api.finance.voidPayment(p.id, { reason, version: p.version }) as Invoice); setStep(null); toast('Payment voided'); } catch (e) { onFail(e); }
  };
  const voidInvoice = async (reason: string) => {
    try { onChanged(await api.finance.voidInvoice(inv.id, { reason, version: inv.version }) as Invoice); setStep(null); toast(`${docName(inv)} voided`); } catch (e) { onFail(e); }
  };
  const credit = async (creditType: 'credit' | 'write_off', extra: Record<string, unknown>) => {
    try {
      const cn = await api.finance.createCredit(inv.id, { creditType, ...extra }) as Invoice;
      setStep(null); setCreditAmts({}); setCreditReason(''); toast('Draft created — review and issue it'); onOpen(cn.id);
    } catch (e) { onFail(e); }
  };
  const livePays = (inv.payments || []).filter((p) => !p.voidedAt);
  const liveCredits = (inv.credits || []).filter((x) => x.status !== 'void');
  const creditable = (inv.lines || []).filter((l) => l.kind !== 'adjustment' && l.kind !== 'retention_release');
  const cols = 'minmax(220px,2fr) 110px 80px 80px 120px 100px 90px 110px';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <InvoiceBadge s={inv.paymentStatus} />
        <span style={{ fontSize: 12.5, color: MUTED }}>Dated {fmtDate(inv.invoiceDate)}{!isCredit ? ` · due ${fmtDate(inv.dueDate)}` : ''}{inv.periodStart ? ` · period ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}` : ''}</span>
        <div style={{ flex: 1 }} />
        <div onClick={() => printInvoice(inv, overview)} style={btn()}>Print / PDF</div>
        {live && !isCredit && r.issueInvoice && <div onClick={() => setStep('credit')} style={btn()}>Credit note</div>}
        {live && !isCredit && r.issueInvoice && inv.outstanding > 0 && <div onClick={() => setStep('writeoff')} style={btn()}>Write off</div>}
        {live && !isCredit && r.recordPayment && inv.outstanding > 0 && <div onClick={() => setPay({ date: todayISO(), amount: String(inv.outstanding), method: 'ach', bankRef: '', txnRef: '', notes: '' })} style={btn(true)}>Record payment received</div>}
      </div>
      {inv.status === 'void' && (
        <div style={{ ...card, padding: '10px 14px', background: '#F7ECE6', fontSize: 12.5, color: DANGER }}>
          Voided {fmtDate(inv.voidedAt)} by {inv.voidedByName}: {inv.voidReason}. It no longer counts toward invoiced, outstanding or retention.
        </div>
      )}
      {isCredit && (
        <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, background: '#EEF3F8' }}>
          {inv.creditType === 'write_off' ? 'Write-off' : 'Credit note'} against <span onClick={() => inv.creditFor && onOpen(inv.creditFor.id)} style={{ color: ACCENT, cursor: 'pointer', fontWeight: 700 }}>{inv.creditFor?.issuedNumber}</span>: {inv.creditReason}
        </div>
      )}

      {step === 'credit' && (
        <div style={{ ...card, padding: '12px 14px', borderColor: ACCENT, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Credit note — how much to take off each line</div>
          {creditable.map((l) => (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
              <span>{l.description}</span><span style={{ textAlign: 'right', color: MUTED }}>of {usd(l.amount)}</span>
              <input type="number" min={0} max={l.amount} value={creditAmts[l.id] || ''} onChange={(e) => setCreditAmts({ ...creditAmts, [l.id]: e.target.value })} placeholder="0.00" style={{ ...input, textAlign: 'right' }} />
            </div>
          ))}
          <div><Label text="Reason *" /><input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="e.g. Steel progress over-claimed on this invoice" style={input} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={creditReason.trim() ? () => credit('credit', { reason: creditReason, lines: Object.entries(creditAmts).filter(([, v]) => Number(v) > 0).map(([lineId, amount]) => ({ lineId, amount: Number(amount) })) }) : undefined} style={btn(true, !creditReason.trim())}>Create credit note</div>
            <div onClick={() => setStep(null)} style={btn()}>Cancel</div>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED }}>Amounts are the contract-work (pre-tax) claim; retention and tax come off at the line's own rates. Credited work shows as billable again.</div>
        </div>
      )}
      {step === 'writeoff' && <ReasonBox title={`Write off the unpaid balance of ${inv.issuedNumber}`} tone="danger" confirm="Create write-off" onCancel={() => setStep(null)}
        onSubmit={(v) => credit('write_off', { reason: v.reason, amount: v.amount ? Number(v.amount) : undefined })}
        fields={[{ key: 'amount', label: 'Amount', type: 'number', initial: String(inv.outstanding) }, { key: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'e.g. Settlement agreed with the client' }]} />}
      {step === 'void' && <ReasonBox title={`Void ${inv.issuedNumber}`} tone="danger" confirm="Void" onCancel={() => setStep(null)} onSubmit={(v) => voidInvoice(v.reason)} fields={[{ key: 'reason', label: 'Why', type: 'textarea', required: true }]} />}
      {step && typeof step === 'object' && <ReasonBox title={`Void the ${usd(step.voidPayment.amount)} payment of ${fmtDate(step.voidPayment.date)}`} tone="danger" confirm="Void payment" onCancel={() => setStep(null)} onSubmit={(v) => voidPayment(step.voidPayment, v.reason)} fields={[{ key: 'reason', label: 'Why', type: 'textarea', required: true }]} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, fontSize: 12.5, lineHeight: 1.6 }}>
        <div><Label text="Bill to" /><b>{inv.billToName || '—'}</b><div style={{ color: MUTED, whiteSpace: 'pre-line' }}>{[inv.billToEmail, inv.billToAddress].filter(Boolean).join('\n')}</div></div>
        <div><Label text="Reference" />{inv.reference || '—'}{inv.poNumber ? <div style={{ color: MUTED }}>PO {inv.poNumber}</div> : null}</div>
        <div><Label text="Description" />{inv.description || '—'}</div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 900 }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '8px 12px', background: '#FBF9F4', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Line</span><span style={{ textAlign: 'right' }}>Value</span><span style={{ textAlign: 'right' }}>Prev %</span><span style={{ textAlign: 'right' }}>To date %</span>
              <span style={{ textAlign: 'right' }}>This claim</span><span style={{ textAlign: 'right' }}>Retention</span><span style={{ textAlign: 'right' }}>Tax</span><span style={{ textAlign: 'right' }}>Net + tax</span>
            </div>
            {(inv.lines || []).map((l: any) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Badge tone={KIND_BADGE[l.kind as LineKind]?.[1] || 'grey'}>{KIND_BADGE[l.kind as LineKind]?.[0] || l.kind}</Badge>
                  <span>{l.description}{l.kind === 'manual' && l.quantity != null ? <span style={{ color: MUTED }}> · {l.quantity} {l.unit || ''} × {usd(l.rate)}</span> : null}</span></span>
                <span style={{ textAlign: 'right' }}>{l.contractValue != null ? usd(l.contractValue) : ''}</span>
                <span style={{ textAlign: 'right', color: MUTED }}>{l.prevProgressPct != null ? pct(l.prevProgressPct) : ''}</span>
                <span style={{ textAlign: 'right' }}>{l.currentProgressPct != null ? pct(l.currentProgressPct) : ''}</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: l.amount < 0 ? DANGER : INK }}>{usd(l.amount)}</span>
                <span style={{ textAlign: 'right' }}>{l.retentionAmount ? (l.retentionAmount > 0 ? `−${usd(l.retentionAmount)}` : `+${usd(-l.retentionAmount)}`) : '—'}</span>
                <span style={{ textAlign: 'right' }}>{l.taxAmount ? usd(l.taxAmount) : '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{usd(Number(l.amount) - Number(l.retentionAmount) + Number(l.taxAmount))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {pay && (
            <div style={{ ...card, padding: '12px 14px', borderColor: ACCENT, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Record a payment received from the client · {usd(inv.outstanding)} owed</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                <div><Label text="Date received" /><input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} style={input} /></div>
                <div><Label text="Amount ($)" /><input type="number" min={0} max={inv.outstanding} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} style={input} /></div>
                <div><Label text="Method" /><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} style={input}>{PAYMENT_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div><Label text="Bank reference" /><input value={pay.bankRef} onChange={(e) => setPay({ ...pay, bankRef: e.target.value })} style={input} /></div>
                <div><Label text="Check / transaction #" /><input value={pay.txnRef} onChange={(e) => setPay({ ...pay, txnRef: e.target.value })} style={input} /></div>
                <div><Label text="Notes" /><input value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} style={input} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}><div onClick={record} style={btn(true)}>Save payment</div><div onClick={() => setPay(null)} style={btn()}>Cancel</div></div>
            </div>
          )}
          {!isCredit && <div>
            <Label text="Payments received" />
            <div style={{ ...card, overflow: 'hidden' }}>
              {(inv.payments || []).map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, opacity: p.voidedAt ? 0.55 : 1 }}>
                  <span style={{ width: 100, color: MUTED }}>{fmtDate(p.date)}</span>
                  <span style={{ flex: 1 }}>{(PAYMENT_METHODS.find(([k]) => k === p.method)?.[1]) || p.method}{p.bankRef ? ` · ${p.bankRef}` : ''}{p.txnRef ? ` · #${p.txnRef}` : ''}{p.voidedAt ? ` · voided: ${p.voidReason}` : ''}</span>
                  <b style={{ textDecoration: p.voidedAt ? 'line-through' : 'none' }}>{usd(p.amount)}</b>
                  {live && r.recordPayment && !p.voidedAt && <span onClick={() => setStep({ voidPayment: p })} style={{ fontSize: 11.5, color: DANGER, cursor: 'pointer' }}>Void</span>}
                </div>
              ))}
              {!inv.payments?.length && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>No payments yet.</div>}
            </div>
          </div>}
          {!isCredit && !!inv.credits?.length && <div>
            <Label text="Credit notes & write-offs" />
            <div style={{ ...card, overflow: 'hidden' }}>
              {inv.credits.map((x) => (
                <div key={x.id} onClick={() => onOpen(x.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, cursor: 'pointer', opacity: x.status === 'void' ? 0.55 : 1 }}>
                  <b style={{ width: 120, color: ACCENT }}>{x.issuedNumber || 'Draft'}</b>
                  <span style={{ flex: 1 }}>{x.creditType === 'write_off' ? 'Write-off' : 'Credit'} · {fmtDate(x.invoiceDate)} · {x.status}</span>
                  <b>{usd(x.total)}</b>
                </div>
              ))}
            </div>
          </div>}
          {inv.notes && <div style={{ fontSize: 12.5, whiteSpace: 'pre-line' }}><Label text="Notes" />{inv.notes}</div>}
          <Attachments scope="finance-invoices" taskId={inv.id} attachments={inv.attachments || []} canManage={r.prepareInvoice} storageReady={storageReady}
            onUpload={async (files) => { await api.finance.uploadAttachments(inv.id, files); onChanged(await api.finance.invoice(inv.id) as Invoice); }}
            onRemove={async (att) => { await api.finance.removeAttachment(inv.id, att.id); onChanged(await api.finance.invoice(inv.id) as Invoice); }}
            onAddLink={async (name, url) => { await api.finance.addLink(inv.id, name, url); onChanged(await api.finance.invoice(inv.id) as Invoice); }} />
          <ApprovalTrail items={inv.approvals} />
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <Totals work={inv.contractWork} ret={inv.retention} adj={inv.adjustment} reimb={inv.reimbursable} rel={inv.retentionRelease} tax={inv.tax} total={inv.total} credit={isCredit}
            credited={live && !isCredit ? inv.credited : undefined} paid={live && !isCredit ? inv.paid : undefined} outstanding={live && !isCredit ? inv.outstanding : undefined} />
          {live && r.issueInvoice && !livePays.length && !liveCredits.length && <div onClick={() => setStep('void')} style={{ ...btn(), color: DANGER, textAlign: 'center' }}>Void {docName(inv).toLowerCase()}</div>}
          {live && r.issueInvoice && (livePays.length > 0 || liveCredits.length > 0) && !isCredit && <div style={{ fontSize: 11.5, color: MUTED }}>To void this invoice, void its payments and credit notes first — or issue a credit note instead.</div>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ print

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** The invoice on the company letterhead, in a new window ready to print or save as PDF. */
async function printInvoice(inv: Invoice, overview: Overview, draft = false) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write('<p style="font-family:Arial;padding:30px;color:#777">Preparing the document…</p>');
  let b: any = {};
  try { b = await api.finance.brand(); } catch { /* print without the letterhead */ }
  const accent = b.accentColor || '#173326';
  const isCredit = inv.kind === 'credit';
  const heading = isCredit ? (inv.creditType === 'write_off' ? 'WRITE-OFF' : 'CREDIT NOTE') : inv.kind === 'retention' ? 'INVOICE — RETENTION' : 'INVOICE';
  const lines = inv.lines || [];
  const lineRows = lines.map((l: any) => `<tr><td>${esc(l.description)}${l.kind === 'progress' && l.currentProgressPct != null ? `<div class="n">${esc(pct(l.prevProgressPct))} → ${esc(pct(l.currentProgressPct))} of ${esc(usd(l.contractValue))}</div>` : ''}${l.kind === 'manual' && l.quantity != null ? `<div class="n">${esc(l.quantity)} ${esc(l.unit || '')} × ${esc(usd(l.rate))}</div>` : ''}</td>
<td class="r">${esc(usd(l.amount))}</td><td class="r">${l.retentionAmount ? esc(usd(-l.retentionAmount)) : '—'}</td><td class="r">${l.taxAmount ? esc(usd(l.taxAmount)) : '—'}</td></tr>`).join('');
  const totalRow = (label: string, v: string, strong = false) => `<tr class="${strong ? 'b' : ''}"><td>${esc(label)}</td><td class="r">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.issuedNumber || 'Draft')} — ${esc(overview.project.name)}</title>
<style>body{font-family:Arial,sans-serif;color:#0B1A12;margin:36px;font-size:12.5px}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${esc(accent)};padding-bottom:14px}
.co{font-size:12px;color:#556;line-height:1.5}.co b{font-size:16px;color:#0B1A12}h1{font-size:24px;margin:0;color:${esc(accent)};text-align:right}.meta{text-align:right;line-height:1.7}
.row{display:flex;gap:40px;margin:22px 0}.lbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#778;font-weight:bold;margin-bottom:4px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#778;border-bottom:1px solid #ccc;padding:6px 4px}
td{padding:7px 4px;border-bottom:1px solid #eee;vertical-align:top}.r{text-align:right;white-space:nowrap}.n{color:#778;font-size:11px;margin-top:2px}
.tot{width:340px;margin-left:auto;margin-top:16px}.tot td{border:none;padding:4px}.tot .b td{font-weight:bold;font-size:15px;border-top:2px solid #0B1A12;padding-top:8px}
.draft{color:#b33;font-weight:bold;letter-spacing:.2em}.foot{margin-top:40px;font-size:11px;color:#778;border-top:1px solid #ddd;padding-top:10px}</style></head><body>
<div class="top"><div class="co">${b.logoDataUrl ? `<img src="${esc(b.logoDataUrl)}" style="max-height:56px;max-width:220px;display:block;margin-bottom:8px">` : ''}<b>${esc(b.companyName || '')}</b><br>${esc(b.address || '')}<br>${esc([b.phone, b.email, b.website].filter(Boolean).join(' · '))}</div>
<div class="meta"><h1>${heading}</h1>${draft ? '<div class="draft">DRAFT</div>' : ''}<b>${esc(inv.issuedNumber || 'Not yet numbered')}</b><br>Date: ${esc(fmtDate(inv.invoiceDate))}${!isCredit ? `<br>Due: ${esc(fmtDate(inv.dueDate))}` : ''}${inv.creditFor ? `<br>Against: ${esc(inv.creditFor.issuedNumber)}` : ''}${inv.poNumber ? `<br>PO: ${esc(inv.poNumber)}` : ''}${inv.reference && !inv.creditFor ? `<br>Ref: ${esc(inv.reference)}` : ''}</div></div>
<div class="row"><div><div class="lbl">Bill to</div><b>${esc(inv.billToName || '')}</b><br>${esc(inv.billToAddress || '').replace(/\n/g, '<br>')}${inv.billToEmail ? `<br>${esc(inv.billToEmail)}` : ''}</div>
<div><div class="lbl">Project</div>${esc(overview.project.name)}${inv.periodStart ? `<br><span class="n">Period ${esc(fmtDate(inv.periodStart))} – ${esc(fmtDate(inv.periodEnd))}</span>` : ''}</div></div>
${inv.description ? `<p>${esc(inv.description)}</p>` : ''}${isCredit && inv.creditReason ? `<p>Reason: ${esc(inv.creditReason)}</p>` : ''}
<table><thead><tr><th>Description</th><th class="r">Amount</th><th class="r">Retention</th><th class="r">Tax</th></tr></thead><tbody>${lineRows}</tbody></table>
<table class="tot">${inv.contractWork || !isCredit ? totalRow('Contract work', usd(inv.contractWork)) : ''}${inv.retention ? totalRow(inv.retention > 0 ? 'Less retention held' : 'Retention reversed', usd(-inv.retention)) : ''}${inv.retentionRelease ? totalRow('Retention released', usd(inv.retentionRelease)) : ''}${inv.reimbursable ? totalRow('Reimbursable expenses', usd(inv.reimbursable)) : ''}${inv.adjustment ? totalRow('Adjustments', usd(inv.adjustment)) : ''}${totalRow('Tax', usd(inv.tax))}${totalRow(isCredit ? 'Total credit' : 'Total due', usd(inv.total), true)}${inv.status === 'issued' && !isCredit && (inv.paid || inv.credited) ? (inv.credited ? totalRow('Credited', usd(inv.credited)) : '') + (inv.paid ? totalRow('Paid to date', usd(inv.paid)) : '') + totalRow('Balance due', usd(inv.outstanding), true) : ''}</table>
${inv.notes ? `<p style="margin-top:24px;white-space:pre-line">${esc(inv.notes)}</p>` : ''}
${inv.status === 'void' ? `<p class="draft">VOID — ${esc(inv.voidReason || '')}</p>` : ''}
<div class="foot">${esc(b.footerNote || '')}</div>
<script>window.onload=function(){window.print()}</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
