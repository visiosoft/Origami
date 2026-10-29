import './DashboardOverview.css';
import { Arrow } from './DashboardArrow';

/** A meeting from the user's Google Calendar, or one of their tasks due, on a day this week. */
export interface WeekItem { id: string; kind: 'meeting' | 'task'; title: string; date: string; project: string; done: boolean; time?: string; sort?: string; link?: string; to?: string }

/** This week, Monday first: meetings and tasks due each day (styles in DashboardOverview.css). */
export function DashboardWeek({ week, calendarConnected, go, className }: {
  week: WeekItem[];
  /** null while unknown; false shows a prompt to connect Google Calendar. */
  calendarConnected?: boolean | null;
  go: (to: string) => void;
  className: string;
}) {
  const now = new Date();
  const monday = new Date(now); monday.setHours(12, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayIso = iso(now);
  const range = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return (
    <div className={className}>
      <div className="do-week-head">
        <h3>This week</h3>
        <span className="do-week-range">{range}</span>
        {calendarConnected === false && <button type="button" className="do-week-connect" onClick={() => go('/my-calendar')}>Connect Google Calendar</button>}
        <Arrow label="Open My Calendar" onClick={() => go('/my-calendar')} />
      </div>
      <div className="do-week-grid">
        {days.map((d) => {
          const di = iso(d);
          const items = week.filter((w) => w.date === di).sort((a, b) => ((a.sort || '') < (b.sort || '') ? -1 : (a.sort || '') > (b.sort || '') ? 1 : 0));
          return (
            <div key={di} className={'do-day' + (di === todayIso ? ' is-today' : '')}>
              <div className="do-day-head"><span>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>{d.getDate()}</b></div>
              <div className="do-day-items">
                {items.slice(0, 4).map((w) => w.kind === 'meeting' ? (
                  <button type="button" key={w.id} className={'do-event is-meeting' + (di < todayIso ? ' is-past' : '')} title={`${w.time} · ${w.title}`}
                    onClick={() => (w.link ? window.open(w.link, '_blank', 'noopener') : go('/my-calendar'))}>
                    <span className="do-event-time">{w.time}</span><span className="do-event-title">{w.title}</span>
                  </button>
                ) : (
                  <button type="button" key={w.id} className={'do-event' + (w.done ? ' is-done' : di < todayIso ? ' is-late' : '')} title={`${w.title} · ${w.project}`} onClick={() => go(w.to || '/tasks')}>{w.title}</button>
                ))}
                {items.length > 4 && <button type="button" className="do-more" onClick={() => go('/my-calendar')}>+{items.length - 4} more</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
