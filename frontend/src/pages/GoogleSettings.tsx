import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type GoogleStatus, type DriveFile } from '../api';
import { useApp } from '../AppContext';

const BG = "'Bricolage Grotesque', serif";

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

const card: React.CSSProperties = {
  background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 18, marginBottom: 16,
};

type Form = {
  'google.clientId': string;
  'google.clientSecret': string;
  'app.baseUrl': string;
  'google.senderEmail': string;
  'google.hostedDomain': string;
  'google.attachmentsFolder': string;
  'reminders.enabled': string;
  'reminders.hour': string;
  'reminders.timezone': string;
};

const EMPTY: Form = {
  'google.clientId': '', 'google.clientSecret': '', 'app.baseUrl': '',
  'google.senderEmail': '', 'google.hostedDomain': '',
  'google.attachmentsFolder': '', 'reminders.enabled': '', 'reminders.hour': '7',
  'reminders.timezone': 'Asia/Dubai',
};

/**
 * Settings → Integrations → Google Workspace.
 * Holds the OAuth client credentials and connects the account the platform
 * uses to send email (Gmail) and read files (Drive).
 */
export function GoogleSettings() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<Form>(EMPTY);
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => {
    Promise.all([api.settings.get(), api.google.status().catch(() => null)])
      .then(([s, st]) => {
        setForm({ ...EMPTY, ...(s as Partial<Form>) });
        setStatus(st);
        if (st?.senderEmail && !s['google.senderEmail']) setTestTo(st.senderEmail);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // The OAuth callback returns here with the outcome in the query string.
  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('error');
    if (connected) { toast(`Google connected as ${connected}`); }
    if (err) setError(err);
    if (connected || err) {
      const next = new URLSearchParams(params);
      next.delete('connected'); next.delete('error');
      setParams(next, { replace: true });
    }
  }, [params, setParams, toast]);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setSaving(true);
    setError('');
    api.settings.save(form)
      .then((s) => { setForm({ ...EMPTY, ...(s as Partial<Form>) }); toast('Google settings saved'); return api.google.status(); })
      .then(setStatus)
      .catch((e: Error) => { setError(e.message); toast('⚠ Failed to save settings'); })
      .finally(() => setSaving(false));
  };

  const disconnect = () => {
    if (!confirm('Disconnect the Google account? Outgoing email and Drive access will stop working.')) return;
    api.google.disconnect().then(setStatus).then(() => toast('Google account disconnected')).catch((e: Error) => setError(e.message));
  };

  const sendTest = () => {
    setError('');
    api.google.testEmail(testTo || undefined)
      .then((r) => toast(`Test email sent to ${r.to}`))
      .catch((e: Error) => { setError(e.message); toast('⚠ Test email failed'); });
  };

  const ready = !!form['google.clientId'] && !!form['app.baseUrl'];

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Google Workspace</div>
        <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
          One OAuth client powers three things: <strong>Sign in with Google</strong>, <strong>outgoing email</strong> (invitations,
          introduction letters) and <strong>Google Drive</strong> access. Create the client in the Google Cloud console, paste the
          credentials here, then connect the account mail should be sent from.
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#8E2E0A', flexShrink: 0, marginTop: 6 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8E2E0A', lineHeight: 1.55 }}>{error}</span>
        </div>
      )}

      {/* ---------------------------------------------------------- credentials */}
      <div style={card}>
        <SectionTitle>OAuth client</SectionTitle>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <Field label="Client ID" hint="From Google Cloud → APIs & Services → Credentials">
            <input style={inputStyle} value={form['google.clientId']} onChange={(e) => set('google.clientId', e.target.value)} placeholder="1234567890-abc.apps.googleusercontent.com" />
          </Field>
          <Field label="Client secret" hint="Stored encrypted at rest; shown masked once saved">
            <input style={inputStyle} type="password" value={form['google.clientSecret']} onChange={(e) => set('google.clientSecret', e.target.value)} placeholder="GOCSPX-…" />
          </Field>
          <Field label="App base URL" hint="Where this app is served from, no trailing slash">
            <input style={inputStyle} value={form['app.baseUrl']} onChange={(e) => set('app.baseUrl', e.target.value)} placeholder="https://origami.example.com" />
          </Field>
          <Field label="Send email from" hint="Leave blank to use the connected account">
            <input style={inputStyle} value={form['google.senderEmail']} onChange={(e) => set('google.senderEmail', e.target.value)} placeholder="hello@origamidb.com" />
          </Field>
          <Field label="Restrict to domain (optional)" hint="Only this Google Workspace domain may sign in">
            <input style={inputStyle} value={form['google.hostedDomain']} onChange={(e) => set('google.hostedDomain', e.target.value)} placeholder="origamidb.com" />
          </Field>
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: '#EEF3EE' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93', marginBottom: 5 }}>Authorised redirect URI</div>
          <div style={{ fontSize: 12.5, color: '#173326', fontWeight: 600, wordBreak: 'break-all' }}>
            {status?.redirectUri || (form['app.baseUrl'] ? `${form['app.baseUrl'].replace(/\/+$/, '')}/api/google/callback` : 'Set the app base URL first')}
          </div>
          <div style={{ fontSize: 11.5, color: '#5C6B65', marginTop: 6, lineHeight: 1.55 }}>
            Add this exact URI to your OAuth client in the Google Cloud console, and enable the <strong>Gmail API</strong> and{' '}
            <strong>Google Drive API</strong> for the project.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div onClick={saving ? undefined : save} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? '#9AB0A4' : '#173326', color: 'white' }}>{saving ? 'Saving…' : 'Save settings'}</div>
        </div>
      </div>

      {/* ------------------------------------------------------------ connection */}
      <div style={card}>
        <SectionTitle>Connected account</SectionTitle>
        {status?.connected ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#1E6B36' }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0B1A12' }}>{status.connectedEmail}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#D2EAD3', color: '#1E6B36' }}>Connected</span>
              {status.connectedAt && <span style={{ fontSize: 11.5, color: '#7E9B93' }}>since {new Date(status.connectedAt).toLocaleDateString()}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#5C6B65', marginTop: 8 }}>
              Mail is sent as <strong>{status.senderEmail || status.connectedEmail}</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, width: 230 }} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send a test to…" />
              <div onClick={sendTest} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#EEF3EE', color: '#173326' }}>Send test email</div>
              <a href={api.google.connectUrl()} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: '#EEF3EE', color: '#173326', textDecoration: 'none' }}>Reconnect</a>
              <div onClick={disconnect} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#F7E4DB', color: '#8E2E0A' }}>Disconnect</div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12.5, color: '#5C6B65', lineHeight: 1.6, marginBottom: 14, maxWidth: 580 }}>
              No account connected yet. Connect the mailbox invitations and project emails should come from — Google will ask for
              permission to send mail and access Drive on its behalf.
            </div>
            {ready ? (
              <a href={api.google.connectUrl()} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: '#173326', color: 'white', textDecoration: 'none' }}>
                Connect Google account
              </a>
            ) : (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8A6D12', background: '#FBE9AE', borderRadius: 8, padding: '9px 13px', display: 'inline-block' }}>
                Save a Client ID, Client secret and App base URL first.
              </div>
            )}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- attachments */}
      {status?.connected && (
        <div style={card}>
          <SectionTitle>File attachments</SectionTitle>
          <div style={{ fontSize: 12.5, color: '#5C6B65', lineHeight: 1.6, marginBottom: 14, maxWidth: 600 }}>
            Files attached to tasks are uploaded to this account's Drive, inside a folder per project. Origami streams them
            back through its own API, so anyone signed in here can see a screenshot without needing access to the Google account.
          </div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <Field label="Attachments folder" hint="Created in Drive on first upload">
              <input style={inputStyle} value={form['google.attachmentsFolder']} onChange={(e) => set('google.attachmentsFolder', e.target.value)} placeholder="Origami Attachments" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <div onClick={saving ? undefined : save} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Save</div>
            <div
              onClick={() => {
                setBusy('drive'); setError('');
                api.google.testDrive()
                  .then(() => toast('Drive access is working'))
                  .catch((e: Error) => { setError(e.message); toast('⚠ Drive test failed'); })
                  .finally(() => setBusy(''));
              }}
              style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#EEF3EE', color: '#173326' }}
            >
              {busy === 'drive' ? 'Testing…' : 'Test Drive access'}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- reminders */}
      {status?.connected && (
        <div style={card}>
          <SectionTitle>Task reminders</SectionTitle>
          <div style={{ fontSize: 12.5, color: '#5C6B65', lineHeight: 1.6, marginBottom: 14, maxWidth: 600 }}>
            A daily digest of overdue and upcoming tasks, emailed to whoever they're assigned to. Sent through the connected
            account, once per day.
          </div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Field label="Send reminders">
              <select style={inputStyle} value={form['reminders.enabled'] || 'false'} onChange={(e) => set('reminders.enabled', e.target.value)}>
                <option value="false">Off</option>
                <option value="true">On</option>
              </select>
            </Field>
            <Field label="Send at" hint="Local hour, 24-hour clock">
              <select style={inputStyle} value={form['reminders.hour'] || '7'} onChange={(e) => set('reminders.hour', e.target.value)}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </Field>
            <Field label="Timezone" hint="IANA name, e.g. Asia/Dubai">
              <input style={inputStyle} value={form['reminders.timezone']} onChange={(e) => set('reminders.timezone', e.target.value)} placeholder="Asia/Dubai" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <div onClick={saving ? undefined : save} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Save</div>
            <div
              onClick={() => {
                setBusy('reminders'); setError('');
                api.reminders.run()
                  .then((r) => toast(r.sent ? `Reminders sent to ${r.sent} person(s)` : 'Nobody has tasks due — nothing sent'))
                  .catch((e: Error) => { setError(e.message); toast('⚠ Could not send reminders'); })
                  .finally(() => setBusy(''));
              }}
              style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#EEF3EE', color: '#173326' }}
            >
              {busy === 'reminders' ? 'Sending…' : 'Send now'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#7E9B93', marginTop: 10, lineHeight: 1.55 }}>
            The scheduler runs inside the app, so the App Service needs <strong>Always On</strong> enabled for it to fire
            reliably. "Send now" works regardless.
          </div>
        </div>
      )}

      {status?.connected && <DrivePanel />}
    </div>
  );
}

function DrivePanel() {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = (term?: string) => {
    setLoading(true);
    setError('');
    api.google.driveFiles(term ?? q)
      .then(setFiles)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div style={card}>
      <SectionTitle>Google Drive</SectionTitle>
      <div style={{ fontSize: 12.5, color: '#5C6B65', marginBottom: 12 }}>Recent files on the connected account — confirms Drive access is working.</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input style={{ ...inputStyle, width: 240 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search file names…" />
        <div onClick={() => search()} style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#EEF3EE', color: '#173326' }}>{loading ? 'Loading…' : files ? 'Search' : 'Browse Drive'}</div>
      </div>
      {error && <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>{error}</div>}
      {files && files.length === 0 && <div style={{ fontSize: 12.5, color: '#7E9B93' }}>No files matched.</div>}
      {files && files.length > 0 && (
        <div style={{ border: '1px solid rgba(20,8,31,0.07)', borderRadius: 10, overflow: 'hidden' }}>
          {files.map((f, i) => (
            <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer"
               style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderTop: i ? '1px solid rgba(20,8,31,0.06)' : 'none', textDecoration: 'none' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0B1A12', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: 11, color: '#7E9B93', flexShrink: 0 }}>{f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ''}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7E9B93', marginBottom: 14 }}>{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#43514D' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: '#7E9B93', lineHeight: 1.45 }}>{hint}</span>}
    </div>
  );
}
