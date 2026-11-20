import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useApp } from '../AppContext';

export interface CalSyncStatus {
  /** connected / connectedEmail: the viewer's OWN calendar (Nov 20); people: how many calendars are read. */
  on: boolean; applied: boolean; connected: boolean; connectedEmail: string; people?: number; window: { pastDays: number; aheadDays: number };
  last?: { at: string; events: number; created: number; moved: number; cancelled: number; notes: number; error?: string | null } | null;
}
export interface CalSyncPreview {
  events: number; skipped: number;
  create: { title: string; date: string; time: string; attendees: number; project: string | null; type: string }[];
  move: { id: string; title: string; date: string; time: string; from: string }[];
  cancel: { id: string; title: string }[];
}

const pill = (dark?: boolean) => ({ padding: '8px 16px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), .14)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });
const when = (d: string, t: string) => `${new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${t ? ' · ' + new Date(`2000-01-01T${t}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}`;

/**
 * Nov 19: "we connected our @origamidb calendar, but meetings aren't pulled
 * in". Meetings now come from the connected company Google account's
 * calendar. The first run is a preview the office applies; after that it runs
 * every hour by itself.
 */
export function CalendarSyncPanel({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const { toast } = useApp();
  const [st, setSt] = useState<CalSyncStatus | null>(null);
  const [pv, setPv] = useState<CalSyncPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.meetings.calendarSync().then(setSt).catch((e: Error) => setError(e.message)); }, []);
  const domain = (st?.connectedEmail || '').split('@')[1] || '';

  const preview = () => { setBusy('preview'); setError(''); api.meetings.calendarPreview().then(setPv).catch((e: Error) => setError(e.message)).finally(() => setBusy(null)); };
  const apply = () => {
    setBusy('apply'); setError('');
    api.meetings.calendarApply().then((r) => {
      toast(`Calendar: ${r.created} new meeting${r.created === 1 ? '' : 's'}${r.moved ? `, ${r.moved} moved` : ''}${r.cancelled ? `, ${r.cancelled} cancelled` : ''}${r.notes ? `, notes for ${r.notes}` : ''}`);
      setPv(null); onApplied();
      return api.meetings.calendarSync().then(setSt);
    }).catch((e: Error) => setError(e.message)).finally(() => setBusy(null));
  };
  const toggle = () => { if (!st) return; setBusy('on'); api.meetings.calendarOn(!st.on).then(setSt).catch((e: Error) => setError(e.message)).finally(() => setBusy(null)); };

  return createPortal(
    <div className="mt-bg" onClick={onClose}>
      <aside className="mt-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Meetings from Google Calendar" style={{ maxWidth: 640 }}>
        <div className="mt-head"><h2>Meetings from Google Calendar</h2><button type="button" className="mt-x" onClick={onClose} aria-label="Close">×</button></div>
        <div style={{ display: 'grid', gap: 12, fontSize: 13, color: 'var(--body)', lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>
            Every hour, meetings on each person’s own Google calendar (connected under Settings → My Calendar) — from {st?.window.pastDays ?? 7} days back to {st?.window.aheadDays ?? 14} days ahead — are added here
            with their guests and Meet link; a meeting several of you are in comes in once. Moved meetings follow, cancelled ones are marked cancelled. After a meeting, Gemini’s notes are read in by themselves
            (Gemini note-taking must be on in the Meet). Meetings you archive or delete are never brought back.
          </p>
          {!st && !error && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
          {st && !st.connected && (
            <div role="alert" style={{ padding: '10px 12px', borderRadius: 10, background: '#FBEFD5', color: '#7A4B00' }}>
              Your calendar isn’t connected, so your meetings don’t come in. Connect it under <b>Settings → My Calendar</b>.
              {(st.people ?? 0) > 0 && <> {st.people} {st.people === 1 ? 'person’s calendar is' : 'people’s calendars are'} read now.</>}
            </div>
          )}
          {st?.connected && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--panel)' }}>
              Reading your calendar, <b>{st.connectedEmail}</b>{(st.people ?? 1) > 1 ? <> — and {(st.people ?? 1) - 1} other {(st.people ?? 1) - 1 === 1 ? 'person’s' : 'people’s'}</> : null}.
              {domain && domain !== 'origamidb.com' && <span style={{ color: '#8A4B12' }}> That isn’t an @origamidb.com account — if your meetings are on another calendar, connect that one in Settings → My Calendar.</span>}
              {st.last && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Last run {new Date(st.last.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}:{' '}
                {st.last.error ? <span style={{ color: '#8E2E0A' }}>{st.last.error}</span> : `${st.last.events} events · ${st.last.created} new · ${st.last.moved} moved · ${st.last.cancelled} cancelled · notes for ${st.last.notes}`}
              </div>}
            </div>
          )}
          {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 9, background: '#F7E4DB', color: '#8E2E0A', fontWeight: 600 }}>{error}</div>}

          {((st?.people ?? 0) > 0) && !st?.applied && !pv && (
            <div><button type="button" style={pill(true)} disabled={!!busy} onClick={preview}>{busy === 'preview' ? 'Reading the calendar…' : 'Preview what would come in'}</button></div>
          )}
          {pv && (
            <div style={{ display: 'grid', gap: 8 }}>
              <b style={{ color: 'var(--ink)' }}>{pv.create.length ? `${pv.create.length} meeting${pv.create.length === 1 ? '' : 's'} would be added` : 'Nothing new to add'} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {pv.events} calendar events read{pv.skipped ? `, ${pv.skipped} left out (all-day, just you, declined, or archived/deleted here)` : ''}</span></b>
              {pv.create.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
                  {pv.create.map((c, i) => (
                    <li key={i} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), .08)' }}>
                      <b style={{ color: 'var(--ink)' }}>{c.title}</b>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{[when(c.date, c.time), `${c.attendees} guests`, c.project, c.type === 'Outside' ? 'someone else’s invite' : ''].filter(Boolean).join(' · ')}</div>
                    </li>
                  ))}
                </ul>
              )}
              {pv.move.length > 0 && <div style={{ fontSize: 12 }}>{pv.move.length} moved: {pv.move.map((m) => `${m.title} → ${when(m.date, m.time)}`).join('; ')}</div>}
              {pv.cancel.length > 0 && <div style={{ fontSize: 12 }}>{pv.cancel.length} cancelled: {pv.cancel.map((m) => m.title).join('; ')}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" style={pill()} onClick={() => setPv(null)}>Not now</button>
                <button type="button" style={pill(true)} disabled={!!busy} onClick={apply}>{busy === 'apply' ? 'Adding…' : `Apply${pv.create.length ? ` — add ${pv.create.length}` : ''} and keep in step hourly`}</button>
              </div>
            </div>
          )}
          {(st?.people ?? 0) > 0 && st?.applied && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={st.on} disabled={busy === 'on'} onChange={toggle} style={{ width: 18, height: 18 }} /> Pull meetings in every hour
              </label>
              <span style={{ flex: 1 }} />
              <button type="button" style={pill(true)} disabled={!!busy} onClick={apply}>{busy === 'apply' ? 'Syncing…' : 'Sync now'}</button>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
