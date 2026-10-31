import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { NotificationMatrix } from '../components/NotificationMatrix';
import { Skeleton } from '../components/Skeleton';

const BG = 'var(--font-display)';

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 'var(--r-12)', padding: 18, marginBottom: 16,
};

function Toggle({ on, onChange, busy }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <div
      onClick={busy ? undefined : () => onChange(!on)}
      style={{
        width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: on ? 'var(--forest)' : '#D6DAD6', cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1, transition: 'background 120ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: 999,
        background: 'var(--surface)', transition: 'left 120ms',
      }} />
    </div>
  );
}

/**
 * Settings -> Notifications.
 *
 * Everyone sets their own matrix (event x text/email, now/daily/weekly); an
 * administrator can also switch task emails off for the whole workspace.
 */
export function NotificationSettings() {
  const { toast, currentRole } = useApp();
  const isAdmin = currentRole?.key === 'admin';

  const [workspace, setWorkspace] = useState(true);
  const [overstretchThreshold, setOverstretchThreshold] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      isAdmin ? api.settings.get().catch(() => null) : Promise.resolve(null),
    ])
      .then(([settings]: any[]) => {
        if (settings) {
          setWorkspace(settings['notifications.assignmentEmail'] !== 'false');
          setOverstretchThreshold(settings['reminders.overstretchThreshold'] || '');
        }
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

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

  if (loading) return <Skeleton label="Loading…" />;

  const row = (title: string, hint: string, on: boolean, onChange: (v: boolean) => void) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--c-5c6b65)', marginTop: 3, lineHeight: 1.55 }}>{hint}</div>
      </div>
      <Toggle on={on} onChange={onChange} busy={saving} />
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>Notifications</div>
        <div style={{ fontSize: 12.5, color: 'var(--c-5c6b65)', marginTop: 4, maxWidth: 620, lineHeight: 1.6 }}>
          Choose how you hear about each thing: a text or an email as it happens, in a daily or weekly digest, or not at all.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>
          {error}
        </div>
      )}

      <NotificationMatrix />
      <div style={{ fontSize: 12, color: 'var(--c-5c6b65)', margin: '10px 0 20px', lineHeight: 1.55 }}>
        Daily digests go out each morning at the reminder hour (Settings → Integrations → Task reminders); weekly digests on Mondays.
        {isAdmin && <> <span onClick={saving ? undefined : sendTest} style={{ fontWeight: 700, color: 'var(--forest)', cursor: saving ? 'default' : 'pointer' }}>Send me a sample task email →</span></>}
      </div>

      {isAdmin && (
        <div style={card}>
          {row(
            'Assignment emails for the whole workspace',
            'Turning this off stops assignment emails for everyone, whatever their own preference says.',
            workspace, saveWorkspace,
          )}
          <div style={{ borderTop: '1px solid rgba(var(--rgb-shade), 0.07)', marginTop: 16, paddingTop: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Overstretch threshold</div>
            <div style={{ fontSize: 12, color: 'var(--c-5c6b65)', marginTop: 3, marginBottom: 8, lineHeight: 1.55 }}>
              A daily notice when someone's open-task count goes over this number. Blank or zero disables it — pick a
              real number before this does anything.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number" min={0} value={overstretchThreshold}
                onChange={(e) => setOverstretchThreshold(e.target.value)}
                placeholder="0 = disabled"
                style={{ width: 100, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 13, fontFamily: 'inherit' }}
              />
              <span
                onClick={saving ? undefined : () => {
                  setSaving(true);
                  api.settings.save({ 'reminders.overstretchThreshold': overstretchThreshold || '0' })
                    .then(() => toast('Threshold saved'))
                    .catch((e: Error) => setError(e.message))
                    .finally(() => setSaving(false));
                }}
                style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--forest)', cursor: saving ? 'default' : 'pointer' }}
              >
                Save
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
