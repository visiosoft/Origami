import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const BG = "'Bricolage Grotesque', serif";

interface CalEvent { id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string }

const startOfWeek = (d: Date) => {
  const out = new Date(d);
  const day = out.getDay();
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
};
const addDays = (d: Date, n: number) => { const out = new Date(d); out.setDate(out.getDate() + n); return out; };
const iso = (d: Date) => d.toISOString();
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A staff member's own Google Calendar, read-only, right in the sidebar --
 * the same connection Settings → My Calendar manages, just shown as an
 * actual week of events instead of only a connect/disconnect toggle.
 */
export function MyCalendar() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.google.myCalendar.status().then((res: any) => setConnected(!!res?.connected)).catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected) { setLoading(false); return; }
    setLoading(true);
    const from = iso(weekStart);
    const to = iso(addDays(weekStart, 7));
    api.google.myCalendar.events(from, to)
      .then((res: any) => setEvents(Array.isArray(res) ? res : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [connected, weekStart]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = (e.start || '').slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    for (const list of m.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return m;
  }, [events]);

  const today = dayKey(new Date());
  const fmtTime = (startIso: string, allDay: boolean) => allDay ? 'All day' : new Date(startIso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  if (connected === null || loading && connected) return <div style={{ padding: 28, fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  if (!connected) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12', marginBottom: 4 }}>My Calendar</div>
        <div style={{ fontSize: 13, color: '#5C6B65', marginBottom: 20 }}>Your own Google Calendar, read-only.</div>
        <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.06)', borderRadius: 14, padding: 24, maxWidth: 480 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12', marginBottom: 6 }}>Not connected yet</div>
          <div style={{ fontSize: 12.5, color: '#7E9B93', marginBottom: 16, lineHeight: 1.6 }}>
            Connect your Google Calendar to see your own schedule here — separate from the office's shared calendar connection.
          </div>
          <div onClick={() => navigate('/settings?tab=my-calendar')} style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>
            Go to Settings → My Calendar
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 22, color: '#0B1A12', marginBottom: 4 }}>My Calendar</div>
          <div style={{ fontSize: 13, color: '#5C6B65' }}>{rangeLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div onClick={() => setWeekStart(startOfWeek(new Date()))} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#173326', background: 'white' }}>Today</div>
          <div onClick={() => setWeekStart((d) => addDays(d, -7))} style={{ padding: '7px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#173326', background: 'white' }}>←</div>
          <div onClick={() => setWeekStart((d) => addDays(d, 7))} style={{ padding: '7px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.1)', color: '#173326', background: 'white' }}>→</div>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12.5, color: '#7E9B93' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {days.map((d) => {
            const key = dayKey(d);
            const dayEvents = byDay.get(key) || [];
            const isToday = key === today;
            return (
              <div key={key} style={{ background: 'white', border: '1px solid ' + (isToday ? 'rgba(47,125,74,0.4)' : 'rgba(20,8,31,0.06)'), borderRadius: 12, padding: 12, minHeight: 140 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: isToday ? '#2F7D4A' : '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div style={{ fontFamily: BG, fontSize: 16, fontWeight: 700, color: isToday ? '#173326' : '#0B1A12', marginBottom: 8 }}>
                  {d.getDate()}
                </div>
                {dayEvents.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#C9CDC9', fontStyle: 'italic' }}>—</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayEvents.map((e) => (
                      <a key={e.id} href={e.htmlLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', padding: '6px 8px', borderRadius: 8, background: '#EEF3EE' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#2F7D4A' }}>{fmtTime(e.start, e.allDay)}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#173326', lineHeight: 1.3 }}>{e.summary}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
