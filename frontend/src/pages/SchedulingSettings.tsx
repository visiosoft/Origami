import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const BG = "'Bricolage Grotesque', serif";
const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.13)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

interface Cal { name: string; email: string }

/**
 * Settings → Calendars.
 *
 * Whose calendars show up when checking availability while booking a
 * meeting. Configured here rather than hardcoded, so the list is whoever the
 * office actually wants deconflicted -- not tied to two specific names.
 */
export function SchedulingSettings() {
  const { toast } = useApp();
  const [calendars, setCalendars] = useState<Cal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.scheduling.calendars()
      .then((res: any) => setCalendars(Array.isArray(res) ? res : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const update = (i: number, patch: Partial<Cal>) =>
    setCalendars((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => setCalendars((prev) => prev.filter((_, j) => j !== i));
  const add = () => setCalendars((prev) => [...prev, { name: '', email: '' }]);

  const save = () => {
    setSaving(true);
    setError('');
    const clean = calendars.filter((c) => c.email.trim());
    api.scheduling.setCalendars(clean)
      .then((res: any) => { setCalendars(res); toast('Calendars saved'); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Calendars</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
          Whoever is listed here shows up when checking availability while booking a meeting. This reads only
          whether they're busy at a time, never what the meeting is — Google only shares that with an account
          that already has permission to see it, same as opening their calendar directly.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 18 }}>
        {calendars.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#9AA39D', marginBottom: 12 }}>No calendars configured yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {calendars.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={c.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" style={{ ...input, width: 160 }} />
              <input value={c.email} onChange={(e) => update(i, { email: e.target.value })} placeholder="email@origami.build" style={{ ...input, flex: 1 }} />
              <span onClick={() => remove(i)} style={{ fontSize: 12, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer', padding: '0 4px' }}>Remove</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <div onClick={add} style={{ fontSize: 12.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>+ Add a calendar</div>
          <div style={{ marginLeft: 'auto' }} />
          <div
            onClick={saving ? undefined : save}
            style={{ padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </div>
        </div>
      </div>
    </div>
  );
}
