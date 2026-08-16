import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { MyTasks } from '../components/MyTasks';
import {
  FINANCE, INVOICES, REVENUE_BASE, FUNNEL, TEAM, DEADLINES, ACTIVITY, HELP_CONTENT,
  enrichInvoices, money, type EnrichedInvoice,
} from '../data/dashboard';

const BG = "'Bricolage Grotesque', serif";
const ocRamp = ['#C7D8CB', '#8AAE95', '#3E8558', '#173326'];
const INVC = '#7E9B93';
const COLC = '#173326';
const OUTC = '#D2822E';

interface Tip { key: string; title: string; rows: (readonly [string, string] | null)[]; accent: string; x: number; y: number }

function Card({ children, extra }: { children: ReactNode; extra?: CSSProperties }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', padding: 18, ...extra }}>
      {children}
    </div>
  );
}

const mini = (t: string) => (
  <div style={{ fontSize: 9, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{t}</div>
);

function Hdr({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, rowGap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <div>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 14.5, color: '#0B1A12', letterSpacing: '-0.01em' }}>{title}</div>
        {sub && <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 3 }}>{sub}</div>}
      </div>
      {right ?? null}
    </div>
  );
}

const bandLabel = (t: string) => (
  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(11,26,18,0.32)', paddingLeft: 2 }}>{t}</div>
);

function Swatch({ c, label }: { c: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
      <span style={{ fontSize: 9.5, color: '#7E9B93', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { viewMode } = useApp();
  const vm = viewMode;
  const isClient = vm === 'client';
  const isCons = vm === 'consultant';

  const [winW, setWinW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
  const [execFilter, setExecFilter] = useState('all');
  const [dashKpi, setDashKpi] = useState('all');
  const [dashTeamFilter, setDashTeamFilter] = useState('all');
  const [dashHelp, setDashHelp] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState<string | null>(null);

  const narrow = winW < 620;
  const swallowDoc = useRef(false);

  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onDoc = () => {
      if (swallowDoc.current) {
        swallowDoc.current = false;
        return;
      }
      setTip((t) => (t ? null : t));
      setDashHelp((h) => (h ? null : h));
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const openTip = (e: React.MouseEvent, title: string, rows: (readonly [string, string] | null)[], accent: string) => {
    e.stopPropagation();
    swallowDoc.current = true;
    const key = title + '|' + rows.length;
    setTip((cur) => (cur && cur.key === key ? null : { key, title, rows, accent: accent || '#173326', x: e.clientX, y: e.clientY }));
  };

  let fin = FINANCE;
  if (isClient) fin = fin.slice(0, 2);
  else if (isCons) fin = fin.slice(0, 3);

  const execTypes: [string, string][] = [['all', 'All'], ['D', 'D'], ['DB', 'DB'], ['DBB', 'DBB'], ['B', 'B']];
  const ef = execFilter;
  const shown = ef === 'all' ? fin : fin.filter((f) => f.exec === ef);
  const sumBy = (arr: typeof fin, k: keyof (typeof fin)[number]) => arr.reduce((t, x) => t + (x[k] as number), 0);
  const rollContract = sumBy(shown, 'base') + sumBy(shown, 'co') + sumBy(shown, 'reimb');
  const rollUsed = sumBy(shown, 'baseUsed') + sumBy(shown, 'coUsed') + sumBy(shown, 'reimbUsed');
  const maxTotal = Math.max(...fin.map((f) => f.base + f.co + f.reimb));

  const kpi = dashKpi;
  const setKpi = (k: string) => () => setDashKpi(kpi === k ? 'all' : k);

  const kpiDefs = isClient
    ? [
        { k: 'projects', label: 'Your Projects', value: String(fin.length), sub: 'In design & construction', color: '#173326' },
        { k: 'money', label: 'Contract Value', value: money(rollContract), sub: Math.round((rollUsed / rollContract) * 100) + '% invoiced to date', color: '#2F7D4A' },
        { k: 'tasks', label: 'Awaiting You', value: '3', sub: '2 selections · 1 approval', color: '#D2822E' },
        { k: 'leads', label: 'Next Milestone', value: 'Sep 15', sub: 'Construction Docs 60%', color: '#245C3A' },
      ]
    : isCons
    ? [
        { k: 'projects', label: 'Assigned Projects', value: String(fin.length), sub: 'Active engagements', color: '#173326' },
        { k: 'money', label: 'Your Billings', value: '$186K', sub: '$41K awaiting payment', color: '#2F7D4A' },
        { k: 'tasks', label: 'Open Items', value: '11', sub: '2 past due · 4 this week', color: '#D2822E' },
        { k: 'leads', label: 'Bid Invitations', value: '4', sub: '2 due within 7 days', color: '#245C3A' },
      ]
    : [
        { k: 'projects', label: 'Active Projects', value: '7', sub: '1 signed · 5 design · 1 construction', color: '#173326', helpKey: 'projects' },
        { k: 'money', label: 'Contract Value', value: money(rollContract), sub: money(rollUsed) + ' used (' + Math.round((rollUsed / rollContract) * 100) + '%) · active only', color: '#2F7D4A', helpKey: 'money' },
        { k: 'tasks', label: 'Open Tasks', value: '32', sub: '18 open · 14 in progress', color: '#D2822E' },
        { k: 'leads', label: 'Lead Pipeline', value: '9', sub: '3 won · 1 lost · 5 live', color: '#245C3A' },
      ];

  const HelpPanel = ({ keyName }: { keyName: string }) => {
    const hc = HELP_CONTENT[keyName];
    return (
      <div style={{ position: 'absolute', top: 46, right: 10, width: 272, background: '#0F2417', color: 'white', borderRadius: 12, padding: '14px 16px', zIndex: 30, boxShadow: '0 16px 40px rgba(11,26,18,0.28)', animation: 'scaleIn 0.15s ease' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D9B94F', marginBottom: 8 }}>{hc.title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)', marginBottom: 12 }}>{hc.body}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {hc.rows.map((r) => (
            <div key={r[1]} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ minWidth: 18, height: 18, padding: '0 4px', borderRadius: 5, background: r[0] === 'OUT' ? 'rgba(184,65,15,0.35)' : 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 700, fontSize: 9, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{r[0]}</span>
              {r[1]}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ticks = [1, 0.75, 0.5, 0.25, 0];

  // ── Revenue derivation ──
  const invLedger = enrichInvoices(INVOICES[vm]);
  const revenueData = REVENUE_BASE[vm].map((r) => {
    const items = invLedger.filter((x) => x.month === r.month);
    return {
      month: r.month,
      invoiced: items.reduce((t, x) => t + x.amount, 0),
      collected: items.reduce((t, x) => t + x.paid, 0),
      items,
      open: items.filter((x) => x.unpaid > 0),
      pastDue: items.reduce((t, x) => t + x.pastDue, 0),
      withinTerms: items.reduce((t, x) => t + x.withinTerms, 0),
      retHeld: items.reduce((t, x) => t + x.retHeld, 0),
    };
  });
  const rawMax = Math.max(...revenueData.map((r) => Math.max(r.invoiced, r.collected)), 1);
  const step = rawMax > 100000 ? 50000 : rawMax > 40000 ? 20000 : 10000;
  const axisMax = Math.ceil(rawMax / step) * step;
  const gridVals: number[] = [];
  for (let v = axisMax; v >= 0; v -= step) gridVals.push(v);
  const CH = 150;
  const totInv = revenueData.reduce((t, r) => t + r.invoiced, 0);
  const totCol = revenueData.reduce((t, r) => t + r.collected, 0);
  const sumPastDue = invLedger.reduce((t, x) => t + x.pastDue, 0);
  const sumWithin = invLedger.reduce((t, x) => t + x.withinTerms, 0);
  const sumRet = invLedger.reduce((t, x) => t + x.retHeld, 0);

  // ── Funnel ──
  const funnelTitle = isClient ? 'Project Phase Progress' : isCons ? 'Bid & Award Funnel' : 'Lead Funnel';
  const funnelData = FUNNEL[vm];

  // ── Team ──
  const tf = dashTeamFilter;
  const teamShown = tf === 'all' ? TEAM : TEAM.filter((t) => t.kind === tf);

  // ── Deadlines / Activity ──
  const dl = kpi === 'all' ? DEADLINES : DEADLINES.filter((d) => d.domain === kpi);
  const act = kpi === 'all' ? ACTIVITY : ACTIVITY.filter((x) => x.domain === kpi);

  const dlCard = (title: string, items: typeof DEADLINES, accent: string) => (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
        <div style={{ width: 7, height: 7, borderRadius: 999, background: accent }} />
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 13.5 }}>{title}</div>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: accent, background: accent + '16', padding: '2px 7px', borderRadius: 999 }}>{items.length}</span>
      </div>
      {items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((d) => (
            <div key={d.task} onClick={() => navigate('/tasks')} style={{ padding: '9px 10px', borderRadius: 9, background: '#FBF8F2', borderLeft: '2px solid ' + accent, cursor: 'pointer' }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0B1A12', lineHeight: 1.35 }}>{d.task}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 9.5, color: '#7E9B93' }}>{d.project}</span>
                <span style={{ fontSize: 9.5, color: '#7E9B93' }}>·</span>
                <span style={{ fontSize: 9.5, color: '#7E9B93' }}>{d.owner}</span>
                <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: accent }}>{d.due}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#7E9B93', padding: '10px 0' }}>Nothing in this filter.</div>
      )}
    </Card>
  );

  const im = invoiceMonth;
  const drawerItems: EnrichedInvoice[] = im ? (im === 'all' ? invLedger.filter((x) => x.unpaid > 0) : invLedger.filter((x) => x.month === im && x.unpaid > 0)) : [];
  const drawerTot = drawerItems.reduce((t, x) => t + x.unpaid, 0);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <MyTasks />
      {bandLabel(isClient ? 'Your project at a glance' : 'Filter the dashboard')}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 10 }}>
        {kpiDefs.map((st) => (
          <div key={st.k} onClick={setKpi(st.k)} style={{ position: 'relative', background: 'white', borderRadius: 14, padding: '15px 16px', cursor: 'pointer', transition: 'all 0.15s', border: kpi === st.k ? '1px solid ' + st.color : '1px solid rgba(20,8,31,0.06)', boxShadow: kpi === st.k ? '0 0 0 3px ' + st.color + '18' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
              {mini(st.label)}
              {'helpKey' in st && st.helpKey && (
                <div onClick={(e) => { e.stopPropagation(); swallowDoc.current = true; setDashHelp(dashHelp === st.helpKey ? null : st.helpKey!); }} style={{ width: 15, height: 15, borderRadius: 999, background: dashHelp === st.helpKey ? '#173326' : '#DCE7DE', color: dashHelp === st.helpKey ? 'white' : '#173326', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', cursor: 'help' }}>?</div>
              )}
              <div style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: kpi === st.k ? st.color : 'rgba(11,26,18,0.2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{kpi === st.k ? 'Filtering' : 'Filter'}</div>
            </div>
            <div style={{ fontFamily: BG, fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em' }}>{st.value}</div>
            <div style={{ fontSize: 10.5, color: st.color, fontWeight: 600, marginTop: 4 }}>{st.sub}</div>
            {'helpKey' in st && st.helpKey && dashHelp === st.helpKey && <HelpPanel keyName={st.helpKey} />}
          </div>
        ))}
      </div>

      <div style={{ height: 5 }} />
      {bandLabel('Money · Schedule — high level')}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12, alignItems: 'start' }}>
        {/* Budget card */}
        <Card>
          <Hdr
            title={isClient ? 'Budget & Time Used — Your Projects' : 'Budget & Time vs Used by Project'}
            sub={isClient ? 'Contract, approved change orders and reimbursables' : 'Roll-up of ' + shown.length + ' of ' + fin.length + ' projects · filtered by execution type'}
            right={
              <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999, flexShrink: 0 }}>
                {execTypes.map((t) => (
                  <div key={t[0]} onClick={() => setExecFilter(t[0])} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', background: ef === t[0] ? 'white' : 'transparent', color: ef === t[0] ? '#0B1A12' : '#7E9B93', boxShadow: ef === t[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{t[1]}</div>
                ))}
              </div>
            }
          />
          <div style={{ position: 'relative' }}>
            {!narrow && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {ticks.map((f, i) => (
                  <div key={'v' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: f * 100 + '%', width: 1, background: f === 0 ? 'rgba(20,8,31,0.14)' : 'rgba(20,8,31,0.06)' }} />
                ))}
              </div>
            )}
            {!narrow && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, overflow: 'hidden' }}>
                {ticks.slice().reverse().map((f, i) => (
                  <span key={'t' + i} style={{ fontSize: 9, color: '#7E9B93', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(Math.round((maxTotal * f) / 50000) * 50000)}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {shown.map((f) => {
                const total = f.base + f.co + f.reimb;
                const used = f.baseUsed + f.coUsed + f.reimbUsed;
                const dPct = Math.round((used / total) * 100);
                const bp = Math.round((f.baseUsed / f.base) * 100);
                const cp = f.co ? Math.round((f.coUsed / f.co) * 100) : 0;
                const rp = f.reimb ? Math.round((f.reimbUsed / f.reimb) * 100) : 0;
                const hot = dPct >= 90 || f.timePct - dPct >= 25;
                const barW = narrow ? '100%' : (total / maxTotal) * 100 + '%';
                const pill = (txt: string, bg: string, col: string) => (
                  <span key={txt} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', background: bg, color: col, padding: '2px 5px', borderRadius: 4 }}>{txt}</span>
                );
                return (
                  <div key={f.name} style={{ cursor: 'pointer' }} onClick={(e) => openTip(e, f.name, [
                    ['Original contract', money(f.base) + '  ·  ' + bp + '% used'],
                    ['Change orders', f.co ? money(f.co) + '  ·  ' + cp + '% used' : 'none'],
                    ['Reimbursables', f.reimb ? money(f.reimb) + '  ·  ' + rp + '% used' : 'none'],
                    ['Total contract', money(total)],
                    ['Spent to date', money(used) + '  ·  ' + dPct + '%'],
                    ['Time used', f.timePct + '%'],
                    ['Phase', f.phase],
                    ['Execution / contract', f.exec + ' · ' + f.contract + ' · ' + f.labor],
                  ], hot ? '#8E2E0A' : '#173326')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, rowGap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0B1A12' }}>{f.name}</span>
                      {pill(f.exec, '#DCE7DE', '#173326')}
                      {pill(f.contract, '#D6E8E5', '#2F6F68')}
                      {pill(f.labor, '#FBE9AE', '#93520F')}
                      <span style={{ marginLeft: narrow ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', whiteSpace: 'nowrap' }}>{f.timePct}% Time Used</span>
                        <span style={{ fontSize: 10, color: 'rgba(11,26,18,0.22)' }}>|</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: hot ? '#8E2E0A' : '#173326', whiteSpace: 'nowrap' }}>{dPct}% $ Used</span>
                        {hot && <span style={{ fontSize: 10, fontWeight: 700, color: '#8E2E0A' }}>!</span>}
                      </span>
                    </div>
                    <div style={{ position: 'relative', width: barW, minWidth: '8%' }}>
                      <div style={{ position: 'relative', height: 17, background: '#DCE7DE', border: '1px solid rgba(23,51,38,0.18)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: (f.baseUsed / total) * 100 + '%', background: hot ? '#8E2E0A' : '#2F7D4A', transition: 'width 0.5s ease' }} />
                        <div style={{ width: (f.coUsed / total) * 100 + '%', background: hot ? '#8E2E0A' : '#2F7D4A', borderLeft: f.coUsed ? '1px solid rgba(255,255,255,0.55)' : 'none' }} />
                        <div style={{ width: (f.reimbUsed / total) * 100 + '%', background: hot ? '#8E2E0A' : '#2F7D4A', borderLeft: f.reimbUsed ? '1px solid rgba(255,255,255,0.55)' : 'none' }} />
                      </div>
                      <div style={{ position: 'absolute', top: -2, bottom: -2, left: f.timePct + '%', width: 2, background: '#0B1A12', transform: 'translateX(-1px)' }} />
                      <div style={{ position: 'absolute', top: '100%', left: f.timePct + '%', transform: 'translateX(-5px)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '6px solid #0B1A12' }} />
                    </div>
                    <div style={{ width: barW, minWidth: '8%', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ flex: 1, height: 13, background: '#EDF2ED', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ height: '50%', width: Math.min(f.timePct, 100) + '%', background: '#7E9B93', transition: 'width 0.5s ease' }} />
                          <div style={{ height: '50%', width: Math.min(dPct, 100) + '%', background: hot ? '#8E2E0A' : '#2F7D4A', transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#7E9B93', flexShrink: 0, whiteSpace: 'nowrap' }}>{f.timePct}% time</span>
                        <span style={{ fontSize: 9, color: 'rgba(11,26,18,0.22)' }}>|</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: hot ? '#8E2E0A' : '#2F7D4A', flexShrink: 0, whiteSpace: 'nowrap' }}>{dPct}% spent</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 9, width: barW }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#173326' }}>{money(f.base)}</span>
                      <span style={{ fontSize: 9.5, color: '#7E9B93' }}>+</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#173326' }}>{money(f.co)}</span>
                      <span style={{ fontSize: 9.5, color: '#7E9B93' }}>+</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#173326' }}>{money(f.reimb)}</span>
                      <span style={{ fontSize: 9.5, color: '#7E9B93', marginLeft: narrow ? 0 : 'auto' }}>{money(used) + ' of ' + money(total) + ' · ' + f.phase}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 13, borderTop: '1px solid rgba(20,8,31,0.07)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            <Swatch c="#2F7D4A" label="On track" />
            <Swatch c="#8E2E0A" label="Over 90% spent or slipping" />
            <Swatch c="#7E9B93" label="Schedule time used" />
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '6px solid #0B1A12' }} />
              <span style={{ fontSize: 9.5, color: '#7E9B93', fontWeight: 600 }}>{narrow ? "Marker = schedule time used · each bar is that project's full contract" : 'Marker = schedule time used · bar length = total contract value'}</span>
            </div>
          </div>
        </Card>

        {/* Revenue card */}
        <Card>
          <Hdr
            title={isClient ? 'Billed vs Paid' : 'Invoiced vs Collected'}
            sub={'Last 6 months' + (isClient ? '' : ' · ' + (ef === 'all' ? 'all execution types' : ef + ' only'))}
            right={
              <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                <Swatch c={INVC} label={isClient ? 'Billed' : 'Invoiced'} />
                <Swatch c={COLC} label={isClient ? 'Paid' : 'Collected'} />
                <Swatch c={OUTC} label="Outstanding" />
              </div>
            }
          />
          <div style={{ position: 'relative', height: 176 }}>
            {gridVals.map((v, i) => (
              <div key={'g' + i} style={{ position: 'absolute', left: 44, right: 0, top: i * (CH / (gridVals.length - 1)), height: 1, background: v === 0 ? 'rgba(20,8,31,0.16)' : 'rgba(20,8,31,0.06)' }} />
            ))}
            {gridVals.map((v, i) => (
              <div key={'l' + i} style={{ position: 'absolute', left: 0, width: 38, textAlign: 'right', top: i * (CH / (gridVals.length - 1)) - 6, fontSize: 9, color: '#7E9B93', fontWeight: 600 }}>{money(v)}</div>
            ))}
            <div style={{ position: 'absolute', left: 44, right: 0, top: 0, height: CH, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              {revenueData.map((r) => {
                const invH = Math.round((r.invoiced / axisMax) * CH);
                const colH = Math.round((r.collected / axisMax) * CH);
                const gap = r.invoiced - r.collected;
                return (
                  <div key={r.month} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: CH, cursor: 'pointer' }} onClick={(e) => openTip(e, r.month + ' 2026', [
                    [isClient ? 'Billed' : 'Invoiced', money(r.invoiced)],
                    [isClient ? 'Paid' : 'Collected', money(r.collected)],
                    ['Outstanding', money(gap)],
                    ['— Past due', money(r.pastDue)],
                    ['— Within terms', money(r.withinTerms)],
                    ['— Retention held', money(r.retHeld)],
                    ['Invoices', r.items.length + ' issued · ' + r.open.length + ' open'],
                  ], OUTC)}>
                    <div style={{ position: 'relative', width: 17, height: Math.max(invH, 1), background: INVC, borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }}>
                      {gap > 0 && (
                        <div onClick={(e) => { e.stopPropagation(); setInvoiceMonth(r.month); setTip(null); }} title={'Open ' + r.open.length + ' outstanding invoice' + (r.open.length === 1 ? '' : 's')} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.round((gap / axisMax) * CH), background: OUTC, borderRadius: '4px 4px 0 0', cursor: 'pointer', boxShadow: invoiceMonth === r.month ? '0 0 0 2px #0B1A12' : 'none' }} />
                      )}
                    </div>
                    <div style={{ width: 17, height: Math.max(colH, 1), background: COLC, borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ position: 'absolute', left: 44, right: 0, top: CH + 6, display: 'flex', gap: 10 }}>
              {revenueData.map((r) => (
                <div key={r.month} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#7E9B93' }}>{r.month}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14, padding: 12, background: '#FBF8F2', borderRadius: 10 }}>
            <div>{mini(isClient ? 'Total Billed' : 'Total Invoiced')}<div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, marginTop: 2, color: INVC }}>{money(totInv)}</div></div>
            <div>{mini(isClient ? 'Total Paid' : 'Total Collected')}<div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, marginTop: 2, color: COLC }}>{money(totCol)}</div></div>
            <div onClick={() => { setInvoiceMonth('all'); setTip(null); }} style={{ cursor: 'pointer' }}>
              {mini('Outstanding')}
              <div style={{ fontFamily: BG, fontSize: 17, fontWeight: 700, marginTop: 2, color: OUTC }}>{money(totInv - totCol)}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#8E2E0A', marginTop: 3 }}>{money(sumPastDue)} past due · per contract terms</div>
              <div style={{ fontSize: 9.5, color: '#7E9B93', marginTop: 1 }}>{money(sumWithin)} within terms · {money(sumRet)} retention</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#173326', marginTop: 4 }}>View invoices →</div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ height: 5 }} />
      {bandLabel('Time on target · tasks')}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
        {/* Funnel */}
        <Card>
          <Hdr title={funnelTitle} sub={isClient ? 'Your project against the agreed programme' : 'Conversion across the workflow · last 90 days'} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {funnelData.map((f, i) => (
              <div key={f.label} style={{ cursor: 'pointer' }} onClick={(e) => openTip(e, funnelTitle, [
                ['Stage', f.label],
                [isClient ? 'Status' : 'Count', f.n],
                ['Share of top of funnel', f.v + '%'],
                i > 0 ? ['Step conversion', Math.round((f.v / funnelData[i - 1].v) * 100) + '% from ' + funnelData[i - 1].label] : ['Position', 'Top of funnel'],
                ['Drop-off from previous', i > 0 ? funnelData[i - 1].v - f.v + ' pts' : '—'],
              ], '#173326')}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0B1A12' }}>{f.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7E9B93' }}>{f.n}</span>
                </div>
                <div style={{ height: 13, background: '#EFEDE8', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: Math.max(f.v, 2) + '%', height: '100%', background: ocRamp[3 - Math.min(3, Math.floor((i * 4) / funnelData.length))], borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
          {!isClient && (
            <div onClick={() => navigate('/pipeline')} style={{ marginTop: 14, fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>Open CRM & Leads →</div>
          )}
        </Card>

        {/* Team */}
        <Card>
          <Hdr title="Workload — Team, Consultants & Subs" sub="Follows the execution-type filter above" />
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {['all', 'Staff', 'Consultant', 'Sub', 'Owner'].map((k) => (
              <div key={k} onClick={() => setDashTeamFilter(k)} style={{ padding: '4px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', background: tf === k ? '#173326' : '#EFEDE8', color: tf === k ? 'white' : '#7E9B93' }}>{k === 'all' ? 'All' : k}</div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {teamShown.map((t) => {
              const pct = Math.round((t.done / t.tasks) * 100);
              const lc = t.tasks > 10 ? '#B8410F' : t.tasks > 6 ? '#D2822E' : '#2F7D4A';
              return (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={(e) => openTip(e, t.name, [
                  ['Role', t.role],
                  ['Type', t.kind],
                  ['Open + closed tasks', String(t.tasks)],
                  ['Completed', t.done + ' of ' + t.tasks + '  ·  ' + pct + '%'],
                  ['Remaining', String(t.tasks - t.done)],
                  ['Load', t.tasks > 10 ? 'Over capacity' : t.tasks > 6 ? 'At capacity' : 'Has room'],
                ], lc)}>
                  <div style={{ width: 29, height: 29, borderRadius: 999, background: '#0F2417', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>{t.av}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0B1A12' }}>{t.name}</span>
                      <span style={{ fontSize: 9, color: '#7E9B93' }}>{t.role}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: lc, background: lc + '16', padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>{t.tasks}</span>
                    </div>
                    <div style={{ height: 5, background: '#EFEDE8', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: lc, borderRadius: 999 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Deadlines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dlCard('Past Due', dl.filter((d) => d.past), '#B8410F')}
          {dlCard('Next 7 Days', dl.filter((d) => !d.past), '#D2822E')}
        </div>
      </div>

      <div style={{ height: 5 }} />
      {bandLabel('News feed')}

      {/* Activity */}
      <Card>
        <Hdr title="Recent Activity" sub={kpi === 'all' ? 'Everything across the portfolio' : 'Filtered by the highlighted card above'} right={<div onClick={() => setDashKpi('all')} style={{ fontSize: 11.5, fontWeight: 700, color: kpi === 'all' ? 'rgba(11,26,18,0.25)' : '#173326', cursor: 'pointer', flexShrink: 0 }}>Clear filter</div>} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '8px 22px' }}>
          {act.map((x) => (
            <div key={x.who + x.act} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(20,8,31,0.05)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: x.c, display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700, color: 'white', flexShrink: 0 }}>{x.av}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#0B1A12', lineHeight: 1.4 }}><span style={{ fontWeight: 700 }}>{x.who}</span> {x.act}</div>
                <div style={{ fontSize: 10, color: '#7E9B93', marginTop: 2 }}>{x.target}</div>
              </div>
              <div style={{ fontSize: 9.5, color: '#7E9B93', whiteSpace: 'nowrap', flexShrink: 0 }}>{x.when}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Click popover */}
      {tip && (
        <div style={{ position: 'fixed', left: Math.min(Math.max(tip.x, 130), winW - 130), top: tip.y - 14, transform: 'translate(-50%, -100%)', zIndex: 400, pointerEvents: 'none', background: '#0B1A12', color: 'white', borderRadius: 10, padding: '10px 12px', minWidth: 190, boxShadow: '0 12px 30px rgba(11,26,18,0.3)', animation: 'fadeIn 0.12s ease' }}>
          <div style={{ fontFamily: BG, fontSize: 12, fontWeight: 700, marginBottom: 7, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.14)', color: 'white' }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: tip.accent, marginRight: 6 }} />
            {tip.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {tip.rows.filter(Boolean).map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, fontSize: 10.5 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{r![0]}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>{r![1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice drawer */}
      {im && (
        <div onClick={() => setInvoiceMonth(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,26,18,0.34)', zIndex: 500, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 92vw)', background: '#FBF8F2', height: '100%', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '-14px 0 40px rgba(11,26,18,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div>
                {mini('Outstanding invoices')}
                <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 3 }}>{im === 'all' ? 'All open invoices' : im + ' 2026'}</div>
                <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 3 }}>{drawerItems.length} invoice{drawerItems.length === 1 ? '' : 's'} · {money(drawerTot)} outstanding · classified against programmed contract terms</div>
              </div>
              <div onClick={() => setInvoiceMonth(null)} style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 999, background: '#EFEDE8', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#173326', flexShrink: 0 }}>×</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([['Past due', drawerItems.reduce((t, x) => t + x.pastDue, 0), '#8E2E0A'], ['Within terms', drawerItems.reduce((t, x) => t + x.withinTerms, 0), '#173326'], ['Retention held', drawerItems.reduce((t, x) => t + x.retHeld, 0), '#93520F']] as [string, number, string][]).map((g) => (
                <div key={g[0]} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 10, padding: 10 }}>
                  {mini(g[0])}
                  <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, marginTop: 2, color: g[2] }}>{money(g[1])}</div>
                </div>
              ))}
            </div>
            {drawerItems.map((x) => (
              <div key={x.id} style={{ background: 'white', border: '1px solid rgba(20,8,31,0.07)', borderLeft: '3px solid ' + (x.status === 'Past due' ? '#8E2E0A' : x.status === 'Retention' ? '#D9B94F' : '#7E9B93'), borderRadius: 10, padding: '13px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0B1A12' }}>{x.id}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, background: x.status === 'Past due' ? '#F6E0D5' : x.status === 'Retention' ? '#FBE9AE' : '#DCE7DE', color: x.status === 'Past due' ? '#8E2E0A' : x.status === 'Retention' ? '#93520F' : '#173326', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{x.status === 'Past due' ? 'Past due ' + x.daysLate + 'd' : x.status}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: BG, fontSize: 14, fontWeight: 700, color: '#0B1A12' }}>{money(x.unpaid)}</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#173326', marginBottom: 8 }}>{x.project}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px' }}>
                  {([
                    ['Invoiced', money(x.amount)],
                    ['Paid', money(x.paid)],
                    ['Issued', x.issuedLabel],
                    ['Terms', 'Net ' + x.net],
                    ['Due', x.dueLabel + (x.daysLate > 0 ? ' · ' + x.daysLate + 'd late' : x.daysLate === 0 ? ' · today' : ' · in ' + -x.daysLate + 'd')],
                    ['Receivable now', money(x.receivable)],
                    x.retHeld > 0 ? ['Retention (' + Math.round(x.retPct * 100) + '%)', money(x.retHeld)] : null,
                    ['Billing basis', x.billing],
                  ].filter(Boolean) as [string, string][]).map((r, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 8.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{r[0]}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0B1A12', marginTop: 1 }}>{r[1]}</div>
                    </div>
                  ))}
                </div>
                {x.retHeld > 0 && <div style={{ fontSize: 10, color: '#93520F', marginTop: 8, background: '#FBE9AE', padding: '6px 8px', borderRadius: 6 }}>{x.release}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {['Open invoice', 'Send reminder', 'Log payment'].map((b) => (
                    <div key={b} style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: b === 'Open invoice' ? '#173326' : '#EFEDE8', color: b === 'Open invoice' ? 'white' : '#173326', cursor: 'pointer' }}>{b}</div>
                  ))}
                </div>
              </div>
            ))}
            {drawerItems.length === 0 && <div style={{ fontSize: 12, color: '#7E9B93', background: 'white', padding: 18, borderRadius: 10, textAlign: 'center' }}>Nothing outstanding for this period.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
