import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { ACCENT, BG, DANGER, INK, MUTED, Label, btn, card, fmtDate, headRow, input } from '../manpowerUi';
import { RELEASE_REASONS, ReasonBox, ReleaseBadge, failed, label, usd, type Overview, type RetentionRelease, type Rights } from './financeUi';

interface RetentionView {
  accrued: number; released: number; held: number; open: number; available: number;
  items: { kind: string; id: string; name: string; phaseId: string | null; held: number; released: number; accrued: number }[];
  releases: RetentionRelease[]; canRelease: boolean; canRequest: boolean;
}

/**
 * Retention held back on every progress claim, and its release: requested for
 * the project, a milestone or a task, approved, then billed on a retention
 * invoice that pays it back to the items that held it.
 */
export function RetentionPanel({ projectId, overview, rights, onOpenInvoice, onChanged }: {
  projectId: number; overview: Overview; rights: Rights; onOpenInvoice: (id: string) => void; onChanged: () => void;
}) {
  const { toast } = useApp();
  const [v, setV] = useState<RetentionView | null>(null);
  const [form, setForm] = useState<{ scope: string; targetId: string; amount: string; reason: string; notes: string } | null>(null);
  const [rejecting, setRejecting] = useState<RetentionRelease | null>(null);
  const load = () => api.finance.retention(projectId).then((r: any) => setV(r)).catch((e: any) => failed(toast, e));
  useEffect(() => { load(); }, [projectId]);
  if (!v) return <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>;

  const phases = overview.sov.groups.flatMap((g) => g.rows.filter((r) => r.kind === 'phase'));
  const tasks = overview.sov.groups.flatMap((g) => g.rows.flatMap((r) => (r.kind === 'task' ? [r] : r.children || [])));
  const nameOf = (r: RetentionRelease) => r.scope === 'project' ? 'Whole project' : (r.scope === 'phase' ? phases : tasks).find((x) => x.id === r.targetId)?.name || r.scope;
  const heldOn = (scope: string, targetId: string) => scope === 'project' ? v.available : Math.min(v.items.find((i) => i.kind === scope && i.id === targetId)?.held || 0, v.available);

  const request = async () => {
    if (!form) return;
    try {
      setV(await api.finance.requestRelease(projectId, { ...form, amount: form.amount === '' ? undefined : Number(form.amount) }) as RetentionView);
      setForm(null); onChanged(); toast('Release requested');
    } catch (e) { failed(toast, e); }
  };
  const decide = async (r: RetentionRelease, decision: 'approve' | 'reject' | 'cancel', reason?: string) => {
    try { setV(await api.finance.decideRelease(r.id, { decision, reason, version: r.version }) as RetentionView); setRejecting(null); onChanged(); }
    catch (e) { failed(toast, e); }
  };
  const bill = async (r: RetentionRelease) => {
    try { const inv = await api.finance.billRelease(r.id) as any; await load(); onChanged(); onOpenInvoice(inv.id); }
    catch (e) { failed(toast, e); }
  };
  const itemCols = 'minmax(220px,2fr) 130px 130px 130px 110px';
  const relCols = '80px minmax(180px,1.6fr) 150px 120px 150px minmax(200px,1.4fr)';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {[
          ['Retention accrued', v.accrued, 'Held back from progress claims'], ['Released', v.released, 'Billed back to the client'],
          ['Held now', v.held, ''], ['Release in progress', v.open, 'Requested or approved, not yet issued'], ['Available to release', v.available, ''],
        ].map(([l, n, sub]) => (
          <div key={l as string} style={{ ...card, padding: '10px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
            <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: INK, marginTop: 2 }}>{usd(n as number)}</div>
            {sub && <div style={{ fontSize: 11.5, color: MUTED }}>{sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, flex: 1 }}>Where it's held</div>
        {v.canRequest && v.available > 0 && <div onClick={() => setForm({ scope: 'project', targetId: '', amount: String(v.available), reason: 'substantial_completion', notes: '' })} style={btn(true)}>Request release</div>}
      </div>
      {form && (
        <div style={{ ...card, padding: '12px 14px', borderColor: ACCENT, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            <div><Label text="Release from" /><select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value, targetId: '', amount: e.target.value === 'project' ? String(v.available) : '' })} style={input}>
              <option value="project">Whole project</option><option value="phase">A milestone</option><option value="task">A task</option></select></div>
            {form.scope !== 'project' && <div><Label text={form.scope === 'phase' ? 'Milestone' : 'Task'} /><select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value, amount: String(heldOn(form.scope, e.target.value)) })} style={input}>
              <option value="">Choose…</option>{v.items.filter((i) => i.kind === form.scope && i.held > 0).map((i) => <option key={i.id} value={i.id}>{i.name} ({usd(i.held)})</option>)}</select></div>}
            <div><Label text="Amount ($)" /><input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={input} /></div>
            <div><Label text="Reason" /><select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={input}>{RELEASE_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div style={{ gridColumn: '1 / -1' }}><Label text="Notes" /><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Certificate of substantial completion issued 9/18" style={input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}><div onClick={request} style={btn(true)}>Request</div><div onClick={() => setForm(null)} style={btn()}>Cancel</div></div>
          <div style={{ fontSize: 11.5, color: MUTED }}>A whole-project release is shared across the items in proportion to what each holds. Nothing is billed until the release is approved and its retention invoice issued.</div>
        </div>
      )}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={headRow(itemCols)}><span>Item</span><span style={{ textAlign: 'right' }}>Accrued</span><span style={{ textAlign: 'right' }}>Released</span><span style={{ textAlign: 'right' }}>Held</span><span /></div>
        {v.items.map((i) => (
          <div key={i.kind + i.id} style={{ display: 'grid', gridTemplateColumns: itemCols, gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
            <span style={{ paddingLeft: i.kind === 'task' && i.phaseId ? 18 : 0, fontWeight: i.kind === 'task' ? 500 : 650 }}>{i.name}</span>
            <span style={{ textAlign: 'right' }}>{usd(i.accrued)}</span><span style={{ textAlign: 'right' }}>{usd(i.released)}</span><b style={{ textAlign: 'right' }}>{usd(i.held)}</b>
            <span style={{ textAlign: 'right' }}>{v.canRequest && i.held > 0 && i.kind !== 'project' && <span onClick={() => setForm({ scope: i.kind, targetId: i.id, amount: String(heldOn(i.kind, i.id)), reason: 'milestone_accepted', notes: '' })} style={{ fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 700 }}>Release…</span>}</span>
          </div>
        ))}
        {!v.items.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No retention held yet — it accrues as progress invoices are issued.</div>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Releases</div>
      {rejecting && <ReasonBox title={`Reject ${rejecting.number}`} tone="danger" confirm="Reject" onCancel={() => setRejecting(null)} onSubmit={(x) => decide(rejecting, 'reject', x.reason)} fields={[{ key: 'reason', label: 'Why', type: 'textarea', required: true }]} />}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={headRow(relCols)}><span>No.</span><span>From</span><span>Reason</span><span style={{ textAlign: 'right' }}>Amount</span><span>Status</span><span /></div>
        {v.releases.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: relCols, gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, opacity: r.status === 'cancelled' || r.status === 'rejected' ? 0.6 : 1 }}>
            <b style={{ color: ACCENT }}>{r.number}</b>
            <span>{nameOf(r)}<div style={{ fontSize: 11, color: MUTED }}>{r.requestedBy} · {fmtDate(r.createdAt)}{r.notes ? ` · ${r.notes}` : ''}</div></span>
            <span style={{ color: MUTED }}>{label(RELEASE_REASONS, r.reason)}</span>
            <b style={{ textAlign: 'right' }}>{usd(r.amount)}</b>
            <span><ReleaseBadge s={r.status} />{r.closedReason && <div style={{ fontSize: 11, color: DANGER }}>{r.closedReason}</div>}</span>
            <span style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {r.status === 'requested' && v.canRelease && <>
                <span onClick={() => decide(r, 'approve')} style={{ color: ACCENT, fontWeight: 700, cursor: 'pointer' }}>Approve</span>
                <span onClick={() => setRejecting(r)} style={{ color: DANGER, cursor: 'pointer' }}>Reject</span>
              </>}
              {r.status === 'approved' && !r.invoiceId && rights.prepareInvoice && <span onClick={() => bill(r)} style={{ color: ACCENT, fontWeight: 700, cursor: 'pointer' }}>Bill it</span>}
              {r.invoiceId && <span onClick={() => onOpenInvoice(r.invoiceId!)} style={{ color: ACCENT, cursor: 'pointer' }}>{r.status === 'billed' ? 'Open invoice' : 'Open draft invoice'}</span>}
              {(r.status === 'requested' || (r.status === 'approved' && !r.invoiceId)) && v.canRequest && <span onClick={() => decide(r, 'cancel')} style={{ color: MUTED, cursor: 'pointer' }}>Cancel</span>}
            </span>
          </div>
        ))}
        {!v.releases.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>No releases yet.</div>}
      </div>
    </div>
  );
}
