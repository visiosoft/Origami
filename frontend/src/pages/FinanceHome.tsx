import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { ACCENT, BG, DANGER, INK, MUTED, Badge, Drawer, card, fmtDate, headRow, input } from '../components/manpowerUi';
import { ProjectFinancials, ACTION_LABEL } from '../components/finance/ProjectFinancials';
import { ChangeOrderDrawer, ChangeOrderList } from '../components/finance/ChangeOrders';
import { ReimbursableDrawer, ReimbursableList } from '../components/finance/Reimbursables';
import { usd, usd0, type Rights } from '../components/finance/financeUi';
import { FinanceReports } from '../components/finance/Reports';

const PAPER = '#FBF8F2';
type Tab = 'approvals' | 'portfolio' | 'reports' | 'changes' | 'reimbursables' | 'audit';

interface Pending {
  type: 'change_order' | 'reimbursable' | 'retention_release' | 'invoice' | 'progress';
  id: string; projectId: number; projectName: string; title: string; detail: string; amount: number | null; since: string; canAct: boolean; itemKind?: string;
}
const TYPE_LABEL: Record<Pending['type'], [string, 'amber' | 'blue' | 'green' | 'grey' | 'red']> = {
  change_order: ['Change order', 'amber'], reimbursable: ['Reimbursable', 'grey'], retention_release: ['Retention release', 'blue'], invoice: ['Invoice', 'green'], progress: ['Progress', 'blue'],
};

/**
 * Finance across every project: what's waiting for a decision, the portfolio's
 * figures, the change order and reimbursable logs, and the audit trail. The
 * Change Orders and Reimbursement menu items open the same page on their tab.
 */
export function FinanceHome({ initial = 'approvals' }: { initial?: Tab }) {
  const navigate = useNavigate();
  const [rights, setRights] = useState<Rights | null>(null);
  const [tab, setTab] = useState<Tab>(initial);
  const [project, setProject] = useState<{ id: number; name: string } | null>(null);
  useEffect(() => { api.finance.access().then((r: any) => setRights(r)).catch(() => setRights(null)); }, []);
  useEffect(() => { setTab(initial); }, [initial]);

  const tabs = ([
    ['approvals', 'Approvals', !!rights && (rights.view || rights.viewChangeOrders || rights.viewReimbursables)],
    ['portfolio', 'Project portfolio', !!rights?.view], ['reports', 'Reports', !!rights?.view], ['changes', 'Change orders', !!rights?.viewChangeOrders],
    ['reimbursables', 'Reimbursables', !!rights?.viewReimbursables], ['audit', 'Audit log', !!rights?.view],
  ] as [Tab, string, boolean][]).filter((t) => t[2]);
  const title = initial === 'changes' ? 'Change Orders' : initial === 'reimbursables' ? 'Reimbursement' : 'Project Finance';
  const blurb = initial === 'changes' ? 'Every change order across projects — priced, reviewed, sent to the client and approved into the contract.'
    : initial === 'reimbursables' ? 'Expenses incurred for clients: submitted with receipts, approved, and billed back at cost plus markup.'
      : 'Contracts, billing and collections across every project, and everything waiting for a decision.';

  return (
    <div style={{ padding: '28px 32px', background: PAPER, minHeight: '100%' }}>
      <h1 style={{ fontFamily: BG, fontWeight: 700, fontSize: 24, color: INK, margin: 0 }}>{title}</h1>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: MUTED }}>{blurb} <span onClick={() => navigate('/help/finance')} style={{ color: ACCENT, fontWeight: 700, cursor: 'pointer' }}>New to this? Read the Finance guide →</span></p>
      {!rights ? <div style={{ marginTop: 20, fontSize: 13, color: MUTED }}>Loading…</div> : !tabs.length ? (
        <div style={{ ...card, padding: 20, marginTop: 20, fontSize: 13, color: MUTED }}>Your role doesn't include project finance, change orders or reimbursables.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(20,8,31,.09)', margin: '18px 0 20px' }}>
            {tabs.map(([k, l]) => (
              <div key={k} onClick={() => setTab(k)} style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: tab === k ? ACCENT : MUTED, borderBottom: '2px solid ' + (tab === k ? ACCENT : 'transparent'), marginBottom: -1 }}>{l}</div>
            ))}
          </div>
          {tab === 'approvals' && <Approvals rights={rights} onProject={setProject} />}
          {tab === 'portfolio' && <Portfolio onProject={setProject} />}
          {tab === 'reports' && <FinanceReports rights={rights} onProject={setProject} />}
          {tab === 'changes' && <ChangeOrderList rights={rights} />}
          {tab === 'reimbursables' && <ReimbursableList rights={rights} />}
          {tab === 'audit' && <Audit />}
        </>
      )}
      {project && (
        <Drawer title={project.name} subtitle="Project financials" width={1400} onClose={() => setProject(null)}>
          <ProjectFinancials projectId={project.id} />
        </Drawer>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ approvals inbox

function Approvals({ rights, onProject }: { rights: Rights; onProject: (p: { id: number; name: string }) => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<Pending[] | null>(null);
  const [co, setCo] = useState<string | null>(null);
  const [re, setRe] = useState<string | null>(null);
  const [mine, setMine] = useState(true);
  const load = () => api.finance.approvals().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch((e: any) => { setRows([]); toast('⚠ ' + (e.message || 'Could not load approvals')); });
  useEffect(() => { load(); }, []);
  const shown = (rows || []).filter((r) => !mine || r.canAct);
  const cols = '150px minmax(160px,1fr) minmax(220px,2fr) 120px 110px 110px';
  const open = (p: Pending) => {
    if (p.type === 'change_order') setCo(p.id);
    else if (p.type === 'reimbursable') setRe(p.id);
    else onProject({ id: p.projectId, name: p.projectName });
  };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Only what I can decide</label>
        <span style={{ fontSize: 12, color: MUTED }}>{rows ? `${shown.length} waiting` : ''}</span>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 900 }}>
            <div style={headRow(cols)}><span>Type</span><span>Project</span><span>What</span><span style={{ textAlign: 'right' }}>Amount</span><span>Waiting since</span><span /></div>
            {rows === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((p) => (
              <div key={p.type + p.id} onClick={() => open(p)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, cursor: 'pointer' }}>
                <span><Badge tone={TYPE_LABEL[p.type][1]}>{TYPE_LABEL[p.type][0]}</Badge></span>
                <span style={{ color: MUTED }}>{p.projectName}</span>
                <span><b>{p.title}</b><div style={{ fontSize: 11.5, color: MUTED }}>{p.detail}</div></span>
                <b style={{ textAlign: 'right' }}>{p.amount != null ? usd(p.amount) : ''}</b>
                <span style={{ color: MUTED }}>{fmtDate(p.since)}</span>
                <span style={{ textAlign: 'right', color: p.canAct ? ACCENT : MUTED, fontWeight: 700 }}>{p.canAct ? 'Review →' : 'View'}</span>
              </div>
            ))}
            {rows && !shown.length && <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>Nothing is waiting for {mine ? 'you' : 'anyone'}.</div>}
          </div>
        </div>
      </div>
      {co && <ChangeOrderDrawer id={co} rights={rights} onClose={() => { setCo(null); load(); }} onChanged={load} />}
      {re && <ReimbursableDrawer id={re} rights={rights} onClose={() => { setRe(null); load(); }} onChanged={() => load()} />}
    </div>
  );
}

// ------------------------------------------------------------------ portfolio

function Portfolio({ onProject }: { onProject: (p: { id: number; name: string }) => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api.finance.portfolio().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch((e: any) => { setRows([]); toast('⚠ ' + (e.message || 'Could not load')); }); }, []);
  const cols = 'minmax(200px,1.6fr) 125px 115px 115px 115px 115px 125px 115px 115px';
  const costs = (rows || []).some((r) => r.committed != null);
  const sum = (k: string) => (rows || []).reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const num = (n: number, tone?: string) => <span style={{ textAlign: 'right', color: tone }}>{usd0(n)}</span>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {rows && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          {[
            ['Client contracts', sum('revisedContract'), `${rows.filter((r) => r.hasClientContract).length} projects billed to clients`], ['Billed to clients', sum('contractWorkInvoiced'), ''],
            ['Received from clients', sum('paid'), ''], ['Clients owe', sum('arOutstanding'), `${usd0(sum('overdue'))} overdue`],
            ...(costs ? [['Committed to subs & vendors', sum('committed'), ''], ['Paid out', sum('paidOut'), ''], ['Still to pay', sum('stillToPay'), '']] : []),
            ['Pending change orders', sum('pendingChanges'), ''],
          ].map(([l, v, sub]) => (
            <div key={l as string} style={{ ...card, padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
              <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: INK, marginTop: 2 }}>{usd0(v as number)}</div>
              {sub && <div style={{ fontSize: 11.5, color: MUTED }}>{sub}</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 1180 }}>
            <div style={headRow(cols)}>
              <span>Project</span><span style={{ textAlign: 'right' }}>Client contract</span><span style={{ textAlign: 'right' }}>Billed</span><span style={{ textAlign: 'right' }}>Received</span>
              <span style={{ textAlign: 'right' }}>Client owes</span><span style={{ textAlign: 'right' }}>Done, not billed</span><span style={{ textAlign: 'right' }}>Committed to subs</span>
              <span style={{ textAlign: 'right' }}>Paid out</span><span style={{ textAlign: 'right' }}>Still to pay</span>
            </div>
            {rows === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {(rows || []).map((r) => (
              <div key={r.projectId} onClick={() => onProject({ id: r.projectId, name: r.name })} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, cursor: 'pointer' }}>
                <span><b>{r.name}</b><div style={{ fontSize: 11, color: MUTED }}>{r.stage}{r.hasClientContract ? (r.approvedChanges ? ` · COs ${usd0(r.approvedChanges)}` : '') : ' · no client contract (outsourced / internal)'}</div></span>
                {r.hasClientContract ? <>
                  {num(r.revisedContract)}{num(r.contractWorkInvoiced)}{num(r.paid)}
                  <span style={{ textAlign: 'right', color: r.overdueCount ? DANGER : undefined }}>{usd0(r.arOutstanding)}{r.overdueCount ? <div style={{ fontSize: 11 }}>{usd0(r.overdue)} overdue</div> : null}</span>
                  {num(r.unbilledEarned, r.unbilledEarned < 0 ? DANGER : r.unbilledEarned > 0 ? '#8A6D12' : undefined)}
                </> : <><span style={{ textAlign: 'right', color: MUTED }}>—</span><span /><span /><span /><span /></>}
                {r.committed != null ? <>{num(r.committed)}{num(r.paidOut)}{num(r.stillToPay, r.stillToPay ? '#8A6D12' : undefined)}</> : <><span /><span /><span /></>}
              </div>
            ))}
            {rows && !rows.length && <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No project has its financials set up yet — open a project and use its Financial tab.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ audit

const ENTITY_TYPES: [string, string][] = [
  ['', 'Everything'], ['project', 'Contract & settings'], ['phase', 'Milestones'], ['task', 'Tasks'], ['invoice', 'Invoices & credit notes'], ['payment', 'Payments'],
  ['change_order', 'Change orders'], ['reimbursable', 'Reimbursables'], ['retention_release', 'Retention releases'],
  ['budget', 'Cost budget'], ['commitment', 'Subcontracts & POs'], ['cost', 'Costs'], ['forecast', 'Cost forecasts'],
];

function Audit() {
  const { toast } = useApp();
  const [q, setQ] = useState({ projectId: '', entityType: '', by: '' });
  const [rows, setRows] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { api.projects.list().then((r: any) => setProjects(Array.isArray(r) ? r.map((p: any) => ({ id: p.id, name: p.name })) : [])).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(q)) if (v) params[k] = v;
      api.finance.audit(params).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch((e: any) => { setRows([]); toast('⚠ ' + (e.message || 'Could not load')); });
    }, 250);
    return () => clearTimeout(t);
  }, [q.projectId, q.entityType, q.by]);
  const show = (v: unknown) => (v == null || v === '' ? '—' : String(v));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={q.projectId} onChange={(e) => setQ({ ...q, projectId: e.target.value })} style={{ ...input, width: 220 }}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={q.entityType} onChange={(e) => setQ({ ...q, entityType: e.target.value })} style={{ ...input, width: 220 }}>{ENTITY_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input value={q.by} onChange={(e) => setQ({ ...q, by: e.target.value })} placeholder="Person" style={{ ...input, width: 180 }} />
        <span style={{ fontSize: 12, color: MUTED, alignSelf: 'center' }}>{rows ? `${rows.length} entries${rows.length >= 500 ? ' (latest 500)' : ''}` : ''}</span>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {rows === null && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>Loading…</div>}
        {(rows || []).map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 12, padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5 }}>
            <span style={{ width: 150, color: MUTED, flexShrink: 0 }}>{new Date(a.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            <span style={{ width: 180, color: MUTED, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.projectName}</span>
            <span style={{ flex: 1, lineHeight: 1.6 }}>
              <b>{a.byName}</b> · {ACTION_LABEL[a.action] || a.action}
              {a.changes && <span style={{ color: MUTED }}> — {Object.entries(a.changes).map(([k, c]: any) => `${k}: ${show(c.from)} → ${show(c.to)}`).join('; ')}</span>}
              {a.reason && <span style={{ color: INK }}> · “{a.reason}”</span>}
            </span>
          </div>
        ))}
        {rows && !rows.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Nothing recorded.</div>}
      </div>
    </div>
  );
}

