import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';

const BG = 'var(--font-display)';
const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 'var(--r-12)', padding: 18, marginBottom: 16,
};

/**
 * Settings → My Calendar.
 *
 * A staff member's own Google Calendar -- separate from the one shared
 * workspace connection everything else (mail, Drive, the office calendars
 * checked while booking a meeting) uses. Connecting here only lets Origami
 * read your own schedule back to you; it never sends mail or touches Drive
 * as you.
 */
export function MyCalendarSettings() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<{ connected: boolean; email: string; connectedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.google.myCalendar.status()
      .then((res: any) => setStatus(res))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // The OAuth callback returns here with the outcome in the query string.
  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('error');
    if (connected) { toast(`Calendar connected as ${connected}`); load(); }
    if (err) setError(err);
    if (connected || err) {
      const next = new URLSearchParams(params);
      next.delete('connected'); next.delete('error');
      setParams(next, { replace: true });
    }
     
  }, [params, setParams, toast]);

  const disconnect = () => {
    setDisconnecting(true);
    api.google.myCalendar.disconnect()
      .then(() => { toast('Calendar disconnected'); load(); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setDisconnecting(false));
  };

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>My Calendar</div>
        <div style={{ fontSize: 12.5, color: 'var(--c-5c6b65)', marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
          Connect your own Google Calendar so your real schedule shows up where you book meetings — read-only, and
          separate from the workspace connection everything else in Origami uses. Nothing here can send mail or
          touch files as you.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>
          {error}
        </div>
      )}

      <div style={card}>
        {status?.connected ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--success)', flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Connected as {status.email}</span>
            </div>
            {status.connectedAt && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 14 }}>Since {new Date(status.connectedAt).toLocaleDateString()}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={api.google.myCalendar.connectUrl()} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: 'var(--mist)', color: 'var(--forest)', textDecoration: 'none' }}>Reconnect</a>
              <div onClick={disconnecting ? undefined : disconnect} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: disconnecting ? 'default' : 'pointer', border: '1px solid rgba(142,46,10,0.2)', color: '#8E2E0A' }}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Not connected</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>Connect your calendar to see your own schedule while booking a meeting.</div>
            <a href={api.google.myCalendar.connectUrl()} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: 'var(--forest)', color: 'white', textDecoration: 'none' }}>
              Connect my calendar
            </a>
          </>
        )}
      </div>
    </div>
  );
}
