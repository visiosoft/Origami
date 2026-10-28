import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { CHANNELS, toggleChannel, type ChannelKey, type NotifyPrefs } from '../data/notifications';

const cell: React.CSSProperties = { padding: '9px 6px', textAlign: 'center', borderTop: '1px solid rgba(var(--rgb-shade), 0.07)' };

/**
 * Settings -> Notifications: one row per event, one column per way of hearing
 * about it (slide 56). Every tick saves at once. Texts need a phone number,
 * so a missing one is called out above the table.
 */
export function NotificationMatrix() {
  const { toast } = useApp();
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.notifications.prefs().then((p) => { setPrefs(p); setPhone(p.phone); }).catch((e: Error) => setError(e.message));
  }, []);

  const save = (body: Parameters<typeof api.notifications.setPrefs>[0], done?: string) => {
    setBusy(true);
    setError('');
    api.notifications.setPrefs(body)
      .then((p) => { setPrefs(p); setPhone(p.phone); if (done) toast(done); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  const pick = (event: string, channel: ChannelKey | 'none') => {
    if (!prefs) return;
    const matrix = { ...prefs.matrix, [event]: toggleChannel(prefs.matrix[event] || [], channel) };
    setPrefs({ ...prefs, matrix });
    save({ matrix });
  };

  if (error && !prefs) return <div style={{ fontSize: 13, color: '#8E2E0A' }}>{error}</div>;
  if (!prefs) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>;
  const groups = [...new Set(prefs.events.map((e) => e.group))];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {prefs.warnings.map((w) => (
        <div key={w} role="alert" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--amber-light)', fontSize: 12.5, fontWeight: 600, color: 'var(--c-8a6d12)' }}>{w}</div>
      ))}
      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7E4DB', fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>{error}</div>}

      <div style={{ overflowX: 'auto', border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 'var(--r-12)', background: 'var(--surface)' }}>
        {/* Each event's name sits above its row of ticks, so the table fits a narrow card. */}
        <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {CHANNELS.map((c) => (
                <th key={c.key} style={{ ...cell, borderTop: 0, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                  {c.label}<div style={{ fontWeight: 500, fontSize: 10.5, color: 'var(--muted)' }}>{c.when}</div>
                </th>
              ))}
              <th style={{ ...cell, borderTop: 0, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>None<div style={{ fontWeight: 500, fontSize: 10.5, color: 'var(--muted)' }}>not needed</div></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => [
              <tr key={'g' + g}><td colSpan={CHANNELS.length + 1} style={{ padding: '12px 14px 4px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forest)' }}>{g}</td></tr>,
              ...prefs.events.filter((e) => e.group === g).map((e) => {
                const row = prefs.matrix[e.key] || [];
                return [
                  <tr key={e.key + ':name'}>
                    <td colSpan={CHANNELS.length + 1} style={{ ...cell, textAlign: 'left', padding: '10px 14px 0' }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{e.label}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 8 }}>{e.hint}</span>
                    </td>
                  </tr>,
                  <tr key={e.key}>
                    {CHANNELS.map((c) => (
                      <td key={c.key} style={{ ...cell, borderTop: 0 }}>
                        <input type="checkbox" checked={row.includes(c.key)} disabled={busy} onChange={() => pick(e.key, c.key)}
                          aria-label={`${e.label}: ${c.label} ${c.when}`} style={{ width: 17, height: 17, accentColor: 'var(--forest)', cursor: 'pointer' }} />
                      </td>
                    ))}
                    <td style={{ ...cell, borderTop: 0 }}>
                      <input type="checkbox" checked={row.length === 0} disabled={busy || row.length === 0} onChange={() => pick(e.key, 'none')}
                        aria-label={`${e.label}: no notification`} style={{ width: 17, height: 17, accentColor: 'var(--muted)', cursor: 'pointer' }} />
                    </td>
                  </tr>,
                ];
              }),
            ])}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>Mobile number for texts</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={prefs.phoneFromPeople || '(415) 555 0100'} inputMode="tel" aria-label="Mobile number for texts"
              style={{ width: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }} />
            <button type="button" disabled={busy || phone === prefs.phone} onClick={() => save({ phone }, 'Number saved')}
              style={{ padding: '8px 14px', borderRadius: 999, border: 0, background: phone === prefs.phone ? 'var(--c-c9d4cc)' : 'var(--forest)', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: phone === prefs.phone ? 'default' : 'pointer' }}>Save</button>
          </div>
          {!prefs.phone && prefs.phoneFromPeople && <span>Using {prefs.phoneFromPeople} from your People record until you enter one.</span>}
        </label>
        <span style={{ flex: 1 }} />
        {prefs.custom && (
          <button type="button" disabled={busy} onClick={() => save({ matrix: null }, 'Back to the defaults')}
            style={{ border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>Back to the defaults</button>
        )}
        <a href="/notifications" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--forest)' }}>See my notifications →</a>
      </div>
    </div>
  );
}
