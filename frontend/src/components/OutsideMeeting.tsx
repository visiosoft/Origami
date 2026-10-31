import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { MEETING_PLATFORMS, parseInvite } from '../data/meetingInvite';
import type { Meeting } from '../data/meetings';

/**
 * An outside meeting (Oct 26 review notes, D1): someone else's invite. Paste
 * it and the meeting fills in -- link, platform, organiser, date and time --
 * then it's reviewed for special actions like any other meeting. Rendered
 * inside the meeting form's grid (`.mt-form`).
 */
export function OutsideMeeting({ m, today, disabled, onChange }: {
  m: Partial<Meeting>; today: string; disabled?: boolean; onChange: (p: Partial<Meeting>) => void;
}) {
  const { toast } = useApp();
  const [paste, setPaste] = useState('');
  const saved = useMemo(() => (m.invite ? parseInvite(m.invite, today) : null), [m.invite, today]);

  const read = () => {
    const text = paste.trim();
    if (!text) return;
    const p = parseInvite(text, today);
    const patch: Partial<Meeting> = { invite: text };
    const got: string[] = [];
    if (p.link || p.phone) { patch.location = p.link || p.phone; patch.locationType = p.link ? 'virtual' : 'call'; got.push(p.link ? 'the link' : 'the dial-in'); }
    if (p.platform) { patch.platform = p.platform; got.push('the platform'); }
    if (p.organizer) { patch.organizer = p.organizer; got.push('the organiser'); }
    if (p.organizerOrg && !m.organizerOrg) patch.organizerOrg = p.organizerOrg;
    if (p.date) { patch.date = p.date; got.push('the date'); }
    if (p.time) { patch.time = p.time; got.push('the time'); }
    if (p.title && !String(m.title || '').trim()) { patch.title = p.title; got.push('the title'); }
    onChange(patch);
    setPaste('');
    toast(got.length ? `Filled in ${got.join(', ')} — check them` : 'Nothing recognised in the invite — fill it in by hand; the invite is kept');
  };

  return (
    <>
      <div className="is-wide mt-outside">
        <strong>Outside meeting — someone else’s invite</strong>
        <ol>
          <li>Paste their invite (the email or calendar text) and fill it in from it.</li>
          <li>Add who from our side is going.</li>
          <li>Afterwards, add their notes, recording or transcript if they share them — or our own notes.</li>
          <li>Review it for special actions and FOR RECORD items, like any meeting.</li>
        </ol>
      </div>
      {!disabled && (
        <label className="is-wide">Paste the invite
          <textarea className="mt-text" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="The Teams / Zoom / Meet invite, as it came in" />
          <span><button type="button" className="ak-btn" disabled={!paste.trim()} onClick={read}>Fill in from the invite</button></span>
        </label>
      )}
      <label>Organiser<input disabled={disabled} value={m.organizer || ''} onChange={(e) => onChange({ organizer: e.target.value })} placeholder="Who sent the invite" /></label>
      <label>Their company<input disabled={disabled} value={m.organizerOrg || ''} onChange={(e) => onChange({ organizerOrg: e.target.value })} placeholder="e.g. City of LA — Plan Check" /></label>
      <label>Platform
        <select disabled={disabled} value={m.platform || ''} onChange={(e) => onChange({ platform: e.target.value || null })}>
          <option value="">Choose…</option>
          {MEETING_PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      {saved && (saved.meetingId || saved.passcode || saved.phone) && (
        <div className="mt-field">
          <span>From the invite</span>
          <span className="mt-muted" style={{ overflowWrap: 'anywhere' }}>
            {[saved.meetingId && `Meeting ID ${saved.meetingId}`, saved.passcode && `Passcode ${saved.passcode}`, saved.phone && saved.phone !== m.location && `Dial-in ${saved.phone}`].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}
      {m.invite && (
        <details className="is-wide mt-invite">
          <summary>The invite as pasted</summary>
          <pre>{m.invite}</pre>
        </details>
      )}
    </>
  );
}
