import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

const BG = "'Bricolage Grotesque', serif";

const card: React.CSSProperties = {
  background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 18, marginBottom: 16,
};

function Toggle({ on, onChange, busy }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <div
      onClick={busy ? undefined : () => onChange(!on)}
      style={{
        width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: on ? '#173326' : '#D6DAD6', cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1, transition: 'background 120ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: 999,
        background: 'white', transition: 'left 120ms',
      }} />
    </div>
  );
}

/**
 * Settings -> Notifications.
 *
 * Two levels: everyone controls their own email, and an administrator can also
 * switch assignment emails off for the whole workspace.
 */
export function NotificationSettings() {
  const { toast, currentRole } = useApp();
  const isAdmin = currentRole?.key === 'admin';

  const [mine, setMine] = useState(true);
  const [workspace, setWorkspace] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.auth.me().catch(() => null),
      isAdmin ? api.settings.get().catch(() => null) : Promise.resolve(null),
    ])
      .then(([me, settings]: any[]) => {
        // Null means never chosen, which reads as on.
        if (me) setMine(me.notifyOnAssignment !== false);
        if (settings) setWorkspace(settings['notifications.assignmentEmail'] !== 'false');
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const saveMine = (value: boolean) => {
    const previous = mine;
    setMine(value);
    setSaving(true);
    setError('');
    api.auth.setNotificationPrefs(value)
      .then(() => toast(value ? 'Assignment emails on' : 'Assignment emails off'))
      .catch((e: Error) => { setMine(previous); setError(e.message); })
      .finally(() => setSaving(false));
  };

  const saveWorkspace = (value: boolean) => {
    const previous = workspace;
    setWorkspace(value);
    setSaving(true);
    setError('');
    api.settings.save({ 'notifications.assignmentEmail': value ? 'true' : 'false' })
      .then(() => toast(value ? 'Assignment emails enabled' : 'Assignment emails disabled for everyone'))
      .catch((e: Error) => { setWorkspace(previous); setError(e.message); })
      .finally(() => setSaving(false));
  };

  const sendTest = () => {
    setSaving(true);
    api.notifications.test()
      .then((r: any) => toast(r?.sent ? 'Sample email sent to you' : `Not sent — ${r?.reason || 'unavailable'}`))
      .catch((e: Error) => toast('⚠ ' + e.message))
      .finally(() => setSaving(false));
  };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  const row = (title: string, hint: string, on: boolean, onChange: (v: boolean) => void) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#5C6B65', marginTop: 3, lineHeight: 1.55 }}>{hint}</div>
      </div>
      <Toggle on={on} onChange={onChange} busy={saving} />
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Notifications</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 620, lineHeight: 1.6 }}>
          When someone assigns you a task, we email you the details and a link straight to it.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>
          {error}
        </div>
      )}

      <div style={card}>
        {row(
          'Email me when I’m assigned a task',
          'Covers the Task Board and the Request Log. You are never emailed for assigning something to yourself.',
          mine, saveMine,
        )}
        <div style={{ borderTop: '1px solid rgba(20,8,31,0.07)', marginTop: 16, paddingTop: 14 }}>
          <span onClick={saving ? undefined : sendTest} style={{ fontSize: 12.5, fontWeight: 700, color: '#173326', cursor: saving ? 'default' : 'pointer' }}>
            Send me a sample →
          </span>
        </div>
      </div>

      {isAdmin && (
        <div style={card}>
          {row(
            'Assignment emails for the whole workspace',
            'Turning this off stops assignment emails for everyone, whatever their own preference says.',
            workspace, saveWorkspace,
          )}
        </div>
      )}
    </div>
  );
}
