import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { Attachments } from '../Attachments';
import { ACCENT, BG, DANGER, INK, MUTED, Drawer, Label, btn, card, fmtDate, headRow, input, todayISO } from '../manpowerUi';
import { ApprovalTrail, REIMB_CATEGORIES, ReasonBox, ReimbBadge, failed, label, usd, usd0, type Overview, type Reimbursable, type Rights } from './financeUi';

/**
 * Reimbursable expenses -- one project's, or every project's (the Reimbursement
 * log). Costs incurred for the client and billed back at cost plus markup.
 */
export function ReimbursableList({ projectId, overview, rights, onChanged, onBill }: {
  projectId?: number; overview?: Overview; rights: Rights; onChanged?: () => void; onBill?: (ids: string[]) => void;
}) {
  const { toast } = useApp();
  const [rows, setRows] = useState<Reimbursable[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const load = () => (projectId ? api.finance.reimbursables(projectId) : api.finance.allReimbursables())
    .then((r: any) => setRows(Array.isArray(r) ? r : [])).catch((e: any) => { setRows([]); toast('⚠ ' + (e.message || 'Could not load reimbursables')); });
  useEffect(() => { load(); }, [projectId]);

  const all = rows || [];
  const shown = all.filter((r) => (status === 'all' || r.status === status) && (!q || `${r.number} ${r.description} ${r.vendor || ''} ${r.projectName || ''}`.toLowerCase().includes(q.toLowerCase())));
  const total = (pred: (r: Reimbursable) => boolean) => all.filter(pred).reduce((a, r) => a + (r.billable ? r.billAmount : r.cost), 0);
  const ready = all.filter((r) => r.status === 'approved' && r.billable && !r.invoiceId);
  const cols = `${onBill ? '28px ' : ''}80px ${projectId ? '' : 'minmax(140px,1.2fr) '}100px minmax(200px,2fr) 140px 110px 110px 150px`;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {[
          ['Awaiting approval', usd0(total((r) => r.status === 'submitted')), `${all.filter((r) => r.status === 'submitted').length} expenses`],
          ['Approved · to bill', usd0(total((r) => r.status === 'approved' && r.billable)), `${ready.length} ready for an invoice`],
          ['Billed', usd0(total((r) => r.status === 'billed')), ''],
          ['Not billable (cost only)', usd0(all.filter((r) => !r.billable && r.status !== 'rejected').reduce((a, r) => a + r.cost, 0)), ''],
        ].map(([l, v, sub]) => (
          <div key={l} style={{ ...card, padding: '10px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
            <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: INK, marginTop: 2 }}>{v}</div>
            {sub && <div style={{ fontSize: 11.5, color: MUTED }}>{sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search expenses" style={{ ...input, width: 240 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 180 }}>
          <option value="all">All statuses</option><option value="submitted">Awaiting approval</option><option value="approved">Approved</option>
          <option value="billed">Billed</option><option value="rejected">Rejected</option>
        </select>
        <div style={{ flex: 1 }} />
        {onBill && rights.prepareInvoice && picked.size > 0 && <div onClick={() => { onBill(Array.from(picked)); setPicked(new Set()); }} style={btn(true)}>Invoice {picked.size} selected</div>}
        {rights.submitReimbursables && <div onClick={() => setCreating(true)} style={btn(!onBill || !picked.size)}>+ Expense</div>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: projectId ? 880 : 1040 }}>
            <div style={headRow(cols)}>
              {onBill && <span />}<span>No.</span>{!projectId && <span>Project</span>}<span>Date</span><span>Expense</span><span>Category</span>
              <span style={{ textAlign: 'right' }}>Cost</span><span style={{ textAlign: 'right' }}>To bill</span><span>Status</span>
            </div>
            {rows === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((r) => {
              const pickable = r.status === 'approved' && r.billable && !r.invoiceId;
              return (
                <div key={r.id} onClick={() => setOpen(r.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', fontSize: 12.5, opacity: r.status === 'rejected' ? 0.55 : 1 }}>
                  {onBill && <span onClick={(e) => e.stopPropagation()}>{pickable && <input type="checkbox" checked={picked.has(r.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(r.id); else n.delete(r.id); setPicked(n); }} />}</span>}
                  <b style={{ color: ACCENT }}>{r.number}</b>
                  {!projectId && <span style={{ color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</span>}
                  <span>{fmtDate(r.date)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}{r.vendor ? <span style={{ color: MUTED }}> · {r.vendor}</span> : null}{r.attachments?.length ? <span style={{ color: MUTED }}> · 📎{r.attachments.length}</span> : null}</span>
                  <span style={{ color: MUTED }}>{label(REIMB_CATEGORIES, r.category)}</span>
                  <span style={{ textAlign: 'right' }}>{usd(r.cost)}</span>
                  <b style={{ textAlign: 'right' }}>{r.billable ? usd(r.billAmount) : <span style={{ color: MUTED, fontWeight: 400 }}>not billed</span>}</b>
                  <span><ReimbBadge s={r.status} /></span>
                </div>
              );
            })}
            {rows && !shown.length && <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>{all.length ? 'Nothing matches.' : 'No reimbursable expenses yet.'}</div>}
          </div>
        </div>
      </div>
      {(open || creating) && (
        <ReimbursableDrawer id={open} projectId={projectId} overview={overview} rights={rights}
          onClose={() => { setOpen(null); setCreating(false); load(); }}
          onChanged={(id) => { load(); onChanged?.(); if (id) { setCreating(false); setOpen(id); } }} />
      )}
    </div>
  );
}

export function ReimbursableDrawer({ id, projectId, overview, rights, onClose, onChanged }: {
  id: string | null; projectId?: number; overview?: Overview; rights: Rights; onClose: () => void; onChanged: (id?: string) => void;
}) {
  const { toast } = useApp();
  const [r, setR] = useState<Reimbursable | null>(null);
  const [f, setF] = useState<Record<string, any>>({ date: todayISO(), description: '', category: 'other', vendor: '', cost: '', markupPct: String(overview?.settings.reimbursableMarkupPct ?? ''), billable: true, taxable: false, phaseId: '', notes: '', projectId: projectId ? String(projectId) : '' });
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const phases = overview ? overview.sov.groups.flatMap((g) => g.rows.filter((x) => x.kind === 'phase').map((x) => ({ id: x.id, name: x.name }))) : [];

  const apply = (x: Reimbursable) => {
    setR(x); setRejecting(false);
    setF({ date: x.date, description: x.description, category: x.category, vendor: x.vendor || '', cost: String(x.cost), markupPct: String(x.markupPct), billable: x.billable, taxable: x.taxable, phaseId: x.phaseId || '', notes: x.notes || '', projectId: String(x.projectId) });
  };
  const load = () => (id ? api.finance.reimbursable(id).then((x: any) => apply(x)).catch((e: any) => failed(toast, e)) : Promise.resolve());
  useEffect(() => { load(); api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => {}); }, [id]);
  useEffect(() => { if (!projectId && !id) api.projects.list().then((x: any) => setProjects(Array.isArray(x) ? x.map((p: any) => ({ id: p.id, name: p.name })) : [])).catch(() => {}); }, [projectId, id]);

  const editable = !r || ((r.status === 'submitted' || r.status === 'rejected') && rights.submitReimbursables) || (r.status === 'approved' && rights.approveReimbursables);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const cost = Number(f.cost) || 0;
  const bill = f.billable ? Math.round((cost + cost * (Number(f.markupPct) || 0) / 100) * 100) / 100 : 0;
  const payload = () => ({ ...f, cost: Number(f.cost), markupPct: f.markupPct === '' ? undefined : Number(f.markupPct), phaseId: f.phaseId || null, version: r?.version });

  const save = async () => {
    try {
      if (!r) {
        const pid = projectId || Number(f.projectId);
        if (!pid) { toast('⚠ Choose the project'); return; }
        const x = await api.finance.createReimbursable(pid, payload()) as Reimbursable;
        toast('Submitted for approval — add the receipt'); onChanged(x.id);
      } else { apply(await api.finance.updateReimbursable(r.id, payload()) as Reimbursable); onChanged(); toast('Saved'); }
    } catch (e) { failed(toast, e); }
  };
  const decide = async (decision: 'approve' | 'reject', reason?: string) => {
    try { apply(await api.finance.decideReimbursable(r!.id, { decision, reason, version: r!.version }) as Reimbursable); onChanged(); toast(decision === 'approve' ? 'Approved' : 'Rejected'); }
    catch (e) { failed(toast, e); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${r!.number}?`)) return;
    try { await api.finance.deleteReimbursable(r!.id); onChanged(); onClose(); } catch (e) { failed(toast, e); }
  };

  return (
    <Drawer title={r ? `${r.number} · ${r.description}` : 'New reimbursable expense'} subtitle={r ? `Submitted by ${r.submittedBy || '—'}${r.projectName ? ` · ${r.projectName}` : ''}` : 'Costs incurred for the client, billed back at cost plus markup'} width={680} onClose={onClose}
      footer={<>
        {r && rights.submitReimbursables && (r.status === 'submitted' || r.status === 'rejected') && <div onClick={remove} style={{ ...btn(), color: DANGER, marginRight: 'auto' }}>Delete</div>}
        {editable && <div onClick={save} style={btn(!r || r.status !== 'submitted' || !rights.approveReimbursables)}>{r ? (r.status === 'rejected' ? 'Resubmit' : 'Save') : 'Submit'}</div>}
        {r?.status === 'submitted' && rights.approveReimbursables && <>
          <div onClick={() => setRejecting(true)} style={{ ...btn(), color: DANGER }}>Reject</div>
          <div onClick={() => decide('approve')} style={btn(true)}>Approve</div>
        </>}
      </>}>
      <div style={{ display: 'grid', gap: 14 }}>
        {r && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ReimbBadge s={r.status} />
          {r.status === 'approved' && <span style={{ fontSize: 12.5, color: MUTED }}>Approved by {r.approvedBy} · {fmtDate(r.approvedAt)}{r.billable ? ' · ready to go on an invoice' : ''}</span>}
          {r.status === 'rejected' && <span style={{ fontSize: 12.5, color: DANGER }}>Rejected by {r.rejectedBy}: {r.rejectedReason}. Correct it and resubmit.</span>}
          {r.status === 'billed' && <span style={{ fontSize: 12.5, color: MUTED }}>Billed on an invoice — correct it with a credit note if needed.</span>}
        </div>}
        {rejecting && <ReasonBox title="Reject expense" tone="danger" confirm="Reject" onCancel={() => setRejecting(false)} onSubmit={(v) => decide('reject', v.reason)} fields={[{ key: 'reason', label: 'Why', type: 'textarea', required: true }]} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          {!projectId && !r && <div style={{ gridColumn: '1 / -1' }}><Label text="Project" /><select value={f.projectId} onChange={set('projectId')} style={input}><option value="">Choose…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
          <div><Label text="Date" /><input disabled={!editable} type="date" value={f.date} onChange={set('date')} style={input} /></div>
          <div><Label text="Category" /><select disabled={!editable} value={f.category} onChange={set('category')} style={input}>{REIMB_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div style={{ gridColumn: '1 / -1' }}><Label text="Description" /><input disabled={!editable} value={f.description} onChange={set('description')} placeholder="e.g. Plan printing for permit submittal" style={input} /></div>
          <div><Label text="Vendor" /><input disabled={!editable} value={f.vendor} onChange={set('vendor')} style={input} /></div>
          <div><Label text="Cost ($)" /><input disabled={!editable} type="number" min={0} value={f.cost} onChange={set('cost')} style={input} /></div>
          <div><Label text="Markup %" /><input disabled={!editable} type="number" min={0} max={100} value={f.markupPct} onChange={set('markupPct')} placeholder="Project default" style={input} /></div>
          {phases.length > 0 && <div><Label text="Milestone (optional)" /><select disabled={!editable} value={f.phaseId} onChange={set('phaseId')} style={input}><option value="">—</option>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}><input disabled={!editable} type="checkbox" checked={!!f.billable} onChange={set('billable')} />Bill to the client</label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}><input disabled={!editable || !f.billable} type="checkbox" checked={!!f.taxable} onChange={set('taxable')} />Taxable when billed</label>
          <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><textarea disabled={!editable} rows={2} value={f.notes} onChange={set('notes')} style={{ ...input, resize: 'vertical' }} /></div>
        </div>
        <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>Cost <b>{usd(cost)}</b></span>
          {f.billable ? <><span>Markup <b>{usd(bill - cost)}</b></span><span style={{ color: ACCENT }}>Bills <b>{usd(bill)}</b></span></> : <span style={{ color: MUTED }}>Tracked as a project cost only — never invoiced.</span>}
        </div>
        {r ? <Attachments scope="finance-reimbursables" taskId={r.id} attachments={r.attachments || []} canManage={rights.submitReimbursables} storageReady={storageReady}
          onUpload={async (files) => { await api.finance.reUpload(r.id, files); load(); }}
          onRemove={async (att) => { await api.finance.reRemoveAttachment(r.id, att.id); load(); }}
          onAddLink={async (name, url) => { await api.finance.reLink(r.id, name, url); load(); }} />
          : <div style={{ fontSize: 11.5, color: MUTED }}>Receipts can be attached once the expense is submitted.</div>}
        <ApprovalTrail items={r?.approvals} />
      </div>
    </Drawer>
  );
}
