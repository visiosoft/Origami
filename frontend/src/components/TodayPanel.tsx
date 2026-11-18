import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { todayISO } from '../data/localDate';

type Row = { key: string; title: string; context: string; due?: string; priority?: string; tag: 'emergency' | 'urgent' | 'overdue' | 'today'; to: string };
type Rfi = { id: string; number: string; subject: string; due: string | null; status: string; to: string };
export type TodayData = { tasks: Row[]; taskCount: number; rfis: { mine: Rfi[]; dueSoon: Rfi[]; overdue: Rfi[] } };

const TAG: Record<Row['tag'], [string, string, string]> = {
  emergency: ['Emergency', '#FBE3DC', '#8E2E0A'], urgent: ['Urgent', '#FBEBDD', '#8A4B12'],
  overdue: ['Overdue', '#F6E7C8', '#7A4B00'], today: ['Due today', 'var(--c-efede8)', 'var(--body)'],
};
const day = (iso?: string | null) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

/**
 * Nov 17 sync: "Today" on the dashboard -- my Emergency / Urgent tasks, my
 * tasks due today or overdue, and my RFIs (my turn, due soon, overdue).
 */
export function TodayPanel() {
  const navigate = useNavigate();
  const [d, setD] = useState<TodayData | null>(null);
  useEffect(() => { api.dashboard.today(todayISO()).then(setD).catch(() => setD(null)); }, []);
  if (!d) return null;
  const rfiCount = d.rfis.mine.length + d.rfis.dueSoon.length + d.rfis.overdue.length;
  const chip = (label: string, bg: string, c: string) => <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: bg, color: c, whiteSpace: 'nowrap' }}>{label}</span>;
  const rfiLine = (r: Rfi, label: [string, string, string]) => (
    <li key={label[0] + r.id}>
      <button type="button" onClick={() => navigate(r.to)} className="today-row">
        {chip(label[0], label[1], label[2])}
        <span className="today-title"><b>{r.number}</b> {r.subject}</span>
        <span className="today-meta">{r.due ? `due ${day(r.due)}` : ''}</span>
      </button>
    </li>
  );
  return (
    <section className="today-panel" aria-label="Today" style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), .07)', borderRadius: 'var(--r-14, 14px)', padding: '14px 16px', display: 'grid', gap: 10 }}>
      <style>{`.today-panel ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}.today-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;padding:7px 8px;border-radius:9px;cursor:pointer;font-family:inherit;color:var(--ink)}.today-row:hover{background:var(--panel)}.today-title{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.today-meta{font-size:11.5px;color:var(--muted);white-space:nowrap}`}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15, color: 'var(--ink)' }}>Today</b>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {d.taskCount ? `${d.taskCount} task${d.taskCount === 1 ? '' : 's'} need you` : 'Nothing urgent or due today'}{rfiCount ? ` · ${rfiCount} RFI${rfiCount === 1 ? '' : 's'}` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => navigate('/tasks')} style={{ border: 0, background: 'transparent', color: 'var(--forest)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>All my tasks →</button>
        <button type="button" onClick={() => navigate('/rfis')} style={{ border: 0, background: 'transparent', color: 'var(--forest)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>RFI log →</button>
      </div>
      {d.tasks.length > 0 && (
        <ul aria-label="Tasks for today">
          {d.tasks.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={() => navigate(t.to)} className="today-row">
                {chip(...TAG[t.tag])}
                <span className="today-title">{t.title}</span>
                <span className="today-meta">{[t.context, t.due ? `due ${day(t.due)}` : ''].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {d.taskCount > d.tasks.length && <div style={{ fontSize: 12, color: 'var(--muted)' }}>+{d.taskCount - d.tasks.length} more in your tasks</div>}
      {rfiCount > 0 && (
        <ul aria-label="RFIs">
          {d.rfis.overdue.map((r) => rfiLine(r, ['RFI overdue', '#FBE3DC', '#8E2E0A']))}
          {d.rfis.dueSoon.map((r) => rfiLine(r, ['RFI due soon', '#F6E7C8', '#7A4B00']))}
          {d.rfis.mine.filter((r) => !d.rfis.overdue.some((x) => x.id === r.id) && !d.rfis.dueSoon.some((x) => x.id === r.id)).map((r) => rfiLine(r, ['RFI · your turn', '#E3EDF8', '#1F4E80']))}
        </ul>
      )}
    </section>
  );
}
