import { REPEAT_DAYS, repeatLabel, type RepeatEvery, type RepeatRule } from '../data/taskRepeat';

/**
 * Nov 27 (Weekly Sync): "Repeat" next to the due date -- Never, every day,
 * weekdays, weekly on chosen days, monthly; optionally until a date. One task:
 * marking it done moves its due date to the next time, and the daily reminder
 * reminds on each day it repeats.
 */
export function RepeatPicker({ value, due, disabled, onChange, inputStyle }: {
  value?: RepeatRule | null; due?: string | null; disabled?: boolean; onChange: (r: RepeatRule | null) => void; inputStyle?: React.CSSProperties;
}) {
  const r = value || null;
  const set = (every: RepeatEvery | '') => onChange(every ? { every, ...(every === 'week' ? { days: r?.days?.length ? r.days : due ? [new Date(due + 'T12:00:00').getDay()] : [1] } : {}), ...(r?.until ? { until: r.until } : {}), ...(r?.anchor ? { anchor: r.anchor } : {}) } : null);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <select aria-label="Repeat" disabled={disabled} value={r?.every || ''} onChange={(e) => set(e.target.value as RepeatEvery | '')} style={{ ...inputStyle, width: '100%' }}>
        <option value="">Doesn’t repeat</option>
        <option value="day">Every day</option>
        <option value="weekdays">Every weekday (Mon–Fri)</option>
        <option value="week">Weekly on…</option>
        <option value="month">Monthly</option>
      </select>
      {r?.every === 'week' && (
        <div role="group" aria-label="Repeat on" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {REPEAT_DAYS.map((d, i) => {
            const on = (r.days || []).includes(i);
            return (
              <button key={d} type="button" aria-pressed={on} disabled={disabled}
                onClick={() => { const days = on ? (r.days || []).filter((x) => x !== i) : [...(r.days || []), i].sort(); if (days.length) onChange({ ...r, days }); }}
                style={{ padding: '3px 8px', borderRadius: 999, border: '1px solid ' + (on ? 'var(--forest)' : 'rgba(var(--rgb-shade), .14)'), background: on ? 'var(--forest)' : 'var(--surface)', color: on ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer' }}>{d}</button>
            );
          })}
        </div>
      )}
      {r && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--muted)' }}>
          Until <input type="date" aria-label="Repeat until" disabled={disabled} value={r.until || ''} onChange={(e) => onChange({ ...r, until: e.target.value || null })} style={{ ...inputStyle, padding: '4px 6px', fontSize: 12 }} />
        </label>
      )}
      {r && <div style={{ fontSize: 11, color: 'var(--muted)' }}>↻ {repeatLabel(r, due)} — marking it done moves the due date to the next time; you’re reminded each time.</div>}
    </div>
  );
}
