import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const BG = "'Bricolage Grotesque', serif";

interface CalEvent { id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string }
interface Positioned extends CalEvent { top: number; height: number; col: number; cols: number; startMin: number; endMin: number }

const HOUR_H = 48; // px per hour, same rhythm Google's own week view uses
const GUTTER_W = 52;
// A small rotating palette so a busy day reads apart at a glance, the way
// Google's own calendar colors do -- kept inside the app's own palette
// rather than borrowing Google's blue.
const PALETTE = ['#2F7D4A', '#2C7A7B', '#93520F', '#6E3FA0', '#A34718', '#3C5C8A', '#8E2E0A'];
const colorFor = (id: string) => PALETTE[Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % PALETTE.length];

const startOfWeek = (d: Date) => {
  const out = new Date(d);
  out.setDate(out.getDate() - out.getDay());
  out.setHours(0, 0, 0, 0);
  return out;
};
const addDays = (d: Date, n: number) => { const out = new Date(d); out.setDate(out.getDate() + n); return out; };
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Lays same-day timed events into side-by-side columns wherever they overlap, like Google's week view. */
function layoutDay(events: CalEvent[]): Positioned[] {
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const s = new Date(e.start);
      const en = new Date(e.end);
      const startMin = Math.max(0, minutesOf(s));
      const endMin = Math.max(startMin + 20, minutesOf(en) || startMin + 30);
      return { ...e, startMin, endMin, top: 0, height: 0, col: 0, cols: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Group into clusters of mutually-overlapping events, then greedily assign columns.
  let cluster: Positioned[] = [];
  let clusterEnd = -1;
  const clusters: Positioned[][] = [];
  for (const e of timed) {
    if (cluster.length && e.startMin >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = -1;
    }
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  if (cluster.length) clusters.push(cluster);

  for (const group of clusters) {
    const colEnds: number[] = [];
    for (const e of group) {
      let col = colEnds.findIndex((end) => end <= e.startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(e.endMin); } else { colEnds[col] = e.endMin; }
      e.col = col;
    }
    const cols = colEnds.length;
    for (const e of group) {
      e.cols = cols;
      e.top = (e.startMin / 60) * HOUR_H;
      e.height = Math.max(18, ((e.endMin - e.startMin) / 60) * HOUR_H - 2);
    }
  }
  return timed;
}

/**
 * A staff member's own Google Calendar, read-only, laid out like Google
 * Calendar's own week view -- a time grid with side-by-side overlap
 * handling and an all-day strip -- rather than a plain agenda list.
 */
export function MyCalendar() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    api.google.myCalendar.status().then((res: any) => setConnected(!!res?.connected)).catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!connected) { setLoading(false); return; }
    setLoading(true);
    api.google.myCalendar.events(weekStart.toISOString(), addDays(weekStart, 7).toISOString())
      .then((res: any) => setEvents(Array.isArray(res) ? res : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [connected, weekStart]);

  // The current-time line only matters while it's on screen; a minute is plenty.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (scrolledRef.current || !gridRef.current) return;
    gridRef.current.scrollTop = Math.max(0, 7 * HOUR_H - 40);
    scrolledRef.current = true;
  }, [loading]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const d of days) m.set(dayKey(d), []);
    for (const e of events) {
      const key = dayKey(new Date(e.start));
      if (m.has(key)) m.get(key)!.push(e);
    }
    return m;
  }, [events, days]);
  const allDayByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const [k, list] of byDay) m.set(k, list.filter((e) => e.allDay));
    return m;
  }, [byDay]);
  const hasAllDay = useMemo(() => events.some((e) => e.allDay), [events]);
  const laidOut = useMemo(() => new Map(days.map((d) => [dayKey(d), layoutDay(byDay.get(dayKey(d)) || [])])), [byDay, days]);

  const today = dayKey(new Date());
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_H;
  const fmtTime = (startIso: string) => new Date(startIso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  const monthLabel = weekStart.getMonth() === addDays(weekStart, 6).getMonth()
    ? weekStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `${weekStart.toLocaleDateString(undefined, { month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;

  if (connected === null) return <div style={{ padding: 28, fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

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
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, color: '#0B1A12' }}>My Calendar</div>
        <div onClick={() => setWeekStart(startOfWeek(new Date()))} style={{ padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', color: '#173326', background: 'white' }}>Today</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <div onClick={() => setWeekStart((d) => addDays(d, -7))} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#43514D' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </div>
          <div onClick={() => setWeekStart((d) => addDays(d, 7))} style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#43514D' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0B1A12' }}>{monthLabel}</div>
        {loading && <span style={{ fontSize: 11.5, color: '#9AA39D' }}>Loading…</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Day header row */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(20,8,31,0.08)', flexShrink: 0 }}>
          <div style={{ width: GUTTER_W, flexShrink: 0 }} />
          {days.map((d) => {
            const key = dayKey(d);
            const isToday = key === today;
            return (
              <div key={key} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '8px 4px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#2F7D4A' : '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <div style={{
                  display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 999, marginTop: 3,
                  fontFamily: BG, fontSize: 15, fontWeight: 700,
                  background: isToday ? '#173326' : 'transparent', color: isToday ? 'white' : '#0B1A12',
                }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* All-day strip */}
        {hasAllDay && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(20,8,31,0.08)', flexShrink: 0, minHeight: 28 }}>
            <div style={{ width: GUTTER_W, flexShrink: 0 }} />
            {days.map((d) => {
              const key = dayKey(d);
              const list = allDayByDay.get(key) || [];
              return (
                <div key={key} style={{ flex: 1, minWidth: 0, padding: '3px 3px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {list.map((e) => (
                    <a key={e.id} href={e.htmlLink} target="_blank" rel="noopener noreferrer" title={e.summary} style={{ display: 'block', textDecoration: 'none', fontSize: 10.5, fontWeight: 600, color: 'white', background: colorFor(e.id), borderRadius: 5, padding: '2px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.summary}
                    </a>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable time grid */}
        <div ref={gridRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ display: 'flex', position: 'relative' }}>
            {/* Hour gutter */}
            <div style={{ width: GUTTER_W, flexShrink: 0 }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ height: HOUR_H, position: 'relative' }}>
                  {h > 0 && (
                    <span style={{ position: 'absolute', top: -6, right: 8, fontSize: 10, color: '#9AA39D', background: 'white' }}>
                      {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'AM' : 'PM'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d) => {
              const key = dayKey(d);
              const isToday = key === today;
              const dayEvents = laidOut.get(key) || [];
              return (
                <div key={key} style={{ flex: 1, minWidth: 0, position: 'relative', borderLeft: '1px solid rgba(20,8,31,0.06)', background: isToday ? '#FBFCFA' : 'transparent' }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ height: HOUR_H, borderTop: h ? '1px solid rgba(20,8,31,0.05)' : 'none' }} />
                  ))}
                  {isToday && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 0, borderTop: '2px solid #C0392B', zIndex: 3 }}>
                      <div style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: 999, background: '#C0392B' }} />
                    </div>
                  )}
                  {dayEvents.map((e) => (
                    <a
                      key={e.id}
                      href={e.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={e.summary}
                      style={{
                        position: 'absolute', top: e.top, left: `calc(${(e.col / e.cols) * 100}% + 1px)`, width: `calc(${100 / e.cols}% - 3px)`,
                        height: e.height, background: colorFor(e.id), color: 'white', borderRadius: 6, padding: '3px 6px',
                        fontSize: 10.5, lineHeight: 1.3, overflow: 'hidden', textDecoration: 'none', boxShadow: '0 1px 3px rgba(20,8,31,0.15)', zIndex: 2,
                      }}
                    >
                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{e.summary}</div>
                      {e.height > 30 && <div style={{ opacity: 0.85 }}>{fmtTime(e.start)}</div>}
                    </a>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
