import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { isMine } from '../components/TaskScope';
import { NewTaskDrawer } from '../components/NewTaskDrawer';
import type { Task } from '../data/tasks';

const BG = "'Bricolage Grotesque', serif";

interface CalEvent {
  id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string;
  /** A task with a due time, merged in alongside the real Google events. */
  isTask?: boolean;
}
interface Positioned extends CalEvent { top: number; height: number; col: number; cols: number; startMin: number; endMin: number }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

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
  const { currentUser, toast } = useApp();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [myTasks, setMyTasks] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  // Click-to-create: a small popover offering "Task" or "Google Meet" at the slot the user clicked.
  const [quickCreate, setQuickCreate] = useState<{ dateKey: string; time: string; x: number; y: number } | null>(null);
  const [taskDrawerSlot, setTaskDrawerSlot] = useState<{ dateKey: string; time: string } | null>(null);
  const [meetSlot, setMeetSlot] = useState<{ dateKey: string; time: string } | null>(null);

  useEffect(() => {
    api.google.myCalendar.status().then((res: any) => setConnected(!!res?.connected)).catch(() => setConnected(false));
  }, []);

  const reloadTasks = () => {
    api.tasks.list()
      .then((res: any) => {
        const rows: Task[] = Array.isArray(res) ? res : [];
        const mine = rows
          .filter((t) => isMine(t, currentUser) && ISO_DATE.test(t.dueDate) && ISO_TIME.test(t.dueTime || ''))
          .map((t) => ({
            id: `task-${t.id}`, summary: t.description || 'Task', isTask: true, allDay: false,
            start: `${t.dueDate}T${t.dueTime}:00`,
            end: `${t.dueDate}T${t.dueTime}:00`,
          }));
        // Keep any not-yet-confirmed optimistic entries around rather than
        // wiping them the instant this fetch lands -- unless the real one
        // (same slot) has now shown up, in which case drop the stand-in.
        const starts = new Set(mine.map((m) => m.start));
        setMyTasks((prev) => [...mine, ...prev.filter((p) => p.id.startsWith('task-pending-') && !starts.has(p.start))]);
      })
      .catch(() => { });
  };

  useEffect(() => { if (connected && currentUser) reloadTasks(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [connected, currentUser]);

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
  const allItems = useMemo(() => [...events, ...myTasks], [events, myTasks]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const d of days) m.set(dayKey(d), []);
    for (const e of allItems) {
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
                <div
                  key={key}
                  onClick={(ev) => {
                    const rect = ev.currentTarget.getBoundingClientRect();
                    const y = ev.clientY - rect.top;
                    const rawMin = Math.max(0, Math.min(24 * 60 - 15, (y / HOUR_H) * 60));
                    const snapped = Math.round(rawMin / 15) * 15;
                    const time = `${pad(Math.floor(snapped / 60))}:${pad(snapped % 60)}`;
                    setQuickCreate({ dateKey: key, time, x: ev.clientX, y: ev.clientY });
                  }}
                  style={{ flex: 1, minWidth: 0, position: 'relative', borderLeft: '1px solid rgba(20,8,31,0.06)', background: isToday ? '#FBFCFA' : 'transparent', cursor: 'pointer' }}
                >
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
                      href={e.isTask ? undefined : e.htmlLink}
                      target={e.isTask ? undefined : '_blank'}
                      rel={e.isTask ? undefined : 'noopener noreferrer'}
                      title={e.summary}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (e.isTask) {
                          ev.preventDefault();
                          const realId = e.id.replace(/^task-(pending-)?/, '');
                          navigate(e.id.startsWith('task-pending-') ? '/tasks' : `/tasks?task=${encodeURIComponent(realId)}&type=log`);
                        }
                      }}
                      style={{
                        position: 'absolute', top: e.top, left: `calc(${(e.col / e.cols) * 100}% + 1px)`, width: `calc(${100 / e.cols}% - 3px)`,
                        height: e.height, background: e.isTask ? '#173326' : colorFor(e.id), color: 'white', borderRadius: 6, padding: '3px 6px',
                        fontSize: 10.5, lineHeight: 1.3, overflow: 'hidden', textDecoration: 'none', boxShadow: '0 1px 3px rgba(20,8,31,0.15)', zIndex: 2,
                        border: e.isTask ? '1px dashed rgba(255,255,255,0.5)' : 'none', cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{e.isTask ? '✓ ' : ''}{e.summary}</div>
                      {e.height > 30 && <div style={{ opacity: 0.85 }}>{fmtTime(e.start)}</div>}
                    </a>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {quickCreate && (
        <div onClick={() => setQuickCreate(null)} style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{
              position: 'fixed', left: Math.min(quickCreate.x, window.innerWidth - 200), top: Math.min(quickCreate.y, window.innerHeight - 120),
              background: 'white', borderRadius: 10, boxShadow: '0 8px 28px rgba(20,8,31,0.22)', border: '1px solid rgba(20,8,31,0.08)',
              padding: 8, width: 188, display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7E9B93', padding: '2px 8px 6px' }}>
              {new Date(`${quickCreate.dateKey}T${quickCreate.time}:00`).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
            <div
              onClick={() => { setTaskDrawerSlot({ dateKey: quickCreate.dateKey, time: quickCreate.time }); setQuickCreate(null); }}
              style={{ padding: '8px 10px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#0B1A12' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F1EC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              ✓ Create Task
            </div>
            <div
              onClick={() => { setMeetSlot({ dateKey: quickCreate.dateKey, time: quickCreate.time }); setQuickCreate(null); }}
              style={{ padding: '8px 10px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#0B1A12' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F1EC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              📹 Create Google Meet
            </div>
          </div>
        </div>
      )}

      {taskDrawerSlot && (
        <NewTaskDrawer
          onClose={() => setTaskDrawerSlot(null)}
          onCreated={(created) => {
            // Optimistic: show it on the grid immediately rather than waiting on a
            // refetch + the "am I the assignee" match to land.
            if (created?.dueDate && created?.dueTime) {
              setMyTasks((prev) => [...prev, {
                id: `task-pending-${Date.now()}`, summary: created.description || 'Task', isTask: true, allDay: false,
                start: `${created.dueDate}T${created.dueTime}:00`, end: `${created.dueDate}T${created.dueTime}:00`,
              }]);
            }
            reloadTasks();
          }}
          defaultAssignedTo={currentUser?.name}
          defaultDueDate={taskDrawerSlot.dateKey}
          defaultDueTime={taskDrawerSlot.time}
        />
      )}

      {meetSlot && (
        <CreateMeetModal
          dateKey={meetSlot.dateKey}
          time={meetSlot.time}
          onClose={() => setMeetSlot(null)}
          onCreated={(ev) => { setEvents((prev) => [...prev, ev]); toast('Google Meet created'); setMeetSlot(null); }}
          toast={toast}
        />
      )}
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fieldRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' };
const iconWrap: React.CSSProperties = { width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center', color: '#7E9B93' };
const plainInput: React.CSSProperties = { flex: 1, minWidth: 0, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#0B1A12', background: 'transparent' };

/**
 * Quick-create modal for the calendar's own "Google Meet" option, styled
 * after Google Calendar's own compact event popup -- title up top, then the
 * usual icon rows for time / guests / video / location / description.
 */
function CreateMeetModal({ dateKey, time, onClose, onCreated, toast }: {
  dateKey: string;
  time: string;
  onClose: () => void;
  onCreated: (ev: CalEvent) => void;
  toast: (msg: string) => void;
}) {
  const { users, currentUser } = useApp();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateKey);
  const [startTime, setStartTime] = useState(time);
  const [duration, setDuration] = useState(60);
  const [guestInput, setGuestInput] = useState('');
  const [guests, setGuests] = useState<string[]>([]);
  const [addMeet, setAddMeet] = useState(true);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const endTime = useMemo(() => {
    const [h, m] = startTime.split(':').map(Number);
    const total = h * 60 + m + duration;
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  }, [startTime, duration]);

  // Teammates whose email isn't already added, so the picker only offers people left to add.
  const teamMatches = useMemo(
    () => users.filter((u) => u.email && u.id !== currentUser?.id && !guests.includes(u.email)),
    [users, guests, currentUser],
  );

  const addGuestEmail = (email: string) => {
    if (!EMAIL_RE.test(email)) { toast('Enter a valid email address'); return; }
    if (!guests.includes(email)) setGuests((g) => [...g, email]);
    setGuestInput('');
  };
  const addGuest = () => {
    const email = guestInput.trim();
    if (!email) return;
    addGuestEmail(email);
  };
  const removeGuest = (email: string) => setGuests((g) => g.filter((e) => e !== email));

  const create = () => {
    if (!title.trim()) { toast('Add a title'); return; }
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (end <= start) end.setDate(end.getDate() + 1); // crossed midnight
    setSaving(true);
    api.google.myCalendar.createEvent({
      summary: title.trim(), start: start.toISOString(), end: end.toISOString(),
      video: addMeet, location: location.trim() || undefined, description: description.trim() || undefined,
      attendees: guests.length ? guests : undefined,
    })
      .then((res: any) => {
        onCreated({ id: res.id, summary: res.summary || title.trim(), start: res.start || start.toISOString(), end: res.end || end.toISOString(), allDay: false, htmlLink: res.htmlLink });
        if (guests.length) toast(`Invite emailed to ${guests.length} guest${guests.length > 1 ? 's' : ''}`);
      })
      .catch((err: any) => toast(`⚠ ${err?.message || 'Could not create the event'}`))
      .finally(() => setSaving(false));
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 300, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: '18px 22px 20px', width: 420, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(20,8,31,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -6 }}>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
          </div>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add title"
          autoFocus
          style={{ boxSizing: 'border-box', width: '100%', border: 'none', borderBottom: '1px solid rgba(20,8,31,0.14)', outline: 'none', fontFamily: BG, fontSize: 19, fontWeight: 600, color: '#0B1A12', padding: '4px 0 10px' }}
        />

        {/* Date + time */}
        <div style={fieldRow}>
          <div style={iconWrap}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={9} /><polyline points="12 7 12 12 15 14" /></svg>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...plainInput, flex: 'none', width: 132 }} />
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ ...plainInput, flex: 'none', width: 90 }} />
          <span style={{ color: '#9AA39D', fontSize: 13 }}>–</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={{ ...plainInput, flex: 'none', width: 96, cursor: 'pointer' }}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        {/* Guests */}
        <div style={{ ...fieldRow, alignItems: 'flex-start' }}>
          <div style={{ ...iconWrap, marginTop: 8 }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {guests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {guests.map((g) => (
                  <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#EFEDE8', borderRadius: 999, padding: '4px 6px 4px 10px', fontSize: 12 }}>
                    {g}
                    <span onClick={() => removeGuest(g)} style={{ cursor: 'pointer', color: '#7E9B93', fontSize: 14, lineHeight: 1 }}>×</span>
                  </span>
                ))}
              </div>
            )}

            {/* From the team -- pick internal people by name, no email to type. */}
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>From your team</div>
            <select
              value=""
              onChange={(e) => { if (e.target.value) addGuestEmail(e.target.value); }}
              style={{ boxSizing: 'border-box', width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontFamily: 'inherit', fontSize: 13, outline: 'none', background: 'white', color: teamMatches.length ? '#0B1A12' : '#9AA39D', marginBottom: 10 }}
            >
              <option value="">{teamMatches.length ? 'Select a teammate…' : 'Everyone on the team is already added'}</option>
              {teamMatches.map((u) => <option key={u.id} value={u.email}>{u.name} — {u.email}</option>)}
            </select>

            {/* Anyone outside the team -- client, consultant, sub. */}
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9AA39D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>External guest</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addGuest(); } }}
                placeholder="name@company.com"
                style={{ boxSizing: 'border-box', flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
              />
              <div onClick={addGuest} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.14)', background: 'white', color: '#173326', flexShrink: 0 }}>Add</div>
            </div>
          </div>
        </div>

        {/* Google Meet toggle */}
        <div style={fieldRow}>
          <div style={iconWrap}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={2} y={6} width={14} height={12} rx={2} /><polygon points="23 7 16 12 23 17 23 7" /></svg>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, color: '#0B1A12' }}>
            <input type="checkbox" checked={addMeet} onChange={(e) => setAddMeet(e.target.checked)} />
            Add Google Meet video conferencing
          </label>
        </div>

        {/* Location */}
        <div style={fieldRow}>
          <div style={iconWrap}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx={12} cy={10} r={3} /></svg>
          </div>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" style={plainInput} />
        </div>

        {/* Description */}
        <div style={fieldRow}>
          <div style={iconWrap}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={21} y1={10} x2={3} y2={10} /><line x1={21} y1={6} x2={3} y2={6} /><line x1={21} y1={14} x2={3} y2={14} /><line x1={17} y1={18} x2={3} y2={18} /></svg>
          </div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add description" style={plainInput} />
        </div>

        {guests.length > 0 && (
          <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 4, paddingLeft: 34 }}>
            Guests are emailed an invite as soon as this is saved.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <div onClick={onClose} style={{ padding: '10px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', background: 'white' }}>Cancel</div>
          <div onClick={saving ? undefined : create} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>
            {saving ? 'Saving…' : 'Save'}
          </div>
        </div>
      </div>
    </div>
  );
}
