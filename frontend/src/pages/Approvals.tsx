import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { AkDate, AkPage, AkPill, AkRow, AkSeg, AkStats } from '../components/ActionKit';

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
type Kind = 'change_order' | 'reimbursable' | 'finance' | 'daily_report' | 'timesheet' | 'workforce';
const KIND: Record<Kind, string> = {
  change_order: 'Change order', reimbursable: 'Reimbursement', finance: 'Finance', daily_report: 'Daily report', timesheet: 'Timesheet', workforce: 'Workforce request',
};
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
  const [mine, setMine] = useState(true);

  useEffect(() => {
    let live = true;
    const canManpower = can('manpower_con', 'manage');
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    (async () => {
      const [projects, finance, logs, sheets, requests] = await Promise.all([
        safe(api.projects.list() as Promise<any[]>, []),
        can('fin_project', 'view') || can('changeorders', 'view') || can('reimbursement', 'view') ? safe(api.finance.approvals() as Promise<any[]>, []) : Promise.resolve([]),
        canManpower ? safe(api.dailyLogs.list({ status: 'submitted' }) as Promise<any[]>, []) : Promise.resolve([]),
        safe(api.timesheets.pendingNotices(), []),
        canManpower ? safe(api.workforceRequests.list() as Promise<any[]>, []) : Promise.resolve([]),
      ]);
      const name = new Map<number, string>((Array.isArray(projects) ? projects : []).map((p: any) => [p.id, p.name]));
      const pn = (id: number) => name.get(id) || `Project ${id}`;
      const out: Waiting[] = [];
      for (const p of Array.isArray(finance) ? finance : []) {
        const k: Kind = p.type === 'change_order' ? 'change_order' : p.type === 'reimbursable' ? 'reimbursable' : 'finance';
        out.push({
          key: 'f' + p.type + p.id, kind: k, title: p.title, sub: [p.projectName, p.detail].filter(Boolean).join(' · '), since: p.since, amount: p.amount, canAct: !!p.canAct,
          to: k === 'change_order' ? '/changeorders' : k === 'reimbursable' ? '/reimbursement' : '/fin_project',
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
  const scoped = all.filter((r) => !mine || r.canAct);
  const shown = scoped.filter((r) => kind === 'all' || r.kind === kind);
  const kinds = (Object.keys(KIND) as Kind[]).filter((k) => scoped.some((r) => r.kind === k));
  const oldest = scoped[0]?.since;

  return (
    <AkPage lead="Everything waiting on a decision — change orders, reimbursements and other finance items, daily reports, timesheets and workforce requests. Open one to approve it where it lives.">
      <AkStats items={[
        { key: 'all', label: mine ? 'Waiting on you' : 'Waiting', value: rows ? scoped.length : '—', sub: rows && oldest ? `oldest since ${new Date(oldest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : undefined, tone: scoped.length ? 'yellow' : undefined, onClick: () => setKind('all'), on: kind === 'all' },
        { key: 'fin', label: 'Finance', value: rows ? scoped.filter((r) => r.kind === 'change_order' || r.kind === 'reimbursable' || r.kind === 'finance').length : '—', sub: 'change orders, reimbursements, invoices' },
        { key: 'site', label: 'Site & people', value: rows ? scoped.filter((r) => r.kind === 'daily_report' || r.kind === 'timesheet' || r.kind === 'workforce').length : '—', sub: 'daily reports, timesheets, workforce' },
      ]} />

      <div className="ak-tools">
        <AkSeg<'all' | Kind> options={[['all', 'All', scoped.length], ...kinds.map((k) => [k, KIND[k], scoped.filter((r) => r.kind === k).length] as ['all' | Kind, string, number])]} value={kind} onChange={setKind} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)' }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Only what I can decide
        </label>
      </div>

      <section className="ak-card">
        {rows === null && <div className="ak-empty">Loading…</div>}
        {rows && !shown.length && <div className="ak-empty">Nothing is waiting{mine ? ' on you' : ''}.</div>}
        {shown.map((r, i) => (
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
