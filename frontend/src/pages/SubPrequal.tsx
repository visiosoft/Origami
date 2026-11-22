import { TradePicker, useSubcontractorTrades } from '../components/SubcontractorTrades';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { PREQUAL_LABEL } from '../data/prequal';
import { RfpPackages } from '../components/RfpPackages';

type Row = Awaited<ReturnType<typeof api.prequal.list>>[number];
const field = { padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 13, background: 'var(--surface)' } as const;
const pill = (on: boolean) => ({ padding: '7px 14px', borderRadius: 999, border: 0, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: on ? 'var(--forest)' : 'var(--mist)', color: on ? '#fff' : 'var(--forest)' }) as const;
const TONE: Record<string, [string, string]> = { approved: ['var(--mint)', 'var(--forest)'], pending: ['var(--amber-light)', '#93520F'], rejected: ['#F7E4DB', '#8E2E0A'], none: ['var(--mist)', 'var(--muted)'] };

/**
 * GC & Sub Prequalify (Nov 13 sync): each contractor's prequal form, the
 * review (approve / turn down), and a private link for the sub to fill it in.
 * Only approved companies with a current licence and insurance can be
 * invited to bid.
 */
function PrequalList() {
  const { toast, can } = useApp();
  const manage = can('sub_prequal', 'manage') || can('manpower_con', 'manage') || can('fin_resources', 'manage');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [show, setShow] = useState<'all' | 'review' | 'approved' | 'blocked'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { trades } = useSubcontractorTrades();
  const load = () => api.prequal.list().then((r) => { setRows(r); if (open) { const n = r.find((x) => x.id === open.id); if (n) setOpen(n); } }).catch(() => setRows([]));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    setForm({ licenseNumber: open.licenseNumber || '', licenseExpiry: open.licenseExpiry || '', insuranceProvider: open.insuranceProvider || '', insurancePolicyNumber: open.insurancePolicyNumber || '', insuranceExpiry: open.insuranceExpiry || '', trades: open.prequal?.trades || '', tradeIds: open.tradeIds || [], yearsInBusiness: open.prequal?.yearsInBusiness ?? '', references: open.prequal?.references || '', w9OnFile: !!open.prequal?.w9OnFile });
    setNote(open.prequalNotes || '');
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (rows || []).filter((r) => (!q || r.companyName.toLowerCase().includes(q.toLowerCase()))
    && (show === 'all' || (show === 'review' && r.prequalStatus === 'pending') || (show === 'approved' && r.canBid) || (show === 'blocked' && !r.canBid))), [rows, q, show]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast(ok); await load(); } catch (e) { toast('⚠ ' + (e as Error).message); } finally { setBusy(false); } };
  const count = (f: (r: Row) => boolean) => (rows || []).filter(f).length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        Before a sub is asked to bid: their licence, insurance, licence classifications and references, reviewed here. A sub who isn’t prequalified yet can still be invited to bid (the prequal form goes with the invite); only one that was <b>turned down</b> can’t.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={pill(show === 'all')} onClick={() => setShow('all')}>All ({count(() => true)})</button>
        <button type="button" style={pill(show === 'review')} onClick={() => setShow('review')}>To review ({count((r) => r.prequalStatus === 'pending')})</button>
        <button type="button" style={pill(show === 'approved')} onClick={() => setShow('approved')}>Can bid ({count((r) => r.canBid)})</button>
        <button type="button" style={pill(show === 'blocked')} onClick={() => setShow('blocked')}>Can’t bid ({count((r) => !r.canBid)})</button>
        <input aria-label="Search companies" placeholder="Search companies" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, marginLeft: 'auto', minWidth: 200 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: open ? 'minmax(0, 1fr) minmax(0, 1.1fr)' : '1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 8, display: 'grid', gap: 2 }}>
          {rows === null ? <div style={{ padding: 12, color: 'var(--muted)' }}>Loading…</div> : !shown.length ? <div style={{ padding: 12, color: 'var(--muted)' }}>No companies here.</div> : shown.map((r) => {
            const tone = TONE[r.prequalStatus || 'none'];
            return (
              <button key={r.id} type="button" onClick={() => setOpen(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: 0, background: open?.id === r.id ? 'var(--mist)' : 'transparent', font: 'inherit', cursor: 'pointer' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5, color: 'var(--ink)' }}>{r.companyName}</b>
                  <span style={{ display: 'block', fontSize: 12, color: r.canBid ? 'var(--muted)' : '#8E2E0A' }}>{r.canBid ? `Licence to ${r.licenseExpiry} · insurance to ${r.insuranceExpiry}` : r.reason}</span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: tone[0], color: tone[1], whiteSpace: 'nowrap' }}>{r.prequalStatus ? PREQUAL_LABEL[r.prequalStatus] : 'Not started'}</span>
              </button>
            );
          })}
        </div>
        {open && (
          <div aria-label="Prequalification" style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ flex: 1, fontSize: 16, color: 'var(--ink)' }}>{open.companyName}</b>
              <button type="button" aria-label="Close" onClick={() => setOpen(null)} style={{ border: 0, background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>
            {open.prequal?.submittedAt && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Form filled in by {open.prequal.submittedBy} on {new Date(open.prequal.submittedAt).toLocaleDateString()}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {([['licenseNumber', 'Licence number', 'text'], ['licenseExpiry', 'Licence expires', 'date'], ['insuranceProvider', 'Insurance company', 'text'], ['insurancePolicyNumber', 'Policy number', 'text'], ['insuranceExpiry', 'Insurance expires', 'date'], ['yearsInBusiness', 'Years in business', 'number']] as const).map(([k, l, t]) => (
                <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--body)' }}>{l}<input type={t} disabled={!manage} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={field} /></label>
              ))}
            </div>
            {/* Nov 19 (Edward): the CSLB licence classifications they hold (with the CSI codes each covers), not free text. */}
            <div style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--body)' }}>Licence classifications
              <TradePicker trades={trades} value={form.tradeIds || []} disabled={!manage} onChange={(ids) => setForm({ ...form, tradeIds: ids })} />
            </div>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--body)' }}>Trade notes<input disabled={!manage} value={form.trades || ''} placeholder="Anything else about what they do" onChange={(e) => setForm({ ...form, trades: e.target.value })} style={field} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--body)' }}>References<textarea rows={3} disabled={!manage} value={form.references || ''} onChange={(e) => setForm({ ...form, references: e.target.value })} style={field} /></label>
            {/* Nov 19 (Edward): no W-9 at prequalifying -- it's asked for when we contract with them. */}
            <div style={{ fontSize: 12.5 }}><b>Files</b> — {open.attachments.length ? open.attachments.map((a) => a.name).join(', ') : 'none yet (the sub can upload from their link, or add them on the Contractors page)'}</div>
            {manage && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy} style={pill(false)} onClick={() => void run(() => api.prequal.save(open.id, form), 'Saved')}>Save the form</button>
                  <button type="button" disabled={busy} style={pill(false)} onClick={() => void run(async () => { const r = await api.prequal.link(open.id); await navigator.clipboard?.writeText(r.link).catch(() => undefined); if (!r.emailed) toast('Link copied — send it to the sub'); }, 'Form link sent')}>Send the form link</button>
                </div>
                <textarea aria-label="Review note" rows={2} placeholder="Note on the decision (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={field} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy} style={pill(true)} onClick={() => void run(async () => { await api.prequal.save(open.id, form); await api.prequal.decide(open.id, 'approved', note); }, 'Prequalified')}>Approve</button>
                  <button type="button" disabled={busy} style={{ ...pill(false), color: '#8E2E0A' }} onClick={() => void run(() => api.prequal.decide(open.id, 'rejected', note), 'Turned down')}>Turn down</button>
                </div>
              </>
            )}
            {open.prequalBy && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{PREQUAL_LABEL[open.prequalStatus || ''] || 'Updated'} by {open.prequalBy}{open.prequalAt ? ` on ${new Date(open.prequalAt).toLocaleDateString()}` : ''}{open.prequalNotes ? ` — ${open.prequalNotes}` : ''}</div>}
            {!open.canBid && <div role="status" style={{ fontSize: 12.5, color: '#8E2E0A' }}>Can’t be invited to bid: {open.reason}.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * GC & Sub Prequalify & RFP (Nov 19 tabs): prequalification of subs, and the
 * bid packages (RFP) -- moved here from Estimating (Edward).
 */
export function SubPrequal() {
  const { can } = useApp();
  const q = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState<'prequal' | 'rfp'>(q.get('tab') === 'rfp' ? 'rfp' : 'prequal');
  const start = q.get('project') && q.get('estimate') ? { projectId: Number(q.get('project')), estimateId: String(q.get('estimate')) } : null;
  const canEdit = can('estimating', 'manage') || can('precon_estimates', 'manage') || can('fin_project', 'manage') || can('sub_prequal', 'manage');
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div role="tablist" style={{ display: 'flex', gap: 6 }}>
        <button type="button" role="tab" aria-selected={tab === 'prequal'} style={pill(tab === 'prequal')} onClick={() => setTab('prequal')}>Prequalification</button>
        <button type="button" role="tab" aria-selected={tab === 'rfp'} style={pill(tab === 'rfp')} onClick={() => setTab('rfp')}>RFP / Bid packages</button>
      </div>
      {tab === 'prequal' ? <PrequalList /> : <RfpPackages canEdit={canEdit} start={start} />}
    </div>
  );
}
