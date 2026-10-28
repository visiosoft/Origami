import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats } from '../components/ActionKit';
import { SortSelect, useSort } from '../components/SortHeader';
import { Skeleton } from '../components/Skeleton';

/** One thing waiting on a decision, from whichever module holds it. */
interface Waiting {
  key: string;
  kind: Kind;
  title: string;
  sub: string;
  since?: string;
  amount?: number | null;
  /** Where to go to decide it. */
  to: string;
  /** The caller can decide it (not just see it). */
  canAct: boolean;
}
type Kind = 'change_order' | 'contract' | 'client_contract' | 'reimbursable' | 'finance' | 'daily_report' | 'timesheet' | 'workforce';
const KIND: Record<Kind, string> = {
  change_order: 'Change order', contract: 'Contract', client_contract: 'Client contract', reimbursable: 'Reimbursement', finance: 'Finance',
  daily_report: 'Daily report', timesheet: 'Timesheet', workforce: 'Workforce request',
};
/** What Approvals is for (Oct 16): contracts and change orders. The rest is one tab over. */
const MAIN: Kind[] = ['change_order', 'contract', 'client_contract'];
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * Special Actions -> Approvals: everything waiting on someone, in one list --
 * change orders and other finance items, submitted daily reports, timesheets and
 * workforce requests. Each row opens the place where it's approved; nothing is
 * decided here. Only what the signed-in person may see is fetched.
 */
export function Approvals() {
  const navigate = useNavigate();
  const { can } = useApp();
  const [rows, setRows] = useState<Waiting[] | null>(null);
  const [kind, setKind] = useState<'all' | Kind>('all');
  const [group, setGroup] = useState<'main' | 'other'>('main');
  const [mine, setMine] = useState(true);

  useEffect(() => {
    let live = true;
    const canManpower = can('manpower_con', 'manage');
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    (async () => {
      const canContracts = can('pipeline', 'view') || can('projects', 'view');
      const [projects, finance, logs, sheets, requests, proposals] = await Promise.all([
        safe(api.projects.list() as Promise<any[]>, []),
        can('fin_project', 'view') || can('changeorders', 'view') || can('reimbursement', 'view') ? safe(api.finance.approvals() as Promise<any[]>, []) : Promise.resolve([]),
        canManpower ? safe(api.dailyLogs.list({ status: 'submitted' }) as Promise<any[]>, []) : Promise.resolve([]),
        safe(api.timesheets.pendingNotices(), []),
        canManpower ? safe(api.workforceRequests.list() as Promise<any[]>, []) : Promise.resolve([]),
        canContracts ? safe(api.proposals.awaiting(), []) : Promise.resolve([]),
      ]);
      const name = new Map<number, string>((Array.isArray(projects) ? projects : []).map((p: any) => [p.id, p.name]));
      const pn = (id: number) => name.get(id) || `Project ${id}`;
      const out: Waiting[] = [];
      for (const p of Array.isArray(finance) ? finance : []) {
        const k: Kind = p.type === 'change_order' ? 'change_order' : p.type === 'commitment' ? 'contract' : p.type === 'reimbursable' ? 'reimbursable' : 'finance';
        out.push({
          key: 'f' + p.type + p.id, kind: k, title: p.title, sub: [p.projectName, p.detail].filter(Boolean).join(' · '), since: p.since, amount: p.amount, canAct: !!p.canAct,
          to: k === 'change_order' ? `/changeorders?co=${encodeURIComponent(p.id)}` : k === 'reimbursable' ? '/reimbursement' : '/fin_project',
        });
      }
      // Client contracts sent and waiting for the client's signature.
      for (const c of Array.isArray(proposals) ? proposals : []) {
        const amt = Number(String(c.amount || '').replace(/[^0-9.]/g, ''));
        out.push({
          key: 'p' + c.dealId, kind: 'client_contract', title: c.subject || `Contract — ${c.dealName}`, sub: [c.dealName, c.sentTo && 'sent to ' + c.sentTo, 'waiting for the client to sign'].filter(Boolean).join(' · '),
          since: c.sentAt, amount: Number.isFinite(amt) && amt > 0 ? amt : null, canAct: true, to: `/pipeline?open=${encodeURIComponent(c.dealId)}`,
        });
      }
      for (const l of Array.isArray(logs) ? logs : []) {
        out.push({ key: 'd' + l.id, kind: 'daily_report', title: `${pn(l.projectId)} — daily report`, sub: [l.supervisorName && 'by ' + l.supervisorName, l.totalHours != null && `${l.totalHours} h`].filter(Boolean).join(' · '), since: l.submittedAt || l.date, canAct: canManpower, to: '/manpower_con?tab=approvals' });
      }
      for (const t of Array.isArray(sheets) ? sheets : []) {
        out.push({ key: 't' + t.id, kind: 'timesheet', title: `${t.employeeName} — week of ${new Date(t.weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, sub: `${t.totalHours} h`, since: t.submittedAt, canAct: true, to: '/manpower_con?tab=approvals' });
      }
      for (const r of (Array.isArray(requests) ? requests : []).filter((x: any) => x.status === 'submitted')) {
        const people = (r.lines || []).reduce((a: number, ln: any) => a + (Number(ln.quantity) || 0), 0);
        out.push({ key: 'w' + r.id, kind: 'workforce', title: `${pn(r.projectId)} — ${r.workArea || 'workforce request'}`, sub: [r.requestedByName && 'by ' + r.requestedByName, people ? `${people} people` : '', r.requiredDate && 'needed ' + new Date(r.requiredDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })].filter(Boolean).join(' · '), since: r.submittedAt, canAct: canManpower, to: '/manpower_con?tab=requests' });
      }
      out.sort((a, b) => String(a.since || '').localeCompare(String(b.since || '')));
      if (live) setRows(out);
    })();
    return () => { live = false; };
  }, [can]);

  const all = rows || [];
  const inGroup = all.filter((r) => (group === 'main' ? MAIN.includes(r.kind) : !MAIN.includes(r.kind)));
  const scoped = inGroup.filter((r) => !mine || r.canAct);
  const shown = scoped.filter((r) => kind === 'all' || r.kind === kind);
  const kinds = (Object.keys(KIND) as Kind[]).filter((k) => scoped.some((r) => r.kind === k));
  const oldest = scoped[0]?.since;
  const { sorted, sort, setSort } = useSort(shown, { since: (r) => r.since, title: (r) => r.title, amount: (r) => r.amount, kind: (r) => KIND[r.kind] });

  return (
    <AkPage lead="Contracts and change orders waiting for approval — subcontracts and purchase orders to approve, client contracts waiting to be signed, and change orders in review. Open one to approve it where it lives.">
      <AkStats items={[
        { key: 'all', label: mine ? 'Waiting on you' : 'Waiting', value: rows ? scoped.length : '—', sub: rows && oldest ? `oldest since ${new Date(oldest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined, tone: scoped.length ? 'yellow' : undefined, onClick: () => setKind('all'), on: kind === 'all' },
        ...(group === 'main' ? [
          { key: 'co', label: 'Change orders', value: rows ? scoped.filter((r) => r.kind === 'change_order').length : '—', sub: 'in review or with the client', onClick: () => setKind('change_order'), on: kind === 'change_order' },
          { key: 'ct', label: 'Contracts to approve', value: rows ? scoped.filter((r) => r.kind === 'contract').length : '—', sub: 'subcontracts and purchase orders', onClick: () => setKind('contract'), on: kind === 'contract' },
          { key: 'cc', label: 'Client contracts', value: rows ? scoped.filter((r) => r.kind === 'client_contract').length : '—', sub: 'sent, not signed yet', onClick: () => setKind('client_contract'), on: kind === 'client_contract' },
        ] : [
          { key: 'fin', label: 'Finance', value: rows ? scoped.filter((r) => r.kind === 'reimbursable' || r.kind === 'finance').length : '—', sub: 'reimbursements, invoices, bills' },
          { key: 'site', label: 'Site & people', value: rows ? scoped.filter((r) => r.kind === 'daily_report' || r.kind === 'timesheet' || r.kind === 'workforce').length : '—', sub: 'daily reports, timesheets, workforce' },
        ]),
      ]} />

      <div className="ak-tools">
        <AkSeg<'main' | 'other'> value={group} onChange={(g) => { setGroup(g); setKind('all'); }} options={[['main', 'Contracts & change orders', all.filter((r) => MAIN.includes(r.kind) && (!mine || r.canAct)).length], ['other', 'Everything else', all.filter((r) => !MAIN.includes(r.kind) && (!mine || r.canAct)).length]]} />
        <AkSeg<'all' | Kind> options={[['all', 'All', scoped.length], ...kinds.map((k) => [k, KIND[k], scoped.filter((r) => r.kind === k).length] as ['all' | Kind, string, number])]} value={kind} onChange={setKind} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)' }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Only what I can decide
        </label>
        <SortSelect className="ak-select" value={sort} onChange={setSort} options={[
          { key: 'default', dir: 'asc', label: 'Waiting longest' }, { key: 'since', dir: 'desc', label: 'Newest first' }, { key: 'amount', dir: 'desc', label: 'Largest amount' },
          { key: 'title', dir: 'asc', label: 'A–Z' }, { key: 'kind', dir: 'asc', label: 'Type' },
        ]} />
      </div>

      <section className="ak-card">
        {rows === null && <div style={{ padding: 16 }}><Skeleton rows={4} /></div>}
        {rows && !shown.length && <div className="ak-empty">Nothing is waiting{mine ? ' on you' : ''}.</div>}
        {sorted.map((r, i) => (
          <AkRow key={r.key} index={i} onClick={() => navigate(r.to)}
            lead={<AkDate iso={r.since ? String(r.since).slice(0, 10) : undefined} />}
            title={r.title}
            sub={r.sub}
            right={<>
              {r.amount != null && <b style={{ fontSize: 13 }}>{usd(r.amount)}</b>}
              <AkPill tone="soft">{KIND[r.kind]}</AkPill>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: r.canAct ? 'var(--forest)' : 'var(--muted)' }}>{r.canAct ? 'Review →' : 'View'}</span>
            </>}
          />
        ))}
      </section>
    </AkPage>
  );
}
