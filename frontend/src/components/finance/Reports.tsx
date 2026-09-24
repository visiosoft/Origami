import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, btn, card, fmtDate, headRow, input, todayISO } from '../manpowerUi';
import { CO_REASONS, CoBadge, downloadCsv, failed, label, usd0, type Rights } from './financeUi';

type ReportKey = 'wip' | 'ar-aging' | 'budget-vs-actual' | 'change-orders' | 'retention' | 'contract-vs-invoiced' | 'cash-forecast';
const REPORTS: [ReportKey, string, string, keyof Rights][] = [
  ['wip', 'WIP schedule', 'Over and under billing, cost-to-cost', 'viewProfitability'],
  ['ar-aging', 'AR aging', 'What clients owe, by how late', 'view'],
  ['budget-vs-actual', 'Budget vs actual', 'Cost budget, committed to subs, spent and forecast', 'viewProfitability'],
  ['cash-forecast', 'Cash forecast', 'Money in and out by month', 'view'],
  ['contract-vs-invoiced', 'Contract vs billed', 'Client contracts: work done, billed and received', 'view'],
  ['change-orders', 'Change order register', 'Every change order and its turnaround', 'viewChangeOrders'],
  ['retention', 'Retention', 'Accrued, released and held', 'view'],
];

/** Column spec: key, heading, kind (money columns right-aligned and totalled). */
type Col = [string, string, ('money' | 'text' | 'date' | 'pct' | 'num')?];

function Table({ cols, rows, total, onRow, extra }: { cols: Col[]; rows: Record<string, any>[]; total?: boolean; onRow?: (r: any) => void; extra?: (r: any, k: string) => React.ReactNode }) {
  const tpl = cols.map(([, , t], i) => (i === 0 ? 'minmax(180px,1.6fr)' : t === 'text' ? 'minmax(120px,1fr)' : '120px')).join(' ');
  const cell = (r: any, [k, , t]: Col) => {
    const x = extra?.(r, k);
    if (x !== undefined) return x;
    const v = r[k];
    if (t === 'money') return <span style={{ textAlign: 'right', color: v < 0 ? DANGER : undefined }}>{v == null ? '—' : usd0(v)}</span>;
    if (t === 'pct') return <span style={{ textAlign: 'right' }}>{v == null ? '—' : `${v}%`}</span>;
    if (t === 'num') return <span style={{ textAlign: 'right' }}>{v ?? '—'}</span>;
    if (t === 'date') return <span>{v ? fmtDate(v) : '—'}</span>;
    return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v ?? '—'}</span>;
  };
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: Math.max(800, cols.length * 125) }}>
          <div style={headRow(tpl)}>{cols.map(([k, l, t]) => <span key={k} style={{ textAlign: t === 'money' || t === 'pct' || t === 'num' ? 'right' : 'left' }}>{l}</span>)}</div>
          {rows.map((r, i) => (
            <div key={i} onClick={onRow ? () => onRow(r) : undefined} style={{ display: 'grid', gridTemplateColumns: tpl, gap: 10, alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(20,8,31,.05)', fontSize: 12.5, cursor: onRow ? 'pointer' : 'default' }}>
              {cols.map((c) => <span key={c[0]} style={{ display: 'contents' }}>{cell(r, c)}</span>)}
            </div>
          ))}
          {!rows.length && <div style={{ padding: 20, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>Nothing to report.</div>}
          {total && rows.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: 10, padding: '9px 14px', borderTop: '1px solid ' + LINE, background: '#F4F1E8', fontSize: 12.5, fontWeight: 700 }}>
              {cols.map(([k, , t], i) => <span key={k} style={{ textAlign: t === 'money' ? 'right' : 'left' }}>{i === 0 ? 'Total' : t === 'money' ? usd0(rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)) : ''}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Financial reports across projects, each exportable to CSV. Figures come from
 * the same calculations as the project screens.
 */
export function FinanceReports({ rights, onProject }: { rights: Rights; onProject: (p: { id: number; name: string }) => void }) {
  const { toast } = useApp();
  const available = REPORTS.filter((r) => rights[r[3]]);
  const [key, setKey] = useState<ReportKey>(available[0]?.[0] || 'ar-aging');
  const [asOf, setAsOf] = useState(todayISO());
  const [months, setMonths] = useState('6');
  // Data is kept with the report it belongs to, so a report never renders another report's figures while its own load.
  const [loaded, setLoaded] = useState<{ key: ReportKey; v: any } | null>(null);
  const data = loaded?.key === key ? loaded.v : null;
  useEffect(() => {
    const q: Record<string, string> = key === 'ar-aging' ? { asOf } : key === 'cash-forecast' ? { months } : {};
    api.finance.report(key, q).then((v) => setLoaded({ key, v })).catch((e: any) => { setLoaded({ key, v: { error: true } }); failed(toast, e); });
  }, [key, asOf, months]);
  const open = (r: any) => r.projectId && onProject({ id: r.projectId, name: r.name || r.projectName });

  let cols: Col[] = [];
  let rows: any[] = [];
  let note = '';
  if (data && !data.error) {
    if (key === 'wip') {
      cols = [['name', 'Project'], ['contract', 'Contract', 'money'], ['projectedCost', 'Forecast cost', 'money'], ['projectedMargin', 'Proj. margin', 'money'], ['projectedMarginPct', 'Margin %', 'pct'],
        ['costToDate', 'Cost to date', 'money'], ['costCompletePct', '% complete', 'pct'], ['earnedRevenue', 'Revenue to date', 'money'], ['billed', 'Billed to client', 'money'], ['overUnderBilling', 'Over / (under)', 'money']];
      rows = data.rows; note = `Cost-to-cost: % complete = cost to date ÷ forecast cost; earned revenue = contract × % complete. Over-billing is a liability, under-billing an asset. Reimbursables are excluded.${data.withoutCosts?.length ? ` Not shown — no cost budget or costs yet: ${data.withoutCosts.join(', ')}.` : ''}`;
    } else if (key === 'ar-aging') {
      cols = [['name', 'Project'], ['current', 'Current', 'money'], ['d1_30', '1–30 days', 'money'], ['d31_60', '31–60', 'money'], ['d61_90', '61–90', 'money'], ['d90_plus', '90+', 'money'], ['total', 'Total', 'money']];
      rows = data.projects;
    } else if (key === 'budget-vs-actual') {
      cols = [['name', 'Project'], ['budget', 'Budget', 'money'], ['committed', 'Committed', 'money'], ['actual', 'Actual', 'money'], ['labor', 'of which labor', 'money'], ['open', 'Open commitments', 'money'], ['eac', 'Forecast', 'money'], ['variance', 'Variance', 'money']];
      rows = data.rows; note = 'Open a project to see its budget by cost code (Financial tab → Job cost).';
    } else if (key === 'contract-vs-invoiced') {
      cols = [['name', 'Project'], ['original', 'Original', 'money'], ['changes', 'Changes', 'money'], ['revised', 'Revised', 'money'], ['ev', 'Work done', 'money'], ['invoiced', 'Billed', 'money'],
        ['billedPct', 'Billed %', 'pct'], ['unbilled', 'Done, not billed', 'money'], ['paid', 'Received', 'money'], ['outstanding', 'Client owes', 'money']];
      rows = data.rows;
    } else if (key === 'change-orders') {
      cols = [['number', 'CO'], ['projectName', 'Project', 'text'], ['title', 'Title', 'text'], ['reason', 'Reason', 'text'], ['status', 'Status', 'text'], ['amount', 'Amount', 'money'], ['cost', 'Cost', 'money'],
        ['scheduleImpactDays', 'Days', 'num'], ['dateRequested', 'Requested', 'date'], ['approvedDate', 'Approved', 'date'], ['daysToApprove', 'Turnaround', 'num']];
      rows = Array.isArray(data) ? data : [];
    } else if (key === 'retention') {
      cols = [['name', 'Project'], ['accrued', 'Accrued', 'money'], ['released', 'Released', 'money'], ['held', 'Held', 'money'], ['open', 'Release in progress', 'money'], ['openCount', 'Open releases', 'num']];
      rows = data.rows;
    } else if (key === 'cash-forecast') {
      cols = [['month', 'Month'], ['in', 'Coming in', 'money'], ...(data.showCosts ? [['out', 'Going out', 'money'] as Col, ['net', 'Net', 'money'] as Col, ['cumulative', 'Cumulative', 'money'] as Col] : [])];
      rows = data.months.map((m: any) => ({ ...m, month: new Date(m.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }));
      note = `Coming in: open invoices by due date (anything overdue counts this month).${data.showCosts ? ' Going out: recorded and approved bills not yet paid, by due date. Payroll is paid through payroll and isn’t repeated here.' : ''}`;
    }
  }
  const exportCsv = () => downloadCsv(`${key}-${todayISO()}`, cols.map(([k, l]) => [k, l]), rows);
  const exportInvoices = () => downloadCsv(`ar-aging-invoices-${asOf}`, [['projectName', 'Project'], ['number', 'Invoice'], ['billTo', 'Bill to'], ['invoiceDate', 'Date'], ['dueDate', 'Due'], ['daysPastDue', 'Days past due'], ['bucket', 'Bucket'], ['total', 'Total'], ['outstanding', 'Outstanding']], data?.invoices || []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 18, alignItems: 'start' }}>
      <div style={{ ...card, overflow: 'hidden' }}>
        {available.map(([k, l, d]) => (
          <div key={k} onClick={() => setKey(k)} style={{ padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer', background: key === k ? '#E7F0E8' : 'white' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: key === k ? ACCENT : INK }}>{l}</div>
            <div style={{ fontSize: 11.5, color: MUTED }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, flex: 1 }}>{REPORTS.find((r) => r[0] === key)?.[1]}</div>
          {key === 'ar-aging' && <><span style={{ fontSize: 12, color: MUTED }}>As of</span><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ ...input, width: 160 }} /></>}
          {key === 'cash-forecast' && <select value={months} onChange={(e) => setMonths(e.target.value)} style={{ ...input, width: 140 }}>{['3', '6', '12'].map((m) => <option key={m} value={m}>{m} months</option>)}</select>}
          {key === 'ar-aging' && <div onClick={exportInvoices} style={btn()}>Export invoices</div>}
          <div onClick={exportCsv} style={btn()}>Export CSV</div>
        </div>
        {!data && <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>}
        {data && !data.error && key === 'ar-aging' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {[['current', 'Current'], ['d1_30', '1–30 days'], ['d31_60', '31–60 days'], ['d61_90', '61–90 days'], ['d90_plus', '90+ days'], ['total', 'Total owed']].map(([k, l]) => (
              <div key={k} style={{ ...card, padding: '10px 14px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
                <div style={{ fontFamily: BG, fontSize: 18, fontWeight: 700, color: k !== 'current' && k !== 'total' && data.totals[k] > 0 ? DANGER : INK }}>{usd0(data.totals[k])}</div>
              </div>
            ))}
          </div>
        )}
        {data && !data.error && key === 'cash-forecast' && (
          <div style={{ ...card, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-end', height: 150 }}>
            {data.months.map((m: any) => {
              const max = Math.max(1, ...data.months.map((x: any) => Math.max(x.in, x.out)));
              return (
                <div key={m.month} style={{ flex: 1, display: 'grid', gap: 4, justifyItems: 'center' }} title={`${m.month}: in ${usd0(m.in)}, out ${usd0(m.out)}`}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 110 }}>
                    <div style={{ width: 16, height: Math.max(2, (m.in / max) * 110), background: '#2F7D4A', borderRadius: 3 }} />
                    {data.showCosts && <div style={{ width: 16, height: Math.max(2, (m.out / max) * 110), background: '#C8876A', borderRadius: 3 }} />}
                  </div>
                  <span style={{ fontSize: 10.5, color: MUTED }}>{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </div>
              );
            })}
          </div>
        )}
        {data && !data.error && <Table cols={cols} rows={rows} total={key !== 'cash-forecast' && key !== 'change-orders'} onRow={key !== 'cash-forecast' && key !== 'change-orders' ? open : undefined}
          extra={(r, k) => (key === 'change-orders' && k === 'status' ? <span><CoBadge s={r.status} /></span> : key === 'change-orders' && k === 'reason' ? <span style={{ color: MUTED }}>{label(CO_REASONS, r.reason)}</span> : undefined)} />}
        {data && !data.error && key === 'ar-aging' && data.invoices.length > 0 && (
          <Table cols={[['number', 'Invoice'], ['projectName', 'Project', 'text'], ['billTo', 'Bill to', 'text'], ['dueDate', 'Due', 'date'], ['daysPastDue', 'Days late', 'num'], ['outstanding', 'Owed', 'money']]} rows={data.invoices} />
        )}
        {note && <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>{note}</div>}
      </div>
    </div>
  );
}
