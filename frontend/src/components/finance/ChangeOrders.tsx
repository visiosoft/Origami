import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { Attachments } from '../Attachments';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, Drawer, Label, btn, card, fmtDate, headRow, input } from '../manpowerUi';
import {
  ApprovalTrail, CO_REASONS, CoBadge, ReasonBox, failed, label, usd, usd0,
  type ChangeOrder, type ChangeOrderItem, type Overview, type Rights,
} from './financeUi';

/** Where a change can land: existing milestones and tasks, or new ones created when it's approved. */
interface Targets { phases: { id: string; name: string }[]; tasks: { id: string; name: string; phaseId: string | null }[] }

function targetsFrom(o: Overview): Targets {
  const phases: Targets['phases'] = [];
  const tasks: Targets['tasks'] = [];
  for (const g of o.sov.groups) for (const r of g.rows) {
    if (r.kind === 'phase') { phases.push({ id: r.id, name: r.name }); for (const c of r.children || []) if (!c.deleted) tasks.push({ id: c.id, name: c.name, phaseId: r.id }); }
    else if (!r.deleted) tasks.push({ id: r.id, name: r.name, phaseId: null });
  }
  for (const t of o.looseTasks || []) if (!tasks.some((x) => x.id === t.id)) tasks.push({ id: t.id, name: t.title, phaseId: null });
  return { phases, tasks };
}

async function loadTargets(projectId: number): Promise<Targets> {
  try { return targetsFrom(await api.finance.overview(projectId) as Overview); } catch { /* no financial view -- use the board */ }
  try {
    const b: any = await api.projectPhases.board(projectId);
    return {
      phases: (b.phases || []).map((p: any) => ({ id: p.id, name: p.name })),
      tasks: (b.tasks || []).filter((t: any) => !t.parentId).map((t: any) => ({ id: t.id, name: t.title, phaseId: t.phaseId || null })),
    };
  } catch { return { phases: [], tasks: [] }; }
}

// ------------------------------------------------------------------ list

/**
 * Change orders -- one project's (inside its Financial tab) or every project's
 * (the Change Orders log).
 */
export function ChangeOrderList({ projectId, overview, rights, onChanged }: { projectId?: number; overview?: Overview; rights: Rights; onChanged?: () => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<ChangeOrder[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const load = () => (projectId ? api.finance.changeOrders(projectId) : api.finance.allChangeOrders())
    .then((r: any) => setRows(Array.isArray(r) ? r : [])).catch((e: any) => { setRows([]); toast('⚠ ' + (e.message || 'Could not load change orders')); });
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => { if (!projectId) api.projects.list().then((r: any) => setProjects(Array.isArray(r) ? r.map((p: any) => ({ id: p.id, name: p.name })) : [])).catch(() => {}); }, [projectId]);

  const shown = (rows || []).filter((c) => (status === 'all' || (status === 'open' ? ['draft', 'internal_review', 'submitted'].includes(c.status) : c.status === status))
    && (!q || `${c.number} ${c.title} ${c.projectName || ''}`.toLowerCase().includes(q.toLowerCase())));
  const sum = (pred: (c: ChangeOrder) => boolean) => (rows || []).filter(pred).reduce((a, c) => a + (c.total || 0), 0);
  const cols = projectId ? '90px minmax(200px,2fr) 150px 120px 120px 90px 130px' : '90px minmax(160px,1.4fr) minmax(200px,2fr) 150px 120px 120px 90px 130px';

  const create = async (v: Record<string, string>) => {
    const pid = projectId || Number(v.projectId);
    if (!pid) { toast('⚠ Choose the project'); return; }
    try {
      const co = await api.finance.createChangeOrder(pid, { title: v.title, reason: v.reason || 'client_request', requestedBy: v.requestedBy }) as ChangeOrder;
      setAdding(false); await load(); setOpen(co.id); onChanged?.();
    } catch (e) { failed(toast, e); }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {[
          ['Approved', usd0(sum((c) => c.status === 'approved')), `${(rows || []).filter((c) => c.status === 'approved').length} change orders`],
          ['Pending', usd0(sum((c) => c.status === 'internal_review' || c.status === 'submitted')), 'In review or with the client'],
          ['Drafts', usd0(sum((c) => c.status === 'draft')), `${(rows || []).filter((c) => c.status === 'draft').length} being priced`],
          ['Rejected / cancelled', String((rows || []).filter((c) => c.status === 'rejected' || c.status === 'cancelled').length), ''],
        ].map(([l, v, sub]) => (
          <div key={l} style={{ ...card, padding: '10px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
            <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: INK, marginTop: 2 }}>{v}</div>
            {sub && <div style={{ fontSize: 11.5, color: MUTED }}>{sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search change orders" style={{ ...input, width: 240 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 180 }}>
          <option value="all">All statuses</option><option value="open">Open</option><option value="draft">Draft</option><option value="internal_review">Internal review</option>
          <option value="submitted">With client</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
        </select>
        <div style={{ flex: 1 }} />
        {rights.editChangeOrders && <div onClick={() => setAdding(true)} style={btn(true)}>+ Change order</div>}
      </div>
      {adding && (
        <ReasonBox title="New change order" confirm="Create" onCancel={() => setAdding(false)} onSubmit={create}
          fields={[
            ...(projectId ? [] : [{ key: 'projectId', label: 'Project', required: true, options: projects.map((p) => [String(p.id), p.name] as [string, string]) }]),
            { key: 'title', label: 'Title', required: true, placeholder: 'e.g. Owner-requested kitchen upgrades' },
            { key: 'requestedBy', label: 'Requested by', placeholder: 'Client, architect, site…' },
          ]}
        />
      )}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: projectId ? 880 : 1060 }}>
            <div style={headRow(cols)}>
              <span>No.</span>{!projectId && <span>Project</span>}<span>Title</span><span>Reason</span><span style={{ textAlign: 'right' }}>Amount</span>
              <span>Requested</span><span style={{ textAlign: 'right' }}>Days</span><span>Status</span>
            </div>
            {rows === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((c) => (
              <div key={c.id} onClick={() => setOpen(c.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', fontSize: 12.5, opacity: c.status === 'cancelled' ? 0.55 : 1 }}>
                <b style={{ color: ACCENT }}>{c.number}</b>
                {!projectId && <span style={{ color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.projectName}</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                <span style={{ color: MUTED }}>{label(CO_REASONS, c.reason)}</span>
                <b style={{ textAlign: 'right', color: c.total < 0 ? DANGER : INK }}>{usd(c.total)}</b>
                <span>{fmtDate(c.dateRequested)}</span>
                <span style={{ textAlign: 'right' }}>{c.scheduleImpactDays ? `${c.scheduleImpactDays > 0 ? '+' : ''}${c.scheduleImpactDays}` : '—'}</span>
                <span><CoBadge s={c.status} /></span>
              </div>
            ))}
            {rows && !shown.length && <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>{rows.length ? 'Nothing matches.' : 'No change orders yet.'}</div>}
          </div>
        </div>
      </div>
      {open && <ChangeOrderDrawer id={open} overview={overview} rights={rights} onClose={() => { setOpen(null); load(); }} onChanged={() => { load(); onChanged?.(); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ drawer

type Step = null | 'return' | 'reject' | 'cancel' | 'client';

export function ChangeOrderDrawer({ id, overview, rights, onClose, onChanged }: { id: string; overview?: Overview; rights: Rights; onClose: () => void; onChanged: () => void }) {
  const { toast } = useApp();
  const [co, setCo] = useState<ChangeOrder | null>(null);
  const [f, setF] = useState<Record<string, any>>({});
  const [items, setItems] = useState<ChangeOrderItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [targets, setTargets] = useState<Targets>({ phases: [], tasks: [] });
  const [impact, setImpact] = useState<any>(null);
  const [step, setStep] = useState<Step>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = (c: ChangeOrder) => {
    setCo(c); setDirty(false); setStep(null);
    setF({ title: c.title, reason: c.reason, requestedBy: c.requestedBy || '', dateRequested: c.dateRequested || '', scheduleImpactDays: String(c.scheduleImpactDays || 0), description: c.description || '', notes: c.notes || '' });
    setItems(c.items.map((i) => ({ ...i, amount: String(i.amount), cost: i.cost == null ? '' : String(i.cost), quantity: i.quantity == null ? '' : String(i.quantity), rate: i.rate == null ? '' : String(i.rate) })));
    if (['draft', 'internal_review', 'submitted'].includes(c.status)) api.finance.changeOrderImpact(c.id).then(setImpact).catch(() => setImpact(null)); else setImpact(null);
  };
  const load = () => api.finance.changeOrder(id).then((c: any) => apply(c)).catch((e: any) => failed(toast, e));
  useEffect(() => { load(); api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => {}); }, [id]);
  useEffect(() => { if (!co) return; if (overview && overview.project.id === co.projectId) setTargets(targetsFrom(overview)); else loadTargets(co.projectId).then(setTargets); }, [co?.projectId]);

  if (!co) return <Drawer title="Change order" width={1000} onClose={onClose}><div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div></Drawer>;
  const editable = co.status === 'draft' && rights.editChangeOrders;
  const set = (k: string) => (e: any) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  const patch = (i: number, p: Partial<ChangeOrderItem>) => { setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x))); setDirty(true); };
  const amountOf = (it: ChangeOrderItem) => (it.quantity !== '' && it.quantity != null && it.rate !== '' && it.rate != null ? Number(it.quantity) * Number(it.rate) : Number(it.amount) || 0);
  const total = items.reduce((a, it) => a + amountOf(it), 0);
  const cost = items.reduce((a, it) => a + (Number(it.cost) || 0), 0);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.finance.updateChangeOrder(co.id, { ...f, version: co.version, items: items.map((it) => ({ ...it, amount: amountOf(it) })) }) as ChangeOrder;
      apply(r); onChanged(); toast('Saved'); return r;
    } catch (e) { failed(toast, e); if (/since you opened it/.test((e as any)?.message || '')) load(); return null; }
    finally { setBusy(false); }
  };
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    let cur: ChangeOrder | null = co;
    if (dirty && co.status === 'draft') cur = await save();
    if (!cur) return;
    setBusy(true);
    try { apply(await api.finance.changeOrderStep(cur.id, action, { version: cur.version, ...extra }) as ChangeOrder); onChanged(); toast('Done'); }
    catch (e) { failed(toast, e); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${co.number}?`)) return;
    try { await api.finance.deleteChangeOrder(co.id); onChanged(); onClose(); } catch (e) { failed(toast, e); }
  };

  const targetValue = (it: ChangeOrderItem) => it.targetType === 'phase' ? `phase:${it.phaseId}` : it.targetType === 'task' ? `task:${it.taskId}` : it.targetType === 'new_task' ? `new_task:${it.phaseId || ''}` : it.targetType;
  const setTarget = (i: number, v: string) => {
    const [t, ref] = v.split(':');
    if (t === 'phase') patch(i, { targetType: 'phase', phaseId: ref, taskId: null });
    else if (t === 'task') patch(i, { targetType: 'task', taskId: ref, phaseId: targets.tasks.find((x) => x.id === ref)?.phaseId || null });
    else if (t === 'new_task') patch(i, { targetType: 'new_task', phaseId: ref || null, taskId: null });
    else patch(i, { targetType: t as any, phaseId: null, taskId: null });
  };
  const describeTarget = (it: ChangeOrderItem) => {
    if (it.targetType === 'phase') return targets.phases.find((p) => p.id === it.phaseId)?.name || 'Milestone';
    if (it.targetType === 'task') return targets.tasks.find((t) => t.id === it.taskId)?.name || 'Task';
    if (it.targetType === 'new_phase') return `New milestone: ${it.newName}`;
    if (it.targetType === 'new_task') return `New task: ${it.newName}${it.phaseId ? ` (${targets.phases.find((p) => p.id === it.phaseId)?.name || 'milestone'})` : ''}`;
    return 'Contract only (allocate later)';
  };
  const cols = editable ? 'minmax(180px,1.6fr) minmax(200px,1.5fr) 60px 70px 90px 110px 100px 24px' : 'minmax(200px,1.6fr) minmax(200px,1.5fr) 110px 110px';

  return (
    <Drawer title={`${co.number} · ${co.title}`} subtitle={`${label(CO_REASONS, co.reason)}${co.requestedBy ? ` · requested by ${co.requestedBy}` : ''}${co.createdBy ? ` · raised by ${co.createdBy}` : ''}`} width={1060} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <CoBadge s={co.status} />
          {co.status === 'approved' && <span style={{ fontSize: 12.5, color: MUTED }}>Approved {fmtDate(co.clientApprovedDate || co.approvedAt)} · signed by {co.clientSigner}{co.clientReference ? ` · ${co.clientReference}` : ''}</span>}
          {(co.status === 'rejected' || co.status === 'cancelled') && <span style={{ fontSize: 12.5, color: DANGER }}>{co.closedReason}</span>}
          <div style={{ flex: 1 }} />
          <div onClick={() => printChangeOrder(co, describeTarget, overview?.project.name)} style={btn()}>Print / PDF</div>
        </div>

        {impact && (impact.ok
          ? <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, background: '#F3F8F3' }}>
              Approving this changes the contract from <b>{usd(impact.revisedBefore)}</b> to <b>{usd(impact.revisedAfter)}</b>
              {' '}({impact.total >= 0 ? '+' : ''}{usd(impact.total)}). Unallocated afterwards: {usd(impact.unallocatedAfter)}.
            </div>
          : <div style={{ ...card, padding: '10px 14px', fontSize: 12.5, background: '#F7ECE6', color: DANGER }}>Can’t be approved as it stands: {impact.problem}</div>)}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          <div style={{ gridColumn: 'span 2' }}><Label text="Title" /><input disabled={!editable} value={f.title} onChange={set('title')} style={input} /></div>
          <div><Label text="Reason" /><select disabled={!editable} value={f.reason} onChange={set('reason')} style={input}>{CO_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><Label text="Requested by" /><input disabled={!editable} value={f.requestedBy} onChange={set('requestedBy')} style={input} /></div>
          <div><Label text="Date requested" /><input disabled={!editable} type="date" value={f.dateRequested} onChange={set('dateRequested')} style={input} /></div>
          <div><Label text="Schedule impact (days)" /><input disabled={!editable} type="number" value={f.scheduleImpactDays} onChange={set('scheduleImpactDays')} style={input} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Label text="Description / justification" /><textarea disabled={!editable} rows={3} value={f.description} onChange={set('description')} style={{ ...input, resize: 'vertical' }} /></div>
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: editable ? 900 : 640 }}>
              <div style={headRow(cols)}>
                <span>Item</span><span>Changes</span>
                {editable ? <><span style={{ textAlign: 'right' }}>Qty</span><span>Unit</span><span style={{ textAlign: 'right' }}>Rate</span><span style={{ textAlign: 'right' }}>Amount</span><span style={{ textAlign: 'right' }}>Cost</span><span /></>
                  : <><span style={{ textAlign: 'right' }}>Amount</span><span style={{ textAlign: 'right' }}>Cost</span></>}
              </div>
              {items.map((it, i) => (
                <div key={it.id || i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '7px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                  {editable ? <>
                    <input value={it.description} onChange={(e) => patch(i, { description: e.target.value })} placeholder="What changes" style={{ ...input, padding: '5px 7px', fontSize: 12.5 }} />
                    <span style={{ display: 'grid', gap: 4 }}>
                      <select value={targetValue(it)} onChange={(e) => setTarget(i, e.target.value)} style={{ ...input, padding: '5px 7px', fontSize: 12.5 }}>
                        <option value="none">Contract only (allocate later)</option>
                        <option value="new_phase">New milestone…</option>
                        <optgroup label="New task under">
                          <option value="new_task:">New task (no milestone)…</option>
                          {targets.phases.map((p) => <option key={'nt' + p.id} value={`new_task:${p.id}`}>New task in {p.name}…</option>)}
                        </optgroup>
                        <optgroup label="Milestones">{targets.phases.map((p) => <option key={p.id} value={`phase:${p.id}`}>{p.name}</option>)}</optgroup>
                        <optgroup label="Tasks">{targets.tasks.map((t) => <option key={t.id} value={`task:${t.id}`}>{t.name}{t.phaseId ? ` — ${targets.phases.find((p) => p.id === t.phaseId)?.name || ''}` : ''}</option>)}</optgroup>
                      </select>
                      {(it.targetType === 'new_phase' || it.targetType === 'new_task') && <input value={it.newName || ''} onChange={(e) => patch(i, { newName: e.target.value })} placeholder={it.targetType === 'new_phase' ? 'Milestone name' : 'Task name'} style={{ ...input, padding: '5px 7px', fontSize: 12.5 }} />}
                    </span>
                    <input type="number" value={it.quantity ?? ''} onChange={(e) => patch(i, { quantity: e.target.value })} style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />
                    <input value={it.unit || ''} onChange={(e) => patch(i, { unit: e.target.value })} placeholder="ea" style={{ ...input, padding: '5px 6px', fontSize: 12.5 }} />
                    <input type="number" value={it.rate ?? ''} onChange={(e) => patch(i, { rate: e.target.value })} style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />
                    {it.quantity !== '' && it.quantity != null && it.rate !== '' && it.rate != null
                      ? <b style={{ textAlign: 'right' }}>{usd(amountOf(it))}</b>
                      : <input type="number" value={it.amount} onChange={(e) => patch(i, { amount: e.target.value })} placeholder="− to deduct" style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />}
                    <input type="number" value={it.cost ?? ''} onChange={(e) => patch(i, { cost: e.target.value })} placeholder="optional" style={{ ...input, padding: '5px 6px', fontSize: 12.5, textAlign: 'right' }} />
                    <span onClick={() => { setItems(items.filter((_, j) => j !== i)); setDirty(true); }} title="Remove" style={{ cursor: 'pointer', color: MUTED, fontSize: 16, textAlign: 'center' }}>×</span>
                  </> : <>
                    <span>{it.description}{it.quantity != null && it.quantity !== '' ? <span style={{ color: MUTED }}> · {it.quantity} {it.unit || ''} × {usd(Number(it.rate))}</span> : null}</span>
                    <span style={{ color: MUTED }}>{describeTarget(it)}</span>
                    <b style={{ textAlign: 'right', color: Number(it.amount) < 0 ? DANGER : INK }}>{usd(Number(it.amount))}</b>
                    <span style={{ textAlign: 'right', color: MUTED }}>{it.cost !== '' && it.cost != null ? usd(Number(it.cost)) : '—'}</span>
                  </>}
                </div>
              ))}
              {!items.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No items yet — price the change line by line.</div>}
              <div style={{ display: 'flex', gap: 16, padding: '10px 14px', borderTop: '1px solid ' + LINE, alignItems: 'center', flexWrap: 'wrap' }}>
                {editable && <div onClick={() => { setItems([...items, { description: '', targetType: 'none', amount: '' }]); setDirty(true); }} style={btn()}>+ Item</div>}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12.5, color: MUTED }}>Cost {usd(cost)} · margin {usd(total - cost)}</span>
                <span style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, color: total < 0 ? DANGER : INK }}>Total {usd(total)}</span>
              </div>
            </div>
          </div>
        </div>
        {editable && <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
          Nothing changes until the change order is approved. Then the contract moves by its total, each item's value by its lines, and new milestones and tasks are added to the project (and its Phase Board).
          Put a change on a task when its milestone is split into tasks; otherwise on the milestone.
        </div>}

        <div><Label text="Internal notes" /><textarea disabled={!editable} rows={2} value={f.notes} onChange={set('notes')} style={{ ...input, resize: 'vertical' }} /></div>

        {step === 'return' && <ReasonBox title="Return to draft" confirm="Return" onCancel={() => setStep(null)} onSubmit={(v) => act('return', { comment: v.comment })} fields={[{ key: 'comment', label: 'What needs changing', type: 'textarea', required: true }]} />}
        {step === 'reject' && <ReasonBox title="Reject change order" tone="danger" confirm="Reject" onCancel={() => setStep(null)} onSubmit={(v) => act('reject', { comment: v.comment })} fields={[{ key: 'comment', label: 'Why', type: 'textarea', required: true }]} />}
        {step === 'cancel' && <ReasonBox title="Cancel change order" tone="danger" confirm="Cancel it" onCancel={() => setStep(null)} onSubmit={(v) => act('cancel', { comment: v.comment })} fields={[{ key: 'comment', label: 'Why', type: 'textarea', required: true }]} />}
        {step === 'client' && <ReasonBox title="Record the client’s approval" confirm="Approve change order" onCancel={() => setStep(null)} onSubmit={(v) => act('client_approve', v)}
          fields={[{ key: 'signer', label: 'Signed / approved by', required: true }, { key: 'date', label: 'Date', type: 'date', initial: new Date().toISOString().slice(0, 10), required: true }, { key: 'reference', label: 'Reference', placeholder: 'Signed CO, email of 9/20…' }, { key: 'comment', label: 'Note', type: 'textarea' }]} />}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid ' + LINE, paddingTop: 14 }}>
          {editable && !co.submittedAt && <div onClick={remove} style={{ ...btn(), color: DANGER }}>Delete draft</div>}
          {rights.editChangeOrders && ['draft', 'internal_review', 'submitted'].includes(co.status) && <div onClick={() => setStep('cancel')} style={{ ...btn(), color: DANGER }}>Cancel CO</div>}
          <div style={{ flex: 1 }} />
          {editable && <div onClick={busy ? undefined : save} style={btn(false, busy || !dirty)}>Save</div>}
          {editable && <div onClick={busy ? undefined : () => act('submit')} style={btn(!rights.approveChangeOrders, busy)}>Submit for review</div>}
          {co.status === 'draft' && rights.approveChangeOrders && <div onClick={() => setStep('client')} style={btn(true)} title="The client has already signed it">Record signed approval</div>}
          {co.status === 'internal_review' && rights.approveChangeOrders && <>
            <div onClick={() => setStep('return')} style={btn()}>Return</div>
            <div onClick={() => setStep('reject')} style={{ ...btn(), color: DANGER }}>Reject</div>
            <div onClick={busy ? undefined : () => act('approve_internal')} style={btn(true, busy)}>Approve &amp; send to client</div>
          </>}
          {co.status === 'submitted' && rights.approveChangeOrders && <>
            <div onClick={() => setStep('return')} style={btn()}>Return</div>
            <div onClick={() => setStep('reject')} style={{ ...btn(), color: DANGER }}>Client rejected</div>
            <div onClick={() => setStep('client')} style={btn(true)}>Record client approval</div>
          </>}
          {co.status === 'rejected' && rights.editChangeOrders && <div onClick={() => act('reopen')} style={btn()}>Reopen as draft</div>}
        </div>

        <Attachments scope="finance-change-orders" taskId={co.id} attachments={co.attachments || []} canManage={rights.editChangeOrders} storageReady={storageReady}
          onUpload={async (files) => { await api.finance.coUpload(co.id, files); load(); }}
          onRemove={async (att) => { await api.finance.coRemoveAttachment(co.id, att.id); load(); }}
          onAddLink={async (name, url) => { await api.finance.coLink(co.id, name, url); load(); }} />
        <ApprovalTrail items={co.approvals} />
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ print

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** The change order on the letterhead with signature blocks, ready to print or save as PDF and send for signing. */
async function printChangeOrder(co: ChangeOrder, where: (it: ChangeOrderItem) => string, projectName?: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write('<p style="font-family:Arial;padding:30px;color:#777">Preparing the change order…</p>');
  let b: any = {};
  try { b = await api.finance.brand(); } catch { /* print without the letterhead */ }
  const accent = b.accentColor || '#173326';
  const rows = co.items.map((it) => `<tr><td>${esc(it.description)}<div class="n">${esc(where(it))}</div></td><td class="r">${it.quantity != null && it.quantity !== '' ? `${esc(it.quantity)} ${esc(it.unit || '')} × ${esc(usd(Number(it.rate)))}` : ''}</td><td class="r">${esc(usd(Number(it.amount)))}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(co.number)} — ${esc(co.title)}</title>
<style>body{font-family:Arial,sans-serif;color:#0B1A12;margin:36px;font-size:12.5px}.top{display:flex;justify-content:space-between;border-bottom:3px solid ${esc(accent)};padding-bottom:14px}
.co{font-size:12px;color:#556;line-height:1.5}.co b{font-size:16px;color:#0B1A12}h1{font-size:24px;margin:0;color:${esc(accent)};text-align:right}.meta{text-align:right;line-height:1.7}
table{width:100%;border-collapse:collapse;margin-top:18px}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#778;border-bottom:1px solid #ccc;padding:6px 4px}
td{padding:7px 4px;border-bottom:1px solid #eee;vertical-align:top}.r{text-align:right;white-space:nowrap}.n{color:#778;font-size:11px;margin-top:2px}.tot td{font-weight:bold;font-size:15px;border-top:2px solid #0B1A12;border-bottom:none}
.sig{display:flex;gap:40px;margin-top:60px}.sig div{flex:1;border-top:1px solid #0B1A12;padding-top:6px;font-size:11px;color:#556}.lbl{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#778;font-weight:bold;margin:18px 0 4px}</style></head><body>
<div class="top"><div class="co">${b.logoDataUrl ? `<img src="${esc(b.logoDataUrl)}" style="max-height:56px;max-width:220px;display:block;margin-bottom:8px">` : ''}<b>${esc(b.companyName || '')}</b><br>${esc(b.address || '')}<br>${esc([b.phone, b.email, b.website].filter(Boolean).join(' · '))}</div>
<div class="meta"><h1>CHANGE ORDER</h1><b>${esc(co.number)}</b><br>Date: ${esc(fmtDate(co.dateRequested || co.createdAt))}${projectName ? `<br>Project: ${esc(projectName)}` : ''}<br>Reason: ${esc(label(CO_REASONS, co.reason))}</div></div>
<div class="lbl">${esc(co.title)}</div>${co.description ? `<div style="white-space:pre-line">${esc(co.description)}</div>` : ''}
<table><thead><tr><th>Description</th><th class="r">Quantity</th><th class="r">Amount</th></tr></thead><tbody>${rows}
<tr class="tot"><td>Total change to the contract</td><td></td><td class="r">${esc(usd(co.total))}</td></tr></tbody></table>
<p>Schedule impact: ${co.scheduleImpactDays ? `${co.scheduleImpactDays > 0 ? '+' : ''}${esc(co.scheduleImpactDays)} calendar days` : 'none'}.</p>
<p class="n">This change order, once signed, amends the contract by the amount above. All other terms remain unchanged.</p>
<div class="sig"><div>Client signature, name &amp; date${co.clientSigner ? `<br><b style="color:#0B1A12">${esc(co.clientSigner)} · ${esc(fmtDate(co.clientApprovedDate))}</b>` : ''}</div><div>For ${esc(b.companyName || 'the contractor')}, name &amp; date</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}

