import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { BID_OUTCOMES, OWED_A_JOB, outcomeLabel, type BidOutcome, type BidStats, type ContractorBid } from '../data/contractorBids';
import { BG, DANGER, INK, MUTED, Badge, bodyRow, btn, card, fmtDate, headRow, input, type Contractor, type Project, type SubcontractorTrade } from './manpowerUi';
import { SortHeader, useSort } from './SortHeader';

const usd = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }));
const today = () => new Date().toISOString().slice(0, 10);
type Draft = { projectId: string; projectName: string; tradeId: string; scope: string; dateReceived: string; amount: string; outcome: BidOutcome; notes: string };
const EMPTY = (): Draft => ({ projectId: '', projectName: '', tradeId: '', scope: '', dateReceived: today(), amount: '', outcome: 'pending', notes: '' });
const OTHER = 'other';

function Stat({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: warn ? 'var(--amber-light)' : 'var(--c-f7f3ea)', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: warn ? 'var(--c-8a6d12)' : MUTED }}>{label}</div>
      <div style={{ fontFamily: BG, fontSize: 22, fontWeight: 700, color: INK, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: warn ? 'var(--c-8a6d12)' : MUTED, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/**
 * A subcontractor's estimates: every project they priced, the amount, and
 * whether they got the job -- with a count of estimates since their last
 * award, so subs who keep bidding without work can be given priority.
 */
export function ContractorBids({ contractor, projects, subTrades, canManage, onChanged }: {
  contractor: Contractor; projects: Project[]; subTrades: SubcontractorTrade[]; canManage: boolean; onChanged: () => Promise<unknown> | void;
}) {
  const { toast } = useApp();
  const [rows, setRows] = useState<ContractorBid[] | null>(null);
  const [adding, setAdding] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.contractors.bids(contractor.id).then(setRows).catch(() => setRows([])); }, [contractor.id]);

  const stats: BidStats | undefined = contractor.bidStats;
  const tradeLabel = (id?: string | null) => { const t = subTrades.find((x) => x.id === id); return t ? `${t.code} ${t.name}` : ''; };
  const myTrades = subTrades.filter((t) => (contractor.tradeIds || []).includes(t.id));
  const tradeChoices = myTrades.length ? myTrades : subTrades;
  const { sorted, sort, toggle } = useSort(rows || [], {
    date: (r) => r.dateReceived, project: (r) => r.projectName, trade: (r) => tradeLabel(r.tradeId) || r.scope || '', amount: (r) => r.amount, outcome: (r) => outcomeLabel(r.outcome),
  }, { key: 'date', dir: 'desc' }, { date: 'desc', amount: 'desc' });

  const done = async (p: Promise<ContractorBid[]>, msg: string) => {
    setBusy(true);
    try { setRows(await p); await onChanged(); toast(msg); return true; }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); return false; }
    finally { setBusy(false); }
  };
  const add = async () => {
    if (!adding) return;
    const other = adding.projectId === OTHER;
    const ok = await done(api.contractors.addBid(contractor.id, {
      projectId: other || !adding.projectId ? null : Number(adding.projectId), projectName: other ? adding.projectName : undefined,
      tradeId: adding.tradeId || null, scope: adding.scope, dateReceived: adding.dateReceived, amount: (adding.amount === '' ? null : adding.amount) as any, outcome: adding.outcome, notes: adding.notes,
    }), 'Estimate added');
    if (ok) setAdding(null);
  };
  const setOutcome = (b: ContractorBid, outcome: BidOutcome) => done(api.contractors.updateBid(b.id, { outcome }), `Marked ${outcomeLabel(outcome).toLowerCase()}`);
  const remove = (b: ContractorBid) => { if (window.confirm(`Delete the estimate for ${b.projectName}?`)) void done(api.contractors.removeBid(b.id), 'Estimate deleted'); };

  const cols = canManage ? '110px minmax(150px,1.3fr) minmax(140px,1.2fr) 110px 150px minmax(120px,1fr) 28px' : '110px minmax(150px,1.3fr) minmax(140px,1.2fr) 110px 120px minmax(120px,1fr)';
  const owed = !!stats && stats.sinceLastAward >= OWED_A_JOB;
  const set = (p: Partial<Draft>) => setAdding((d) => (d ? { ...d, ...p } : d));

  return (
    <div style={{ ...card, padding: '18px 20px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Estimates &amp; bids</div>
        {canManage && !adding && <div onClick={() => setAdding({ ...EMPTY(), tradeId: myTrades.length === 1 ? myTrades[0].id : '' })} style={btn(true)}>+ Add estimate</div>}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>Every project they priced and whether they got the job. Subs who keep bidding without an award are flagged so they can be considered first.</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
        <Stat label="Estimates received" value={stats?.received ?? 0} sub={stats?.lastBidAt ? `last ${fmtDate(stats.lastBidAt)}` : undefined} />
        <Stat label="Projects bid" value={stats?.projects ?? 0} sub={stats?.pending ? `${stats.pending} pending` : undefined} />
        <Stat label="Awarded" value={stats?.awarded ?? 0} sub={stats?.winRate != null ? `${stats.winRate}% of decided bids` : undefined} />
        <Stat label="Not awarded" value={stats?.notAwarded ?? 0} />
        <Stat label={stats?.awarded ? 'Since last award' : 'Without an award'} value={stats?.sinceLastAward ?? 0}
          sub={owed ? 'Consider them for the next job' : stats?.lastAwardAt ? `last job ${fmtDate(stats.lastAwardAt)}` : 'estimates not awarded'} warn={owed} />
      </div>

      {adding && (
        <div style={{ background: 'var(--c-f7f3ea)', borderRadius: 10, padding: 12, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 12 }}>
          <label style={{ fontSize: 11.5, color: MUTED }}>Project
            <select value={adding.projectId} onChange={(e) => set({ projectId: e.target.value })} style={input} aria-label="Project">
              <option value="">Pick a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value={OTHER}>Other / not in Origami…</option>
            </select>
          </label>
          {adding.projectId === OTHER && <label style={{ fontSize: 11.5, color: MUTED }}>Project name<input value={adding.projectName} onChange={(e) => set({ projectName: e.target.value })} placeholder="e.g. Smith residence" style={input} aria-label="Project name" /></label>}
          <label style={{ fontSize: 11.5, color: MUTED }}>Trade
            <select value={adding.tradeId} onChange={(e) => set({ tradeId: e.target.value })} style={input} aria-label="Trade">
              <option value="">—</option>
              {tradeChoices.map((t) => <option key={t.id} value={t.id}>{t.code} {t.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11.5, color: MUTED }}>Scope<input value={adding.scope} onChange={(e) => set({ scope: e.target.value })} placeholder="e.g. Framing, levels 1–2" style={input} aria-label="Scope" /></label>
          <label style={{ fontSize: 11.5, color: MUTED }}>Received<input type="date" value={adding.dateReceived} onChange={(e) => set({ dateReceived: e.target.value })} style={input} aria-label="Date received" /></label>
          <label style={{ fontSize: 11.5, color: MUTED }}>Amount ($)<input inputMode="decimal" value={adding.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" style={input} aria-label="Amount" /></label>
          <label style={{ fontSize: 11.5, color: MUTED }}>Outcome
            <select value={adding.outcome} onChange={(e) => set({ outcome: e.target.value as BidOutcome })} style={input} aria-label="Outcome">
              {BID_OUTCOMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11.5, color: MUTED, gridColumn: '1 / -1' }}>Notes<input value={adding.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Came in 8% high; good on schedule" style={input} aria-label="Notes" /></label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <div onClick={() => setAdding(null)} style={btn()}>Cancel</div>
            <div onClick={busy ? undefined : add} style={btn(true, busy || !adding.projectId || (adding.projectId === OTHER && !adding.projectName.trim()))}>Save estimate</div>
          </div>
        </div>
      )}

      <div style={{ border: '1px solid rgba(var(--rgb-shade), .06)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={headRow(cols)}>
              <SortHeader k="date" sort={sort} onSort={toggle}>Received</SortHeader>
              <SortHeader k="project" sort={sort} onSort={toggle}>Project</SortHeader>
              <SortHeader k="trade" sort={sort} onSort={toggle}>Trade / scope</SortHeader>
              <SortHeader k="amount" sort={sort} onSort={toggle} align="right">Amount</SortHeader>
              <SortHeader k="outcome" sort={sort} onSort={toggle}>Outcome</SortHeader>
              <span>Notes</span>
              {canManage && <span />}
            </div>
            {rows === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {sorted.map((b) => {
              const tone = (BID_OUTCOMES.find(([k]) => k === b.outcome) || BID_OUTCOMES[0])[2];
              return (
                <div key={b.id} style={bodyRow(cols)}>
                  <span style={{ fontSize: 12.5 }}>{fmtDate(b.dateReceived)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: INK, minWidth: 0 }}>{b.projectName}</span>
                  <span style={{ fontSize: 12.5, minWidth: 0 }}>{[tradeLabel(b.tradeId), b.scope].filter(Boolean).join(' · ') || '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{usd(b.amount)}</span>
                  <span>
                    {canManage ? (
                      <select value={b.outcome} disabled={busy} onChange={(e) => setOutcome(b, e.target.value as BidOutcome)} aria-label={`Outcome for ${b.projectName}`} style={{ ...input, padding: '5px 8px', fontSize: 12 }}>
                        {BID_OUTCOMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    ) : <Badge tone={tone}>{outcomeLabel(b.outcome)}</Badge>}
                    {b.outcomeDate && b.outcome !== 'pending' && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{fmtDate(b.outcomeDate)}</div>}
                  </span>
                  <span style={{ fontSize: 12, color: MUTED, minWidth: 0 }}>{b.notes || ''}</span>
                  {canManage && <span onClick={() => remove(b)} title="Delete" style={{ cursor: 'pointer', color: DANGER, fontSize: 16, textAlign: 'center' }}>×</span>}
                </div>
              );
            })}
            {rows && !rows.length && <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No estimates recorded yet{canManage ? ' — add one each time they price a job.' : '.'}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
