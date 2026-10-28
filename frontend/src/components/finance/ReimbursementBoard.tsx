import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { ReimbursableDrawer } from './Reimbursables';
import { REIMB_CATEGORIES, failed, label, usd, usd0, type Reimbursable, type Rights } from './financeUi';
import './ReimbursementBoard.css';

type Status = Reimbursable['status'];
const STATUS: Record<Status, [string, string]> = {
  submitted: ['Awaiting approval', 'rb-pill is-dark'], approved: ['Approved', 'rb-pill is-yellow'], billed: ['Billed', 'rb-pill is-soft'], rejected: ['Rejected', 'rb-pill is-grey'],
};
const FILTERS: [Status | 'all', string][] = [['all', 'All'], ['submitted', 'Awaiting'], ['approved', 'Approved'], ['billed', 'Billed'], ['rejected', 'Rejected']];
/** What an expense is worth here: what it bills the client, or its cost if it is never billed. */
const worth = (r: Reimbursable) => (r.billable ? r.billAmount : r.cost);
const live = (r: Reimbursable) => r.status !== 'rejected';
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (m: string) => new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const dayLabel = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Reimbursements in the New look, built on the expense workflow: what is
 * waiting for approval, what is approved and ready to bill, what has been
 * billed; then every expense by month, with spend by project and category on
 * the side. Every figure comes from the reimbursables log. Opening, editing,
 * rejecting and adding go through the same drawer as the Classic list.
 */
export function ReimbursementBoard({ rights }: { rights: Rights }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<Reimbursable[] | null>(null);
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [project, setProject] = useState<number | 'all'>('all');
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState<{ id: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.finance.allReimbursables()
    .then((r: any) => setRows(Array.isArray(r) ? r : []))
    .catch((e: any) => { setRows([]); toast('⚠ ' + (e.message || 'Could not load reimbursements')); });
  useEffect(() => { load(); }, []);

  const all = rows || [];
  const projects = useMemo(() => {
    const m = new Map<number, { id: number; name: string; total: number; count: number }>();
    for (const r of all) {
      const p = m.get(r.projectId) || { id: r.projectId, name: r.projectName || `Project ${r.projectId}`, total: 0, count: 0 };
      p.count += 1; if (live(r)) p.total += worth(r);
      m.set(r.projectId, p);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [all]);

  // Totals follow the project picked, not the status filter, so the cards always show the whole picture.
  const scope = project === 'all' ? all : all.filter((r) => r.projectId === project);
  const total = (pred: (r: Reimbursable) => boolean) => scope.filter(pred).reduce((a, r) => a + worth(r), 0);
  const count = (pred: (r: Reimbursable) => boolean) => scope.filter(pred).length;
  const awaiting = (r: Reimbursable) => r.status === 'submitted';
  const toBill = (r: Reimbursable) => r.status === 'approved' && r.billable && !r.invoiceId;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const spent = (m: string) => scope.filter((r) => live(r) && monthKey(r.date) === m).reduce((a, r) => a + r.cost, 0);
  const spentNow = spent(thisMonth), spentBefore = spent(lastMonth);
  const noReceipt = scope.filter((r) => live(r) && !(r.attachments || []).length).length;

  const needle = q.trim().toLowerCase();
  const shown = scope
    .filter((r) => (status === 'all' || r.status === status)
      && (!needle || `${r.number} ${r.description} ${r.vendor || ''} ${r.projectName || ''} ${r.submittedBy || ''} ${label(REIMB_CATEGORIES, r.category)}`.toLowerCase().includes(needle)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const groups = useMemo(() => {
    const m = new Map<string, Reimbursable[]>();
    for (const r of shown) { const k = monthKey(r.date); m.set(k, [...(m.get(k) || []), r]); }
    return [...m.entries()];
  }, [shown]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of scope) if (live(r)) m.set(r.category, (m.get(r.category) || 0) + worth(r));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [scope]);
  const catMax = Math.max(1, ...byCategory.map(([, v]) => v));
  const projMax = Math.max(1, ...projects.map((p) => p.total));

  const approve = async (r: Reimbursable) => {
    setBusy(r.id);
    try { await api.finance.decideReimbursable(r.id, { decision: 'approve', version: r.version }); toast(`${r.number} approved`); await load(); }
    catch (e) { failed(toast, e); } finally { setBusy(null); }
  };

  const cards: { k: string; label: string; value: string; sub: string; tone?: string; onClick?: () => void }[] = [
    { k: 'await', label: 'Waiting for approval', value: usd0(total(awaiting)), sub: `${count(awaiting)} ${count(awaiting) === 1 ? 'expense' : 'expenses'}`, tone: count(awaiting) ? 'is-yellow' : '', onClick: () => setStatus('submitted') },
    { k: 'bill', label: 'Approved · ready to bill', value: usd0(total(toBill)), sub: `${count(toBill)} not on an invoice yet`, onClick: () => setStatus('approved') },
    { k: 'billed', label: 'Billed to clients', value: usd0(total((r) => r.status === 'billed')), sub: `${count((r) => r.status === 'billed')} expenses`, onClick: () => setStatus('billed') },
    { k: 'month', label: `Spent in ${new Date().toLocaleDateString('en-US', { month: 'long' })}`, value: usd0(spentNow),
      sub: spentBefore ? `${spentNow >= spentBefore ? '▲' : '▼'} ${usd0(Math.abs(spentNow - spentBefore))} vs last month` : 'Cost of expenses dated this month', tone: 'is-dark' },
  ];

  return (
    <div className="rb">
      <div className="rb-stats">
        {cards.map((c, i) => (
          <button type="button" key={c.k} className={'rb-stat ' + (c.tone || '')} style={{ animationDelay: i * 0.05 + 's' }} onClick={c.onClick} disabled={!c.onClick}>
            <span className="rb-stat-label">{c.label}</span>
            <span className="rb-stat-value">{rows === null ? '—' : c.value}</span>
            <span className="rb-stat-sub">{rows === null ? 'Loading…' : c.sub}</span>
          </button>
        ))}
      </div>

      <div className="rb-tools">
        <div className="rb-seg" role="tablist">
          {FILTERS.map(([k, l]) => {
            const n = k === 'all' ? scope.length : scope.filter((r) => r.status === k).length;
            return <button type="button" key={k} role="tab" aria-selected={status === k} className={status === k ? 'is-on' : ''} onClick={() => setStatus(k)}>{l}<i>{n}</i></button>;
          })}
        </div>
        <select className="rb-select" value={String(project)} onChange={(e) => setProject(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="rb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search expense, vendor, person…" />
        {rights.submitReimbursables && <button type="button" className="rb-add" onClick={() => setDrawer({ id: null })}>+ Expense</button>}
      </div>

      <div className="rb-main">
        <section className="rb-card rb-list">
          {rows === null && <div className="rb-empty">Loading…</div>}
          {rows && !shown.length && (
            <div className="rb-empty">
              {all.length ? 'Nothing matches these filters.' : 'No expenses yet.'}
              {!all.length && rights.submitReimbursables && <button type="button" className="rb-link" onClick={() => setDrawer({ id: null })}>Add the first one</button>}
            </div>
          )}
          {groups.map(([m, items]) => (
            <div key={m} className="rb-group">
              <div className="rb-group-head">
                <span>{monthLabel(m)}</span>
                <b>{usd0(items.filter(live).reduce((a, r) => a + worth(r), 0))}</b>
              </div>
              {items.map((r) => {
                const files = (r.attachments || []).length;
                return (
                  <div key={r.id} role="button" tabIndex={0} className={'rb-row' + (r.status === 'rejected' ? ' is-muted' : '')}
                    onClick={() => setDrawer({ id: r.id })} onKeyDown={(e) => { if (e.key === 'Enter') setDrawer({ id: r.id }); }}>
                    <span className="rb-date"><b>{dayLabel(r.date).split(' ')[1]}</b>{dayLabel(r.date).split(' ')[0]}</span>
                    <span className="rb-main-text">
                      <span className="rb-title">{r.description || 'Untitled expense'}</span>
                      <span className="rb-sub">{[r.number, project === 'all' ? r.projectName : '', r.vendor, label(REIMB_CATEGORIES, r.category), r.submittedBy ? 'by ' + r.submittedBy : ''].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={'rb-receipt rb-hide-sm' + (files ? '' : ' is-missing')} title={files ? `${files} receipt${files === 1 ? '' : 's'}` : 'No receipt attached'}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                      {files || '!'}
                    </span>
                    <span className="rb-amt">
                      <b>{usd(worth(r))}</b>
                      <small>{r.billable ? `cost ${usd0(r.cost)} + ${r.markupPct}%` : 'cost only'}</small>
                    </span>
                    <span className="rb-state">
                      {r.status === 'submitted' && rights.approveReimbursables
                        ? <button type="button" className="rb-approve" disabled={busy === r.id} onClick={(e) => { e.stopPropagation(); approve(r); }}>{busy === r.id ? '…' : 'Approve'}</button>
                        : <span className={STATUS[r.status][1]}>{r.status === 'approved' && r.invoiceId ? 'On invoice' : STATUS[r.status][0]}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        <aside className="rb-side">
          <section className="rb-card">
            <h3 className="rb-h">By project</h3>
            {!projects.length && <div className="rb-muted">No expenses yet.</div>}
            {projects.slice(0, 8).map((p) => (
              <button type="button" key={p.id} className={'rb-bar-row' + (project === p.id ? ' is-on' : '')} onClick={() => setProject(project === p.id ? 'all' : p.id)}>
                <span className="rb-bar-top"><span className="rb-bar-name">{p.name}</span><b>{usd0(p.total)}</b></span>
                <span className="rb-bar-track"><span className="rb-bar-fill" style={{ width: (p.total / projMax) * 100 + '%' }} /></span>
              </button>
            ))}
            {project !== 'all' && <button type="button" className="rb-link" onClick={() => setProject('all')}>Show all projects</button>}
          </section>

          <section className="rb-card">
            <h3 className="rb-h">By category</h3>
            {!byCategory.length && <div className="rb-muted">Nothing yet.</div>}
            {byCategory.map(([k, v]) => (
              <div key={k} className="rb-bar-row is-static">
                <span className="rb-bar-top"><span className="rb-bar-name">{label(REIMB_CATEGORIES, k)}</span><b>{usd0(v)}</b></span>
                <span className="rb-bar-track"><span className="rb-bar-fill is-dark" style={{ width: (v / catMax) * 100 + '%' }} /></span>
              </div>
            ))}
          </section>

          {noReceipt > 0 && (
            <section className="rb-card rb-warn">
              <b>{noReceipt}</b> {noReceipt === 1 ? 'expense has' : 'expenses have'} no receipt attached. Open one and add the receipt before it's billed.
            </section>
          )}
        </aside>
      </div>

      {drawer && (
        <ReimbursableDrawer id={drawer.id} rights={rights}
          onClose={() => { setDrawer(null); load(); }}
          onChanged={(id) => { load(); if (id) setDrawer({ id }); }} />
      )}
    </div>
  );
}
