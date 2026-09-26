import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const INK = '#0B1A12';
const MUTED = '#7E9B93';
const BG = "'Bricolage Grotesque', serif";
const input: React.CSSProperties = { boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontSize: 13, fontFamily: 'inherit', background: 'white', color: INK };

interface Row {
  key: string; label: string; sub?: string; payslips: number;
  earnings: Record<string, number>; gross: number; taxes: Record<string, number>; taxTotal: number;
  deductions: Record<string, number>; deductionTotal: number; net: number; paid: number; unpaid: number;
}
interface Report {
  from: string; to: string; includeDrafts: boolean;
  runs: { id: string; label: string; periodStart: string; periodEnd: string; status: string; headcount: number }[];
  columns: { earnings: string[]; taxes: string[]; deductions: string[] };
  byEmployee: Row[]; byRun: Row[]; totals: Row;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function range(preset: string): [string, string] {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  const q = Math.floor(m / 3);
  switch (preset) {
    case 'this_month': return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
    case 'last_month': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case 'this_quarter': return [iso(new Date(y, q * 3, 1)), iso(new Date(y, q * 3 + 3, 0))];
    case 'last_quarter': return [iso(new Date(y, q * 3 - 3, 1)), iso(new Date(y, q * 3, 0))];
    case 'last_year': return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    default: return [`${y}-01-01`, iso(now)]; // year to date
  }
}
const PRESETS: [string, string][] = [['ytd', 'Year to date'], ['this_month', 'This month'], ['last_month', 'Last month'], ['this_quarter', 'This quarter'], ['last_quarter', 'Last quarter'], ['last_year', 'Last year'], ['custom', 'Custom…']];

/**
 * Payroll reports (Manpower -> Payroll -> Reports): what was paid and what
 * was withheld, by employee or by pay run, for a period -- federal and state
 * withholding, Social Security and Medicare apart from other deductions
 * (insurance, advance and loan repayments). From finalized payslips, as paid.
 */
export function PayrollReports({ employees, currency = 'USD' }: { employees: { id: string; name: string }[]; currency?: string }) {
  const [preset, setPreset] = useState('ytd');
  const [[from, to], setRange] = useState<[string, string]>(range('ytd'));
  const [employeeId, setEmployeeId] = useState('');
  const [drafts, setDrafts] = useState(false);
  const [view, setView] = useState<'employee' | 'run'>('employee');
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const money = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }), [currency]);
  const fmt = (n?: number) => (n ? money.format(n) : '—');

  useEffect(() => {
    setError('');
    const qs = new URLSearchParams({ from, to, ...(employeeId ? { employeeId } : {}), ...(drafts ? { drafts: '1' } : {}) });
    api.payroll.report(qs.toString()).then((x) => setR(x as Report)).catch((e: Error) => { setR(null); setError(e.message); });
  }, [from, to, employeeId, drafts]);

  const rows = r ? (view === 'employee' ? r.byEmployee : r.byRun) : [];
  const cols = r?.columns || { earnings: [], taxes: [], deductions: [] };

  const exportCsv = () => {
    if (!r) return;
    const head = [view === 'employee' ? 'Employee' : 'Pay run', view === 'employee' ? 'Worker ID / department' : 'Period', 'Payslips',
      ...cols.earnings, 'Gross pay', ...cols.taxes, 'Total taxes withheld', ...cols.deductions, 'Total other deductions', 'Net pay', 'Paid', 'Unpaid'];
    const line = (x: Row) => [x.label, x.sub || '', x.payslips, ...cols.earnings.map((c) => x.earnings[c] || 0), x.gross, ...cols.taxes.map((c) => x.taxes[c] || 0), x.taxTotal,
      ...cols.deductions.map((c) => x.deductions[c] || 0), x.deductionTotal, x.net, x.paid, x.unpaid];
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [head, ...rows.map(line), line({ ...r.totals, label: 'Total', sub: '' })].map((l) => l.map(esc).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `Payroll ${view === 'employee' ? 'by employee' : 'by pay run'} ${r.from} to ${r.to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(20,8,31,0.1)', whiteSpace: 'nowrap', background: 'white', position: 'sticky', top: 0 };
  const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontSize: 12.5, color: '#43514D', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid rgba(20,8,31,0.05)' };
  const group = (label: string, span: number, color: string) => span > 0 && <th colSpan={span} style={{ ...th, textAlign: 'center', color, borderBottom: '2px solid ' + color }}>{label}</th>;
  const body = (x: Row, bold = false) => {
    const st = bold ? { ...td, fontWeight: 700, color: INK, background: '#FBF8F2' } : td;
    return (
      <tr key={x.key}>
        <td style={{ ...st, textAlign: 'left', position: 'sticky', left: 0, background: bold ? '#FBF8F2' : 'white' }}>
          <div style={{ fontWeight: 600, color: INK }}>{x.label}</div>{x.sub && <div style={{ fontSize: 11, color: MUTED }}>{x.sub}</div>}
        </td>
        <td style={st}>{x.payslips}</td>
        {cols.earnings.map((c) => <td key={'e' + c} style={st}>{fmt(x.earnings[c])}</td>)}
        <td style={{ ...st, fontWeight: 700, color: INK }}>{fmt(x.gross)}</td>
        {cols.taxes.map((c) => <td key={'t' + c} style={st}>{fmt(x.taxes[c])}</td>)}
        <td style={{ ...st, fontWeight: 700, color: '#8E2E0A' }}>{fmt(x.taxTotal)}</td>
        {cols.deductions.map((c) => <td key={'d' + c} style={st}>{fmt(x.deductions[c])}</td>)}
        <td style={{ ...st, fontWeight: 700, color: '#93520F' }}>{fmt(x.deductionTotal)}</td>
        <td style={{ ...st, fontWeight: 700, color: '#1E6B36' }}>{fmt(x.net)}</td>
        <td style={st}>{fmt(x.paid)}</td>
        <td style={{ ...st, color: x.unpaid ? '#8E2E0A' : st.color }}>{fmt(x.unpaid)}</td>
      </tr>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={preset} onChange={(e) => { setPreset(e.target.value); if (e.target.value !== 'custom') setRange(range(e.target.value)); }} style={input}>
          {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {preset === 'custom' && <>
          <input type="date" value={from} onChange={(e) => setRange([e.target.value, to])} style={input} />
          <span style={{ color: MUTED }}>to</span>
          <input type="date" value={to} onChange={(e) => setRange([from, e.target.value])} style={input} />
        </>}
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ ...input, maxWidth: 220 }}>
          <option value="">All employees</option>
          {[...employees].sort((a, b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#43514D' }}>
          <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} /> Include draft runs
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {([['employee', 'By employee'], ['run', 'By pay run']] as const).map(([k, l]) => (
            <span key={k} onClick={() => setView(k)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: view === k ? '#173326' : 'white', color: view === k ? 'white' : '#43514D', border: '1px solid ' + (view === k ? '#173326' : 'rgba(20,8,31,0.12)') }}>{l}</span>
          ))}
          <span onClick={exportCsv} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: r?.totals.payslips ? 'pointer' : 'default', border: '1px solid rgba(20,8,31,0.12)', color: '#173326', opacity: r?.totals.payslips ? 1 : 0.5 }}>Export CSV</span>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7E4DB', fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>{error}</div>}

      {r && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {([['Gross pay', r.totals.gross, INK], ['Taxes withheld', r.totals.taxTotal, '#8E2E0A'], ['Other deductions', r.totals.deductionTotal, '#93520F'], ['Net pay', r.totals.net, '#1E6B36'], ['Not yet paid', r.totals.unpaid, r.totals.unpaid ? '#8E2E0A' : INK]] as [string, number, string][]).map(([l, v, c]) => (
              <div key={l} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
                <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: c, marginTop: 2 }}>{money.format(v || 0)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>
            {r.runs.length} pay run{r.runs.length === 1 ? '' : 's'} ending {r.from} – {r.to}{r.includeDrafts ? ' (drafts included — not final)' : ''} · {r.totals.payslips} payslip{r.totals.payslips === 1 ? '' : 's'}
          </div>
          {!rows.length ? (
            <div style={{ padding: '26px 20px', textAlign: 'center', fontSize: 13, color: MUTED, background: '#FBF8F2', borderRadius: 12 }}>No finalized payroll in this period{drafts ? '' : ' — tick “Include draft runs” to preview drafts'}.</div>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: '65vh', background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12 }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{ ...th, left: 0, zIndex: 2 }} />
                    {group('Earnings', cols.earnings.length + 1, INK)}
                    {group('Taxes withheld', cols.taxes.length + 1, '#8E2E0A')}
                    {group('Other deductions', cols.deductions.length + 1, '#93520F')}
                    <th colSpan={3} style={th} />
                  </tr>
                  <tr>
                    <th style={{ ...th, textAlign: 'left', left: 0, zIndex: 2 }}>{view === 'employee' ? 'Employee' : 'Pay run'}</th>
                    <th style={th}>Slips</th>
                    {cols.earnings.map((c) => <th key={'e' + c} style={th}>{c}</th>)}<th style={th}>Gross</th>
                    {cols.taxes.map((c) => <th key={'t' + c} style={th}>{c}</th>)}<th style={th}>Total</th>
                    {cols.deductions.map((c) => <th key={'d' + c} style={th}>{c}</th>)}<th style={th}>Total</th>
                    <th style={th}>Net pay</th><th style={th}>Paid</th><th style={th}>Unpaid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => body(x))}
                  {body({ ...r.totals, label: 'Total', sub: undefined }, true)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
