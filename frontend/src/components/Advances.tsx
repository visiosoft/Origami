import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import {
  ACCENT, ADVANCE_TYPES, BG, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, methodLabel, money, PAYMENT_METHODS, todayISO,
  type PayrollSettings,
} from './manpowerUi';

interface Approval { stage: string; decision: string; byName: string; byId?: string; at: string; note?: string }
interface Repayment { id: string; date: string; amount: number; method: string; runId?: string; byName?: string; note?: string }
interface Advance {
  id: string; employeeId: string; type: string; amount: number; requestDate: string; reason?: string; installments: number;
  installmentAmount: number; deductionStart: string; status: string; approvals: Approval[]; disbursedAt?: string; disbursedByName?: string;
  paymentMethod?: string; paymentRef?: string; repayments: Repayment[]; recovered: number; remaining: number; nextInstallment: number;
  createdByName?: string; createdById?: string; awaiting?: string;
}

const STAGES = [
  { key: 'manager', label: 'Manager', status: 'pending_manager', finance: false },
  { key: 'hr', label: 'HR', status: 'pending_hr', finance: false },
  { key: 'finance', label: 'Finance', status: 'pending_finance', finance: true },
];
const STATUS: Record<string, { label: string; tone: 'amber' | 'blue' | 'green' | 'red' | 'grey' }> = {
  pending_manager: { label: 'Awaiting manager', tone: 'amber' },
  pending_hr: { label: 'Awaiting HR', tone: 'amber' },
  pending_finance: { label: 'Awaiting finance', tone: 'amber' },
  approved: { label: 'Approved — to pay out', tone: 'blue' },
  disbursed: { label: 'Being recovered', tone: 'blue' },
  settled: { label: 'Settled', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
};
const FILTERS: [string, string, (a: Advance) => boolean][] = [
  ['open', 'Open', (a) => !['settled', 'rejected', 'cancelled'].includes(a.status)],
  ['approval', 'Awaiting approval', (a) => a.status.startsWith('pending_')],
  ['payout', 'Awaiting payout', (a) => a.status === 'approved'],
  ['recovering', 'Being recovered', (a) => a.status === 'disbursed'],
  ['closed', 'Settled / closed', (a) => ['settled', 'rejected', 'cancelled'].includes(a.status)],
  ['all', 'All', () => true],
];
const typeLabel = (t: string) => ADVANCE_TYPES.find(([k]) => k === t)?.[1] || t;

export function AdvancesPanel({ employees, settings, canManage, canFinance, employeeId, onOpenEmployee }: {
  employees: Employee[]; settings: PayrollSettings; canManage: boolean; canFinance: boolean;
  employeeId?: string; onOpenEmployee?: (id: string) => void;
}) {
  const cur = settings.currency;
  const [rows, setRows] = useState<Advance[] | null>(null);
  const [filter, setFilter] = useState(employeeId ? 'all' : 'open');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => api.advances.list({ employeeId }).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, [employeeId]);

  const empById = new Map(employees.map((e) => [e.id, e]));
  const all = rows || [];
  const test = (FILTERS.find(([k]) => k === filter) || FILTERS[0])[2];
  const q = query.trim().toLowerCase();
  const shown = all.filter((a) => test(a) && (!q || (empById.get(a.employeeId)?.name || '').toLowerCase().includes(q)));
  const outstanding = all.filter((a) => a.status === 'disbursed').reduce((s, a) => s + a.remaining, 0);
  const cols = (employeeId ? '' : 'minmax(150px,1.3fr) ') + '140px 120px 150px 130px 170px';
  const opened = all.find((a) => a.id === openId);

  const Tile = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div style={{ ...card, padding: '12px 16px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED }}>{label}</div>
      <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: tone || INK, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div>
      {!employeeId && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Tile label="Awaiting approval" value={String(all.filter((a) => a.status.startsWith('pending_')).length)} />
          <Tile label="Approved, not paid out" value={String(all.filter((a) => a.status === 'approved').length)} />
          <Tile label="Outstanding balance" value={money(outstanding, cur)} tone={outstanding ? DANGER : INK} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
          {FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {!employeeId && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" style={{ ...input, width: 200 }} />}
        {employeeId && <span style={{ fontSize: 12, color: MUTED }}>{outstanding ? `${money(outstanding, cur)} still owed` : 'Nothing owed'}</span>}
        <div style={{ flex: 1 }} />
        <div onClick={() => setAdding(true)} style={btn(true)}>+ Request advance / loan</div>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: employeeId ? 700 : 880 }}>
            <div style={headRow(cols)}>{!employeeId && <span>Employee</span>}<span>Type</span><span>Amount</span><span>Recovery</span><span>Outstanding</span><span>Status</span></div>
            {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((a) => {
              const s = STATUS[a.status] || STATUS.pending_manager;
              return (
                <div key={a.id} onClick={() => setOpenId(a.id)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                  {!employeeId && <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{empById.get(a.employeeId)?.name || 'Unknown'}</span>}
                  <span style={{ fontSize: 12.5 }}>{typeLabel(a.type)}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{money(a.amount, cur)}</span>
                  <span style={{ fontSize: 12 }}>{a.installments === 1 ? 'One deduction' : `${a.installments} × ${money(a.installmentAmount, cur)}`}</span>
                  <span style={{ fontSize: 12.5, color: a.status === 'disbursed' ? DANGER : MUTED }}>{a.status === 'disbursed' ? money(a.remaining, cur) : '—'}</span>
                  <span><Badge tone={s.tone}>{s.label}</Badge></span>
                </div>
              );
            })}
            {rows && !shown.length && <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>Nothing here.</div>}
          </div>
        </div>
      </div>
      {adding && <RequestDrawer employees={employees} settings={settings} employeeId={employeeId} onClose={() => setAdding(false)} onDone={async () => { setAdding(false); await load(); }} />}
      {opened && (
        <DetailDrawer a={opened} employee={empById.get(opened.employeeId)} settings={settings} canManage={canManage} canFinance={canFinance}
          onOpenEmployee={onOpenEmployee} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}

function RequestDrawer({ employees, settings, employeeId, onClose, onDone }: {
  employees: Employee[]; settings: PayrollSettings; employeeId?: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  const [f, setF] = useState({ employeeId: employeeId || '', type: 'salary_advance', amount: '', installments: '1', reason: '', deductionStart: '' });
  const [saving, setSaving] = useState(false);
  const amount = Number(f.amount) || 0;
  const n = Math.max(1, Number(f.installments) || 1);
  const per = Math.ceil((amount / n) * 100) / 100;
  const emp = employees.find((e) => e.id === f.employeeId);

  const submit = async () => {
    if (!f.employeeId) { toast('⚠ Pick the employee'); return; }
    if (!(amount > 0)) { toast('⚠ Enter the amount'); return; }
    setSaving(true);
    try {
      await api.advances.create({ employeeId: f.employeeId, type: f.type, amount, installments: n, reason: f.reason || undefined, deductionStart: f.deductionStart || undefined });
      toast('Request raised — it now goes to the manager');
      onDone();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not raise the request')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Request an advance or loan" subtitle="Goes to manager, then HR, then finance for approval. Once finance pays it out, it's recovered from payroll." width={500} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Submitting…' : 'Submit request'}</div></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {!employeeId && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Label text="Employee" />
            <select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} style={input}>
              <option value="">Select…</option>
              {employees.filter((e) => !e.contractorId).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.workerId}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label text="Type" />
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, installments: e.target.value === 'loan' ? '6' : f.installments })} style={input}>
            {ADVANCE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div><Label text={`Amount (${settings.currency})`} /><input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} style={input} /></div>
        <div><Label text="Repay over (instalments)" /><input type="number" min={1} max={120} value={f.installments} onChange={(e) => setF({ ...f, installments: e.target.value })} style={input} /></div>
        <div><Label text="Start deducting from" /><input type="date" value={f.deductionStart} onChange={(e) => setF({ ...f, deductionStart: e.target.value })} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Reason" /><textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} /></div>
      </div>
      {amount > 0 && (
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: '#F3F8F3', fontSize: 12.5, color: INK, lineHeight: 1.6 }}>
          {n === 1 ? `Recovered in full from one payroll: ${money(amount, settings.currency)}.` : `${n} deductions of about ${money(per, settings.currency)}.`}
          {' '}Starts {f.deductionStart ? `from ${fmtDate(f.deductionStart)}` : 'the month after it is paid out'}.
          {emp?.payRate && emp.payType === 'monthly' && per > emp.payRate * 0.5 && <div style={{ color: DANGER }}>That's more than half of {emp.name}'s monthly salary per deduction.</div>}
        </div>
      )}
    </Drawer>
  );
}

function DetailDrawer({ a, employee, settings, canManage, canFinance, onOpenEmployee, onClose, onChanged }: {
  a: Advance; employee?: Employee; settings: PayrollSettings; canManage: boolean; canFinance: boolean;
  onOpenEmployee?: (id: string) => void; onClose: () => void; onChanged: () => Promise<unknown>;
}) {
  const { toast, currentUser } = useApp();
  const cur = settings.currency;
  const [note, setNote] = useState('');
  const [pay, setPay] = useState({ date: todayISO(), method: 'bank_transfer', ref: '' });
  const [repay, setRepay] = useState({ amount: '', date: todayISO(), note: '' });
  const [busy, setBusy] = useState(false);
  const s = STATUS[a.status] || STATUS.pending_manager;
  const step = STAGES.find((x) => x.status === a.status);
  const me = currentUser?.id;
  const blocked = !!me && (me === a.createdById || me === employee?.userId || a.approvals.some((x) => x.byId === me && x.decision === 'approved'));
  const mayDecide = !!step && (step.finance ? canFinance : canManage) && !blocked;

  const act = async (fn: () => Promise<unknown>, msg: string, close = false) => {
    setBusy(true);
    try { await fn(); toast(msg); await onChanged(); if (close) onClose(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
    finally { setBusy(false); }
  };

  return (
    <Drawer title={`${typeLabel(a.type)} — ${money(a.amount, cur)}`} width={560} onClose={onClose}
      subtitle={`${employee?.name || 'Unknown'} · requested ${fmtDate(a.requestDate)} by ${a.createdByName || 'Unknown'}`}
      footer={<>
        {([...STAGES.map((x) => x.status), 'approved'].includes(a.status)) && (canManage || me === a.createdById) && (
          <div onClick={busy ? undefined : () => { if (confirm('Cancel this request?')) act(() => api.advances.cancel(a.id), 'Cancelled', true); }} style={btn(false, busy)}>Cancel request</div>
        )}
        {mayDecide && <>
          <div onClick={busy ? undefined : () => act(() => api.advances.reject(a.id, note), 'Rejected')} style={{ ...btn(false, busy), color: DANGER }}>Reject</div>
          <div onClick={busy ? undefined : () => act(() => api.advances.approve(a.id, note), `Approved at the ${step!.label} step`)} style={btn(true, busy)}>Approve as {step!.label}</div>
        </>}
      </>}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge tone={s.tone}>{s.label}</Badge>
        {onOpenEmployee && <span onClick={() => onOpenEmployee(a.employeeId)} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Open profile →</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {STAGES.map((st, i) => {
          const done = a.approvals.find((x) => x.stage === st.key);
          const current = a.status === st.status;
          return (
            <div key={st.key} style={{ ...card, padding: '10px 12px', borderColor: current ? ACCENT : LINE, background: done?.decision === 'approved' ? '#F3F8F3' : done?.decision === 'rejected' ? '#F7ECE6' : 'white' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em' }}>{i + 1}. {st.label}</div>
              <div style={{ fontSize: 12.5, color: INK, marginTop: 4 }}>
                {done ? <>{done.decision === 'approved' ? '✓' : '✕'} {done.byName}<div style={{ fontSize: 11, color: MUTED }}>{fmtDate(done.at)}{done.note ? ` — ${done.note}` : ''}</div></>
                  : current ? <span style={{ color: '#8A6D12' }}>Waiting</span> : <span style={{ color: MUTED }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ ...card, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.8, marginBottom: 16 }}>
        <div>Repayment: <b>{a.installments === 1 ? 'one deduction' : `${a.installments} instalments of ${money(a.installmentAmount, cur)}`}</b>, from the payroll period covering {fmtDate(a.deductionStart)}</div>
        {a.reason && <div>Reason: {a.reason}</div>}
        {a.disbursedAt && <div>Paid out {fmtDate(a.disbursedAt)} by {a.disbursedByName} · {methodLabel(a.paymentMethod)}{a.paymentRef ? ` · ${a.paymentRef}` : ''}</div>}
        {['disbursed', 'settled'].includes(a.status) && <div>Recovered <b>{money(a.recovered, cur)}</b> · outstanding <b style={{ color: a.remaining ? DANGER : '#1E6B36' }}>{money(a.remaining, cur)}</b>{a.nextInstallment ? ` · next deduction ${money(a.nextInstallment, cur)}` : ''}</div>}
      </div>

      {mayDecide && <div style={{ marginBottom: 14 }}><Label text="Note with your decision (optional)" /><input value={note} onChange={(e) => setNote(e.target.value)} style={input} /></div>}
      {step && !mayDecide && (
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
          {blocked ? 'You raised this, it is your own, or you approved an earlier step — a different person decides this step.'
            : `Waiting for someone with ${step.finance ? 'finance' : 'HR / workforce'} rights to decide the ${step.label} step.`}
        </div>
      )}

      {a.status === 'approved' && canFinance && (
        <div style={{ ...card, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Pay out</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><Label text="Date" /><input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} style={input} /></div>
            <div><Label text="Method" /><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} style={input}>{PAYMENT_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><Label text="Reference" /><input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} style={input} /></div>
          </div>
          <div style={{ marginTop: 10 }}><div onClick={busy ? undefined : () => act(() => api.advances.disburse(a.id, { ...pay, ref: pay.ref || undefined }), 'Paid out — recovery will start in payroll')} style={btn(true, busy)}>Mark as paid out</div></div>
        </div>
      )}

      {a.status === 'disbursed' && canFinance && (
        <div style={{ ...card, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Record a repayment outside payroll</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 8 }}>
            <div><Label text={`Amount (${cur})`} /><input type="number" min={0} value={repay.amount} placeholder={String(a.remaining)} onChange={(e) => setRepay({ ...repay, amount: e.target.value })} style={input} /></div>
            <div><Label text="Date" /><input type="date" value={repay.date} onChange={(e) => setRepay({ ...repay, date: e.target.value })} style={input} /></div>
            <div><Label text="Note" /><input value={repay.note} onChange={(e) => setRepay({ ...repay, note: e.target.value })} placeholder="e.g. Cash returned" style={input} /></div>
          </div>
          <div style={{ marginTop: 10 }}><div onClick={busy ? undefined : () => act(() => api.advances.repay(a.id, { amount: Number(repay.amount), date: repay.date, note: repay.note || undefined }), 'Repayment recorded')} style={btn(false, busy)}>Record repayment</div></div>
        </div>
      )}

      {a.repayments.length > 0 && (
        <>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Repayments</div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {a.repayments.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
                <span style={{ flex: 1 }}>{fmtDate(r.date)} · {r.method === 'payroll' ? 'Payroll deduction' : 'Manual'}{r.note ? ` · ${r.note}` : ''}</span>
                <span style={{ fontWeight: 700 }}>{money(r.amount, cur)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}
