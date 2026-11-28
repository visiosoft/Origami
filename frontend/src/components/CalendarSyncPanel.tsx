import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useApp } from '../AppContext';

export interface CalSource { name: string; email: string; company: boolean; ok: boolean; events: number; error?: string }
export interface CalSyncStatus {
  on: boolean; applied: boolean; connected: boolean; connectedEmail: string; window: { pastDays: number; aheadDays: number };
  /** 'everyone' once a sync with people's own calendars was applied. */
  scope?: 'company' | 'everyone';
  people?: { name: string; email: string }[];
  notConnected?: number;
  /** Nov 27: every staff member's calendar -- connected or not, and what the last run read. */
  calendars?: { id: string; name: string; email: string; connected: boolean; lastAt: string | null; events: number | null; ok: boolean | null; error: string | null }[];
  last?: { at: string; events: number; created: number; moved: number; cancelled: number; notes: number; error?: string | null; sources?: CalSource[] } | null;
}
export interface CalSyncPreview {
  events: number; skipped: number; sources?: CalSource[];
  create: { title: string; date: string; time: string; attendees: number; project: string | null; type: string }[];
  move: { id: string; title: string; date: string; time: string; from: string }[];
  cancel: { id: string; title: string }[];
}

const pill = (dark?: boolean) => ({ padding: '8px 16px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), .14)', background: dark ? 'var(--ink)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });
const when = (d: string, t: string) => `${new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${t ? ' · ' + new Date(`2000-01-01T${t}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}`;

/**
 * Nov 19: "we connected our @origamidb calendar, but meetings aren't pulled
 * in". Meetings now come from the connected company Google account's
 * calendar -- and (Nov 20: "for all people it is showing this email") from
 * everyone's own connected calendar too. The first run with them is a preview
 * the office applies; after that it runs every hour by itself.
 */
export function CalendarSyncPanel({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const { toast } = useApp();
  const [st, setSt] = useState<CalSyncStatus | null>(null);
  const [pv, setPv] = useState<CalSyncPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.meetings.calendarSync().then(setSt).catch((e: Error) => setError(e.message)); }, []);
  const domain = (st?.connectedEmail || '').split('@')[1] || '';
  const everyone = st?.scope === 'everyone';
  const canRead = !!st && (st.connected || !!st.people?.length);
  // Calendars: what the last run (or the preview) read, else who is connected.
  const read = pv?.sources || st?.last?.sources || [];
  const calendars: (Omit<CalSource, 'ok' | 'events'> & { ok?: boolean; events?: number })[] = [
    ...(st?.connected ? [read.find((r) => r.company) || { name: 'Company calendar', email: st.connectedEmail, company: true }] : []),
    ...(st?.people || []).map((p) => read.find((r) => !r.company && r.email.toLowerCase() === p.email.toLowerCase()) || { ...p, company: false }),
  ];

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
            Every hour, meetings on the company calendar and on everyone’s own calendar — from {st?.window.pastDays ?? 7} days back to {st?.window.aheadDays ?? 14} days ahead — are added here
            with their guests and Meet link. A meeting several people are in comes in once. Moved meetings follow; cancelled ones (by the organiser) are marked cancelled.
            After a meeting, Gemini’s notes are read in by themselves (Gemini note-taking must be on in the Meet). Meetings you archive or delete are never brought back.
          </p>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--panel)', fontSize: 12.5 }}>
            <b>Invite systems@origamidb.com</b> to every meeting. The Fathom notetaker joins with it, and its notes come in through the shared mailbox
            (reading Fathom notes in by themselves is a later step, once that mailbox is live).
          </div>
          {!st && !error && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
          {st && !st.connected && !st.people?.length && (
            <div role="alert" style={{ padding: '10px 12px', borderRadius: 10, background: '#FBEFD5', color: '#7A4B00' }}>
              No calendar is connected yet. Connect the company account under <b>Settings → Google</b>, and each person can connect their own under <b>Settings → My Calendar</b>.
            </div>
          )}
          {st && (st.connected || !!st.people?.length) && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--panel)', display: 'grid', gap: 6 }}>
              <div>
                Reading {st.connected ? <>the company calendar (<b>{st.connectedEmail}</b>)</> : 'no company calendar'}
                {everyone ? <> and <b>{st.people?.length || 0}</b> {st.people?.length === 1 ? 'person’s' : 'people’s'} own calendar{st.people?.length === 1 ? '' : 's'}.</> : <> only — people’s own calendars come in after the next preview below.</>}
                {domain && domain !== 'origamidb.com' && <span style={{ color: '#8A4B12' }}> That company account isn’t an @origamidb.com one.</span>}
              </div>
              <ul aria-label="Calendars read" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 3, fontSize: 12.5 }}>
                {calendars.map((c) => (
                  <li key={(c.company ? 'co:' : '') + c.email} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <b style={{ color: 'var(--ink)' }}>{c.name}</b>
                    <span style={{ color: 'var(--muted)' }}>{c.email}</span>
                    {c.ok === false
                      ? <span style={{ color: '#8E2E0A' }}>{c.company ? (c.error || 'couldn’t be read') : 'connection expired — reconnect in Settings → My Calendar'}</span>
                      : c.ok ? <span style={{ color: '#2F6B3A' }}>✓ {c.events} event{c.events === 1 ? '' : 's'}</span> : null}
                  </li>
                ))}
              </ul>
              {!!st.notConnected && <div style={{ fontSize: 12, color: '#7A4B00' }}>{st.notConnected} {st.notConnected === 1 ? 'person hasn’t' : 'people haven’t'} connected their calendar yet — each person does it under <b>Settings → My Calendar</b>.</div>}
              {!!st.calendars?.length && (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Everyone’s calendar ({st.calendars.filter((c) => c.connected).length} of {st.calendars.length} connected)</summary>
                  <div role="table" aria-label="Everyone’s calendar" style={{ display: 'grid', gap: 2, marginTop: 6, fontSize: 12.5 }}>
                    {st.calendars.map((c) => (
                      <div role="row" key={c.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 10, padding: '4px 0', borderBottom: '1px solid rgba(var(--rgb-shade), .06)' }}>
                        <span role="cell" style={{ overflowWrap: 'anywhere' }}><b style={{ color: 'var(--ink)' }}>{c.name}</b></span>
                        <span role="cell" style={{ color: !c.connected ? 'var(--muted)' : c.ok === false ? '#8E2E0A' : '#2F6B3A' }}>
                          {!c.connected ? 'not connected'
                            : c.ok === false ? 'connection expired — reconnect in Settings → My Calendar'
                            : c.lastAt ? `✓ read ${new Date(c.lastAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${c.events ?? 0} meeting${c.events === 1 ? '' : 's'}`
                            : 'connected — read on the next run'}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {st.last && <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Last run {new Date(st.last.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}:{' '}
                {st.last.error ? <span style={{ color: '#8E2E0A' }}>{st.last.error}</span> : `${st.last.events} events · ${st.last.created} new · ${st.last.moved} moved · ${st.last.cancelled} cancelled · notes for ${st.last.notes}`}
              </div>}
            </div>
          )}
          {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 9, background: '#F7E4DB', color: '#8E2E0A', fontWeight: 600 }}>{error}</div>}

          {canRead && (!st.applied || !everyone) && !pv && (
            <div><button type="button" style={pill(true)} disabled={!!busy} onClick={preview}>{busy === 'preview' ? 'Reading the calendars…' : st.applied ? 'Preview with everyone’s calendars' : 'Preview what would come in'}</button></div>
          )}
          {pv && (
            <div style={{ display: 'grid', gap: 8 }}>
              <b style={{ color: 'var(--ink)' }}>{pv.create.length ? `${pv.create.length} meeting${pv.create.length === 1 ? '' : 's'} would be added` : 'Nothing new to add'} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {pv.events} calendar events read{pv.skipped ? `, ${pv.skipped} left out (all-day, private, out of office, declined, or archived/deleted here)` : ''}</span></b>
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
          {canRead && st.applied && everyone && !pv && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', flexDirection: 'row', gap: 8, alignItems: 'center', fontWeight: 600, cursor: 'pointer', width: 'auto', margin: 0, fontSize: 13, color: 'var(--body)' }}>
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
