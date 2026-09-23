import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import type { Employee } from './EmployeeDirectory';
import {
  ACCENT, BG, DANGER, INK, LINE, MUTED, Badge, Drawer, Label, bodyRow, btn, card, fmtDate, headRow, input, localISO, methodLabel, money, PAYMENT_METHODS, todayISO,
  type PayComponent, type PayrollSettings,
} from './manpowerUi';

interface PayLine { id: string; name: string; kind: 'earning' | 'deduction'; source: string; amount: number; note?: string; refIds?: string[] }
interface Payslip {
  id: string; runId: string; employeeId: string; employee: Record<string, any>; basis: Record<string, any>; lines: PayLine[];
  gross: number; deductions: number; net: number; paymentStatus: string; paidAt?: string; paymentMethod?: string; paymentRef?: string;
  paidByName?: string; notes?: string; run?: Run;
}
interface Run {
  id: string; label: string; periodStart: string; periodEnd: string; payGroup: string; status: string;
  totals?: { headcount: number; gross: number; deductions: number; net: number; paid: number };
  createdByName?: string; createdAt: string; finalizedByName?: string; finalizedAt?: string; voidedByName?: string; voidReason?: string; notes?: string;
  payslips?: Payslip[];
}

const RUN_STATUS: Record<string, { label: string; tone: 'grey' | 'green' | 'red' | 'amber' | 'blue' }> = {
  draft: { label: 'Draft', tone: 'amber' }, finalized: { label: 'Finalized', tone: 'blue' }, void: { label: 'Void', tone: 'red' },
};
const GROUP_LABEL: Record<string, string> = { all: 'Everyone', monthly: 'Salaried staff', daily: 'Daily-wage workers' };
const METHODS = PAYMENT_METHODS;

const monthBounds = (offset = 0) => {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  return { start: localISO(start), end: localISO(end) };
};

const basisText = (b: Record<string, any>) => {
  if (b.payGroup === 'monthly') return b.employedDays != null && b.employedDays < b.periodDays ? `${b.employedDays} of ${b.periodDays} days` : 'Full month';
  if (b.payType === 'hourly') return `${b.hoursWorked || 0} h`;
  const parts = [`${b.fullDays || 0} full`];
  if (b.halfDays) parts.push(`${b.halfDays} half`);
  if (b.extraHours) parts.push(`${b.extraHours} h`);
  return parts.join(' · ') + (b.manual ? ' (manual)' : '');
};

// ------------------------------------------------------------------ print

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function printPayslip(slip: Payslip, run: Pick<Run, 'label' | 'periodStart' | 'periodEnd'>, currency: string) {
  const e = slip.employee || {};
  const rows = (kind: 'earning' | 'deduction') => slip.lines.filter((l) => l.kind === kind)
    .map((l) => `<tr><td>${esc(l.name)}${l.note ? `<div class="n">${esc(l.note)}</div>` : ''}</td><td class="r">${esc(money(l.amount, currency))}</td></tr>`).join('')
    || '<tr><td colspan="2" class="n">None</td></tr>';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(e.name)} ${esc(run.label)}</title>
<style>body{font-family:Arial,sans-serif;color:#0B1A12;margin:32px;font-size:13px}h1{font-size:20px;margin:0}h2{font-size:13px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#556}
table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #e6e6e6;vertical-align:top}.r{text-align:right;white-space:nowrap}.n{color:#778;font-size:11px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:14px}.net{margin-top:20px;padding:12px 14px;background:#EEF4EF;display:flex;justify-content:space-between;font-size:16px;font-weight:bold}</style></head>
<body><h1>Payslip — ${esc(run.label)}</h1><div class="n">${esc(fmtDate(run.periodStart))} to ${esc(fmtDate(run.periodEnd))}</div>
<div class="grid"><div><b>${esc(e.name)}</b></div><div>Worker ID: ${esc(e.workerId || '—')}</div>
<div>${esc(e.designation || '')}${e.department ? ' · ' + esc(e.department) : ''}</div><div>Pay basis: ${esc(e.payType)} @ ${esc(money(e.payRate, currency))}</div>
<div>Worked: ${esc(basisText(slip.basis))}${slip.basis.otHours ? ' · OT ' + esc(slip.basis.otHours) + ' h' : ''}</div><div>Bank: ${esc(e.bankName || '—')} ${esc(e.bankAccount || '')}</div></div>
<h2>Earnings</h2><table>${rows('earning')}<tr><td><b>Gross pay</b></td><td class="r"><b>${esc(money(slip.gross, currency))}</b></td></tr></table>
<h2>Deductions</h2><table>${rows('deduction')}<tr><td><b>Total deductions</b></td><td class="r"><b>${esc(money(slip.deductions, currency))}</b></td></tr></table>
<div class="net"><span>Net pay</span><span>${esc(money(slip.net, currency))}</span></div>
<p class="n">${slip.paymentStatus === 'paid' ? `Paid ${esc(fmtDate(slip.paidAt))} by ${esc(methodLabel(slip.paymentMethod))}${slip.paymentRef ? ' · ref ' + esc(slip.paymentRef) : ''}` : 'Not yet paid'}</p>
<script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

// ------------------------------------------------------------------ runs

export function PayrollRuns({ employees, currency, canManage, canFinance }: {
  employees: Employee[]; currency: string; canManage: boolean; canFinance: boolean;
}) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const load = () => api.payroll.runs().then((r: any) => setRuns(Array.isArray(r) ? r : [])).catch(() => setRuns([]));
  useEffect(() => { load(); }, []);

  if (openId) return <RunDetail runId={openId} employees={employees} currency={currency} canManage={canManage} canFinance={canFinance} onBack={() => { setOpenId(null); load(); }} />;

  const all = runs || [];
  const cols = 'minmax(170px,1.4fr) 190px 150px 70px 130px 130px 150px 100px';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, color: MUTED, flex: 1, minWidth: 260 }}>
          HR prepares a run from approved daily logs, approved overtime and advance/loan recoveries; finance checks it, finalizes it (which locks it) and records payment.
        </div>
        {canManage && <div onClick={() => setCreating(true)} style={btn(true)}>+ New payroll run</div>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 1000 }}>
            <div style={headRow(cols)}><span>Run</span><span>Period</span><span>Who</span><span>People</span><span>Gross</span><span>Net</span><span>Paid</span><span>Status</span></div>
            {runs === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {all.map((r) => {
              const s = RUN_STATUS[r.status] || RUN_STATUS.draft;
              const t = r.totals || { headcount: 0, gross: 0, net: 0, paid: 0, deductions: 0 };
              const pct = t.net ? Math.round((t.paid / t.net) * 100) : 0;
              return (
                <div key={r.id} onClick={() => setOpenId(r.id)} style={{ ...bodyRow(cols), cursor: 'pointer', opacity: r.status === 'void' ? 0.55 : 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: MUTED }}>{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</span>
                  <span style={{ fontSize: 12.5 }}>{GROUP_LABEL[r.payGroup] || r.payGroup}</span>
                  <span style={{ fontSize: 12.5 }}>{t.headcount}</span>
                  <span style={{ fontSize: 12.5 }}>{money(t.gross, currency)}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{money(t.net, currency)}</span>
                  <span>
                    {r.status === 'finalized' ? (
                      <>
                        <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>{pct}% paid</div>
                        <div style={{ height: 5, borderRadius: 999, background: '#EFEDE8', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#1E6B36' }} /></div>
                      </>
                    ) : <span style={{ fontSize: 12, color: MUTED }}>—</span>}
                  </span>
                  <span><Badge tone={s.tone}>{s.label}</Badge></span>
                </div>
              );
            })}
            {runs && !all.length && <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No payroll runs yet. Set pay rates on employees, then start a run for a period.</div>}
          </div>
        </div>
      </div>
      {creating && <NewRunDrawer onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id); }} />}
    </div>
  );
}

function NewRunDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { toast } = useApp();
  const last = monthBounds(-1);
  const [periodStart, setStart] = useState(last.start);
  const [periodEnd, setEnd] = useState(last.end);
  const [payGroup, setGroup] = useState('all');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const pick = (offset: number) => { const b = monthBounds(offset); setStart(b.start); setEnd(b.end); };

  const create = async () => {
    setSaving(true);
    try {
      const run: any = await api.payroll.createRun({ periodStart, periodEnd, payGroup, label: label || undefined, notes: notes || undefined });
      toast(`${run.label}: ${run.totals?.headcount ?? 0} payslips calculated`);
      onCreated(run.id);
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not start the run')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="New payroll run" subtitle="Calculates a draft payslip for everyone in the group. Nothing is final until finance finalizes it." width={520} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : create} style={btn(true, saving)}>{saving ? 'Calculating…' : 'Calculate payslips'}</div></>}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <div onClick={() => pick(-1)} style={{ ...btn(), padding: '5px 12px', fontSize: 12 }}>Last month</div>
        <div onClick={() => pick(0)} style={{ ...btn(), padding: '5px 12px', fontSize: 12 }}>This month</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><Label text="Period start" /><input type="date" value={periodStart} onChange={(e) => setStart(e.target.value)} style={input} /></div>
        <div><Label text="Period end" /><input type="date" value={periodEnd} onChange={(e) => setEnd(e.target.value)} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label text="Who is paid in this run" />
          <select value={payGroup} onChange={(e) => setGroup(e.target.value)} style={input}>
            <option value="all">Everyone on payroll</option>
            <option value="monthly">Salaried staff only</option>
            <option value="daily">Daily-wage and hourly workers only</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Name (optional)" /><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. September 2026" style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 14, lineHeight: 1.6 }}>
        Wages for daily and hourly workers come from <b>approved</b> daily logs in the period. Approved overtime not yet paid, and advance/loan instalments that are due, are included automatically. Contractors' workers are not on your payroll.
      </div>
    </Drawer>
  );
}

function RunDetail({ runId, employees, currency, canManage, canFinance, onBack }: {
  runId: string; employees: Employee[]; currency: string; canManage: boolean; canFinance: boolean; onBack: () => void;
}) {
  const { toast } = useApp();
  const [run, setRun] = useState<Run | null>(null);
  const [slipId, setSlipId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [query, setQuery] = useState('');
  const load = () => api.payroll.run(runId).then((r: any) => setRun(r)).catch((e: Error) => toast('⚠ ' + e.message));
  useEffect(() => { load(); }, [runId]);

  if (!run) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>;
  const t = run.totals || { headcount: 0, gross: 0, deductions: 0, net: 0, paid: 0 };
  const slips = (run.payslips || []).filter((p) => !query.trim() || String(p.employee?.name || '').toLowerCase().includes(query.trim().toLowerCase()));
  const s = RUN_STATUS[run.status] || RUN_STATUS.draft;

  const act = async (fn: () => Promise<any>, done: string) => {
    setBusy(true);
    try { const r = await fn(); toast(done); if (r && r.id === runId && r.payslips) setRun(r); else await load(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'That did not work')); }
    finally { setBusy(false); }
  };

  const Tile = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div style={{ ...card, padding: '12px 16px', flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED }}>{label}</div>
      <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: tone || INK, marginTop: 2 }}>{value}</div>
    </div>
  );
  const cols = 'minmax(170px,1.5fr) 150px 70px 120px 120px 130px 100px';
  const open = run.payslips?.find((p) => p.id === slipId);

  return (
    <div>
      <div onClick={onBack} style={{ display: 'inline-flex', gap: 6, cursor: 'pointer', color: ACCENT, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>← All payroll runs</div>
      <div style={{ ...card, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: BG, fontSize: 21, fontWeight: 700, color: INK }}>{run.label}</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
            {fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)} · {GROUP_LABEL[run.payGroup]} · prepared by {run.createdByName || 'Unknown'}
            {run.finalizedByName ? ` · finalized by ${run.finalizedByName} on ${fmtDate(run.finalizedAt)}` : ''}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone={s.tone}>{s.label}</Badge>
            {run.status === 'void' && <span style={{ fontSize: 12, color: DANGER }}>Voided by {run.voidedByName}: {run.voidReason}</span>}
          </div>
        </div>
        {run.status === 'draft' && canManage && <>
          <div onClick={busy ? undefined : () => { if (confirm('Delete this draft run?')) act(async () => { await api.payroll.removeRun(runId); onBack(); }, 'Draft deleted'); }} style={{ ...btn(false, busy), color: DANGER }}>Delete draft</div>
          <div onClick={busy ? undefined : () => act(() => api.payroll.recalculate(runId), 'Recalculated')} style={btn(false, busy)}>Recalculate</div>
        </>}
        {run.status === 'draft' && canFinance && (
          <div onClick={busy ? undefined : () => { if (confirm(`Finalize ${run.label}? Payslips lock, overtime is marked paid and advance/loan recoveries are booked. It can only be undone by voiding before anyone is paid.`)) act(() => api.payroll.finalize(runId), 'Finalized'); }} style={btn(true, busy)}>Finalize</div>
        )}
        {run.status === 'finalized' && canFinance && <>
          {t.paid === 0 && <div onClick={busy ? undefined : () => { const reason = prompt('Why is this run being voided?'); if (reason) act(() => api.payroll.voidRun(runId, reason), 'Run voided'); }} style={{ ...btn(false, busy), color: DANGER }}>Void run</div>}
          {t.paid < t.net && <div onClick={() => setPaying(true)} style={btn(true)}>Record payment…</div>}
        </>}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Tile label="People" value={String(t.headcount)} />
        <Tile label="Gross" value={money(t.gross, currency)} />
        <Tile label="Deductions" value={money(t.deductions, currency)} />
        <Tile label="Net pay" value={money(t.net, currency)} tone={ACCENT} />
        {run.status === 'finalized' && <Tile label="Paid so far" value={money(t.paid, currency)} tone="#1E6B36" />}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" style={{ ...input, width: 240 }} />
        {run.status === 'draft' && <span style={{ fontSize: 12, color: MUTED }}>Open a payslip to correct days worked or add a bonus / deduction.</span>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={headRow(cols)}><span>Employee</span><span>Worked</span><span>OT</span><span>Gross</span><span>Deductions</span><span>Net</span><span>Paid</span></div>
            {slips.map((p) => (
              <div key={p.id} onClick={() => setSlipId(p.id)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                <span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{p.employee?.name}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{p.employee?.workerId} · {p.employee?.payType}</div>
                </span>
                <span style={{ fontSize: 12 }}>{basisText(p.basis)}</span>
                <span style={{ fontSize: 12 }}>{p.basis.otHours ? `${p.basis.otHours} h` : '—'}</span>
                <span style={{ fontSize: 12.5 }}>{money(p.gross, currency)}</span>
                <span style={{ fontSize: 12.5, color: p.deductions ? DANGER : MUTED }}>{p.deductions ? money(p.deductions, currency) : '—'}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{money(p.net, currency)}</span>
                <span>{p.paymentStatus === 'paid' ? <Badge tone="green">Paid</Badge> : run.status === 'finalized' ? <Badge tone="amber">Unpaid</Badge> : <span style={{ fontSize: 12, color: MUTED }}>—</span>}</span>
              </div>
            ))}
            {!slips.length && <div style={{ padding: 18, fontSize: 12.5, color: MUTED }}>No payslips match.</div>}
          </div>
        </div>
      </div>

      {open && (
        <PayslipDrawer slip={open} run={run} currency={currency} canManage={canManage} canFinance={canFinance} employees={employees}
          onClose={() => setSlipId(null)} onChanged={load} />
      )}
      {paying && (
        <PayDrawer run={run} currency={currency} onClose={() => setPaying(false)} onDone={async () => { setPaying(false); await load(); }} />
      )}
    </div>
  );
}

function PayDrawer({ run, currency, onClose, onDone }: { run: Run; currency: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const unpaid = (run.payslips || []).filter((p) => p.paymentStatus !== 'paid');
  const [picked, setPicked] = useState<Set<string>>(new Set(unpaid.map((p) => p.id)));
  const [method, setMethod] = useState('bank_transfer');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const total = unpaid.filter((p) => picked.has(p.id)).reduce((a, p) => a + p.net, 0);
  const submit = async () => {
    if (!picked.size) { toast('⚠ Pick who was paid'); return; }
    setSaving(true);
    try { await api.payroll.pay(run.id, { payslipIds: Array.from(picked), method, ref: ref || undefined, date }); toast(`${picked.size} marked paid`); onDone(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not record payment')); }
    finally { setSaving(false); }
  };
  return (
    <Drawer title="Record salary payment" subtitle={`${picked.size} selected · ${money(total, currency)}`} width={540} onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : submit} style={btn(true, saving)}>{saving ? 'Saving…' : 'Mark as paid'}</div></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><Label text="Paid on" /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} /></div>
        <div><Label text="Method" /><select value={method} onChange={(e) => setMethod(e.target.value)} style={input}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><Label text="Reference" /><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ACH batch / check no." style={input} /></div>
      </div>
      <div style={{ ...card, maxHeight: 420, overflowY: 'auto' }}>
        {unpaid.map((p) => (
          <label key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer' }}>
            <input type="checkbox" checked={picked.has(p.id)} onChange={() => setPicked((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} />
            <span style={{ flex: 1, fontSize: 13, color: INK }}>{p.employee?.name} <span style={{ color: MUTED, fontSize: 11.5 }}>{p.employee?.bankAccount ? `· ${p.employee.bankName || ''} ${p.employee.bankAccount}` : '· no bank details'}</span></span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{money(p.net, currency)}</span>
          </label>
        ))}
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ payslip

export function PayslipDrawer({ slip, run, currency, canManage, canFinance, onClose, onChanged }: {
  slip: Payslip; run: Run; currency: string; canManage: boolean; canFinance: boolean; employees?: Employee[];
  onClose: () => void; onChanged: () => Promise<unknown> | void;
}) {
  const { toast } = useApp();
  const editable = run.status === 'draft' && canManage;
  const b = slip.basis;
  const [work, setWork] = useState({ fullDays: b.fullDays ?? 0, halfDays: b.halfDays ?? 0, extraHours: b.extraHours ?? 0, hoursWorked: b.hoursWorked ?? 0 });
  const [manual, setManual] = useState(slip.lines.filter((l) => l.source === 'manual').map((l) => ({ id: l.id, name: l.name, kind: l.kind, amount: l.amount })));
  const [notes, setNotes] = useState(slip.notes || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setWork({ fullDays: b.fullDays ?? 0, halfDays: b.halfDays ?? 0, extraHours: b.extraHours ?? 0, hoursWorked: b.hoursWorked ?? 0 });
    setManual(slip.lines.filter((l) => l.source === 'manual').map((l) => ({ id: l.id, name: l.name, kind: l.kind, amount: l.amount })));
    setNotes(slip.notes || '');
  }, [slip]);

  const save = async (body: any, msg: string) => {
    setSaving(true);
    try { await api.payroll.updatePayslip(slip.id, body); await onChanged(); toast(msg); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    finally { setSaving(false); }
  };
  const payOne = async () => {
    const ref = prompt('Payment reference (optional)') ?? undefined;
    try { await api.payroll.pay(run.id, { payslipIds: [slip.id], ref }); await onChanged(); toast('Marked paid'); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not record payment')); }
  };

  const section = (kind: 'earning' | 'deduction') => (
    <div style={{ ...card, overflow: 'hidden', marginBottom: 12 }}>
      {slip.lines.filter((l) => l.kind === kind).map((l) => (
        <div key={l.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: INK }}>{l.name}{l.source === 'manual' && <span style={{ fontSize: 10.5, color: MUTED }}> · manual</span>}</div>
            {l.note && <div style={{ fontSize: 11, color: MUTED }}>{l.note}</div>}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: kind === 'deduction' ? DANGER : INK }}>{money(l.amount, currency)}</div>
        </div>
      ))}
      {!slip.lines.some((l) => l.kind === kind) && <div style={{ padding: '8px 14px', fontSize: 12, color: MUTED }}>None</div>}
      <div style={{ display: 'flex', padding: '9px 14px', background: '#F7F3EA', fontSize: 12.5, fontWeight: 700 }}>
        <span style={{ flex: 1 }}>{kind === 'earning' ? 'Gross pay' : 'Total deductions'}</span>
        <span>{money(kind === 'earning' ? slip.gross : slip.deductions, currency)}</span>
      </div>
    </div>
  );

  const isDaily = b.payGroup === 'daily';
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <Drawer title={slip.employee?.name || 'Payslip'} width={620} onClose={onClose}
      subtitle={`${run.label} · ${slip.employee?.workerId || ''} · ${slip.employee?.payType} @ ${money(slip.employee?.payRate, currency)}${b.hourlyRate ? ` (${money(b.hourlyRate, currency)}/h)` : ''}`}
      footer={<>
        <div onClick={() => { if (!printPayslip(slip, run, currency)) toast('⚠ Allow pop-ups to print the payslip'); }} style={btn()}>Print payslip</div>
        {run.status === 'finalized' && slip.paymentStatus !== 'paid' && canFinance && <div onClick={payOne} style={btn(true)}>Mark paid</div>}
      </>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {slip.paymentStatus === 'paid'
          ? <Badge tone="green">Paid {fmtDate(slip.paidAt)} · {methodLabel(slip.paymentMethod)}{slip.paymentRef ? ` · ${slip.paymentRef}` : ''}</Badge>
          : <Badge tone={run.status === 'draft' ? 'amber' : 'grey'}>{run.status === 'draft' ? 'Draft' : 'Unpaid'}</Badge>}
        <span style={{ fontSize: 12, color: MUTED }}>Worked: {basisText(b)}{b.otHours ? ` · OT ${b.otHours} h` : ''}</span>
        {b.recoveryShortfall && <Badge tone="amber">Some recovery deferred — net pay too low</Badge>}
      </div>

      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Earnings</div>
      {section('earning')}
      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 8 }}>Deductions</div>
      {section('deduction')}
      <div style={{ display: 'flex', padding: '12px 16px', borderRadius: 12, background: '#EEF4EF', fontSize: 16, fontWeight: 700, color: ACCENT, marginBottom: 18 }}>
        <span style={{ flex: 1 }}>Net pay</span><span>{money(slip.net, currency)}</span>
      </div>

      {editable && (
        <div style={{ ...card, padding: '14px 16px' }}>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4 }}>Corrections</div>
          {isDaily && (
            <>
              <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>
                {b.manual ? 'Days entered by hand.' : 'Counted from approved daily logs.'} Override if the logs are incomplete.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                {b.payType === 'hourly'
                  ? <div><Label text="Hours worked" /><input type="number" min={0} value={work.hoursWorked} onChange={(e) => setWork({ ...work, hoursWorked: num(e.target.value) })} style={input} /></div>
                  : <>
                    <div><Label text="Full days" /><input type="number" min={0} value={work.fullDays} onChange={(e) => setWork({ ...work, fullDays: num(e.target.value) })} style={input} /></div>
                    <div><Label text="Half days" /><input type="number" min={0} value={work.halfDays} onChange={(e) => setWork({ ...work, halfDays: num(e.target.value) })} style={input} /></div>
                    <div><Label text="Short-day hours" /><input type="number" min={0} value={work.extraHours} onChange={(e) => setWork({ ...work, extraHours: num(e.target.value) })} style={input} /></div>
                  </>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div onClick={saving ? undefined : () => save({ work }, 'Days updated')} style={btn(false, saving)}>Apply days</div>
                {b.manual && <div onClick={saving ? undefined : () => save({ work: null }, 'Back to daily logs')} style={btn(false, saving)}>Use daily logs</div>}
              </div>
            </>
          )}
          <Label text="Bonuses and one-off deductions" />
          {manual.map((m, i) => (
            <div key={m.id || i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 24px', gap: 8, marginBottom: 6 }}>
              <input value={m.name} onChange={(e) => setManual(manual.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Eid bonus" style={input} />
              <select value={m.kind} onChange={(e) => setManual(manual.map((x, j) => (j === i ? { ...x, kind: e.target.value as any } : x)))} style={input}>
                <option value="earning">Earning</option><option value="deduction">Deduction</option>
              </select>
              <input type="number" min={0} value={m.amount} onChange={(e) => setManual(manual.map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)))} style={input} />
              <span onClick={() => setManual(manual.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: DANGER, alignSelf: 'center' }}>×</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 12 }}>
            <span onClick={() => setManual([...manual, { id: '', name: '', kind: 'earning', amount: 0 }])} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Add line</span>
          </div>
          <Label text="Notes" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...input, resize: 'vertical', marginBottom: 10 }} />
          <div onClick={saving ? undefined : () => save({ manualLines: manual.map((m) => ({ ...m, id: m.id || undefined })), notes }, 'Payslip updated')} style={btn(true, saving)}>{saving ? 'Saving…' : 'Save adjustments'}</div>
        </div>
      )}
      {!editable && slip.notes && <div style={{ fontSize: 12.5, color: INK, whiteSpace: 'pre-wrap' }}><b>Notes:</b> {slip.notes}</div>}
    </Drawer>
  );
}

// ------------------------------------------------------------------ setup

export function PayrollSetup({ settings, onSettings, canManage }: { settings: PayrollSettings; onSettings: (s: PayrollSettings) => void; canManage: boolean }) {
  const { toast } = useApp();
  const [draft, setDraft] = useState<PayrollSettings>(settings);
  const [components, setComponents] = useState<PayComponent[]>([]);
  const [newName, setNewName] = useState('');
  useEffect(() => setDraft(settings), [settings]);
  const loadComponents = () => api.payroll.components().then((r: any) => setComponents(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { loadComponents(); }, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const saveSettings = async () => {
    try { onSettings(await api.payroll.saveSettings(draft) as PayrollSettings); toast('Payroll settings saved'); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
  };
  const update = async (c: PayComponent, patch: Partial<PayComponent>) => {
    try { await api.payroll.updateComponent(c.id, patch); loadComponents(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); loadComponents(); }
  };
  const add = async () => {
    if (!newName.trim()) return;
    try { await api.payroll.createComponent({ name: newName.trim(), kind: 'earning', calcType: 'fixed' }); setNewName(''); loadComponents(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not add')); }
  };
  const remove = async (c: PayComponent) => {
    if (!confirm(`Remove ${c.name}? Past payslips keep it; it stops applying to new ones. To pause it instead, untick Active.`)) return;
    try { await api.payroll.removeComponent(c.id); loadComponents(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not remove')); }
  };
  const nf = (v: string) => (v === '' ? 0 : Number(v));
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cols = 'minmax(170px,1.5fr) 120px 170px 110px 120px 60px 26px';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, marginBottom: 12 }}>Payroll rules</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
          <div><Label text="Currency" /><input disabled={!canManage} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} style={input} /></div>
          <div><Label text="Hours in a full day" /><input disabled={!canManage} type="number" value={draft.standardDayHours} onChange={(e) => setDraft({ ...draft, standardDayHours: nf(e.target.value) })} style={input} /></div>
          <div><Label text="Least hours for a half day" /><input disabled={!canManage} type="number" value={draft.halfDayHours} onChange={(e) => setDraft({ ...draft, halfDayHours: nf(e.target.value) })} style={input} /></div>
          <div><Label text="Paid days a monthly salary covers" /><input disabled={!canManage} type="number" step={0.01} title="21.67 = 2,080 hours a year" value={draft.monthDays} onChange={(e) => setDraft({ ...draft, monthDays: nf(e.target.value) })} style={input} /></div>
          {(['normal', 'weekend', 'holiday', 'night'] as const).map((k) => (
            <div key={k}><Label text={`${k[0].toUpperCase() + k.slice(1)} overtime ×`} /><input disabled={!canManage} type="number" step={0.05} value={draft.otMultipliers[k]} onChange={(e) => setDraft({ ...draft, otMultipliers: { ...draft.otMultipliers, [k]: nf(e.target.value) } })} style={input} /></div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Label text="Weekend days (for overtime)" />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => {
              const on = draft.weekendDays.includes(i);
              return <div key={d} onClick={canManage ? () => setDraft({ ...draft, weekendDays: on ? draft.weekendDays.filter((x) => x !== i) : [...draft.weekendDays, i].sort() }) : undefined} style={{ ...btn(on), padding: '5px 11px', fontSize: 12 }}>{d}</div>;
            })}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
          Days at or over the full-day hours earn a full daily wage; days between the half-day and full-day hours earn half; shorter days are paid by the hour. Hours past a full day are only paid once they are approved as overtime.
        </div>
        {canManage && <div style={{ marginTop: 12 }}><div onClick={dirty ? saveSettings : undefined} style={btn(dirty, !dirty)}>{dirty ? 'Save rules' : 'Saved'}</div></div>}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 6px' }}>
          <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK }}>Pay components</div>
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>Allowances and deductions. A company-wide value applies to everyone in the group; set a different amount per employee on their Salary & Payroll tab. Zero = only where set per employee.</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            <div style={headRow(cols)}><span>Name</span><span>Type</span><span>Calculated as</span><span>Company value</span><span>Applies to</span><span>Active</span><span /></div>
            {components.map((c) => (
              <div key={c.id} style={bodyRow(cols)}>
                <input disabled={!canManage} defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update(c, { name: e.target.value.trim() })} style={input} />
                <select disabled={!canManage} value={c.kind} onChange={(e) => update(c, { kind: e.target.value as any })} style={input}><option value="earning">Earning</option><option value="deduction">Deduction</option></select>
                <select disabled={!canManage} value={c.calcType} onChange={(e) => update(c, { calcType: e.target.value as any })} style={input}>
                  <option value="fixed">Fixed amount</option><option value="percent_basic">% of basic</option>
                  {c.kind === 'deduction' && <option value="percent_gross">% of gross</option>}
                </select>
                <input disabled={!canManage} type="number" min={0} defaultValue={c.defaultValue} onBlur={(e) => Number(e.target.value) !== c.defaultValue && update(c, { defaultValue: nf(e.target.value) })} style={input} />
                <select disabled={!canManage} value={c.appliesTo} onChange={(e) => update(c, { appliesTo: e.target.value as any })} style={input}><option value="all">Everyone</option><option value="monthly">Salaried</option><option value="daily">Daily-wage</option></select>
                <input type="checkbox" disabled={!canManage} checked={c.active} onChange={(e) => update(c, { active: e.target.checked })} />
                {canManage ? <span onClick={() => remove(c)} style={{ cursor: 'pointer', color: DANGER }}>×</span> : <span />}
              </div>
            ))}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid ' + LINE }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="e.g. Hardship allowance" style={{ ...input, maxWidth: 300 }} />
            <div onClick={add} style={btn(true)}>+ Add component</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ profile tab

export function EmployeePayPanel({ employee, settings, canManage, canFinance, onChanged }: {
  employee: Employee; settings: PayrollSettings; canManage: boolean; canFinance: boolean; onChanged: () => Promise<unknown> | void;
}) {
  const { toast } = useApp();
  const cur = settings.currency;
  const [components, setComponents] = useState<PayComponent[] | null>(null);
  const [slips, setSlips] = useState<Payslip[] | null>(null);
  const [open, setOpen] = useState<Payslip | null>(null);
  const [draft, setDraft] = useState({ payType: employee.payType || 'monthly', payRate: employee.payRate ?? '', overtimeRate: employee.overtimeRate ?? '' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadSlips = () => api.payroll.employeePayslips(employee.id).then((r: any) => setSlips(Array.isArray(r) ? r : [])).catch(() => setSlips([]));
  useEffect(() => {
    api.payroll.components().then((r: any) => setComponents(Array.isArray(r) ? r : [])).catch(() => setComponents([]));
    loadSlips();
  }, [employee.id]);
  useEffect(() => {
    setDraft({ payType: employee.payType || 'monthly', payRate: employee.payRate ?? '', overtimeRate: employee.overtimeRate ?? '' });
    setValues(Object.fromEntries((employee.payComponents || []).map((c) => [c.componentId, String(c.value)])));
  }, [employee]);

  const group = draft.payType === 'daily' || draft.payType === 'hourly' ? 'daily' : 'monthly';
  const relevant = (components || []).filter((c) => c.active && (c.appliesTo === 'all' || c.appliesTo === group));
  const rate = Number(draft.payRate) || 0;
  const hourly = draft.payType === 'hourly' ? rate : draft.payType === 'daily' ? rate / settings.standardDayHours : rate / (settings.monthDays * settings.standardDayHours);
  const otBase = Number(draft.overtimeRate) || hourly;

  const save = async () => {
    setSaving(true);
    try {
      await api.employees.update(employee.id, {
        payType: draft.payType, payRate: draft.payRate === '' ? null : Number(draft.payRate),
        overtimeRate: draft.overtimeRate === '' ? null : Number(draft.overtimeRate),
        payComponents: Object.entries(values).filter(([, v]) => v !== '').map(([componentId, v]) => ({ componentId, value: Number(v) })),
      });
      await onChanged();
      toast('Pay setup saved');
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    finally { setSaving(false); }
  };

  const unit = (c: PayComponent) => (c.calcType === 'fixed' ? cur : '%');
  const runOf = (s: Payslip) => s.run as Run;
  const cols = '1.3fr 110px 130px 130px 100px';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {employee.contractorId && <div style={{ ...card, padding: '12px 16px', fontSize: 12.5, color: '#8A6D12', background: '#FBF6E4' }}>This is a contractor's worker — they're paid by their contractor, not through your payroll. A rate here is used only for costing.</div>}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, marginBottom: 12 }}>Pay setup</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <Label text="Pay basis" />
            <select disabled={!canManage} value={draft.payType} onChange={(e) => setDraft({ ...draft, payType: e.target.value })} style={input}>
              <option value="hourly">Hourly</option><option value="monthly">Salary (monthly)</option><option value="daily">Day rate</option>
            </select>
          </div>
          <div><Label text={draft.payType === 'monthly' ? `Monthly salary (${cur})` : draft.payType === 'daily' ? `Daily rate (${cur})` : `Hourly rate (${cur})`} /><input disabled={!canManage} type="number" min={0} value={draft.payRate} onChange={(e) => setDraft({ ...draft, payRate: e.target.value })} style={input} /></div>
          <div><Label text={`Overtime hourly base (${cur})`} /><input disabled={!canManage} type="number" min={0} value={draft.overtimeRate} placeholder={hourly ? String(Math.round(hourly * 100) / 100) : 'Their hourly rate'} onChange={(e) => setDraft({ ...draft, overtimeRate: e.target.value })} style={input} /></div>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
          Works out to {money(hourly, cur)} an hour; overtime from {money(otBase * settings.otMultipliers.normal, cur)}/h (×{settings.otMultipliers.normal}) on normal days.
        </div>

        <div style={{ marginTop: 16 }}>
          <Label text="Allowances and deductions for this employee" />
          <div style={{ ...card, overflow: 'hidden' }}>
            {relevant.map((c) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 140px', gap: 10, alignItems: 'center', padding: '8px 12px', borderTop: '1px solid rgba(20,8,31,.05)' }}>
                <span style={{ fontSize: 12.5, color: INK }}>{c.name} <span style={{ fontSize: 11, color: MUTED }}>· {c.kind}{c.calcType !== 'fixed' ? `, % of ${c.calcType === 'percent_gross' ? 'gross' : 'basic'}` : ''}</span></span>
                <input disabled={!canManage} type="number" min={0} value={values[c.id] ?? ''} placeholder={c.defaultValue ? `Company: ${c.defaultValue}` : 'Not applied'} onChange={(e) => setValues({ ...values, [c.id]: e.target.value })} style={input} />
                <span style={{ fontSize: 11.5, color: MUTED }}>{unit(c)}{values[c.id] === undefined || values[c.id] === '' ? (c.defaultValue ? ' · company value' : '') : ' · this employee'}</span>
              </div>
            ))}
            {components === null && <div style={{ padding: 12, fontSize: 12, color: MUTED }}>Loading…</div>}
            {components && !relevant.length && <div style={{ padding: 12, fontSize: 12, color: MUTED }}>No active components for this pay basis — add them under Setup → Payroll setup.</div>}
          </div>
        </div>
        {canManage && <div style={{ marginTop: 12 }}><div onClick={saving ? undefined : save} style={btn(true, saving)}>{saving ? 'Saving…' : 'Save pay setup'}</div></div>}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 8px', fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK }}>Payslips</div>
        <div style={headRow(cols)}><span>Period</span><span>Status</span><span>Gross</span><span>Net</span><span>Paid</span></div>
        {slips === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
        {(slips || []).map((s) => (
          <div key={s.id} onClick={() => setOpen(s)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
            <span style={{ fontSize: 12.5, color: INK }}>{runOf(s)?.label} <span style={{ fontSize: 11, color: MUTED }}>{fmtDate(runOf(s)?.periodStart)} – {fmtDate(runOf(s)?.periodEnd)}</span></span>
            <span><Badge tone={(RUN_STATUS[runOf(s)?.status] || RUN_STATUS.draft).tone}>{(RUN_STATUS[runOf(s)?.status] || RUN_STATUS.draft).label}</Badge></span>
            <span style={{ fontSize: 12.5 }}>{money(s.gross, cur)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{money(s.net, cur)}</span>
            <span>{s.paymentStatus === 'paid' ? <Badge tone="green">Paid</Badge> : <span style={{ fontSize: 12, color: MUTED }}>—</span>}</span>
          </div>
        ))}
        {slips && !slips.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>No payslips yet.</div>}
      </div>
      {open && <PayslipDrawer slip={open} run={runOf(open)} currency={cur} canManage={false} canFinance={canFinance} onClose={() => setOpen(null)} onChanged={async () => { await loadSlips(); setOpen(null); }} />}
    </div>
  );
}

