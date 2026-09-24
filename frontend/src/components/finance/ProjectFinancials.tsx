import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, btn, card, fmtDate, headRow, input } from '../manpowerUi';
import {
  BILLING_METHODS, STALE_EVENT, BillingBadge, InvoiceBadge, PaymentBadge, ProgressBar, failed, pct, usd, usd0,
  type Group, type Invoice, type Overview, type Payment, type Row, type Settings,
} from './financeUi';
import { InvoiceDrawer } from './InvoiceDrawer';
import { ChangeOrderList } from './ChangeOrders';
import { ReimbursableList } from './Reimbursables';
import { RetentionPanel } from './Retention';
import { JobCostPanel, ProfitabilityPanel } from './JobCost';

type View = 'sov' | 'changes' | 'reimbursables' | 'retention' | 'invoices' | 'payments' | 'jobcost' | 'profit' | 'activity';
type Filter = 'all' | 'design' | 'construction' | 'other' | 'unphased';

/**
 * A project's money: what it's worth, what's been earned, billed and paid, and
 * the schedule of values behind every figure. Works for any project -- design,
 * construction, both, or a general job billed as a lump sum.
 */
export function ProjectFinancials({ projectId, category }: { projectId: number; category?: 'design' | 'construction' }) {
  const { toast } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('sov');
  const [filter, setFilter] = useState<Filter>(category || 'all');
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [item, setItem] = useState<Row | null>(null);
  const [progressFor, setProgressFor] = useState<Row | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const load = async () => {
    try { setData(await api.finance.overview(projectId) as Overview); setError(''); }
    catch (e: any) { setError(e.message || 'Could not load financials'); }
  };
  const loadInvoices = () => api.finance.invoices(projectId).then((r: any) => setInvoices(Array.isArray(r) ? r : [])).catch(() => setInvoices([]));
  useEffect(() => { load(); loadInvoices(); }, [projectId]);
  // Someone else changed a record this screen was showing (a 409): reload rather than overwrite.
  useEffect(() => { const f = () => { load(); loadInvoices(); }; window.addEventListener(STALE_EVENT, f); return () => window.removeEventListener(STALE_EVENT, f); }, [projectId]);
  // Bumped whenever an invoice changes, so panels that depend on invoices (retention, reimbursables) reload.
  const [tick, setTick] = useState(0);
  const refresh = async () => { setTick((t) => t + 1); await Promise.all([load(), loadInvoices()]); };

  const newInvoice = async (billReady: boolean, reimbursableIds?: string[]) => {
    setBusy(true);
    try {
      const inv = await api.finance.createInvoice(projectId, reimbursableIds ? { reimbursableIds } : billReady ? { billReady: true } : { kind: 'standard' }) as Invoice;
      await loadInvoices();
      setOpenInvoice(inv.id);
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not start the invoice')); }
    finally { setBusy(false); }
  };

  if (error) return <div style={{ ...card, padding: 18, fontSize: 13, color: DANGER }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading financials…</div>;
  const { summary: s } = data.sov;
  const r = data.rights;

  if (!data.settings.exists) {
    const costSide = r.viewProfitability || r.manageCosts;
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {setupOpen && r.manage ? <SetupCard data={data} onDone={(o) => { setData(o); loadInvoices(); }} /> : (
          <div style={{ ...card, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260, fontSize: 13, color: INK, lineHeight: 1.6 }}>
              <b>No client contract on this project.</b>{' '}
              <span style={{ color: MUTED }}>{costSide ? 'Work you pay others for (subcontractors, vendors, consultants) and labor are tracked below.' : "Its financials haven't been set up yet."} If a client pays you for this project, set up client billing.</span>
            </div>
            {r.manage && <div onClick={() => setSetupOpen(true)} style={btn()}>Set up client billing</div>}
          </div>
        )}
        {costSide && <JobCostPanel projectId={projectId} overview={data} />}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* contract line + actions */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, color: MUTED, flex: 1, minWidth: 260 }}>
          Retention {pct(data.settings.retentionPct)} · Tax {pct(data.settings.taxPct)} · Net {data.settings.paymentTermsDays} days
          {data.settings.billToName ? ` · Bill to ${data.settings.billToName}` : ''}
          {data.settings.requireProgressApproval ? ' · Progress needs approval before billing' : ''}
          {data.settings.contractLockedAt ? ' · Contract locked (invoiced)' : ''}
        </div>
        <div onClick={() => setSettingsOpen(true)} style={btn()}>Settings</div>
        {r.prepareInvoice && <div onClick={busy ? undefined : () => newInvoice(true)} style={btn(s.billableNow > 0, busy || s.billableNow <= 0)} title={s.billableNow > 0 ? '' : 'Nothing earned is waiting to be billed'}>
          Bill ready work{s.billableNow > 0 ? ` · ${usd0(s.billableNow)}` : ''}
        </div>}
      </div>

      <SummaryCards s={s} />

      {/* view switch */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + LINE }}>
        {([
          ['sov', 'Schedule of values'], ...(r.viewChangeOrders ? [['changes', 'Change orders']] : []), ['invoices', `Invoices${invoices ? ` (${invoices.length})` : ''}`],
          ['payments', 'Payments'], ...(r.viewReimbursables ? [['reimbursables', 'Reimbursables']] : []), ['retention', 'Retention'],
          ...(r.viewProfitability || r.manageCosts ? [['jobcost', 'Job cost']] : []), ...(r.viewProfitability ? [['profit', 'Profitability']] : []), ['activity', 'Activity'],
        ] as [View, string][]).map(([k, l]) => (
          <div key={k} onClick={() => setView(k)} style={{ padding: '9px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: view === k ? ACCENT : MUTED, borderBottom: '2px solid ' + (view === k ? ACCENT : 'transparent'), marginBottom: -1 }}>{l}</div>
        ))}
      </div>

      {view === 'sov' && (
        <Sov data={data} filter={filter} setFilter={setFilter} onChanged={setData} onItem={setItem} onProgress={setProgressFor}
          onAddMilestone={async (name, value) => {
            try { setData(await api.finance.addMilestone(projectId, { name, contractValue: value }) as Overview); toast('Milestone added'); }
            catch (e: any) { failed(toast, e); }
          }} />
      )}
      {view === 'changes' && <ChangeOrderList projectId={projectId} overview={data} rights={r} onChanged={load} />}
      {view === 'reimbursables' && <ReimbursableList key={tick} projectId={projectId} overview={data} rights={r} onChanged={load} onBill={(ids) => newInvoice(false, ids)} />}
      {view === 'jobcost' && <JobCostPanel key={tick} projectId={projectId} overview={data} />}
      {view === 'profit' && <ProfitabilityPanel key={tick} projectId={projectId} />}
      {view === 'retention' && <RetentionPanel key={tick} projectId={projectId} overview={data} rights={r} onOpenInvoice={setOpenInvoice} onChanged={() => Promise.all([load(), loadInvoices()])} />}
      {view === 'invoices' && (
        <InvoiceList invoices={invoices} canManage={r.prepareInvoice} busy={busy} billableNow={s.billableNow} onOpen={setOpenInvoice} onNew={newInvoice} />
      )}
      {view === 'payments' && <PaymentList projectId={projectId} onOpenInvoice={setOpenInvoice} />}
      {view === 'activity' && <ActivityList projectId={projectId} />}

      {settingsOpen && <SettingsDrawer data={data} onClose={() => setSettingsOpen(false)} onSaved={(o) => { setData(o); setSettingsOpen(false); }} />}
      {item && <ItemDrawer row={item} projectId={projectId} rights={r} onClose={() => setItem(null)} onSaved={(o) => { setData(o); setItem(null); }} onOpenInvoice={(id) => { setItem(null); setOpenInvoice(id); }} />}
      {progressFor && <ProgressDrawer row={progressFor} data={data} onClose={() => setProgressFor(null)} onSaved={(o) => { setData(o); setProgressFor(null); }} />}
      {openInvoice && <InvoiceDrawer invoiceId={openInvoice} overview={data} onClose={() => { setOpenInvoice(null); refresh(); }} onChanged={refresh} />}
    </div>
  );
}

// ------------------------------------------------------------------ summary

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div style={{ ...card, padding: '11px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: tone || INK, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SummaryCards({ s }: { s: Overview['sov']['summary'] }) {
  const of = (n: number) => (s.revisedContract ? `${Math.round((n / s.revisedContract) * 1000) / 10}% of contract` : '');
  const allocTone = s.allocation === 'over' ? DANGER : s.allocation === 'full' ? '#1E6B36' : MUTED;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <Card label="Original contract" value={usd0(s.originalContract)} />
        <Card label="Approved changes" value={usd0(s.approvedChanges)} sub={s.pendingChanges ? `${usd0(s.pendingChanges)} pending approval` : 'Approved change orders'} tone={s.approvedChanges < 0 ? DANGER : undefined} />
        <Card label="Revised contract" value={usd0(s.revisedContract)} />
        <Card label="Work done" value={usd0(s.ev)} sub={of(s.ev)} />
        <Card label="Billed to client" value={usd0(s.contractWorkInvoiced)} sub={`${usd0(s.invoiceTotals)} after retention & tax`} />
        <Card label="Received" value={usd0(s.paid)} sub="From the client" />
        <Card label="Client owes" value={usd0(s.arOutstanding)} sub={s.overdueCount ? `${usd0(s.overdue)} overdue (${s.overdueCount})` : undefined} tone={s.overdueCount ? DANGER : undefined} />
        <Card label={s.unbilledEarned < 0 ? 'Billed ahead of work' : 'Done, not yet billed'} value={usd0(Math.abs(s.unbilledEarned))} tone={s.unbilledEarned < 0 ? DANGER : s.unbilledEarned > 0 ? '#8A6D12' : undefined} sub={s.billableNow > 0 ? `${usd0(s.billableNow)} ready to invoice` : undefined} />
        <Card label="Retention held" value={usd0(s.retentionHeld)} sub={s.retentionReleased ? `${usd0(s.retentionReleased)} released` : undefined} />
        {(s.reimbursablesBilled !== 0 || s.credits !== 0) && <Card label="Outside the contract" value={usd0(s.reimbursablesBilled)} sub={`Reimbursables billed${s.credits ? ` · credits ${usd0(s.credits)}` : ''}`} />}
        <Card label="Remaining contract" value={usd0(s.remainingContract)} sub={of(s.remainingContract)} />
      </div>
      {!s.lumpSum && (
        <div style={{ ...card, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: INK, fontWeight: 600 }}>Allocated {usd0(s.allocated)} of {usd0(s.revisedContract)}</span>
          <div style={{ flex: 1, minWidth: 160, height: 8, borderRadius: 99, background: '#EFEDE8', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, s.revisedContract ? (s.allocated / s.revisedContract) * 100 : 0)}%`, background: allocTone === MUTED ? ACCENT : allocTone }} />
          </div>
          <Badge tone={s.allocation === 'over' ? 'red' : s.allocation === 'full' ? 'green' : 'grey'}>
            {s.allocation === 'over' ? `Over-allocated by ${usd0(-s.unallocated)}` : s.allocation === 'full' ? 'Fully allocated' : `${usd0(s.unallocated)} unallocated`}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ schedule of values

const COLS = 'minmax(230px, 2fr) 130px 120px 105px 105px 105px 95px 100px 105px 105px 170px';

function Sov({ data, filter, setFilter, onChanged, onItem, onProgress, onAddMilestone }: {
  data: Overview; filter: Filter; setFilter: (f: Filter) => void; onChanged: (o: Overview) => void;
  onItem: (r: Row) => void; onProgress: (r: Row) => void; onAddMilestone: (name: string, value: number | null) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<{ name: string; value: string } | null>(null);
  const [taskValue, setTaskValue] = useState<{ id: string; value: string } | null>(null);
  const { toast } = useApp();
  const loose = data.looseTasks || [];
  const saveTaskValue = async () => {
    if (!taskValue?.id || taskValue.value === '') return;
    try { onChanged(await api.finance.updateItem('task', taskValue.id, { contractValue: Number(taskValue.value) }) as Overview); setTaskValue(null); toast('Value added'); }
    catch (e: any) { failed(toast, e); }
  };
  // Phases that carry no value and were never billed (template phases, say) are hidden until asked for.
  const [showEmpty, setShowEmpty] = useState(false);
  const isEmpty = (r: Row) => r.value == null && !r.invoiced && !(r.children || []).some((c) => c.value != null || c.invoiced);
  const inFilter = data.sov.groups.filter((g) => filter === 'all' || g.category === filter);
  const hiddenCount = inFilter.reduce((n, g) => n + g.rows.filter(isEmpty).length, 0);
  const groups = showEmpty ? inFilter : inFilter.map((g) => ({ ...g, rows: g.rows.filter((r) => !isEmpty(r)) })).filter((g) => g.rows.length);
  const present = new Set(data.sov.groups.map((g) => g.category));
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const s = data.sov.summary;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {([['all', 'All'], ['design', 'Design'], ['construction', 'Construction'], ['other', 'Other'], ['unphased', 'Unphased']] as [Filter, string][])
          .filter(([k]) => k === 'all' || present.has(k as any) || k === filter)
          .map(([k, l]) => <div key={k} onClick={() => setFilter(k)} style={{ ...btn(filter === k), padding: '5px 12px', fontSize: 12 }}>{l}</div>)}
        <div style={{ flex: 1 }} />
        {hiddenCount > 0 && (
          <span onClick={() => setShowEmpty(!showEmpty)} title="Phases with no value and nothing billed -- e.g. from the programme template" style={{ fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 600 }}>
            {showEmpty ? `Hide ${hiddenCount} without a value` : `Show ${hiddenCount} without a value`}
          </span>
        )}
        <span onClick={() => setOpen(new Set(data.sov.groups.flatMap((g) => g.rows.map((r) => r.id))))} style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>Expand all</span>
        <span onClick={() => setOpen(new Set())} style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>Collapse</span>
        {data.rights.manage && loose.length > 0 && <div onClick={() => setTaskValue({ id: loose[0].id, value: '' })} style={btn()} title="Give a board task outside the phases its own value">+ Task value</div>}
        {data.rights.manage && <div onClick={() => setAdding({ name: '', value: '' })} style={btn()}>+ Milestone</div>}
      </div>

      {adding && (
        <div style={{ ...card, padding: '12px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderColor: ACCENT }}>
          <div style={{ flex: 1, minWidth: 220 }}><Label text="Milestone" /><input autoFocus value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder="e.g. Deposit, Permit set, Handover" style={input} /></div>
          <div style={{ width: 160 }}><Label text="Value (optional)" /><input type="number" min={0} value={adding.value} onChange={(e) => setAdding({ ...adding, value: e.target.value })} style={input} /></div>
          <div onClick={() => { if (adding.name.trim()) { onAddMilestone(adding.name.trim(), adding.value === '' ? null : Number(adding.value)); setAdding(null); } }} style={btn(true)}>Add</div>
          <div onClick={() => setAdding(null)} style={btn()}>Cancel</div>
          <div style={{ width: '100%', fontSize: 11.5, color: MUTED }}>Milestones added here are ordinary project phases (shown under Other), so the Phase Board and financials share one structure.</div>
        </div>
      )}

      {taskValue && (
        <div style={{ ...card, padding: '12px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderColor: ACCENT }}>
          <div style={{ flex: 1, minWidth: 220 }}><Label text="Task (not in a phase)" /><select value={taskValue.id} onChange={(e) => setTaskValue({ ...taskValue, id: e.target.value })} style={input}>{loose.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
          <div style={{ width: 160 }}><Label text="Value ($)" /><input type="number" min={0} autoFocus value={taskValue.value} onChange={(e) => setTaskValue({ ...taskValue, value: e.target.value })} style={input} /></div>
          <div onClick={saveTaskValue} style={btn(true)}>Add</div>
          <div onClick={() => setTaskValue(null)} style={btn()}>Cancel</div>
          <div style={{ width: '100%', fontSize: 11.5, color: MUTED }}>Tasks inside a milestone get their values from the milestone's row (expand it). This is for ad-hoc board tasks that sit outside the phases; they appear under Unphased work.</div>
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 1390 }}>
            <div style={headRow(COLS)}>
              <span>Milestone / task</span><span>Progress</span><span style={{ textAlign: 'right' }}>Value</span><span style={{ textAlign: 'right' }}>Work done</span>
              <span style={{ textAlign: 'right' }}>Billed</span><span style={{ textAlign: 'right' }}>Ready to bill</span><span style={{ textAlign: 'right' }}>Retention</span>
              <span style={{ textAlign: 'right' }}>Received</span><span style={{ textAlign: 'right' }}>Client owes</span><span style={{ textAlign: 'right' }}>Remaining</span><span>Status</span>
            </div>
            {data.sov.lump && <SovRow row={data.sov.lump} depth={0} data={data} onChanged={onChanged} onItem={onItem} onProgress={onProgress} />}
            {groups.map((g) => (
              <GroupBlock key={g.category} g={g} data={data} open={open} toggle={toggle} onChanged={onChanged} onItem={onItem} onProgress={onProgress} />
            ))}
            {!data.sov.lump && !groups.length && (
              <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
                {hiddenCount ? <>No milestone here carries a value yet. <span onClick={() => setShowEmpty(true)} style={{ color: ACCENT, cursor: 'pointer', fontWeight: 600 }}>Show all {hiddenCount}</span> to give them values.</> : 'No milestones here.'}
              </div>
            )}
            {!s.lumpSum && filter === 'all' && (
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '10px 14px', borderTop: '1px solid ' + LINE, background: s.allocation === 'over' ? '#F7ECE6' : '#FBF9F4', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ color: s.allocation === 'over' ? DANGER : INK }}>{s.allocation === 'over' ? 'Over-allocated' : 'Unallocated'}</span><span />
                <span style={{ textAlign: 'right', color: s.allocation === 'over' ? DANGER : INK }}>{usd0(s.unallocated)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {s.lumpSum && <div style={{ fontSize: 12, color: MUTED }}>Billed as a lump sum: update the project's progress to bill against the whole contract. Give any milestone or task a value to switch to a schedule of values.</div>}
    </div>
  );
}

function GroupBlock({ g, data, open, toggle, onChanged, onItem, onProgress }: {
  g: Group; data: Overview; open: Set<string>; toggle: (id: string) => void; onChanged: (o: Overview) => void; onItem: (r: Row) => void; onProgress: (r: Row) => void;
}) {
  const t = g.totals;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '8px 14px', background: '#F4F1E8', borderTop: '1px solid ' + LINE, fontSize: 11.5, fontWeight: 700, color: INK, alignItems: 'center' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>{g.label}</span><span />
        <span style={{ textAlign: 'right' }}>{t.value != null ? usd0(t.value) : '—'}</span><span style={{ textAlign: 'right' }}>{usd0(t.ev)}</span>
        <span style={{ textAlign: 'right' }}>{usd0(t.invoiced)}</span><span style={{ textAlign: 'right' }}>{usd0(t.billable)}</span>
        <span style={{ textAlign: 'right' }}>{usd0(t.retention)}</span><span style={{ textAlign: 'right' }}>{usd0(t.paid)}</span>
        <span style={{ textAlign: 'right' }}>{usd0(t.outstanding)}</span><span style={{ textAlign: 'right' }}>{usd0(t.remaining)}</span><span />
      </div>
      {g.rows.map((r) => (
        <div key={r.id}>
          <SovRow row={r} depth={0} data={data} expanded={open.has(r.id)} onToggle={r.children?.length ? () => toggle(r.id) : undefined} onChanged={onChanged} onItem={onItem} onProgress={onProgress} />
          {open.has(r.id) && (r.children || []).map((c) => <SovRow key={c.id} row={c} depth={1} data={data} onChanged={onChanged} onItem={onItem} onProgress={onProgress} />)}
        </div>
      ))}
    </>
  );
}

function SovRow({ row, depth, data, expanded, onToggle, onChanged, onItem, onProgress }: {
  row: Row; depth: number; data: Overview; expanded?: boolean; onToggle?: () => void; onChanged: (o: Overview) => void; onItem: (r: Row) => void; onProgress: (r: Row) => void;
}) {
  const { toast } = useApp();
  const approval = data.settings.requireProgressApproval;
  const editableValue = data.rights.manage && row.kind !== 'project' && !row.valueFromTasks && !row.deleted;
  const [val, setVal] = useState(row.ownValue == null ? '' : String(row.ownValue));
  useEffect(() => { setVal(row.ownValue == null ? '' : String(row.ownValue)); }, [row.ownValue, row.fin?.version]);
  const saveValue = async () => {
    const next = val === '' ? null : Number(val);
    if (next === row.ownValue || (next != null && !Number.isFinite(next))) return;
    try { onChanged(await api.finance.updateItem(row.kind, row.id, { contractValue: next, version: row.fin?.version }) as Overview); }
    catch (e: any) { failed(toast, e); setVal(row.ownValue == null ? '' : String(row.ownValue)); }
  };
  const progressEditable = row.kind === 'project' || (!row.valueFromTasks && !row.deleted);
  const num = (n: number) => <span style={{ textAlign: 'right', fontSize: 12.5 }}>{n ? usd0(n) : <span style={{ color: '#c8c3cf' }}>—</span>}</span>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center', padding: '7px 14px', borderTop: '1px solid rgba(20,8,31,.05)', background: row.kind === 'project' ? '#F3F8F3' : 'white', opacity: row.deleted ? 0.6 : 1 }}>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: depth * 22, minWidth: 0 }}>
        {onToggle ? <span onClick={onToggle} style={{ cursor: 'pointer', color: MUTED, width: 12, fontSize: 11 }}>{expanded ? '▾' : '▸'}</span> : <span style={{ width: 12 }} />}
        <span onClick={() => onItem(row)} title="Details, deliverables and billing conditions" style={{ fontSize: 13, fontWeight: depth ? 500 : 650, color: INK, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.name}
        </span>
        {row.valueFromTasks && <span style={{ fontSize: 10.5, color: MUTED }}>from tasks</span>}
        {!!row.changeOrders && <span title="Approved change orders included in the value" style={{ fontSize: 10.5, color: row.changeOrders > 0 ? '#1E6B36' : DANGER, whiteSpace: 'nowrap' }}>CO {row.changeOrders > 0 ? '+' : '−'}{usd0(Math.abs(row.changeOrders))}</span>}
      </span>
      <span onClick={progressEditable && (data.rights.reportProgress || data.rights.approveProgress) ? () => onProgress(row) : undefined} style={{ cursor: progressEditable ? 'pointer' : 'default', display: 'grid', gap: 3 }} title={`Physical progress ${pct(row.physicalProgress)}`}>
        <span style={{ fontSize: 11.5, color: INK }}>
          {pct(row.reportedProgress)}{approval && row.approvedProgress !== row.reportedProgress ? <span style={{ color: MUTED }}> · ✓ {pct(row.approvedProgress)}</span> : null}
        </span>
        <ProgressBar reported={row.reportedProgress} billable={row.billableProgress} />
      </span>
      <span style={{ textAlign: 'right' }}>
        {editableValue
          ? <span style={{ display: 'grid', gap: 2 }}>
            <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} onBlur={saveValue} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="—" title={row.changeOrders ? 'Base value, before change orders' : undefined} style={{ ...input, padding: '4px 6px', fontSize: 12.5, textAlign: 'right' }} />
            {!!row.changeOrders && <span style={{ fontSize: 10.5, color: MUTED }}>= {usd0(row.value)} with COs</span>}
          </span>
          : <span style={{ fontSize: 12.5, fontWeight: 600, fontStyle: row.valueFromTasks ? 'italic' : 'normal' }}>{row.value != null ? usd0(row.value) : '—'}</span>}
      </span>
      {num(row.ev)}
      <span onClick={row.invoiced ? () => onItem({ ...row, name: row.name, _tab: 'invoices' } as any) : undefined} style={{ textAlign: 'right', fontSize: 12.5, cursor: row.invoiced ? 'pointer' : 'default', color: row.invoiced ? ACCENT : undefined, textDecoration: row.invoiced ? 'underline' : 'none', textDecorationColor: '#cfd8d2' }}>
        {row.invoiced ? usd0(row.invoiced) : <span style={{ color: '#c8c3cf' }}>—</span>}
      </span>
      <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: row.billable ? 700 : 400, color: row.billable ? '#8A6D12' : row.overBilled ? DANGER : undefined }}>
        {row.billable ? usd0(row.billable) : row.overBilled ? `−${usd0(row.overBilled)}` : <span style={{ color: '#c8c3cf' }}>—</span>}
      </span>
      {num(row.retention)}{num(row.paid)}{num(row.outstanding)}
      <span style={{ textAlign: 'right', fontSize: 12.5 }}>{row.value != null ? usd0(row.remaining) : '—'}</span>
      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {row.deleted ? <Badge tone="grey">Task removed</Badge> : <BillingBadge s={row.billingStatus} />}<PaymentBadge s={row.paymentStatus} />
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ setup & settings

function SettingsForm({ data, f, set }: { data: Overview; f: Record<string, any>; set: (k: string, v: any) => void }) {
  const locked = !!data.settings.contractLockedAt;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      <div><Label text="Original contract value ($)" /><input type="number" min={0} disabled={locked} value={f.originalContractValue} onChange={(e) => set('originalContractValue', e.target.value)} style={input} />
        {locked && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>Locked since the first invoice — changes come through change orders.</div>}</div>
      <div><Label text="Original budget ($, optional)" /><input type="number" min={0} value={f.originalBudget} onChange={(e) => set('originalBudget', e.target.value)} style={input} /></div>
      <div><Label text="Retention %" /><input type="number" min={0} max={100} step={0.5} value={f.retentionPct} onChange={(e) => set('retentionPct', e.target.value)} style={input} /></div>
      <div><Label text="Tax % (on invoices)" /><input type="number" min={0} max={100} step={0.25} value={f.taxPct} onChange={(e) => set('taxPct', e.target.value)} style={input} /></div>
      <div><Label text="Payment terms (days)" /><input type="number" min={0} max={365} value={f.paymentTermsDays} onChange={(e) => set('paymentTermsDays', e.target.value)} style={input} /></div>
      <div><Label text="Labor burden %" /><input type="number" min={0} max={200} step={0.5} value={f.laborBurdenPct} onChange={(e) => set('laborBurdenPct', e.target.value)} placeholder="e.g. 30" style={input} /></div>
      <div><Label text="Reimbursable markup %" /><input type="number" min={0} max={100} step={0.5} value={f.reimbursableMarkupPct} onChange={(e) => set('reimbursableMarkupPct', e.target.value)} style={input} /></div>
      <div><Label text="Contract number" /><input value={f.contractNumber} onChange={(e) => set('contractNumber', e.target.value)} style={input} /></div>
      <div><Label text="Client PO number" /><input value={f.poNumber} onChange={(e) => set('poNumber', e.target.value)} style={input} /></div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: INK, alignSelf: 'end', paddingBottom: 8 }}>
        <input type="checkbox" checked={!!f.requireProgressApproval} onChange={(e) => set('requireProgressApproval', e.target.checked)} />Progress must be approved before billing
      </label>
      <div><Label text="Bill to" /><input value={f.billToName} onChange={(e) => set('billToName', e.target.value)} style={input} /></div>
      <div><Label text="Billing email" /><input value={f.billToEmail} onChange={(e) => set('billToEmail', e.target.value)} style={input} /></div>
      <div style={{ gridColumn: '1 / -1' }}><Label text="Billing address" /><textarea rows={2} value={f.billToAddress} onChange={(e) => set('billToAddress', e.target.value)} style={{ ...input, resize: 'vertical' }} /></div>
    </div>
  );
}

const formFrom = (data: Overview, s: Settings) => ({
  originalContractValue: s.exists ? s.originalContractValue : data.suggestedContract || '',
  originalBudget: s.originalBudget ?? '', retentionPct: s.exists ? s.retentionPct : 10, taxPct: s.taxPct ?? 0, paymentTermsDays: s.paymentTermsDays ?? 30,
  reimbursableMarkupPct: s.reimbursableMarkupPct ?? 0, laborBurdenPct: s.laborBurdenPct ?? 0,
  requireProgressApproval: !!s.requireProgressApproval, contractNumber: s.contractNumber || '', poNumber: s.poNumber || '',
  billToName: s.billToName || data.billToDefaults?.name || '', billToEmail: s.billToEmail || data.billToDefaults?.email || '', billToAddress: s.billToAddress || data.billToDefaults?.address || '',
});
const payloadFrom = (f: Record<string, any>, locked: boolean) => ({
  ...(locked ? {} : { originalContractValue: Number(f.originalContractValue) || 0 }),
  originalBudget: f.originalBudget === '' ? null : Number(f.originalBudget), retentionPct: Number(f.retentionPct) || 0, taxPct: Number(f.taxPct) || 0,
  paymentTermsDays: Number(f.paymentTermsDays) || 0, requireProgressApproval: !!f.requireProgressApproval, contractNumber: f.contractNumber, poNumber: f.poNumber,
  reimbursableMarkupPct: Number(f.reimbursableMarkupPct) || 0, laborBurdenPct: Number(f.laborBurdenPct) || 0,
  billToName: f.billToName, billToEmail: f.billToEmail, billToAddress: f.billToAddress,
});

function SetupCard({ data, onDone }: { data: Overview; onDone: (o: Overview) => void }) {
  const { toast } = useApp();
  const [f, setF] = useState<Record<string, any>>(() => formFrom(data, data.settings));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { onDone(await api.finance.saveSettings(data.project.id, payloadFrom(f, false)) as Overview); toast('Financials set up'); }
    catch (e: any) { failed(toast, e); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ ...card, padding: '18px 20px' }}>
      <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, color: INK }}>Set up this project's financials</div>
      <div style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 16px', lineHeight: 1.6, maxWidth: 760 }}>
        The contract value, retention and tax the project bills with. After this, give milestones and tasks their share of the contract
        (or bill the whole project as a lump sum), keep progress up to date, and invoice what's been earned.
      </div>
      <SettingsForm data={data} f={f} set={(k, v) => setF({ ...f, [k]: v })} />
      <div style={{ marginTop: 16 }}><div onClick={busy ? undefined : save} style={btn(true, busy)}>{busy ? 'Saving…' : 'Set up financials'}</div></div>
    </div>
  );
}

function SettingsDrawer({ data, onClose, onSaved }: { data: Overview; onClose: () => void; onSaved: (o: Overview) => void }) {
  const { toast } = useApp();
  const [f, setF] = useState<Record<string, any>>(() => formFrom(data, data.settings));
  const save = async () => {
    try { onSaved(await api.finance.saveSettings(data.project.id, { ...payloadFrom(f, !!data.settings.contractLockedAt), version: data.settings.version }) as Overview); toast('Saved'); }
    catch (e: any) { failed(toast, e); }
  };
  return (
    <Drawer title="Financial settings" subtitle={data.project.name} width={680} onClose={onClose}
      footer={data.rights.manage ? <><div onClick={onClose} style={btn()}>Cancel</div><div onClick={save} style={btn(true)}>Save</div></> : undefined}>
      <SettingsForm data={data} f={f} set={(k, v) => setF({ ...f, [k]: v })} />
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 14, lineHeight: 1.6 }}>
        Changing retention or tax affects new invoices only -- issued invoices keep the rates they were issued with.
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ item details

function ItemDrawer({ row, projectId, rights, onClose, onSaved, onOpenInvoice }: {
  row: Row & { _tab?: string }; projectId: number; rights: Overview['rights']; onClose: () => void; onSaved: (o: Overview) => void; onOpenInvoice: (id: string) => void;
}) {
  const { toast } = useApp();
  const [tab, setTab] = useState<'details' | 'progress' | 'invoices'>(row._tab === 'invoices' ? 'invoices' : 'details');
  const fin = row.fin || ({} as any);
  const [f, setF] = useState<Record<string, any>>({
    budgetedCost: fin.budgetedCost ?? '', estimatedCost: fin.estimatedCost ?? '', billingMethod: fin.billingMethod || 'percent_complete',
    retentionPctOverride: fin.retentionPctOverride ?? '', taxPctOverride: fin.taxPctOverride ?? '', csiCodeId: fin.csiCodeId || '', subcontractorTradeId: fin.subcontractorTradeId || '',
    deliverables: fin.deliverables || '', requiredFromUs: fin.requiredFromUs || '', requiredFromClient: fin.requiredFromClient || '', requiredFromContractor: fin.requiredFromContractor || '',
    acceptanceCriteria: fin.acceptanceCriteria || '', billingCondition: fin.billingCondition || '', notes: fin.notes || '',
  });
  const [codes, setCodes] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [history, setHistory] = useState<any[] | null>(null);
  const [lines, setLines] = useState<any[] | null>(null);
  useEffect(() => {
    api.csiCodes.list().then((r: any) => setCodes(Array.isArray(r) ? r : [])).catch(() => {});
    api.subcontractorTrades.list().then((r: any) => setTrades(Array.isArray(r) ? r : [])).catch(() => {});
    const itemId = row.kind === 'project' ? String(projectId) : row.id;
    api.finance.progressHistory(row.kind, itemId).then((r: any) => setHistory(Array.isArray(r) ? r : [])).catch(() => setHistory([]));
    api.finance.itemInvoices(row.kind, itemId).then((r: any) => setLines(Array.isArray(r) ? r : [])).catch(() => setLines([]));
  }, [row.id]);
  const editable = rights.manage && row.kind !== 'project' && !row.deleted;
  const save = async () => {
    try {
      onSaved(await api.finance.updateItem(row.kind, row.id, {
        ...f, version: row.fin?.version,
        budgetedCost: f.budgetedCost === '' ? null : Number(f.budgetedCost), estimatedCost: f.estimatedCost === '' ? null : Number(f.estimatedCost),
        retentionPctOverride: f.retentionPctOverride === '' ? null : Number(f.retentionPctOverride), taxPctOverride: f.taxPctOverride === '' ? null : Number(f.taxPctOverride),
      }) as Overview);
      toast('Saved');
    } catch (e: any) { failed(toast, e); }
  };
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const area = (k: string, label: string, ph?: string) => (
    <div style={{ gridColumn: '1 / -1' }}><Label text={label} /><textarea disabled={!editable} rows={2} value={f[k]} onChange={set(k)} placeholder={ph} style={{ ...input, resize: 'vertical' }} /></div>
  );

  return (
    <Drawer title={row.name} subtitle={`${row.kind === 'phase' ? 'Milestone' : row.kind === 'task' ? 'Task' : 'Project'} · value ${row.value != null ? usd(row.value) : '—'} · earned ${usd(row.ev)} · invoiced ${usd(row.invoiced)}`} width={720} onClose={onClose}
      footer={tab === 'details' && editable ? <><div onClick={onClose} style={btn()}>Cancel</div><div onClick={save} style={btn(true)}>Save</div></> : undefined}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + LINE, marginBottom: 14 }}>
        {([['details', 'Details'], ['progress', 'Progress history'], ['invoices', `Invoices${lines ? ` (${lines.length})` : ''}`]] as const).map(([k, l]) => (
          <div key={k} onClick={() => setTab(k)} style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: tab === k ? ACCENT : MUTED, borderBottom: '2px solid ' + (tab === k ? ACCENT : 'transparent'), marginBottom: -1 }}>{l}</div>
        ))}
      </div>
      {tab === 'details' && (
        row.kind === 'project' ? <div style={{ fontSize: 12.5, color: MUTED }}>The whole project is billed as one item. Its settings live under Settings.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div><Label text="Billing method" /><select disabled={!editable} value={f.billingMethod} onChange={set('billingMethod')} style={input}>{BILLING_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><Label text="Budgeted cost ($)" /><input disabled={!editable} type="number" min={0} value={f.budgetedCost} onChange={set('budgetedCost')} style={input} /></div>
            <div><Label text="Estimated cost ($)" /><input disabled={!editable} type="number" min={0} value={f.estimatedCost} onChange={set('estimatedCost')} style={input} /></div>
            <div><Label text="Retention % override" /><input disabled={!editable} type="number" min={0} max={100} value={f.retentionPctOverride} onChange={set('retentionPctOverride')} placeholder="Project default" style={input} /></div>
            <div><Label text="Tax % override" /><input disabled={!editable} type="number" min={0} max={100} value={f.taxPctOverride} onChange={set('taxPctOverride')} placeholder="Project default" style={input} /></div>
            <div><Label text="Cost code" /><select disabled={!editable} value={f.csiCodeId} onChange={set('csiCodeId')} style={input}><option value="">—</option>{codes.filter((c) => c.active || c.id === f.csiCodeId).map((c) => <option key={c.id} value={c.id}>{c.code} {c.division}</option>)}</select></div>
            <div><Label text="Trade" /><select disabled={!editable} value={f.subcontractorTradeId} onChange={set('subcontractorTradeId')} style={input}><option value="">—</option>{trades.filter((t) => t.active || t.id === f.subcontractorTradeId).map((t) => <option key={t.id} value={t.id}>{t.code} {t.name}</option>)}</select></div>
            {area('deliverables', 'Deliverables', 'What this milestone/task produces')}
            {area('requiredFromUs', 'Required from us')}
            {area('requiredFromClient', 'Required from the client')}
            {area('requiredFromContractor', 'Required from the contractor')}
            {area('acceptanceCriteria', 'Acceptance criteria')}
            {area('billingCondition', 'Billing condition', 'e.g. Milestone completion approved by the client')}
            {area('notes', 'Financial notes')}
          </div>
        )
      )}
      {tab === 'progress' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          {(history || []).map((h) => (
            <div key={h.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
              <span style={{ width: 150, color: MUTED }}>{fmtDate(h.at)}</span>
              <span style={{ flex: 1 }}><b>{h.kind === 'approved' ? 'Approved' : 'Reported'}</b> {pct(h.fromPct)} → {pct(h.toPct)}{h.reason ? ` — ${h.reason}` : ''}</span>
              <span style={{ color: MUTED }}>{h.byName}</span>
            </div>
          ))}
          {history && !history.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>No progress recorded yet.</div>}
        </div>
      )}
      {tab === 'invoices' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          {(lines || []).map((l, i) => (
            <div key={i} onClick={() => onOpenInvoice(l.invoiceId)} style={{ display: 'flex', gap: 10, padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, cursor: 'pointer' }}>
              <span style={{ width: 120, fontWeight: 700, color: ACCENT }}>{l.number || 'Draft'}</span>
              <span style={{ width: 110, color: MUTED }}>{fmtDate(l.invoiceDate)}</span>
              <span style={{ flex: 1 }}>{l.prevProgressPct != null ? `${pct(l.prevProgressPct)} → ${pct(l.currentProgressPct)}` : l.description}</span>
              <b>{usd(l.amount)}</b>
              <Badge tone={l.status === 'issued' ? 'green' : 'grey'}>{l.status}</Badge>
            </div>
          ))}
          {lines && !lines.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Not on any invoice yet.</div>}
          {lines && lines.length > 0 && (
            <div style={{ padding: '9px 14px', borderTop: '1px solid ' + LINE, fontSize: 12.5, fontWeight: 700, display: 'flex' }}>
              <span style={{ flex: 1 }}>Total invoiced (issued)</span>{usd(lines.filter((l) => l.status === 'issued').reduce((a, l) => a + l.amount, 0))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ------------------------------------------------------------------ progress

function ProgressDrawer({ row, data, onClose, onSaved }: { row: Row; data: Overview; onClose: () => void; onSaved: (o: Overview) => void }) {
  const { toast } = useApp();
  const [val, setVal] = useState(String(row.reportedProgress));
  const [reason, setReason] = useState('');
  const approval = data.settings.requireProgressApproval;
  const id = row.kind === 'project' ? String(data.project.id) : row.id;
  const version = row.kind === 'project' ? data.settings.version : row.fin?.version;
  const n = Number(val);
  const lowering = Number.isFinite(n) && n < row.reportedProgress;
  const report = async () => {
    try { onSaved(await api.finance.reportProgress(row.kind, id, { pct: n, reason: reason || undefined, version }) as Overview); toast('Progress updated'); }
    catch (e: any) { failed(toast, e); }
  };
  const approve = async () => {
    try { onSaved(await api.finance.approveProgress(row.kind, id, { pct: row.reportedProgress, version }) as Overview); toast(`Approved ${pct(row.reportedProgress)}`); }
    catch (e: any) { failed(toast, e); }
  };
  return (
    <Drawer title={`Progress — ${row.name}`} width={480} onClose={onClose}>
      <div style={{ ...card, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.8, marginBottom: 14 }}>
        <div>Reported: <b>{pct(row.reportedProgress)}</b>{approval ? <> · Approved: <b>{pct(row.approvedProgress)}</b></> : null}</div>
        <div>Physical (tasks done): {pct(row.physicalProgress)}</div>
        <div>Value {row.value != null ? usd(row.value) : '—'} · earned {usd(row.ev)} · invoiced {usd(row.invoiced)}</div>
        <div style={{ color: MUTED, fontSize: 11.5 }}>{approval ? 'Billing uses approved progress.' : 'Billing uses reported progress.'} Physical progress is shown for reference and never billed on its own.</div>
      </div>
      {data.rights.reportProgress && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div><Label text="Progress % (cumulative)" /><input type="number" min={0} max={100} step={1} value={val} onChange={(e) => setVal(e.target.value)} style={input} /></div>
          {lowering && <div><Label text="Why is progress going down?" /><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required when reducing progress" style={input} /></div>}
          <div><div onClick={report} style={btn(true)}>Update progress</div></div>
        </div>
      )}
      {approval && data.rights.approveProgress && row.approvedProgress < row.reportedProgress && (
        <div style={{ ...card, padding: '12px 14px', marginTop: 16, borderColor: ACCENT }}>
          <div style={{ fontSize: 12.5, marginBottom: 8 }}>Approve the reported {pct(row.reportedProgress)} for billing?</div>
          <div onClick={approve} style={btn(true)}>Approve {pct(row.reportedProgress)}</div>
        </div>
      )}
    </Drawer>
  );
}

// ------------------------------------------------------------------ lists

function InvoiceList({ invoices, canManage, busy, billableNow, onOpen, onNew }: {
  invoices: Invoice[] | null; canManage: boolean; busy: boolean; billableNow: number; onOpen: (id: string) => void; onNew: (billReady: boolean) => void;
}) {
  const cols = '130px 110px 110px minmax(160px,1fr) 120px 120px 110px 120px 110px';
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {canManage && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={busy || billableNow <= 0 ? undefined : () => onNew(true)} style={btn(true, busy || billableNow <= 0)}>Progress invoice for ready work</div>
          <div onClick={busy ? undefined : () => onNew(false)} style={btn(false, busy)}>Blank invoice</div>
        </div>
      )}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 1050 }}>
            <div style={headRow(cols)}><span>Invoice</span><span>Date</span><span>Due</span><span>Description</span><span style={{ textAlign: 'right' }}>Contract work</span><span style={{ textAlign: 'right' }}>Total</span><span style={{ textAlign: 'right' }}>Paid</span><span style={{ textAlign: 'right' }}>Outstanding</span><span>Status</span></div>
            {invoices === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {(invoices || []).map((i) => (
              <div key={i.id} onClick={() => onOpen(i.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', opacity: i.status === 'void' ? 0.55 : 1 }}>
                <b style={{ fontSize: 12.5, color: ACCENT }}>{i.issuedNumber || 'Draft'}</b>
                <span style={{ fontSize: 12.5 }}>{fmtDate(i.invoiceDate)}</span>
                <span style={{ fontSize: 12.5, color: i.overdue ? DANGER : undefined }}>{fmtDate(i.dueDate)}</span>
                <span style={{ fontSize: 12.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.kind === 'credit' ? <b style={{ color: '#3C5C8A' }}>{i.creditType === 'write_off' ? 'Write-off · ' : 'Credit · '}</b> : i.kind === 'retention' ? <b style={{ color: '#3C5C8A' }}>Retention · </b> : null}
                  {i.approvalRequestedAt && i.status === 'draft' ? <b style={{ color: '#8A6D12' }}>Awaiting approval · </b> : null}
                  {i.description || (i.kind === 'progress' ? 'Progress claim' : 'Invoice')}
                </span>
                <span style={{ textAlign: 'right', fontSize: 12.5 }}>{usd(i.contractWork)}</span>
                <b style={{ textAlign: 'right', fontSize: 12.5 }}>{usd(i.total)}</b>
                <span style={{ textAlign: 'right', fontSize: 12.5 }}>{i.status === 'issued' ? usd(i.paid) : '—'}</span>
                <span style={{ textAlign: 'right', fontSize: 12.5, color: i.overdue ? DANGER : undefined }}>{i.status === 'issued' ? usd(i.outstanding) : '—'}</span>
                <span><InvoiceBadge s={i.paymentStatus} /></span>
              </div>
            ))}
            {invoices && !invoices.length && <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No invoices yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentList({ projectId, onOpenInvoice }: { projectId: number; onOpenInvoice: (id: string) => void }) {
  const [rows, setRows] = useState<Payment[] | null>(null);
  useEffect(() => { api.finance.payments(projectId).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [projectId]);
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {(rows || []).map((p) => (
        <div key={p.id} onClick={() => onOpenInvoice(p.invoiceId)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', fontSize: 12.5, opacity: p.voidedAt ? 0.55 : 1 }}>
          <span style={{ width: 110, color: MUTED }}>{fmtDate(p.date)}</span>
          <b style={{ width: 120, color: ACCENT }}>{p.invoiceNumber}</b>
          <span style={{ flex: 1 }}>{p.method.toUpperCase()}{p.bankRef ? ` · ${p.bankRef}` : ''}{p.txnRef ? ` · ${p.txnRef}` : ''}{p.voidedAt ? ` · voided: ${p.voidReason}` : ''}</span>
          <b style={{ textDecoration: p.voidedAt ? 'line-through' : 'none' }}>{usd(p.amount)}</b>
        </div>
      ))}
      {rows && !rows.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>No payments recorded.</div>}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  financials_set_up: 'Set up financials', settings_changed: 'Changed financial settings', item_set_up: 'Set up an item', item_changed: 'Changed an item',
  progress_reported: 'Reported progress', progress_approved: 'Approved progress', milestone_added: 'Added a milestone', invoice_drafted: 'Started an invoice',
  invoice_draft_changed: 'Edited a draft invoice', invoice_draft_deleted: 'Deleted a draft invoice', invoice_issued: 'Issued an invoice', invoice_voided: 'Voided an invoice',
  payment_recorded: 'Recorded a payment', payment_voided: 'Voided a payment',
  invoice_approval_requested: 'Sent an invoice for approval', credit_drafted: 'Started a credit note', write_off_drafted: 'Started a write-off',
  credit_issued: 'Issued a credit note', write_off_issued: 'Wrote off a balance', credit_voided: 'Voided a credit note',
  co_created: 'Raised a change order', co_changed: 'Edited a change order', co_deleted: 'Deleted a change order', co_submitted: 'Submitted a change order',
  co_sent_to_client: 'Approved a change order internally', co_returned: 'Returned a change order', co_approved: 'Recorded client approval of a change order',
  co_rejected: 'Rejected a change order', co_cancelled: 'Cancelled a change order', co_reopened: 'Reopened a change order',
  reimbursable_submitted: 'Submitted a reimbursable', reimbursable_changed: 'Edited a reimbursable', reimbursable_approved: 'Approved a reimbursable',
  reimbursable_rejected: 'Rejected a reimbursable', reimbursable_deleted: 'Deleted a reimbursable',
  retention_release_requested: 'Requested a retention release', retention_release_approved: 'Approved a retention release',
  retention_release_rejected: 'Rejected a retention release', retention_release_cancelled: 'Cancelled a retention release',
  budget_added: 'Added a budget line', budget_changed: 'Changed a budget line', budget_removed: 'Removed a budget line', forecast_set: 'Set a cost forecast',
  commitment_created: 'Created a subcontract / PO', commitment_changed: 'Edited a subcontract / PO', commitment_revised: 'Revised an approved subcontract / PO',
  commitment_approved: 'Approved a subcontract / PO', commitment_closed: 'Closed a subcontract / PO', commitment_voided: 'Voided a subcontract / PO',
  commitment_reopened: 'Reopened a subcontract / PO', commitment_deleted: 'Deleted a subcontract / PO',
  cost_recorded: 'Recorded a cost', cost_changed: 'Edited a cost', cost_approved: 'Approved a cost', cost_paid: 'Marked a cost paid', cost_voided: 'Voided a cost', cost_deleted: 'Deleted a cost',
};
export { ACTION_LABEL };

function ActivityList({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api.finance.activity(projectId).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [projectId]);
  const show = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'number' ? String(v) : String(v));
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      {(rows || []).map((a) => (
        <div key={a.id} style={{ display: 'flex', gap: 12, padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
          <span style={{ width: 120, color: MUTED }}>{fmtDate(a.at)}</span>
          <span style={{ flex: 1, lineHeight: 1.6 }}>
            <b>{a.byName}</b> · {ACTION_LABEL[a.action] || a.action}
            {a.changes && <span style={{ color: MUTED }}> — {Object.entries(a.changes).map(([k, c]: any) => `${k}: ${show(c.from)} → ${show(c.to)}`).join('; ')}</span>}
            {a.reason && <span style={{ color: INK }}> · “{a.reason}”</span>}
          </span>
        </div>
      ))}
      {rows && !rows.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Nothing recorded yet.</div>}
    </div>
  );
}

