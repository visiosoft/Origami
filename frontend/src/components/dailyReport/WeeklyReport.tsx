import { useEffect, useState, type ReactNode } from 'react';
import { api, type WeeklyReport as Week } from '../../api';
import { useApp } from '../../AppContext';
import { AkPill, AkStats, akToday } from '../ActionKit';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mondayOf = (day: string) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const plusDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const short = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const CONDITION: Record<string, string> = { good: 'Good', damaged: 'Damaged', short: 'Short' };

function Block({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="ak-card" style={{ padding: '14px 18px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{title}{count != null && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}> · {count}</span>}</div>
      <div className="ak-detail" style={{ margin: 0, background: 'transparent', padding: 0 }}>{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/**
 * Daily Reports -> Weekly: one project's week from its daily reports -- each
 * day, hours by cost code and by worker, then delays, inspections, visitors,
 * deliveries, equipment and notes. "Email PDF / Excel" sends it on.
 */
export function WeeklyReport({ projects, initialProject }: { projects: { id: number; name: string }[]; initialProject?: number | '' }) {
  const { toast } = useApp();
  const [projectId, setProjectId] = useState<number | ''>(initialProject || projects[0]?.id || '');
  const [week, setWeek] = useState(() => mondayOf(akToday()));
  const [data, setData] = useState<Week | null>(null);
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id); }, [projects, projectId]);
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api.dailyLogs.weekly(projectId, week).then(setData).catch((e: Error) => { setData(null); toast('⚠ ' + (e.message || 'Could not load the week')); }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, week]);

  const email = async () => {
    if (!projectId) return;
    setSending(true);
    try {
      const r = await api.dailyLogs.emailWeekly(projectId, week, to.trim() || undefined);
      toast(`Sent to ${r.to.join(', ')}`);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not sent')); }
    finally { setSending(false); }
  };

  const t = data?.totals;
  const thisWeek = week === mondayOf(akToday());
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ak-tools">
        <select className="ak-select" value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} aria-label="Project">
          {!projects.length && <option value="">No projects with daily reports yet</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="ak-btn" aria-label="Previous week" onClick={() => setWeek(plusDays(week, -7))}>◀</button>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', minWidth: 170, textAlign: 'center' }}>{short(week)} – {short(plusDays(week, 6))}</span>
          <button type="button" className="ak-btn" aria-label="Next week" disabled={thisWeek} onClick={() => setWeek(plusDays(week, 7))}>▶</button>
          {!thisWeek && <button type="button" className="ak-btn" onClick={() => setWeek(mondayOf(akToday()))}>This week</button>}
        </div>
        <span style={{ flex: 1 }} />
        <input className="ak-search" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Email to (blank = the usual list)" aria-label="Email to" />
        <button type="button" className="ak-btn is-dark" disabled={!projectId || sending} onClick={email}>{sending ? 'Sending…' : 'Email PDF / Excel'}</button>
      </div>

      {loading && !data && <section className="ak-card"><div className="ak-empty">Loading…</div></section>}
      {data && t && (
        <>
          <AkStats items={[
            { key: 'days', label: 'Days worked', value: t.daysWorked, sub: t.daysNoWork ? `${t.daysNoWork} no-work day${t.daysNoWork === 1 ? '' : 's'}` : 'this week' },
            { key: 'hours', label: 'Crew hours', value: t.hours, sub: `${t.workerDays} worker-days` },
            { key: 'equip', label: 'Equipment hours', value: t.equipmentHours, sub: `${t.equipmentIdle} h idle` },
            { key: 'missing', label: 'Days with no report', value: t.daysMissing, sub: 'weekdays so far', tone: t.daysMissing ? 'yellow' : undefined },
          ]} />

          <Block title="The week">
            <Table head={['Day', 'Report', 'Crew', 'Hours', 'Superintendent']} rows={data.days.map((d) => [
              short(d.date),
              d.status === 'missing' ? <span style={{ color: 'var(--muted)' }}>No report</span>
                : d.worked === 'no' ? <>No work — {d.reason || '—'} {d.auto && <AkPill tone="soft">Auto</AkPill>}</>
                : <>{d.status === 'approved' ? 'Approved' : 'Submitted'}{d.updates ? ` · ${d.updates} update${d.updates === 1 ? '' : 's'}` : ''}</>,
              d.crew || '', d.hours || '', d.supervisor,
            ])} />
          </Block>

          {data.byCode.length > 0 && (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              <Block title="Hours by cost code"><Table head={['Cost code', 'Workers', 'Hours']} rows={data.byCode.map((c) => [c.label, c.workers, c.hours])} /></Block>
              <Block title="Hours by worker"><Table head={['Worker', 'Trade', 'Days', 'Hours']} rows={data.byWorker.map((w) => [w.name, w.trade, w.days, w.hours])} /></Block>
            </div>
          )}
          {data.delays.length > 0 && <Block title="Delays" count={data.delays.length}><Table head={['Day', 'Delay', 'Get well', 'Details']} rows={data.delays.map((d) => [short(d.date), d.label, d.getWell === 'unknown' ? 'Unknown' : d.getWell ? short(d.getWell) : '—', d.details])} /></Block>}
          {data.inspections.length > 0 && <Block title="Inspections" count={data.inspections.length}><Table head={['Day', 'Authority', 'What', 'Outcome']} rows={data.inspections.map((i) => [short(i.date), i.authority, i.what, i.outcome])} /></Block>}
          {data.visitors.length > 0 && <Block title="Site visitors" count={data.visitors.length}><Table head={['Day', 'Visitor', 'Name', 'Details']} rows={data.visitors.map((v) => [short(v.date), v.type, v.name, v.details])} /></Block>}
          {data.deliveries.length > 0 && <Block title="Deliveries" count={data.deliveries.length}><Table head={['Day', 'Supplier', 'PO / ticket', 'Items', 'Qty', 'Condition']} rows={data.deliveries.map((d) => [short(d.date), d.supplier, d.poRef, d.items, d.qty, CONDITION[d.condition] || ''])} /></Block>}
          {data.equipment.length > 0 && <Block title="Equipment" count={data.equipment.length}><Table head={['Equipment', 'Owned / rented', 'Days', 'Hours used', 'Hours idle']} rows={[...data.equipment.map((m) => [m.name, m.ownership === 'rented' ? 'Rented' : m.ownership === 'owned' ? 'Owned' : '', m.days, m.hoursUsed, m.hoursIdle]), [<b key="t">Total</b>, '', '', <b key="u">{t.equipmentHours}</b>, <b key="i">{t.equipmentIdle}</b>]]} /></Block>}
          {data.notes.length > 0 && <Block title="Notes" count={data.notes.length}><Table head={['Day', 'Note']} rows={data.notes.map((n) => [short(n.date), <span key="n" style={{ whiteSpace: 'pre-wrap' }}>{n.text}</span>])} /></Block>}
          {!data.days.some((d) => d.logId) && <section className="ak-card"><div className="ak-empty">No daily reports were filed for this project this week.</div></section>}
        </>
      )}
    </div>
  );
}
