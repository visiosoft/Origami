import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { Attachments } from '../Attachments';
import { ACCENT, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, btn, card, fmtDate, input, todayISO } from '../manpowerUi';
import { InvoiceBadge, PAYMENT_METHODS, failed, pct, usd, type Invoice, type InvoiceLine, type Overview, type Row } from './financeUi';

/** A line as edited in the draft form -- numbers kept as typed text until saved. */
interface EditLine {
  id?: string; kind: 'progress' | 'manual' | 'adjustment'; targetType?: string | null; phaseId?: string | null; taskId?: string | null;
  description: string; contractValue: number | null; prevBilled: number; current: string; amount: string;
  quantity: string; unit: string; rate: string; retentionApplies: boolean; taxable: boolean;
}

// Cents helpers mirroring the server's money.ts -- the preview only; the server recomputes on save and issue.
const c = (n: number | string | null | undefined) => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100 + (v >= 0 ? 1e-9 : -1e-9)) : 0; };
const pctOfC = (cents: number, p: number) => { const x = (cents * p) / 100; return Math.sign(x) * Math.round(Math.abs(x)); };
const d = (cents: number) => cents / 100;

/** Items that can carry a progress line, as the server's billableItems(). */
function billable(o: Overview): Row[] {
  const out: Row[] = [];
  if (o.sov.lump) out.push(o.sov.lump);
  for (const g of o.sov.groups) for (const r of g.rows) {
    if (r.kind === 'phase') { if (r.valueFromTasks) out.push(...(r.children || []).filter((x) => x.ownValue != null)); else if (r.ownValue != null) out.push(r); }
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
  retentionApplies: l.retentionApplies, taxable: l.taxable,
});

export function InvoiceDrawer({ invoiceId, overview, onClose, onChanged }: { invoiceId: string; overview: Overview; onClose: () => void; onChanged: () => void }) {
  const { toast } = useApp();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const load = () => api.finance.invoice(invoiceId).then((r: any) => { setInv(r); setError(''); }).catch((e: any) => setError(e.message || 'Could not load the invoice'));
  useEffect(() => { load(); }, [invoiceId]);
  const apply = (r: any) => { setInv(r); onChanged(); };
  const fail = (e: any) => {
    failed(toast, e);
    if (/since you opened it|changed by/i.test(e?.message || '')) load();
  };

  const title = inv ? (inv.issuedNumber || 'Draft invoice') : 'Invoice';
  const subtitle = inv ? `${overview.project.name} · ${inv.kind === 'progress' ? 'Progress claim' : 'Standard invoice'}${inv.status === 'issued' ? ` · issued ${fmtDate(inv.issuedAt)} by ${inv.issuedByName || '—'}` : ''}` : '';
  return (
    <Drawer title={title} subtitle={subtitle} width={1040} onClose={onClose}>
      {error && <div style={{ fontSize: 13, color: DANGER }}>{error}</div>}
      {!inv && !error && <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>}
      {inv && inv.status === 'draft' && <DraftEditor inv={inv} overview={overview} onSaved={apply} onFail={fail} onDeleted={() => { onChanged(); onClose(); }} />}
      {inv && inv.status !== 'draft' && <IssuedView inv={inv} overview={overview} onChanged={apply} onFail={fail} />}
    </Drawer>
  );
}

// ------------------------------------------------------------------ draft

function DraftEditor({ inv, overview, onSaved, onFail, onDeleted }: {
  inv: Invoice; overview: Overview; onSaved: (i: Invoice) => void; onFail: (e: any) => void; onDeleted: () => void;
}) {
  const { toast } = useApp();
  const canManage = overview.rights.manage;
  const [h, setH] = useState(() => ({
    invoiceDate: inv.invoiceDate || '', dueDate: inv.dueDate || '', periodStart: inv.periodStart || '', periodEnd: inv.periodEnd || '',
    reference: inv.reference || '', poNumber: inv.poNumber || '', description: inv.description || '', billToName: inv.billToName || '',
    billToEmail: inv.billToEmail || '', billToAddress: inv.billToAddress || '', retentionPct: String(inv.retentionPct ?? 0), taxPct: String(inv.taxPct ?? 0), notes: inv.notes || '',
  }));
  const [lines, setLines] = useState<EditLine[]>(() => (inv.lines || []).map(toEdit));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  useEffect(() => { setLines((inv.lines || []).map(toEdit)); setDirty(false); }, [inv.version]);

  const items = useMemo(() => billable(overview), [overview]);
  const byKey = useMemo(() => new Map(items.map((r) => [keyOf({ kind: r.kind, id: r.id }), r])), [items]);
  const setHead = (k: keyof typeof h) => (e: any) => { setH({ ...h, [k]: e.target.value }); setDirty(true); };
  const patch = (i: number, p: Partial<EditLine>) => { setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l))); setDirty(true); };

  // Live preview: each line's amount, retention, net and tax, the way the server will compute them.
  const invRet = Number(h.retentionPct) || 0;
  const invTax = Number(h.taxPct) || 0;
  const figures = lines.map((l) => {
    const item = l.kind === 'progress' ? byKey.get(keyOf(l)) : undefined;
    const amountC = l.kind === 'manual' && l.quantity !== '' && l.rate !== '' ? Math.round(Number(l.quantity) * c(l.rate)) : c(l.amount);
    const retPct = l.kind === 'adjustment' ? 0 : item?.fin?.retentionPctOverride != null ? Number(item.fin.retentionPctOverride) : invRet;
    const taxPct = item?.fin?.taxPctOverride != null ? Number(item.fin.taxPctOverride) : invTax;
    const retC = l.kind !== 'adjustment' && l.retentionApplies ? pctOfC(amountC, retPct) : 0;
    const netC = amountC - retC;
    const taxC = l.taxable ? pctOfC(netC, taxPct) : 0;
    return { amountC, retC, netC, taxC, retPct, taxPct };
  });
  const tot = figures.reduce((a, f, i) => ({
    work: a.work + (lines[i].kind === 'adjustment' ? 0 : f.amountC), ret: a.ret + f.retC, adj: a.adj + (lines[i].kind === 'adjustment' ? f.amountC : 0), tax: a.tax + f.taxC,
  }), { work: 0, ret: 0, adj: 0, tax: 0 });
  const totalC = tot.work - tot.ret + tot.adj + tot.tax;

  const payload = () => ({
    version: inv.version, ...h,
    lines: lines.map((l) => ({
      id: l.id, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, description: l.description,
      amount: l.kind === 'manual' && l.quantity !== '' && l.rate !== '' ? undefined : Number(l.amount), quantity: l.quantity, unit: l.unit, rate: l.rate,
      retentionApplies: l.retentionApplies, taxable: l.taxable,
    })),
  });
  const save = async () => {
    setBusy(true);
    try { const r = await api.finance.updateInvoice(inv.id, payload()) as Invoice; onSaved(r); setDirty(false); toast('Draft saved'); return r; }
    catch (e) { onFail(e); return null; }
    finally { setBusy(false); }
  };
  const issue = async () => {
    const current = dirty ? await save() : inv;
    if (!current) return;
    if (!current.lines?.length) { toast('⚠ Add at least one line before issuing.'); return; }
    if (!window.confirm(`Issue this invoice for ${usd(current.total)}? It gets its number now and can't be edited afterwards -- only voided.`)) return;
    setBusy(true);
    try { onSaved(await api.finance.issueInvoice(inv.id, current.version) as Invoice); toast('Invoice issued'); }
    catch (e) { onFail(e); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this draft?')) return;
    try { await api.finance.deleteInvoice(inv.id); toast('Draft deleted'); onDeleted(); } catch (e) { onFail(e); }
  };

  const addProgress = (r: Row) => {
    const phaseId = r.kind === 'phase' ? r.id : r.kind === 'task' ? r.phaseId || null : null;
    setLines([...lines, {
      kind: 'progress', targetType: r.kind, phaseId, taskId: r.kind === 'task' ? r.id : null, description: r.name, contractValue: r.value,
      prevBilled: r.invoiced, current: '', amount: String(Math.max(r.billable, 0) || ''), quantity: '', unit: '', rate: '', retentionApplies: true, taxable: invTax > 0,
    }]);
    setPicking(false); setDirty(true);
  };
  const addManual = () => { setLines([...lines, { kind: 'manual', description: '', contractValue: null, prevBilled: 0, current: '', amount: '', quantity: '1', unit: '', rate: '', retentionApplies: true, taxable: invTax > 0 }]); setDirty(true); };
  const addAdjustment = () => { setLines([...lines, { kind: 'adjustment', description: '', contractValue: null, prevBilled: 0, current: '', amount: '', quantity: '', unit: '', rate: '', retentionApplies: false, taxable: false }]); setDirty(true); };
  const onInvoice = new Set(lines.filter((l) => l.kind === 'progress').map((l) => keyOf(l)));

  const cols = 'minmax(200px,2.2fr) 105px 80px 90px 120px 95px 70px 110px 28px';
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        <div><Label text="Invoice date" /><input type="date" value={h.invoiceDate} onChange={setHead('invoiceDate')} style={input} /></div>
        <div><Label text="Due date" /><input type="date" value={h.dueDate} onChange={setHead('dueDate')} style={input} /></div>
        <div><Label text="Period from" /><input type="date" value={h.periodStart} onChange={setHead('periodStart')} style={input} /></div>
        <div><Label text="Period to" /><input type="date" value={h.periodEnd} onChange={setHead('periodEnd')} style={input} /></div>
        <div><Label text="Retention %" /><input type="number" min={0} max={100} value={h.retentionPct} onChange={setHead('retentionPct')} style={input} /></div>
        <div><Label text="Tax %" /><input type="number" min={0} max={100} value={h.taxPct} onChange={setHead('taxPct')} style={input} /></div>
        <div><Label text="Reference / contract" /><input value={h.reference} onChange={setHead('reference')} style={input} /></div>
        <div><Label text="Client PO" /><input value={h.poNumber} onChange={setHead('poNumber')} style={input} /></div>
        <div><Label text="Bill to" /><input value={h.billToName} onChange={setHead('billToName')} style={input} /></div>
        <div><Label text="Billing email" /><input value={h.billToEmail} onChange={setHead('billToEmail')} style={input} /></div>
        <div style={{ gridColumn: 'span 2' }}><Label text="Billing address" /><input value={h.billToAddress} onChange={setHead('billToAddress')} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Description" /><input value={h.description} onChange={setHead('description')} placeholder="e.g. Progress claim #3 — work to 30 September" style={input} /></div>
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
                    <Badge tone={l.kind === 'progress' ? 'green' : l.kind === 'manual' ? 'blue' : 'amber'}>{l.kind === 'progress' ? 'SOV' : l.kind === 'manual' ? 'Item' : 'Adj.'}</Badge>
                    <input value={l.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder={l.kind === 'adjustment' ? 'What the adjustment is for' : 'Description'} style={{ ...input, padding: '5px 7px', fontSize: 12.5 }} />
                  </span>
                  {l.kind === 'progress' ? <span style={{ textAlign: 'right', fontSize: 12.5 }}>{usd(l.contractValue)}</span>
                    : l.kind === 'manual' ? <span style={{ display: 'flex', gap: 3 }}>
                      <input type="number" value={l.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} title="Quantity" style={{ ...input, padding: '5px 5px', fontSize: 12, width: 44 }} />
                      <input type="number" value={l.rate} onChange={(e) => patch(i, { rate: e.target.value })} title="Rate" placeholder="rate" style={{ ...input, padding: '5px 5px', fontSize: 12 }} />
                    </span> : <span />}
                  <span style={{ textAlign: 'right', fontSize: 12.5, color: MUTED }}>{l.kind === 'progress' ? pct(Math.round(prevPct * 100) / 100) : ''}</span>
                  {l.kind === 'progress'
                    ? <input type="number" min={0} max={100} value={l.current !== '' ? l.current : String(Math.round(toDatePct * 100) / 100)}
                      onChange={(e) => {
                        const p = e.target.value;
                        const amt = p === '' ? '' : String(d(pctOfC(valueC, Number(p)) - c(l.prevBilled)));
                        patch(i, { current: p, amount: amt });
                      }} style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />
                    : <span />}
                  {l.kind === 'manual' && l.quantity !== '' && l.rate !== ''
                    ? <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{usd(d(f.amountC))}</span>
                    : <input type="number" value={l.amount} onChange={(e) => patch(i, { amount: e.target.value, current: '' })} placeholder={l.kind === 'adjustment' ? '− for a discount' : ''}
                      style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />}
                  <span style={{ textAlign: 'right', fontSize: 12, display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {l.kind !== 'adjustment' && <input type="checkbox" checked={l.retentionApplies} onChange={(e) => patch(i, { retentionApplies: e.target.checked })} title="Retention applies" />}
                    {f.retC ? `−${usd(d(f.retC))}` : '—'}
                  </span>
                  <span style={{ textAlign: 'center' }}><input type="checkbox" checked={l.taxable} onChange={(e) => patch(i, { taxable: e.target.checked })} title={`Taxable at ${pct(f.taxPct)}`} /></span>
                  <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{usd(d(f.netC + f.taxC))}</span>
                  <span onClick={() => { setLines(lines.filter((_, j) => j !== i)); setDirty(true); }} title="Remove line" style={{ cursor: 'pointer', color: MUTED, textAlign: 'center', fontSize: 16 }}>×</span>
                </div>
              );
            })}
            {!lines.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No lines yet.</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid ' + LINE, flexWrap: 'wrap', position: 'relative' }}>
          <div onClick={() => setPicking(!picking)} style={btn()}>+ Schedule-of-values line</div>
          <div onClick={addManual} style={btn()}>+ Manual item</div>
          <div onClick={addAdjustment} style={btn()}>+ Adjustment</div>
          {picking && (
            <div style={{ position: 'absolute', top: 46, left: 12, zIndex: 5, ...card, boxShadow: '0 12px 30px rgba(20,8,31,.15)', maxHeight: 320, overflowY: 'auto', minWidth: 460 }}>
              {items.filter((r) => !onInvoice.has(keyOf({ kind: r.kind, id: r.id })) && (r.value || 0) > r.invoiced).map((r) => (
                <div key={r.kind + r.id} onClick={() => addProgress(r)} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', fontSize: 12.5 }}>
                  <span style={{ flex: 1 }}>{r.name}</span>
                  <span style={{ color: MUTED }}>{usd(r.invoiced)} of {usd(r.value)}</span>
                  {r.billable > 0 && <b style={{ color: '#8A6D12' }}>{usd(r.billable)} ready</b>}
                </div>
              ))}
              {!items.some((r) => !onInvoice.has(keyOf({ kind: r.kind, id: r.id })) && (r.value || 0) > r.invoiced) && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>Every item with a value is on this invoice or fully billed.</div>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div><Label text="Notes on the invoice" /><textarea rows={4} value={h.notes} onChange={setHead('notes')} placeholder="Payment instructions, remarks…" style={{ ...input, resize: 'vertical' }} /></div>
        <Totals work={d(tot.work)} ret={d(tot.ret)} adj={d(tot.adj)} tax={d(tot.tax)} total={d(totalC)} note={dirty ? 'Preview -- saved when you save or issue.' : undefined} />
      </div>

      {canManage && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid ' + LINE, paddingTop: 14 }}>
          <div onClick={remove} style={{ ...btn(), color: DANGER, marginRight: 'auto' }}>Delete draft</div>
          <div onClick={() => printInvoice({ ...inv, ...h, retentionPct: invRet, taxPct: invTax } as any, overview, true)} style={btn()}>Preview</div>
          <div onClick={busy ? undefined : save} style={btn(false, busy || !dirty)}>Save draft</div>
          <div onClick={busy ? undefined : issue} style={btn(true, busy)}>Issue invoice</div>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
        Drafts don't reserve work: when issued, every line is checked again against what has been invoiced by then, and the invoice number is assigned.
        Contract work is always pre-tax; retention is held from each line's claim, and tax is charged on the amount after retention.
      </div>
    </div>
  );
}

function Totals({ work, ret, adj, tax, total, paid, outstanding, note }: { work: number; ret: number; adj: number; tax: number; total: number; paid?: number; outstanding?: number; note?: string }) {
  const row = (l: string, v: string, strong = false, tone?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: strong ? 14 : 12.5, fontWeight: strong ? 700 : 500, color: tone || INK }}><span>{l}</span><span>{v}</span></div>
  );
  return (
    <div style={{ ...card, padding: '12px 16px' }}>
      {row('Contract work', usd(work))}
      {row('Retention held', ret ? `−${usd(ret)}` : usd(0))}
      {adj ? row('Adjustments', usd(adj)) : null}
      {row('Tax', usd(tax))}
      <div style={{ borderTop: '1px solid ' + LINE, margin: '6px 0' }} />
      {row('Total due', usd(total), true)}
      {paid != null && row('Paid', usd(paid))}
      {outstanding != null && row('Outstanding', usd(outstanding), true, outstanding > 0 ? DANGER : '#1E6B36')}
      {note && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{note}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ issued / void

function IssuedView({ inv, overview, onChanged, onFail }: { inv: Invoice; overview: Overview; onChanged: (i: Invoice) => void; onFail: (e: any) => void }) {
  const { toast } = useApp();
  const canManage = overview.rights.manage && inv.status === 'issued';
  const [pay, setPay] = useState<{ date: string; amount: string; method: string; bankRef: string; txnRef: string; notes: string } | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => {}); }, []);

  const record = async () => {
    if (!pay) return;
    try { onChanged(await api.finance.recordPayment(inv.id, { ...pay, amount: Number(pay.amount) }) as Invoice); setPay(null); toast('Payment recorded'); }
    catch (e) { onFail(e); }
  };
  const voidPayment = async (p: any) => {
    const reason = window.prompt(`Void the ${usd(p.amount)} payment of ${fmtDate(p.date)}? Say why:`);
    if (!reason?.trim()) return;
    try { onChanged(await api.finance.voidPayment(p.id, { reason, version: p.version }) as Invoice); toast('Payment voided'); } catch (e) { onFail(e); }
  };
  const voidInvoice = async () => {
    const reason = window.prompt(`Void ${inv.issuedNumber}? It stays on record but stops counting. Say why:`);
    if (!reason?.trim()) return;
    try { onChanged(await api.finance.voidInvoice(inv.id, { reason, version: inv.version }) as Invoice); toast('Invoice voided'); } catch (e) { onFail(e); }
  };
  const live = (inv.payments || []).filter((p) => !p.voidedAt);
  const cols = 'minmax(220px,2fr) 110px 80px 80px 120px 100px 90px 110px';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <InvoiceBadge s={inv.paymentStatus} />
        <span style={{ fontSize: 12.5, color: MUTED }}>Dated {fmtDate(inv.invoiceDate)} · due {fmtDate(inv.dueDate)}{inv.periodStart ? ` · period ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}` : ''}</span>
        <div style={{ flex: 1 }} />
        <div onClick={() => printInvoice(inv, overview)} style={btn()}>Print / PDF</div>
        {canManage && inv.outstanding > 0 && <div onClick={() => setPay({ date: todayISO(), amount: String(inv.outstanding), method: 'ach', bankRef: '', txnRef: '', notes: '' })} style={btn(true)}>Record payment</div>}
      </div>
      {inv.status === 'void' && (
        <div style={{ ...card, padding: '10px 14px', background: '#F7ECE6', fontSize: 12.5, color: DANGER }}>
          Voided {fmtDate(inv.voidedAt)} by {inv.voidedByName}: {inv.voidReason}. It no longer counts toward invoiced, outstanding or retention.
        </div>
      )}
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
                <span>{l.description}{l.kind === 'manual' && l.quantity != null ? <span style={{ color: MUTED }}> · {l.quantity} {l.unit || ''} × {usd(l.rate)}</span> : null}{l.kind === 'adjustment' ? <span style={{ color: MUTED }}> (adjustment)</span> : null}</span>
                <span style={{ textAlign: 'right' }}>{l.contractValue != null ? usd(l.contractValue) : ''}</span>
                <span style={{ textAlign: 'right', color: MUTED }}>{l.prevProgressPct != null ? pct(l.prevProgressPct) : ''}</span>
                <span style={{ textAlign: 'right' }}>{l.currentProgressPct != null ? pct(l.currentProgressPct) : ''}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{usd(l.amount)}</span>
                <span style={{ textAlign: 'right' }}>{l.retentionAmount ? `−${usd(l.retentionAmount)}` : '—'}</span>
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
              <div style={{ fontSize: 13, fontWeight: 700 }}>Record a payment · {usd(inv.outstanding)} outstanding</div>
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
          <div>
            <Label text="Payments" />
            <div style={{ ...card, overflow: 'hidden' }}>
              {(inv.payments || []).map((p) => (
                <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, opacity: p.voidedAt ? 0.55 : 1 }}>
                  <span style={{ width: 100, color: MUTED }}>{fmtDate(p.date)}</span>
                  <span style={{ flex: 1 }}>{(PAYMENT_METHODS.find(([k]) => k === p.method)?.[1]) || p.method}{p.bankRef ? ` · ${p.bankRef}` : ''}{p.txnRef ? ` · #${p.txnRef}` : ''}{p.voidedAt ? ` · voided: ${p.voidReason}` : ''}</span>
                  <b style={{ textDecoration: p.voidedAt ? 'line-through' : 'none' }}>{usd(p.amount)}</b>
                  {canManage && !p.voidedAt && <span onClick={() => voidPayment(p)} style={{ fontSize: 11.5, color: DANGER, cursor: 'pointer' }}>Void</span>}
                </div>
              ))}
              {!inv.payments?.length && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>No payments yet.</div>}
            </div>
          </div>
          {inv.notes && <div style={{ fontSize: 12.5, whiteSpace: 'pre-line' }}><Label text="Notes" />{inv.notes}</div>}
          <Attachments scope="finance-invoices" taskId={inv.id} attachments={inv.attachments || []} canManage={overview.rights.manage} storageReady={storageReady}
            onUpload={async (files) => { await api.finance.uploadAttachments(inv.id, files); onChanged(await api.finance.invoice(inv.id) as Invoice); }}
            onRemove={async (att) => { await api.finance.removeAttachment(inv.id, att.id); onChanged(await api.finance.invoice(inv.id) as Invoice); }}
            onAddLink={async (name, url) => { await api.finance.addLink(inv.id, name, url); onChanged(await api.finance.invoice(inv.id) as Invoice); }} />
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <Totals work={inv.contractWork} ret={inv.retention} adj={inv.adjustment} tax={inv.tax} total={inv.total}
            paid={inv.status === 'issued' ? inv.paid : undefined} outstanding={inv.status === 'issued' ? inv.outstanding : undefined} />
          {canManage && !live.length && <div onClick={voidInvoice} style={{ ...btn(), color: DANGER, textAlign: 'center' }}>Void invoice</div>}
          {canManage && live.length > 0 && <div style={{ fontSize: 11.5, color: MUTED }}>To void this invoice, void its payments first.</div>}
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
  w.document.write('<p style="font-family:Arial;padding:30px;color:#777">Preparing the invoice…</p>');
  let b: any = {};
  try { b = await api.finance.brand(); } catch { /* print without the letterhead */ }
  const accent = b.accentColor || '#173326';
  const lines = inv.lines || [];
  const lineRows = lines.map((l: any) => `<tr><td>${esc(l.description)}${l.kind === 'progress' && l.currentProgressPct != null ? `<div class="n">${esc(pct(l.prevProgressPct))} → ${esc(pct(l.currentProgressPct))} of ${esc(usd(l.contractValue))}</div>` : ''}${l.kind === 'manual' && l.quantity != null ? `<div class="n">${esc(l.quantity)} ${esc(l.unit || '')} × ${esc(usd(l.rate))}</div>` : ''}</td>
<td class="r">${esc(usd(l.amount))}</td><td class="r">${l.retentionAmount ? '−' + esc(usd(l.retentionAmount)) : '—'}</td><td class="r">${l.taxAmount ? esc(usd(l.taxAmount)) : '—'}</td></tr>`).join('');
  const totalRow = (label: string, v: string, strong = false) => `<tr class="${strong ? 'b' : ''}"><td>${esc(label)}</td><td class="r">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.issuedNumber || 'Draft invoice')} — ${esc(overview.project.name)}</title>
<style>body{font-family:Arial,sans-serif;color:#0B1A12;margin:36px;font-size:12.5px}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${esc(accent)};padding-bottom:14px}
.co{font-size:12px;color:#556;line-height:1.5}.co b{font-size:16px;color:#0B1A12}h1{font-size:26px;margin:0;color:${esc(accent)};text-align:right}.meta{text-align:right;line-height:1.7}
.row{display:flex;gap:40px;margin:22px 0}.lbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#778;font-weight:bold;margin-bottom:4px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#778;border-bottom:1px solid #ccc;padding:6px 4px}
td{padding:7px 4px;border-bottom:1px solid #eee;vertical-align:top}.r{text-align:right;white-space:nowrap}.n{color:#778;font-size:11px;margin-top:2px}
.tot{width:320px;margin-left:auto;margin-top:16px}.tot td{border:none;padding:4px}.tot .b td{font-weight:bold;font-size:15px;border-top:2px solid #0B1A12;padding-top:8px}
.draft{color:#b33;font-weight:bold;letter-spacing:.2em}.foot{margin-top:40px;font-size:11px;color:#778;border-top:1px solid #ddd;padding-top:10px}</style></head><body>
<div class="top"><div class="co">${b.logoDataUrl ? `<img src="${esc(b.logoDataUrl)}" style="max-height:56px;max-width:220px;display:block;margin-bottom:8px">` : ''}<b>${esc(b.companyName || '')}</b><br>${esc(b.address || '')}<br>${esc([b.phone, b.email, b.website].filter(Boolean).join(' · '))}</div>
<div class="meta"><h1>INVOICE</h1>${draft ? '<div class="draft">DRAFT</div>' : ''}<b>${esc(inv.issuedNumber || 'Not yet numbered')}</b><br>Date: ${esc(fmtDate(inv.invoiceDate))}<br>Due: ${esc(fmtDate(inv.dueDate))}${inv.poNumber ? `<br>PO: ${esc(inv.poNumber)}` : ''}${inv.reference ? `<br>Ref: ${esc(inv.reference)}` : ''}</div></div>
<div class="row"><div><div class="lbl">Bill to</div><b>${esc(inv.billToName || '')}</b><br>${esc(inv.billToAddress || '').replace(/\n/g, '<br>')}${inv.billToEmail ? `<br>${esc(inv.billToEmail)}` : ''}</div>
<div><div class="lbl">Project</div>${esc(overview.project.name)}${inv.periodStart ? `<br><span class="n">Period ${esc(fmtDate(inv.periodStart))} – ${esc(fmtDate(inv.periodEnd))}</span>` : ''}</div></div>
${inv.description ? `<p>${esc(inv.description)}</p>` : ''}
<table><thead><tr><th>Description</th><th class="r">Amount</th><th class="r">Retention</th><th class="r">Tax</th></tr></thead><tbody>${lineRows}</tbody></table>
<table class="tot">${totalRow('Contract work', usd(inv.contractWork))}${totalRow('Less retention held', inv.retention ? '−' + usd(inv.retention) : usd(0))}${inv.adjustment ? totalRow('Adjustments', usd(inv.adjustment)) : ''}${totalRow('Tax', usd(inv.tax))}${totalRow('Total due', usd(inv.total), true)}${inv.status === 'issued' && inv.paid ? totalRow('Paid to date', usd(inv.paid)) + totalRow('Balance due', usd(inv.outstanding), true) : ''}</table>
${inv.notes ? `<p style="margin-top:24px;white-space:pre-line">${esc(inv.notes)}</p>` : ''}
${inv.status === 'void' ? `<p class="draft">VOID — ${esc(inv.voidReason || '')}</p>` : ''}
<div class="foot">${esc(b.footerNote || '')}</div>
<script>window.onload=function(){window.print()}</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
