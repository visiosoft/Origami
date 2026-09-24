import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { Attachments } from '../Attachments';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, Drawer, Label, btn, card, fmtDate, headRow, input, todayISO } from '../manpowerUi';
import { COMMITMENT_TYPES, COST_TYPES, CostBadge, ReasonBox, downloadCsv, failed, label, usd, usd0, type Overview } from './financeUi';

// ------------------------------------------------------------------ shapes

interface CostRow {
  key: string; csiCodeId: string | null; code: string; division: string;
  budgetOriginal: number; budgetChanges: number; budget: number; committed: number; commitmentBilled: number; open: number;
  bills: number; labor: number; laborHours: number; reimbursable: number; actual: number; eac: number; eacOverridden: boolean; costToComplete: number; variance: number; spentPct: number;
}
interface Line { id?: string; description: string; csiCodeId?: string | null; phaseId?: string | null; taskId?: string | null; amount: number | string }
interface Commitment {
  id: string; number: string; type: string; contractorId?: string; vendorName: string; title: string; scope?: string; status: string; dateIssued?: string;
  approvedBy?: string; approvedAt?: string; closedReason?: string; notes?: string; attachments: any[]; sharedAttachments?: any[]; lines: Line[]; total: number; billed: number; remaining: number; version: number;
}
interface CostEntry {
  id: string; date: string; dueDate?: string; type: string; contractorId?: string; vendorName?: string; reference?: string; commitmentId?: string; csiCodeId?: string;
  phaseId?: string; taskId?: string; description: string; amount: number; status: string; approvedBy?: string; paidDate?: string; paymentRef?: string; voidReason?: string;
  notes?: string; attachments: any[]; version: number; createdBy?: string; source?: string;
}
interface CostsView {
  rights: { manageCosts: boolean; approveCosts: boolean; viewProfitability: boolean };
  originalBudget: number | null; laborBurdenPct: number;
  rows: CostRow[]; totals: Record<string, number>; profitability: Record<string, any>;
  budgetLines: (Line & { id: string; version: number; notes?: string })[]; commitments: Commitment[]; entries: CostEntry[];
  labor: { people: { employeeId: string; name: string; hours: number; otHours: number; wage: number; cost: number; rate: number }[]; weeks: { week: string; hours: number; cost: number }[]; hours: number; wage: number; cost: number };
  contractors: { id: string; name: string }[];
}
interface Code { id: string; code: string; division: string; active: boolean }

/** Cost codes and project items for the pickers, loaded once per panel. */
function usePickers(overview: Overview) {
  const [codes, setCodes] = useState<Code[]>([]);
  useEffect(() => { api.csiCodes.list().then((r: any) => setCodes(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  const items = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (const g of overview.sov.groups) for (const r of g.rows) {
      if (r.kind === 'phase') { out.push({ value: `phase:${r.id}`, label: r.name }); for (const c of r.children || []) out.push({ value: `task:${c.id}:${r.id}`, label: `   ${c.name}` }); }
      else out.push({ value: `task:${r.id}:`, label: r.name });
    }
    return out;
  }, [overview]);
  return { codes, items };
}
const itemValue = (x: { phaseId?: string | null; taskId?: string | null }) => (x.taskId ? `task:${x.taskId}:${x.phaseId || ''}` : x.phaseId ? `phase:${x.phaseId}` : '');
const fromItemValue = (v: string) => {
  const [k, a, b] = v.split(':');
  return k === 'task' ? { taskId: a, phaseId: b || null } : k === 'phase' ? { phaseId: a, taskId: null } : { phaseId: null, taskId: null };
};

function CodeSelect({ codes, value, onChange, disabled }: { codes: Code[]; value?: string | null; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ ...input, padding: '5px 7px', fontSize: 12.5 }}>
      <option value="">No cost code</option>
      {codes.filter((c) => c.active || c.id === value).map((c) => <option key={c.id} value={c.id}>{c.code} {c.division}</option>)}
    </select>
  );
}
function ItemSelect({ items, value, onChange, disabled }: { items: { value: string; label: string }[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...input, padding: '5px 7px', fontSize: 12.5 }}>
      <option value="">Whole project</option>
      {items.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
    </select>
  );
}

function Stat({ l, v, sub, tone }: { l: string; v: string; sub?: string; tone?: string }) {
  return (
    <div style={{ ...card, padding: '10px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
      <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: tone || INK, marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontSize: 11.5, color: MUTED }}>{sub}</div>}
    </div>
  );
}

/**
 * Where the budget stands, in one bar: paid out, billed but unpaid, committed
 * but not yet billed, and budget not yet committed (or committed past it).
 */
function SpendBar({ budget, committed, paid, unpaid, open, other }: { budget: number; committed: number; paid: number; unpaid: number; open: number; other: number }) {
  const scale = Math.max(budget, paid + unpaid + open + other, committed, 1);
  const uncommitted = Math.max(budget - (paid + unpaid + open + other), 0);
  const over = Math.max(paid + unpaid + open + other - budget, 0);
  const parts: [string, number, string][] = [
    ['Paid out', paid, '#2F7D4A'], ['Billed, unpaid', unpaid, '#D9A441'], ['Other cost to date', other, '#7FA38C'],
    ['Committed, not yet billed', open, '#CFE3D2'], ['Budget not yet committed', uncommitted, '#EFEDE8'],
  ];
  if (!budget && !paid && !unpaid && !open && !other) return null;
  return (
    <div style={{ ...card, padding: '12px 16px', display: 'grid', gap: 8 }}>
      <div style={{ position: 'relative', height: 12, borderRadius: 99, overflow: 'hidden', display: 'flex', background: '#EFEDE8' }}>
        {parts.filter(([, n]) => n > 0).map(([l, n, c]) => <div key={l} title={`${l}: ${usd(n)}`} style={{ width: `${(n / scale) * 100}%`, background: c }} />)}
        {budget > 0 && over > 0 && <div title="Budget" style={{ position: 'absolute', left: `${(budget / scale) * 100}%`, top: 0, bottom: 0, width: 2, background: DANGER }} />}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: MUTED }}>
        {parts.filter(([, n]) => n > 0).map(([l, n, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: c, border: c === '#EFEDE8' ? '1px solid #DAD6CD' : 'none' }} />{l} <b style={{ color: INK }}>{usd0(n)}</b></span>
        ))}
        {over > 0 && <span style={{ color: DANGER, fontWeight: 700 }}>{usd0(over)} past the budget</span>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ job cost panel

type Sub = 'codes' | 'budget' | 'commitments' | 'costs' | 'labor';

/**
 * Job cost for one project: budget by cost code against what's committed and
 * spent, the forecast at completion, and the budget, subcontracts / POs,
 * bills and labor behind those figures.
 */
export function JobCostPanel({ projectId, overview }: { projectId: number; overview: Overview }) {
  const { toast } = useApp();
  const [v, setV] = useState<CostsView | null>(null);
  const [sub, setSub] = useState<Sub>('codes');
  const load = () => api.finance.costs(projectId).then((r: any) => setV(r)).catch((e: any) => failed(toast, e));
  useEffect(() => { load(); }, [projectId]);
  const pick = usePickers(overview);
  if (!v) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading job cost…</div>;
  const t = v.totals;
  const paidOut = v.entries.filter((e) => e.status === 'paid').reduce((a, e) => a + e.amount, 0);
  const unpaidBills = v.entries.filter((e) => e.status === 'recorded' || e.status === 'approved').reduce((a, e) => a + e.amount, 0);
  const stillToPay = unpaidBills + t.open;
  const tabs: [Sub, string][] = [['codes', 'By cost code'], ['budget', `Budget (${v.budgetLines.length})`], ['commitments', `Subcontracts & POs (${v.commitments.length})`], ['costs', `Costs (${v.entries.filter((e) => e.status !== 'void').length})`], ['labor', 'Labor']];
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <Stat l="Budget" v={usd0(t.budget)} sub={t.budgetChanges ? `incl. ${usd0(t.budgetChanges)} from change orders` : v.originalBudget != null && Math.abs(v.originalBudget - t.budget) >= 1 ? `Settings say ${usd0(v.originalBudget)}` : 'Cost budget'} />
        <Stat l="Committed" v={usd0(t.committed)} sub={`${v.commitments.filter((c) => c.status === 'approved' || c.status === 'closed').length} subcontract${v.commitments.length === 1 ? '' : 's'} / POs`} />
        <Stat l="Paid out" v={usd0(paidOut)} sub="To subcontractors & vendors" tone={paidOut ? '#1E6B36' : undefined} />
        <Stat l="Still to pay" v={usd0(stillToPay)} sub={unpaidBills ? `${usd0(unpaidBills)} billed and unpaid` : 'Nothing billed and unpaid'} tone={stillToPay ? '#8A6D12' : undefined} />
      </div>
      <SpendBar budget={t.budget} committed={t.committed} paid={paidOut} unpaid={unpaidBills} open={t.open} other={Math.max(t.actual - paidOut - unpaidBills, 0)} />
      <div style={{ ...card, padding: '10px 16px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 12.5 }}>
        <span><span style={{ color: MUTED }}>Cost to date </span><b>{usd0(t.actual)}</b>
          <span style={{ color: MUTED, fontSize: 11.5 }}> ({[t.bills && `bills ${usd0(t.bills)}`, t.labor && `labor ${usd0(t.labor)}`, t.reimbursable && `reimbursables ${usd0(t.reimbursable)}`].filter(Boolean).join(' · ') || 'nothing yet'})</span></span>
        <span><span style={{ color: MUTED }}>Forecast at completion </span><b>{usd0(t.eac)}</b></span>
        <span><span style={{ color: MUTED }}>Variance </span><b style={{ color: t.variance < 0 ? DANGER : t.variance > 0 ? '#1E6B36' : INK }}>{t.variance < 0 ? `${usd0(-t.variance)} over budget` : t.variance > 0 ? `${usd0(t.variance)} under budget` : 'on budget'}</b></span>
        <span><span style={{ color: MUTED }}>Labor </span><b>{t.laborHours || 0} h</b>{v.laborBurdenPct ? <span style={{ color: MUTED, fontSize: 11.5 }}> · burden {v.laborBurdenPct}%</span> : null}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + LINE }}>
        {tabs.map(([k, l]) => <div key={k} onClick={() => setSub(k)} style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: sub === k ? ACCENT : MUTED, borderBottom: '2px solid ' + (sub === k ? ACCENT : 'transparent'), marginBottom: -1 }}>{l}</div>)}
      </div>
      {sub === 'codes' && <ByCode v={v} projectId={projectId} onChanged={setV} />}
      {sub === 'budget' && <Budget v={v} projectId={projectId} pick={pick} onChanged={setV} />}
      {sub === 'commitments' && <Commitments v={v} projectId={projectId} pick={pick} onChanged={setV} />}
      {sub === 'costs' && <Costs v={v} projectId={projectId} pick={pick} onChanged={setV} />}
      {sub === 'labor' && <Labor v={v} />}
    </div>
  );
}

function ByCode({ v, projectId, onChanged }: { v: CostsView; projectId: number; onChanged: (x: CostsView) => void }) {
  const { toast } = useApp();
  const [edit, setEdit] = useState<{ key: string; csiCodeId: string | null; eac: string; note: string } | null>(null);
  const cols = 'minmax(170px,2fr) repeat(6, minmax(92px,1fr)) 120px';
  const save = async (clear = false) => {
    if (!edit) return;
    try { onChanged(await api.finance.setForecast(projectId, { csiCodeId: edit.csiCodeId, eac: clear ? null : edit.eac, note: edit.note }) as CostsView); setEdit(null); }
    catch (e) { failed(toast, e); }
  };
  const csv = () => downloadCsv(`job-cost-${projectId}`, [['code', 'Code'], ['division', 'Division'], ['budget', 'Budget'], ['committed', 'Committed'], ['actual', 'Actual'], ['open', 'Open commitments'], ['eac', 'Forecast (EAC)'], ['variance', 'Variance'], ['labor', 'Labor'], ['laborHours', 'Labor hours']], v.rows);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div style={{ flex: 1, fontSize: 11.5, color: MUTED }}>Forecast is your estimate where you've set one (✎); otherwise the larger of the budget and cost to date plus what's committed but not yet billed.</div><div onClick={csv} style={btn()}>Export CSV</div></div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            <div style={headRow(cols)}>
              <span>Cost code</span><span style={{ textAlign: 'right' }}>Budget</span><span style={{ textAlign: 'right' }}>Committed</span><span style={{ textAlign: 'right' }}>Cost to date</span>
              <span style={{ textAlign: 'right' }}>Not yet billed</span><span style={{ textAlign: 'right' }}>Forecast</span><span style={{ textAlign: 'right' }}>Variance</span><span style={{ paddingLeft: 14 }}>Spent</span>
            </div>
            {v.rows.map((r) => (
              <div key={r.key}>
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                  <span><b>{r.code}</b> {r.division}</span>
                  <span style={{ textAlign: 'right' }} title={r.budgetChanges ? `${usd(r.budgetOriginal)} + ${usd(r.budgetChanges)} change orders` : ''}>{usd0(r.budget)}{r.budgetChanges ? <span style={{ color: '#1E6B36', fontSize: 10.5 }}> +CO</span> : null}</span>
                  <span style={{ textAlign: 'right' }}>{r.committed ? usd0(r.committed) : '—'}</span>
                  <span style={{ textAlign: 'right' }} title={`Bills ${usd(r.bills)} · labor ${usd(r.labor)} (${r.laborHours} h) · reimbursables ${usd(r.reimbursable)}`}>{usd0(r.actual)}</span>
                  <span style={{ textAlign: 'right', color: MUTED }}>{r.open ? usd0(r.open) : '—'}</span>
                  <span onClick={v.rights.manageCosts ? () => setEdit({ key: r.key, csiCodeId: r.csiCodeId, eac: String(r.eac), note: '' }) : undefined} style={{ textAlign: 'right', fontWeight: 700, cursor: v.rights.manageCosts ? 'pointer' : 'default', color: r.eacOverridden ? ACCENT : INK }} title={v.rights.manageCosts ? 'Set a forecast' : ''}>
                    {usd0(r.eac)}{r.eacOverridden ? ' ✎' : ''}
                  </span>
                  <span style={{ textAlign: 'right', color: r.variance < 0 ? DANGER : r.variance > 0 ? '#1E6B36' : MUTED, fontWeight: r.variance < 0 ? 700 : 400 }}>{r.variance ? usd0(r.variance) : '—'}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 14 }}>
                    <span style={{ flex: 1, height: 6, borderRadius: 99, background: '#EFEDE8', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.min(100, r.spentPct)}%`, background: r.spentPct > 100 ? DANGER : '#2F7D4A' }} /></span>
                    <span style={{ fontSize: 11, color: MUTED, width: 38, textAlign: 'right' }}>{r.budget ? `${Math.round(r.spentPct)}%` : ''}</span>
                  </span>
                </div>
                {edit?.key === r.key && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 14px 12px', background: '#FBF9F4', flexWrap: 'wrap' }}>
                    <div style={{ width: 160 }}><Label text="Forecast at completion ($)" /><input autoFocus type="number" value={edit.eac} onChange={(e) => setEdit({ ...edit, eac: e.target.value })} style={input} /></div>
                    <div style={{ flex: 1, minWidth: 220 }}><Label text="Why" /><input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="e.g. Soils report: deeper footings" style={input} /></div>
                    <div onClick={() => save()} style={btn(true)}>Set forecast</div>
                    {r.eacOverridden && <div onClick={() => save(true)} style={btn()}>Back to automatic</div>}
                    <div onClick={() => setEdit(null)} style={btn()}>Cancel</div>
                  </div>
                )}
              </div>
            ))}
            {!v.rows.length && <div style={{ padding: 20, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>Nothing yet — add the budget, then subcontracts, POs and costs. Labor comes in from approved timesheets and daily logs.</div>}
            {v.rows.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 14px', borderTop: '1px solid ' + LINE, background: '#F4F1E8', fontSize: 12.5, fontWeight: 700 }}>
                <span>Total</span><span style={{ textAlign: 'right' }}>{usd0(v.totals.budget)}</span><span style={{ textAlign: 'right' }}>{usd0(v.totals.committed)}</span><span style={{ textAlign: 'right' }}>{usd0(v.totals.actual)}</span>
                <span style={{ textAlign: 'right' }}>{usd0(v.totals.open)}</span><span style={{ textAlign: 'right' }}>{usd0(v.totals.eac)}</span><span style={{ textAlign: 'right', color: v.totals.variance < 0 ? DANGER : undefined }}>{usd0(v.totals.variance)}</span><span />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ budget

function Budget({ v, projectId, pick, onChanged }: { v: CostsView; projectId: number; pick: ReturnType<typeof usePickers>; onChanged: (x: CostsView) => void }) {
  const { toast } = useApp();
  const blank = { csiCodeId: '', item: '', description: '', amount: '' };
  const [add, setAdd] = useState(blank);
  const [edits, setEdits] = useState<Record<string, { csiCodeId: string; item: string; description: string; amount: string }>>({});
  const can = v.rights.manageCosts;
  const save = async (x: { id?: string; version?: number; csiCodeId: string; item: string; description: string; amount: string }) => {
    try {
      onChanged(await api.finance.saveBudgetLine(projectId, { id: x.id, version: x.version, csiCodeId: x.csiCodeId || null, ...fromItemValue(x.item), description: x.description, amount: Number(x.amount) }) as CostsView);
      if (x.id) setEdits((e) => { const n = { ...e }; delete n[x.id!]; return n; }); else setAdd(blank);
    } catch (e) { failed(toast, e); }
  };
  const remove = async (id: string) => { if (!window.confirm('Remove this budget line?')) return; try { onChanged(await api.finance.removeBudgetLine(id) as CostsView); } catch (e) { failed(toast, e); } };
  const cols = 'minmax(170px,1.2fr) minmax(160px,1fr) minmax(200px,1.6fr) 130px 120px';
  const row = (x: typeof add, set: (p: Partial<typeof add>) => void) => <>
    <CodeSelect codes={pick.codes} value={x.csiCodeId} onChange={(c) => set({ csiCodeId: c })} />
    <ItemSelect items={pick.items} value={x.item} onChange={(i) => set({ item: i })} />
    <input value={x.description} onChange={(e) => set({ description: e.target.value })} placeholder="What it covers" style={{ ...input, padding: '5px 7px', fontSize: 12.5 }} />
    <input type="number" value={x.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" style={{ ...input, padding: '5px 7px', fontSize: 12.5, textAlign: 'right' }} />
  </>;
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 860 }}>
          <div style={headRow(cols)}><span>Cost code</span><span>For</span><span>Description</span><span style={{ textAlign: 'right' }}>Amount</span><span /></div>
          {v.budgetLines.map((b) => {
            const e = edits[b.id];
            const name = (id?: string | null) => { const c = pick.codes.find((x) => x.id === id); return c ? `${c.code} ${c.division}` : 'No cost code'; };
            return (
              <div key={b.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '7px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                {e ? <>
                  {row(e, (p) => setEdits({ ...edits, [b.id]: { ...e, ...p } }))}
                  <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><span onClick={() => save({ ...e, id: b.id, version: b.version })} style={{ color: ACCENT, fontWeight: 700, cursor: 'pointer' }}>Save</span><span onClick={() => setEdits((x) => { const n = { ...x }; delete n[b.id]; return n; })} style={{ color: MUTED, cursor: 'pointer' }}>Cancel</span></span>
                </> : <>
                  <span>{name(b.csiCodeId)}</span>
                  <span style={{ color: MUTED }}>{pick.items.find((i) => i.value === itemValue(b))?.label.trim() || 'Whole project'}</span>
                  <span>{b.description}</span>
                  <b style={{ textAlign: 'right' }}>{usd(Number(b.amount))}</b>
                  <span style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>{can && <>
                    <span onClick={() => setEdits({ ...edits, [b.id]: { csiCodeId: b.csiCodeId || '', item: itemValue(b), description: b.description || '', amount: String(b.amount) } })} style={{ color: ACCENT, cursor: 'pointer' }}>Edit</span>
                    <span onClick={() => remove(b.id)} style={{ color: DANGER, cursor: 'pointer' }}>Remove</span>
                  </>}</span>
                </>}
              </div>
            );
          })}
          {can && (
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid ' + LINE, background: '#FBF9F4' }}>
              {row(add, (p) => setAdd({ ...add, ...p }))}
              <span style={{ textAlign: 'right' }}><span onClick={add.amount !== '' ? () => save(add) : undefined} style={{ ...btn(true, add.amount === ''), padding: '6px 12px', fontSize: 12 }}>+ Add line</span></span>
            </div>
          )}
          <div style={{ display: 'flex', padding: '9px 14px', borderTop: '1px solid ' + LINE, fontSize: 12.5, fontWeight: 700 }}>
            <span style={{ flex: 1 }}>Original budget</span>{usd(v.budgetLines.reduce((a, b) => a + Number(b.amount), 0))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ commitments

function Commitments({ v, projectId, pick, onChanged }: { v: CostsView; projectId: number; pick: ReturnType<typeof usePickers>; onChanged: (x: CostsView) => void }) {
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const cols = '90px 130px minmax(160px,1.2fr) minmax(180px,1.4fr) 120px 120px 120px 110px';
  const current = open && open !== 'new' ? v.commitments.find((c) => c.id === open) || null : null;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}><div style={{ flex: 1 }} />{v.rights.manageCosts && <div onClick={() => setOpen('new')} style={btn(true)}>+ Subcontract / PO</div>}</div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 960 }}>
            <div style={headRow(cols)}><span>No.</span><span>Type</span><span>Subcontractor / vendor</span><span>Title</span><span style={{ textAlign: 'right' }}>Committed</span><span style={{ textAlign: 'right' }}>Billed to us</span><span style={{ textAlign: 'right' }}>Not yet billed</span><span>Status</span></div>
            {v.commitments.map((c) => (
              <div key={c.id} onClick={() => setOpen(c.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, cursor: 'pointer', opacity: c.status === 'void' ? 0.5 : 1 }}>
                <b style={{ color: ACCENT }}>{c.number}</b><span style={{ color: MUTED }}>{label(COMMITMENT_TYPES, c.type)}</span><span>{c.vendorName}</span><span>{c.title}</span>
                <b style={{ textAlign: 'right' }}>{usd0(c.total)}</b><span style={{ textAlign: 'right' }}>{usd0(c.billed)}</span><span style={{ textAlign: 'right', color: MUTED }}>{c.status === 'approved' ? usd0(c.remaining) : '—'}</span>
                <span><CostBadge s={c.status} /></span>
              </div>
            ))}
            {!v.commitments.length && <div style={{ padding: 20, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No subcontracts or purchase orders yet. Approved ones count as committed cost.</div>}
          </div>
        </div>
      </div>
      {open && <CommitmentDrawer c={current} v={v} projectId={projectId} pick={pick} onClose={() => setOpen(null)} onChanged={(x, id) => { onChanged(x); if (id) setOpen(id); }} />}
    </div>
  );
}

function CommitmentDrawer({ c, v, projectId, pick, onClose, onChanged }: {
  c: Commitment | null; v: CostsView; projectId: number; pick: ReturnType<typeof usePickers>; onClose: () => void; onChanged: (x: CostsView, openId?: string) => void;
}) {
  const { toast } = useApp();
  const [f, setF] = useState(() => ({ type: c?.type || 'subcontract', contractorId: c?.contractorId || '', vendorName: c?.vendorName || '', title: c?.title || '', scope: c?.scope || '', dateIssued: c?.dateIssued || '', notes: c?.notes || '' }));
  const [lines, setLines] = useState<(Line & { item: string })[]>(() => (c?.lines || []).map((l) => ({ ...l, amount: String(l.amount), item: itemValue(l) })));
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState<null | 'void' | 'close' | 'revise'>(null);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => {}); }, []);
  useEffect(() => { if (c) { setLines(c.lines.map((l) => ({ ...l, amount: String(l.amount), item: itemValue(l) }))); setDirty(false); } }, [c?.version]);
  const editable = !c || c.status === 'draft' ? v.rights.manageCosts : c.status === 'approved' && v.rights.approveCosts;
  const set = (k: keyof typeof f) => (e: any) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  const patch = (i: number, p: Partial<Line & { item: string }>) => { setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l))); setDirty(true); };
  const total = lines.reduce((a, l) => a + (Number(l.amount) || 0), 0);
  const billedHere = v.entries.filter((e) => c && e.commitmentId === c.id && e.status !== 'void');

  const save = async (reason?: string) => {
    if (c?.status === 'approved' && !reason) { setStep('revise'); return; }
    try {
      const r = await api.finance.saveCommitment(projectId, { id: c?.id, version: c?.version, ...f, reason, lines: lines.map((l) => ({ id: l.id, description: l.description, csiCodeId: l.csiCodeId || null, ...fromItemValue(l.item), amount: Number(l.amount) })) }) as CostsView;
      const id = c?.id || r.commitments.find((x) => !v.commitments.some((y) => y.id === x.id))?.id;
      onChanged(r, id); setDirty(false); setStep(null); toast('Saved');
    } catch (e) { failed(toast, e); }
  };
  const act = async (action: string, reason?: string) => {
    try {
      const r = await api.finance.commitmentStep(c!.id, action, { version: c!.version, reason }) as CostsView;
      onChanged(r); setStep(null);
      if (action === 'delete') onClose();
    } catch (e) { failed(toast, e); }
  };
  const cols = 'minmax(200px,1.6fr) minmax(160px,1fr) minmax(150px,1fr) 120px 24px';

  return (
    <Drawer title={c ? `${c.number} · ${c.title}` : 'New subcontract / purchase order'} subtitle={c ? `${c.vendorName}${c.approvedBy ? ` · approved by ${c.approvedBy} ${fmtDate(c.approvedAt)}` : ''}` : 'Cost the project is committed to before it is billed'} width={920} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        {c && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><CostBadge s={c.status} />
          <span style={{ fontSize: 12.5, color: MUTED }}>Committed {usd(c.total)} · billed to us {usd(c.billed)}{c.status === 'approved' ? ` · ${usd(c.remaining)} not yet billed` : ''}{c.closedReason ? ` · ${c.closedReason}` : ''}</span></div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          <div><Label text="Type" /><select disabled={!editable} value={f.type} onChange={set('type')} style={input}>{COMMITMENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><Label text="Subcontractor (directory)" /><select disabled={!editable} value={f.contractorId} onChange={(e) => { const k = v.contractors.find((x) => x.id === e.target.value); setF({ ...f, contractorId: e.target.value, vendorName: k ? k.name : f.vendorName }); setDirty(true); }} style={input}>
            <option value="">— Not in the directory —</option>{v.contractors.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div>
          <div><Label text="Vendor name" /><input disabled={!editable} value={f.vendorName} onChange={set('vendorName')} style={input} /></div>
          <div><Label text="Date issued" /><input disabled={!editable} type="date" value={f.dateIssued} onChange={set('dateIssued')} style={input} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Label text="Title" /><input disabled={!editable} value={f.title} onChange={set('title')} placeholder="e.g. Foundations & slab on grade" style={input} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Label text="Scope" /><textarea disabled={!editable} rows={2} value={f.scope} onChange={set('scope')} style={{ ...input, resize: 'vertical' }} /></div>
        </div>
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={headRow(cols)}><span>Line</span><span>Cost code</span><span>For</span><span style={{ textAlign: 'right' }}>Amount</span><span /></div>
          {lines.map((l, i) => (
            <div key={l.id || i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '6px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
              <input disabled={!editable} value={l.description} onChange={(e) => patch(i, { description: e.target.value })} style={{ ...input, padding: '5px 7px', fontSize: 12.5 }} />
              <CodeSelect disabled={!editable} codes={pick.codes} value={l.csiCodeId} onChange={(x) => patch(i, { csiCodeId: x })} />
              <ItemSelect disabled={!editable} items={pick.items} value={l.item} onChange={(x) => patch(i, { item: x })} />
              <input disabled={!editable} type="number" value={l.amount} onChange={(e) => patch(i, { amount: e.target.value })} style={{ ...input, padding: '5px 7px', fontSize: 12.5, textAlign: 'right' }} />
              {editable ? <span onClick={() => { setLines(lines.filter((_, j) => j !== i)); setDirty(true); }} style={{ cursor: 'pointer', color: MUTED, fontSize: 16, textAlign: 'center' }}>×</span> : <span />}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, padding: '9px 14px', borderTop: '1px solid ' + LINE, alignItems: 'center' }}>
            {editable && <div onClick={() => { setLines([...lines, { description: '', csiCodeId: '', amount: '', item: '' }]); setDirty(true); }} style={btn()}>+ Line</div>}
            <div style={{ flex: 1 }} /><b style={{ fontFamily: BG, fontSize: 16 }}>{usd(total)}</b>
          </div>
        </div>
        <div><Label text="Notes" /><textarea disabled={!editable} rows={2} value={f.notes} onChange={set('notes')} style={{ ...input, resize: 'vertical' }} /></div>
        {step === 'revise' && <ReasonBox title="Revise an approved commitment" confirm="Save revision" onCancel={() => setStep(null)} onSubmit={(x) => save(x.reason)} fields={[{ key: 'reason', label: 'Why (e.g. change order to the subcontract)', type: 'textarea', required: true }]} />}
        {step === 'void' && <ReasonBox title="Void commitment" tone="danger" confirm="Void" onCancel={() => setStep(null)} onSubmit={(x) => act('void', x.reason)} fields={[{ key: 'reason', label: 'Why', type: 'textarea', required: true }]} />}
        {step === 'close' && <ReasonBox title="Close commitment" confirm="Close" onCancel={() => setStep(null)} onSubmit={(x) => act('close', x.reason)} fields={[{ key: 'reason', label: 'Note', initial: 'Complete — final pay app received' }]} />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid ' + LINE, paddingTop: 12 }}>
          {c?.status === 'draft' && v.rights.manageCosts && <div onClick={() => window.confirm(`Delete ${c.number}?`) && act('delete')} style={{ ...btn(), color: DANGER }}>Delete draft</div>}
          {c && ['draft', 'approved'].includes(c.status) && v.rights.approveCosts && <div onClick={() => setStep('void')} style={{ ...btn(), color: DANGER }}>Void</div>}
          <div style={{ flex: 1 }} />
          {editable && <div onClick={() => save()} style={btn(!c, !dirty && !!c)}>{c ? (c.status === 'approved' ? 'Save revision' : 'Save') : 'Create'}</div>}
          {c?.status === 'draft' && v.rights.approveCosts && <div onClick={() => act('approve')} style={btn(true)}>Approve</div>}
          {c?.status === 'approved' && v.rights.approveCosts && <div onClick={() => setStep('close')} style={btn()}>Close</div>}
          {c?.status === 'closed' && v.rights.approveCosts && <div onClick={() => act('reopen')} style={btn()}>Reopen</div>}
        </div>
        {c && billedHere.length > 0 && <div>
          <Label text="Their bills against it" />
          <div style={{ ...card, overflow: 'hidden' }}>
            {billedHere.map((e) => <div key={e.id} style={{ display: 'flex', gap: 10, padding: '7px 12px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
              <span style={{ width: 100, color: MUTED }}>{fmtDate(e.date)}</span><span style={{ flex: 1 }}>{e.reference ? `${e.reference} · ` : ''}{e.description}</span><CostBadge s={e.status} /><b>{usd(e.amount)}</b></div>)}
          </div>
        </div>}
        {c && <Attachments scope="finance-costs" taskId={c.id} attachments={c.attachments || []} canManage={v.rights.manageCosts} storageReady={storageReady}
          onUpload={async (files) => { await api.finance.costUpload(c.id, files); onChanged(await api.finance.costs(projectId) as CostsView); }}
          onRemove={async (att) => { await api.finance.costRemoveAttachment(c.id, att.id); onChanged(await api.finance.costs(projectId) as CostsView); }}
          onAddLink={async (name, url) => { await api.finance.costLink(c.id, name, url); onChanged(await api.finance.costs(projectId) as CostsView); }} />}
        {c && c.contractorId && <div>
          <Label text={`Shared with ${c.vendorName || 'the subcontractor'}`} />
          <div style={{ fontSize: 12, color: MUTED, margin: '-2px 0 8px', lineHeight: 1.55 }}>Drawings, specs or the signed agreement they should see in their portal. The files above stay internal.</div>
          <Attachments scope="finance-commitment-shared" taskId={c.id} attachments={c.sharedAttachments || []} canManage={v.rights.manageCosts} storageReady={storageReady}
            onUpload={async (files) => { await api.finance.sharedUpload(c.id, files); onChanged(await api.finance.costs(projectId) as CostsView); }}
            onRemove={async (att) => { await api.finance.sharedRemove(c.id, att.id); onChanged(await api.finance.costs(projectId) as CostsView); }}
            onAddLink={async (name, url) => { await api.finance.sharedLink(c.id, name, url); onChanged(await api.finance.costs(projectId) as CostsView); }} />
        </div>}
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ costs

function Costs({ v, projectId, pick, onChanged }: { v: CostsView; projectId: number; pick: ReturnType<typeof usePickers>; onChanged: (x: CostsView) => void }) {
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [status, setStatus] = useState('live');
  const shown = v.entries.filter((e) => status === 'all' || (status === 'live' ? e.status !== 'void' : e.status === status));
  const cols = '100px 150px minmax(150px,1fr) minmax(200px,1.6fr) 130px 120px 110px';
  const codeName = (id?: string) => { const c = pick.codes.find((x) => x.id === id); return c ? c.code : '—'; };
  const current = open && open !== 'new' ? v.entries.find((e) => e.id === open) || null : null;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...input, width: 180 }}>
          <option value="live">All but void</option><option value="recorded">To approve</option><option value="approved">Approved, not yet paid</option><option value="paid">Paid</option><option value="void">Void</option><option value="all">Everything</option>
        </select>
        <div style={{ flex: 1 }} />
        <div onClick={() => downloadCsv(`costs-${projectId}`, [['date', 'Date'], ['type', 'Type'], ['vendorName', 'Vendor'], ['reference', 'Reference'], ['description', 'Description'], ['amount', 'Amount'], ['status', 'Status'], ['dueDate', 'Due'], ['paidDate', 'Paid']], shown)} style={btn()}>Export CSV</div>
        {v.rights.manageCosts && <div onClick={() => setOpen('new')} style={btn(true)}>+ Cost</div>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 920 }}>
            <div style={headRow(cols)}><span>Date</span><span>Type</span><span>Vendor</span><span>Description</span><span>Cost code</span><span style={{ textAlign: 'right' }}>Amount</span><span>Status</span></div>
            {shown.map((e) => (
              <div key={e.id} onClick={() => setOpen(e.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, cursor: 'pointer', opacity: e.status === 'void' ? 0.5 : 1 }}>
                <span>{fmtDate(e.date)}</span><span style={{ color: MUTED }}>{label(COST_TYPES, e.type)}</span><span>{e.vendorName || '—'}</span>
                <span>{e.reference ? <b>{e.reference} · </b> : null}{e.description}{e.commitmentId ? <span style={{ color: MUTED }}> · {v.commitments.find((c) => c.id === e.commitmentId)?.number}</span> : null}{e.source === 'portal' && <span title="Sent by the subcontractor through their portal" style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: '#D8E2F0', color: '#3C5C8A', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>From portal</span>}</span>
                <span style={{ color: MUTED }}>{codeName(e.csiCodeId)}</span><b style={{ textAlign: 'right' }}>{usd(e.amount)}</b><span><CostBadge s={e.status} /></span>
              </div>
            ))}
            {!shown.length && <div style={{ padding: 20, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No costs here.</div>}
          </div>
        </div>
      </div>
      {open && <CostDrawer e={current} v={v} projectId={projectId} pick={pick} onClose={() => setOpen(null)} onChanged={(x, id) => { onChanged(x); if (id) setOpen(id); }} />}
    </div>
  );
}

function CostDrawer({ e, v, projectId, pick, onClose, onChanged }: {
  e: CostEntry | null; v: CostsView; projectId: number; pick: ReturnType<typeof usePickers>; onClose: () => void; onChanged: (x: CostsView, openId?: string) => void;
}) {
  const { toast } = useApp();
  const [f, setF] = useState(() => ({
    date: e?.date || todayISO(), dueDate: e?.dueDate || '', type: e?.type || 'vendor_bill', contractorId: e?.contractorId || '', vendorName: e?.vendorName || '', reference: e?.reference || '',
    commitmentId: e?.commitmentId || '', csiCodeId: e?.csiCodeId || '', item: e ? itemValue(e) : '', description: e?.description || '', amount: e ? String(e.amount) : '', notes: e?.notes || '',
  }));
  const [step, setStep] = useState<null | 'over' | 'void' | 'pay'>(null);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => {}); }, []);
  const editable = !e || (e.status === 'recorded' ? v.rights.manageCosts : e.status !== 'void' && v.rights.approveCosts);
  const set = (k: keyof typeof f) => (ev: any) => setF({ ...f, [k]: ev.target.value });
  const approvedCommitments = v.commitments.filter((c) => c.status === 'approved' || c.id === f.commitmentId);

  const save = async (overrideReason?: string) => {
    try {
      const { item, ...rest } = f;
      const r = await api.finance.saveCost(projectId, { ...rest, ...fromItemValue(item), id: e?.id, version: e?.version, amount: Number(f.amount), commitmentId: f.commitmentId || null, csiCodeId: f.csiCodeId || null, overrideReason }) as CostsView;
      const id = e?.id || r.entries.find((x) => !v.entries.some((y) => y.id === x.id))?.id;
      onChanged(r, id); setStep(null); toast('Saved');
    } catch (err: any) {
      if (/give a reason/.test(err?.message || '')) { toast('⚠ ' + err.message); setStep('over'); } else failed(toast, err);
    }
  };
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    try { onChanged(await api.finance.costStep(e!.id, action, { version: e!.version, ...extra }) as CostsView); setStep(null); if (action === 'delete') onClose(); }
    catch (err) { failed(toast, err); }
  };

  return (
    <Drawer title={e ? `${e.reference ? e.reference + ' · ' : ''}${e.description}` : 'Record a cost'} subtitle={e ? `${e.vendorName || '—'} · recorded by ${e.createdBy || '—'}` : 'A vendor bill, subcontractor pay application, material or equipment charge'} width={720} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        {e && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><CostBadge s={e.status} />
          <span style={{ fontSize: 12.5, color: e.status === 'void' ? DANGER : MUTED }}>{e.status === 'paid' ? `Paid ${fmtDate(e.paidDate)}${e.paymentRef ? ` · ${e.paymentRef}` : ''}` : e.status === 'approved' ? `Approved by ${e.approvedBy}` : e.status === 'void' ? `Void: ${e.voidReason}` : 'Waiting for approval'}</span></div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
          <div><Label text="Type" /><select disabled={!editable} value={f.type} onChange={set('type')} style={input}>{COST_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><Label text="Date" /><input disabled={!editable} type="date" value={f.date} onChange={set('date')} style={input} /></div>
          <div><Label text="Due" /><input disabled={!editable} type="date" value={f.dueDate} onChange={set('dueDate')} placeholder="30 days" style={input} /></div>
          <div><Label text="Against commitment" /><select disabled={!editable} value={f.commitmentId} onChange={(ev) => { const c = v.commitments.find((x) => x.id === ev.target.value); setF({ ...f, commitmentId: ev.target.value, vendorName: c ? c.vendorName : f.vendorName, contractorId: c?.contractorId || f.contractorId, csiCodeId: f.csiCodeId || c?.lines[0]?.csiCodeId || '' }); }} style={input}>
            <option value="">None</option>{approvedCommitments.map((c) => <option key={c.id} value={c.id}>{c.number} {c.vendorName} ({usd0(c.remaining)} left)</option>)}</select></div>
          <div><Label text="Vendor (directory)" /><select disabled={!editable} value={f.contractorId} onChange={(ev) => { const k = v.contractors.find((x) => x.id === ev.target.value); setF({ ...f, contractorId: ev.target.value, vendorName: k ? k.name : f.vendorName }); }} style={input}>
            <option value="">—</option>{v.contractors.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div>
          <div><Label text="Vendor name" /><input disabled={!editable} value={f.vendorName} onChange={set('vendorName')} style={input} /></div>
          <div><Label text="Bill / invoice #" /><input disabled={!editable} value={f.reference} onChange={set('reference')} style={input} /></div>
          <div><Label text="Amount ($)" /><input disabled={!editable} type="number" value={f.amount} onChange={set('amount')} style={input} /></div>
          <div><Label text="Cost code" /><CodeSelect disabled={!editable} codes={pick.codes} value={f.csiCodeId} onChange={(x) => setF({ ...f, csiCodeId: x })} /></div>
          <div><Label text="For" /><ItemSelect disabled={!editable} items={pick.items} value={f.item} onChange={(x) => setF({ ...f, item: x })} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Label text="Description" /><input disabled={!editable} value={f.description} onChange={set('description')} placeholder="e.g. Ready-mix concrete, 42 cy" style={input} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><textarea disabled={!editable} rows={2} value={f.notes} onChange={set('notes')} style={{ ...input, resize: 'vertical' }} /></div>
        </div>
        {step === 'over' && <ReasonBox title="This bills past the commitment" confirm="Record anyway" onCancel={() => setStep(null)} onSubmit={(x) => save(x.reason)} fields={[{ key: 'reason', label: 'Why (the commitment should usually be revised instead)', type: 'textarea', required: true }]} />}
        {step === 'void' && <ReasonBox title="Void cost" tone="danger" confirm="Void" onCancel={() => setStep(null)} onSubmit={(x) => act('void', { reason: x.reason })} fields={[{ key: 'reason', label: 'Why', type: 'textarea', required: true }]} />}
        {step === 'pay' && <ReasonBox title="Mark paid" confirm="Mark paid" onCancel={() => setStep(null)} onSubmit={(x) => act('pay', { paidDate: x.paidDate, paymentRef: x.paymentRef })} fields={[{ key: 'paidDate', label: 'Paid on', type: 'date', initial: todayISO(), required: true }, { key: 'paymentRef', label: 'Check / ACH reference' }]} />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid ' + LINE, paddingTop: 12 }}>
          {e?.status === 'recorded' && v.rights.manageCosts && <div onClick={() => window.confirm('Delete this cost?') && act('delete')} style={{ ...btn(), color: DANGER }}>Delete</div>}
          {e && e.status !== 'void' && v.rights.approveCosts && <div onClick={() => setStep('void')} style={{ ...btn(), color: DANGER }}>Void</div>}
          <div style={{ flex: 1 }} />
          {editable && <div onClick={() => save()} style={btn(!e)}>{e ? 'Save' : 'Record cost'}</div>}
          {e?.status === 'recorded' && v.rights.approveCosts && <div onClick={() => act('approve')} style={btn(true)}>Approve</div>}
          {e?.status === 'approved' && v.rights.approveCosts && <div onClick={() => setStep('pay')} style={btn(true)}>Mark paid</div>}
        </div>
        {e && <Attachments scope="finance-costs" taskId={e.id} attachments={e.attachments || []} canManage={v.rights.manageCosts} storageReady={storageReady}
          onUpload={async (files) => { await api.finance.costUpload(e.id, files); onChanged(await api.finance.costs(projectId) as CostsView); }}
          onRemove={async (att) => { await api.finance.costRemoveAttachment(e.id, att.id); onChanged(await api.finance.costs(projectId) as CostsView); }}
          onAddLink={async (name, url) => { await api.finance.costLink(e.id, name, url); onChanged(await api.finance.costs(projectId) as CostsView); }} />}
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ labor

function Labor({ v }: { v: CostsView }) {
  const l = v.labor;
  const pcols = 'minmax(200px,2fr) 110px 110px 110px 130px 130px';
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
        From approved timesheets and approved daily labor logs. Where both record the same person, project and day, the larger is used — never both.
        Hours past a standard day (across all projects) are overtime at the payroll overtime rate. Burden ({v.laborBurdenPct || 0}%) is set in Financial settings.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        <Stat l="Hours" v={String(l.hours)} /><Stat l="Wages" v={usd0(l.wage)} /><Stat l="Burden" v={usd0(l.cost - l.wage)} /><Stat l="Labor cost" v={usd0(l.cost)} />
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={headRow(pcols)}><span>Person</span><span style={{ textAlign: 'right' }}>Hours</span><span style={{ textAlign: 'right' }}>Overtime</span><span style={{ textAlign: 'right' }}>Base rate</span><span style={{ textAlign: 'right' }}>Wages</span><span style={{ textAlign: 'right' }}>Cost</span></div>
        {l.people.map((p) => (
          <div key={p.employeeId} style={{ display: 'grid', gridTemplateColumns: pcols, gap: 10, padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
            <span>{p.name}</span><span style={{ textAlign: 'right' }}>{p.hours}</span><span style={{ textAlign: 'right', color: MUTED }}>{p.otHours || '—'}</span>
            <span style={{ textAlign: 'right' }}>{usd(p.rate)}/h</span><span style={{ textAlign: 'right' }}>{usd(p.wage)}</span><b style={{ textAlign: 'right' }}>{usd(p.cost)}</b>
          </div>
        ))}
        {!l.people.length && <div style={{ padding: 18, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No approved labor on this project yet.</div>}
      </div>
      {l.weeks.length > 0 && <div style={{ ...card, padding: '12px 14px' }}>
        <Label text="By week" />
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 110, marginTop: 8 }}>
          {l.weeks.map((w) => {
            const max = Math.max(...l.weeks.map((x) => x.cost)) || 1;
            return <div key={w.week} title={`Week of ${fmtDate(w.week)}: ${w.hours} h · ${usd(w.cost)}`} style={{ flex: 1, minWidth: 14, maxWidth: 48, display: 'grid', gap: 4, justifyItems: 'center' }}>
              <div style={{ width: '100%', height: Math.max(3, (w.cost / max) * 80), background: '#2F7D4A', borderRadius: 4 }} />
              <span style={{ fontSize: 9.5, color: MUTED }}>{w.week.slice(5)}</span>
            </div>;
          })}
        </div>
      </div>}
    </div>
  );
}

// ------------------------------------------------------------------ profitability

/** Margin now and at completion, the WIP position, and how reimbursables did -- for those who can see profitability. */
export function ProfitabilityPanel({ projectId }: { projectId: number }) {
  const { toast } = useApp();
  const [v, setV] = useState<CostsView | null>(null);
  useEffect(() => { api.finance.costs(projectId).then((r: any) => setV(r)).catch((e: any) => failed(toast, e)); }, [projectId]);
  if (!v) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>;
  const p = v.profitability;
  const pctTone = (n: number) => (n < 0 ? DANGER : n < 10 ? '#8A6D12' : '#1E6B36');
  if (!p.projectedCost && !p.costToDate) {
    return <div style={{ ...card, padding: 20, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>No cost budget or costs yet, so there's no margin to forecast. Add the budget under Job cost; labor appears as timesheets and daily logs are approved.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {p.loss && <div style={{ ...card, padding: '10px 14px', background: '#F7ECE6', color: DANGER, fontSize: 12.5, fontWeight: 600 }}>
        This project is forecast to lose {usd0(-p.projectedMargin)}. Review the forecast by cost code, or price the extra work as change orders.
      </div>}
      <div>
        <Label text="At completion" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          <Stat l="Contract" v={usd0(p.contract)} sub="Revised, with approved change orders" />
          <Stat l="Forecast cost" v={usd0(p.projectedCost)} sub="Excluding reimbursables" />
          <Stat l="Projected margin" v={usd0(p.projectedMargin)} sub={`${p.projectedMarginPct}% of contract`} tone={pctTone(p.projectedMarginPct)} />
        </div>
      </div>
      <div>
        <Label text="To date" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          <Stat l="Work done (progress)" v={usd0(p.ev)} />
          <Stat l="Cost to date" v={usd0(p.costToDate)} />
          <Stat l="Margin to date" v={usd0(p.marginToDate)} sub={`${p.marginToDatePct}% of work done`} tone={pctTone(p.marginToDatePct)} />
        </div>
      </div>
      <div>
        <Label text="Work in progress (cost-to-cost)" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          <Stat l="% complete by cost" v={`${p.costCompletePct}%`} sub="Cost to date ÷ forecast cost" />
          <Stat l="Revenue to date (by cost)" v={usd0(p.earnedRevenue)} sub="Contract × % complete" />
          <Stat l="Billed to client" v={usd0(p.billed)} />
          <Stat l={p.overUnderBilling >= 0 ? 'Over-billed' : 'Under-billed'} v={usd0(Math.abs(p.overUnderBilling))} sub={p.overUnderBilling >= 0 ? 'Billed ahead of cost progress (a liability)' : 'Work done, not yet billed (an asset)'} tone={p.overUnderBilling >= 0 ? '#8A6D12' : ACCENT} />
        </div>
      </div>
      {(p.reimbursablesBilled || p.reimbursableCost) ? <div>
        <Label text="Reimbursables" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          <Stat l="Billed" v={usd0(p.reimbursablesBilled)} /><Stat l="Cost" v={usd0(p.reimbursableCost)} /><Stat l="Markup earned" v={usd0(p.reimbursableMargin)} />
        </div>
      </div> : null}
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
        Work done (progress) is the billable progress on the schedule of values; % complete by cost compares cost to date with the forecast cost. When the two disagree a lot,
        either progress or the cost forecast needs another look.
      </div>
    </div>
  );
}
