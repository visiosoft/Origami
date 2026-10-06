import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { ReimbursableDrawer } from './Reimbursables';
import { REIMB_CATEGORIES, failed, label, usd, usd0, type Reimbursable, type Rights } from './financeUi';
import './ReimbursementBoard.css';

const AVATAR_TONES = ['#F3D9B1', '#CFE0CC', '#F2CFC4', '#D5DCE8', '#F5E3A1', '#E3D3EC', '#CFE5E4', '#EBD8C8'];
const toneFor = (s: string) => AVATAR_TONES[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length];
const initials = (n: string) => n.split(/[\s(·,-]+/).filter((w) => /^[A-Za-z0-9]/.test(w)).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '•';
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATUS: Record<Reimbursable['status'], [string, string]> = {
  submitted: ['Awaiting', 'rb-pill is-dark'], approved: ['Approved', 'rb-pill is-green'], billed: ['Billed', 'rb-pill is-yellow'], rejected: ['Rejected', 'rb-pill is-grey'],
};
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (m: string) => new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const shiftMonth = (m: string, by: number) => { const d = new Date(m + '-01T12:00:00'); d.setMonth(d.getMonth() + by); return monthKey(d); };
const short = (n: number) => (n >= 9950 ? `$${Math.round(n / 1000)}k` : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
/** What an expense is worth on this board: what it bills, or its cost if it is never billed. */
const worth = (r: Reimbursable) => (r.billable ? r.billAmount : r.cost);

/**
 * The Reimbursement log in the New look, laid out like the payroll board:
 * projects on the left, the month (totals, split and a calendar of spend) in
 * the middle, and the chosen expense on the right. Editing, rejecting and
 * adding go through the same drawer as everywhere else.
 */
export function ReimbursementBoard({ rights }: { rights: Rights }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<Reimbursable[] | null>(null);
  const [project, setProject] = useState<number | 'all'>('all');
  const [month, setMonth] = useState<string>(monthKey(new Date()));
  const [day, setDay] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ id: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.finance.allReimbursables()
    .then((r: any) => setRows(Array.isArray(r) ? r : []))
    .catch((e: any) => { setRows([]); toast('⚠ ' + (e.message || 'Could not load reimbursables')); });
  useEffect(() => { load(); }, []);
  // Open on the month of the latest expense, so a quiet month doesn't greet you with nothing.
  useEffect(() => {
    if (!rows?.length) return;
    const latest = rows.reduce((a, r) => (r.date > a ? r.date : a), '');
    if (latest && !rows.some((r) => r.date.startsWith(monthKey(new Date())))) setMonth(latest.slice(0, 7));
  }, [rows === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = rows || [];
  const projects = useMemo(() => {
    const m = new Map<number, { id: number; name: string; count: number; total: number }>();
    for (const r of all) {
      const p = m.get(r.projectId) || { id: r.projectId, name: r.projectName || `Project ${r.projectId}`, count: 0, total: 0 };
      p.count += 1; if (r.status !== 'rejected') p.total += worth(r);
      m.set(r.projectId, p);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [all]);

  const inProject = project === 'all' ? all : all.filter((r) => r.projectId === project);
  const inMonth = inProject.filter((r) => r.date.startsWith(month));
  const listed = (day ? inMonth.filter((r) => r.date.startsWith(day)) : inMonth).slice().sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const live = inMonth.filter((r) => r.status !== 'rejected');
  const total = live.reduce((a, r) => a + worth(r), 0);
  const sum = (pred: (r: Reimbursable) => boolean) => inMonth.filter(pred).reduce((a, r) => a + worth(r), 0);
  const approvedAmt = sum((r) => r.status === 'approved' || r.status === 'billed');
  const awaitingAmt = sum((r) => r.status === 'submitted');
  const rejectedAmt = sum((r) => r.status === 'rejected');
  const splitBase = approvedAmt + awaitingAmt + rejectedAmt || 1;
  const pctOf = (n: number) => Math.round((n / splitBase) * 100);

  const selected = all.find((r) => r.id === sel) || listed[0] || null;

  // Calendar cells for the month, Monday first.
  const cells = useMemo(() => {
    const first = new Date(month + '-01T12:00:00');
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const out: (null | { iso: string; n: number; amt: number; awaiting: boolean; onlyRejected: boolean; count: number })[] = Array(lead).fill(null);
    for (let n = 1; n <= days; n++) {
      const iso = `${month}-${String(n).padStart(2, '0')}`;
      const that = inProject.filter((r) => r.date.startsWith(iso));
      const liveDay = that.filter((r) => r.status !== 'rejected');
      out.push({ iso, n, amt: liveDay.reduce((a, r) => a + worth(r), 0), awaiting: that.some((r) => r.status === 'submitted'), onlyRejected: that.length > 0 && !liveDay.length, count: that.length });
    }
    return out;
  }, [month, inProject]);
  const today = new Date().toISOString().slice(0, 10);

  const approve = async (r: Reimbursable) => {
    setBusy(true);
    try { await api.finance.decideReimbursable(r.id, { decision: 'approve', version: r.version }); toast(`${r.number} approved`); await load(); }
    catch (e) { failed(toast, e); } finally { setBusy(false); }
  };

  const monthBills = live.filter((r) => r.billable);
  const billedAmt = monthBills.filter((r) => r.status === 'billed').reduce((a, r) => a + r.billAmount, 0);
  const toBillAmt = monthBills.reduce((a, r) => a + r.billAmount, 0);
  const withReceipt = inMonth.filter((r) => (r.attachments || []).length > 0).length;

  return (
    <div className="rb">
      {/* Projects */}
      <aside className="rb-panel rb-left">
        <h3 className="rb-h">Projects</h3>
        <div className="rb-people">
          {[{ id: 'all' as const, name: 'All projects', count: all.length, total: all.filter((r) => r.status !== 'rejected').reduce((a, r) => a + worth(r), 0) }, ...projects].map((p) => (
            <button type="button" key={p.id} className={'rb-person' + (project === p.id ? ' is-on' : '')} onClick={() => { setProject(p.id); setDay(null); setSel(null); }}>
              <span className="rb-avatar" style={{ background: p.id === 'all' ? 'var(--yellow)' : toneFor(p.name) }}>{p.id === 'all' ? '∑' : initials(p.name)}</span>
              <span className="rb-person-text">
                <span className="rb-person-name">{p.name}</span>
                <span className="rb-person-sub">{p.count} {p.count === 1 ? 'expense' : 'expenses'} · {usd0(p.total)}</span>
              </span>
            </button>
          ))}
          {rows && !projects.length && <div className="rb-muted" style={{ padding: '8px 4px' }}>No expenses yet.</div>}
        </div>
      </aside>

      {/* The month */}
      <section className="rb-panel rb-mid">
        <div className="rb-mid-head">
          <div className="rb-big">
            <span className="rb-num">{inMonth.length}</span><span className="rb-unit">{inMonth.length === 1 ? 'expense' : 'expenses'}</span>
            <span className="rb-slash">/</span><span className="rb-num">{usd0(total)}</span>
          </div>
          <div className="rb-month">
            <button type="button" aria-label="Previous month" onClick={() => { setMonth(shiftMonth(month, -1)); setDay(null); }}>‹</button>
            <span>{monthLabel(month)}</span>
            <button type="button" aria-label="Next month" onClick={() => { setMonth(shiftMonth(month, 1)); setDay(null); }}>›</button>
          </div>
          {rights.submitReimbursables && <button type="button" className="rb-add" onClick={() => setDrawer({ id: null })}>+ Expense</button>}
        </div>

        <div className="rb-split">
          {([['Approved', approvedAmt, 'is-yellow'], ['Awaiting', awaitingAmt, 'is-dark'], ['Rejected', rejectedAmt, 'is-grey']] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} className="rb-split-col" style={{ flexGrow: Math.max(pctOf(v), 12) }}>
              <span className="rb-split-label">{l}</span>
              <span className={'rb-bar ' + c} title={usd(v)}>{pctOf(v)}%</span>
            </div>
          ))}
        </div>

        <div className="rb-cal">
          {DOW.map((d) => <span key={d} className="rb-dow">{d}</span>)}
          {cells.map((c, i) => c === null ? <span key={'x' + i} /> : (
            <button type="button" key={c.iso}
              className={'rb-day' + (day === c.iso ? ' is-on' : '') + (c.iso === today ? ' is-today' : '') + (c.count ? ' has' : '')}
              onClick={() => setDay(day === c.iso ? null : c.iso)}>
              <span className="rb-day-n">{c.n}</span>
              {c.count > 0 && (
                <span className={'rb-chip ' + (c.onlyRejected ? 'is-grey' : c.awaiting ? 'is-dark' : 'is-yellow')}>{c.onlyRejected ? 'Rejected' : short(c.amt)}</span>
              )}
            </button>
          ))}
        </div>

        <div className="rb-list-head">
          <span>{day ? new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'This month'}</span>
          {day && <button type="button" className="rb-link" onClick={() => setDay(null)}>Whole month</button>}
        </div>
        <div className="rb-list">
          {rows === null && <div className="rb-muted">Loading…</div>}
          {rows && !listed.length && <div className="rb-muted">{day ? 'Nothing on this day.' : 'No expenses this month.'}</div>}
          {listed.map((r) => (
            <button type="button" key={r.id} className={'rb-item' + (selected?.id === r.id ? ' is-on' : '')} onClick={() => setSel(r.id)}>
              <span className="rb-item-main">
                <span className="rb-item-title">{r.description}</span>
                <span className="rb-item-sub">{r.number} · {r.projectName}{r.vendor ? ' · ' + r.vendor : ''}</span>
              </span>
              <span className="rb-item-amt">{usd(worth(r))}</span>
              <span className={STATUS[r.status][1]}>{STATUS[r.status][0]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* The chosen expense */}
      <aside className="rb-panel rb-right">
        {!selected ? <div className="rb-muted" style={{ padding: 20, textAlign: 'center' }}>Pick an expense to see it here.</div> : (
          <>
            <div className="rb-hero">
              <span className="rb-hero-avatar" style={{ background: toneFor(selected.category) }}>{initials(label(REIMB_CATEGORIES, selected.category))}</span>
              <div className="rb-hero-title">{selected.description}</div>
              <div className="rb-hero-sub">{selected.number} · {selected.projectName}</div>
              <span className={STATUS[selected.status][1]} style={{ marginTop: 10 }}>{STATUS[selected.status][0]}</span>
            </div>
            <dl className="rb-facts">
              {([
                ['Date', new Date(selected.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                ['Category', label(REIMB_CATEGORIES, selected.category)],
                ['Vendor', selected.vendor || '—'],
                ['Cost', usd(selected.cost)],
                [selected.billable ? 'Bills' : 'Billing', selected.billable ? `${usd(selected.billAmount)} (${selected.markupPct}% markup)` : 'Cost only — not billed'],
                ['Submitted by', selected.submittedBy || '—'],
              ] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {selected.status === 'rejected' && selected.rejectedReason && <div className="rb-note">Rejected: {selected.rejectedReason}</div>}

            <h4 className="rb-h4">Receipts</h4>
            <div className="rb-docs">
              {(selected.attachments || []).length === 0 && <span className="rb-muted">No receipt attached yet.</span>}
              {(selected.attachments || []).map((a: any) => (
                <a key={a.id} className="rb-doc" href={a.webViewLink || a.url || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!a.webViewLink && !a.url) { e.preventDefault(); setDrawer({ id: selected.id }); } }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'currentColor', flexShrink: 0 }}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                  <span>{a.name}</span>
                </a>
              ))}
            </div>

            <div className="rb-actions">
              {selected.status === 'submitted' && rights.approveReimbursables && (
                <button type="button" className="rb-btn is-dark" disabled={busy} onClick={() => approve(selected)}>Approve</button>
              )}
              <button type="button" className="rb-btn" onClick={() => setDrawer({ id: selected.id })}>
                {selected.status === 'submitted' && rights.approveReimbursables ? 'Review / reject' : 'Open'}
              </button>
            </div>

            <h4 className="rb-h4">This month</h4>
            {([
              ['Approved', approvedAmt, approvedAmt + awaitingAmt, 'is-yellow', `${usd0(approvedAmt)} / ${usd0(approvedAmt + awaitingAmt)}`],
              ['Billed to clients', billedAmt, toBillAmt, 'is-dark', `${usd0(billedAmt)} / ${usd0(toBillAmt)}`],
              ['Receipts attached', withReceipt, inMonth.length, 'is-grey', `${withReceipt} / ${inMonth.length}`],
            ] as [string, number, number, string, string][]).map(([l, v, of, c, txt]) => (
              <div key={l} className="rb-meter">
                <div className="rb-meter-row"><span>{l}</span><b>{txt}</b></div>
                <div className="rb-meter-track"><div className={'rb-meter-fill ' + c} style={{ width: `${of ? Math.min(100, (v / of) * 100) : 0}%` }} /></div>
              </div>
            ))}
          </>
        )}
      </aside>

      {drawer && (
        <ReimbursableDrawer id={drawer.id} rights={rights}
          onClose={() => { setDrawer(null); load(); }}
          onChanged={(id) => { load(); if (id) { setDrawer({ id }); setSel(id); } }} />
      )}
    </div>
  );
}
