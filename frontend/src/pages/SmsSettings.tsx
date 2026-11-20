import { useEffect, useState } from 'react';
import { api, type QuoTasksStatus } from '../api';
import { useApp } from '../AppContext';
import { Skeleton } from '../components/Skeleton';

const BG = 'var(--font-display)';
const MASK = '••••••••';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit',
  fontSize: 13, color: 'var(--ink)', outline: 'none',
};

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 'var(--r-12)', padding: 18, marginBottom: 16,
};

type Form = {
  'sms.accountSid': string; 'sms.authToken': string; 'sms.fromNumber': string; 'sms.enabled': string;
  'sms.provider': string; 'sms.quoApiKey': string; 'sms.quoFrom': string; 'sms.quoWebhookSecret': string;
};
const EMPTY: Form = { 'sms.accountSid': '', 'sms.authToken': '', 'sms.fromNumber': '', 'sms.enabled': 'true', 'sms.provider': 'twilio', 'sms.quoApiKey': '', 'sms.quoFrom': '', 'sms.quoWebhookSecret': '' };
const QUO_LINE = '+16507614661';

interface Status { provider?: 'twilio' | 'quo'; configured: boolean; enabled: boolean; fromNumber: string; accountSid: string }

/**
 * Settings → SMS.
 *
 * Texts go out through Quo -- the office line, so replies land in Quo (Oct 27
 * sync) -- or Twilio. Keys and tokens are stored masked like the other
 * secrets, so posting the mask back leaves them unchanged.
 */
export function SmsSettings() {
  const { toast } = useApp();
  const [form, setForm] = useState<Form>(EMPTY);
  const [status, setStatus] = useState<Status | null>(null);
  const [testTo, setTestTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = () => api.sms.status().then((s: any) => setStatus(s as Status)).catch(() => setStatus(null));

  useEffect(() => {
    Promise.all([api.settings.get(), api.sms.status().catch(() => null)])
      .then(([s, st]: any[]) => {
        setForm({ ...EMPTY, ...(s as Partial<Form>) });
        if (st) setStatus(st as Status);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setSaving(true);
    setError('');
    api.settings.save(form)
      .then((s: any) => { setForm({ ...EMPTY, ...(s as Partial<Form>) }); toast('SMS settings saved'); return loadStatus(); })
      .catch((e: Error) => { setError(e.message); toast('⚠ Failed to save'); })
      .finally(() => setSaving(false));
  };

  const sendTest = () => {
    if (!testTo.trim()) { setError('Enter a number to text.'); return; }
    setSending(true);
    setError('');
    api.sms.test(testTo.trim())
      .then((r: any) => toast(`Test sent to ${r?.to || testTo}`))
      .catch((e: Error) => { setError(e.message); toast('⚠ ' + e.message); })
      .finally(() => setSending(false));
  };

  if (loading) return <Skeleton label="Loading…" />;

  const enabled = form['sms.enabled'] !== 'false';

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>Text messages</div>
        <div style={{ fontSize: 12.5, color: 'var(--c-5c6b65)', marginTop: 4, maxWidth: 640, lineHeight: 1.6 }}>
          Texting clients from the system (“Text client” on a lead, contact or project), using the SMS templates.
          Sent through Quo from the office line, so replies come back to Quo.
        </div>
      </div>

      {error && (
        <div style={{ padding: '11px 14px', borderRadius: 10, background: '#F7E4DB', border: '1px solid rgba(142,46,10,0.18)', marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: '#8E2E0A' }}>
          {error}
        </div>
      )}

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: status?.configured ? (status.enabled ? 'var(--success)' : '#93520F') : '#B8410F' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            {status?.configured ? (status.enabled ? 'Ready to send' : 'Configured, but switched off') : 'Not configured'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            {status?.configured
              ? `Sending through ${status.provider === 'quo' ? 'Quo' : 'Twilio'} as ${status.fromNumber}${status.provider === 'quo' ? '' : ` · account ${status.accountSid}`}`
              : form['sms.provider'] === 'quo' ? 'Add the Quo API key below.' : 'Add the account SID, auth token and sending number below.'}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 10 }}>Send through</div>
        <div role="radiogroup" aria-label="SMS provider" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['quo', 'Quo — the office line'], ['twilio', 'Twilio']] as const).map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: '1px solid ' + (form['sms.provider'] === k ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.14)'), fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' }}>
              <input type="radio" name="sms-provider" checked={(form['sms.provider'] || 'twilio') === k} onChange={() => set('sms.provider', k)} /> {label}
            </label>
          ))}
        </div>
      </div>

      {form['sms.provider'] === 'quo' && (
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 14 }}>Quo</div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>API key</label>
              <input style={inputStyle} type="password" value={form['sms.quoApiKey']} onChange={(e) => set('sms.quoApiKey', e.target.value)} placeholder={MASK} aria-label="Quo API key" />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Create one in Quo → Settings → API. Stored masked; leave as {MASK} to keep the saved key.</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>Send from</label>
              <input style={inputStyle} value={form['sms.quoFrom']} onChange={(e) => set('sms.quoFrom', e.target.value)} placeholder={QUO_LINE} aria-label="Quo number" />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>The Quo number texts come from. Blank = the office line, (650) 761-4661.</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>STOP replies — webhook signing secret</label>
              <input style={inputStyle} type="password" value={form['sms.quoWebhookSecret']} onChange={(e) => set('sms.quoWebhookSecret', e.target.value)} placeholder={MASK} aria-label="Quo webhook signing secret" />
              <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                In Quo, add a webhook for <b>message.received</b> pointing to <code>{window.location.origin}/api/texts/quo-webhook</code> and paste its signing secret here.
                People who reply STOP then stop getting texts; START turns them back on. Every text ends with “Reply STOP to opt out” and a link to choose which texts they get.
              </span>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={(e) => set('sms.enabled', e.target.checked ? 'true' : 'false')} />
            Sending is on
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>— untick to stop every outgoing text without clearing the key.</span>
          </label>
        </div>
      )}

      <div style={{ ...card, display: form['sms.provider'] === 'quo' ? 'none' : undefined }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 14 }}>Twilio Account</div>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>Account SID</label>
            <input style={inputStyle} value={form['sms.accountSid']} onChange={(e) => set('sms.accountSid', e.target.value)} placeholder="ACxxxxxxxx…" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>Auth Token</label>
            <input style={inputStyle} type="password" value={form['sms.authToken']} onChange={(e) => set('sms.authToken', e.target.value)} placeholder={MASK} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Stored masked. Leave as {MASK} to keep the saved token.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--body)' }}>Sending Number</label>
            <input style={inputStyle} value={form['sms.fromNumber']} onChange={(e) => set('sms.fromNumber', e.target.value)} placeholder="+14155550100" />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>A number on your Twilio account, in +country format.</span>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => set('sms.enabled', e.target.checked ? 'true' : 'false')} />
          Sending is on
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>— untick to stop every outgoing text without clearing the credentials.</span>
        </label>
      </div>

      <div style={card}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 12 }}>Send a Test</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inputStyle, flex: '1 1 220px' }} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+14155551234" />
          <div onClick={sending || !status?.configured ? undefined : sendTest}
            style={{ padding: '9px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: sending || !status?.configured ? 'default' : 'pointer', background: status?.configured ? (sending ? 'var(--c-9ab0a4)' : 'var(--forest)') : 'var(--c-d6ded8)', color: status?.configured ? 'white' : 'var(--c-9aa39d)' }}>
            {sending ? 'Sending…' : 'Send test'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-9aa39d)', marginTop: 8, lineHeight: 1.5 }}>
          Sends one real text and is billed like any other. Save your credentials first.
        </div>
      </div>

      <div onClick={saving ? undefined : save}
        style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', background: saving ? 'var(--c-9ab0a4)' : 'var(--forest)', color: 'white' }}>
        {saving ? 'Saving…' : 'Save SMS settings'}
      </div>
      {form['sms.provider'] === 'quo' && <QuoTasksPanel />}
    </div>
  );
}

/**
 * Quo tasks (D6, Nov 15): every task made in Quo comes in as a Task (with
 * where it came from); done or reopened here changes it in Quo, and the other
 * way round. Open Quo tasks from before are previewed, then imported.
 */
function QuoTasksPanel() {
  const { toast } = useApp();
  const [st, setSt] = useState<QuoTasksStatus | null>(null);
  const [pv, setPv] = useState<Awaited<ReturnType<typeof api.quoTasks.preview>> | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { api.quoTasks.status().then(setSt).catch(() => setSt(null)); }, []);
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try { await fn(); } catch (e) { toast('⚠ ' + (e as Error).message); } finally { setBusy(''); }
  };
  if (!st) return null;
  const pill = (primary: boolean, off = false) => ({ padding: '8px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: off ? 'default' : 'pointer', background: primary ? 'var(--forest)' : 'var(--mist)', color: primary ? '#fff' : 'var(--forest)', opacity: off ? 0.55 : 1 } as const);
  return (
    <div style={{ ...card, marginTop: 16 }} aria-label="Quo tasks">
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 12 }}>Quo tasks</div>
      <div style={{ fontSize: 12.5, color: 'var(--c-5c6b65)', lineHeight: 1.55, marginBottom: 12 }}>
        Every task made in Quo comes in as a Task, with where it came from (e.g. “Quo, text from Alton HVAC to Edward on Oct 21”), given to the person with the same email in Quo. Marking it done or reopening it here does the same in Quo, and completing, reopening, editing or deleting it in Quo updates it here.
        Connect this on one system only (staging or live), or both will receive the same tasks.
      </div>
      {!st.hasKey ? <div style={{ fontSize: 12.5, color: '#8E2E0A' }}>Add and save the Quo API key above first.</div> : (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {st.connected
              ? <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-1e6b36)' }}>✓ Receiving Quo tasks</span>
              : <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Not connected</span>}
            {!st.connected
              ? <div onClick={() => !busy && void run('connect', async () => { setSt(await api.quoTasks.connect()); toast('Quo will now send its tasks here'); })} style={pill(true, !!busy)}>{busy === 'connect' ? 'Connecting…' : 'Connect Quo tasks'}</div>
              : <div onClick={() => !busy && confirm('Stop receiving Quo tasks? Tasks already here stay.') && void run('disconnect', async () => { setSt(await api.quoTasks.disconnect()); })} style={pill(false, !!busy)}>Disconnect</div>}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{st.imported} Quo task{st.imported === 1 ? '' : 's'} here{st.lastEvent ? ` · last from Quo ${new Date(st.lastEvent.at).toLocaleString()} (${st.lastEvent.action})` : ''}</span>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(var(--rgb-shade), 0.08)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 12.5 }}>Open tasks already in Quo</b>
              <div onClick={() => !busy && void run('preview', async () => setPv(await api.quoTasks.preview()))} style={pill(false, !!busy)}>{busy === 'preview' ? 'Checking…' : 'Preview'}</div>
            </div>
            {pv && (!pv.toImport.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Every open Quo task ({pv.open}) is already here.</div> : (
              <>
                <div style={{ fontSize: 12.5 }}>{pv.toImport.length} of {pv.open} open Quo task{pv.open === 1 ? '' : 's'} would come in:</div>
                <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 12, lineHeight: 1.6, background: 'var(--c-efede8)', borderRadius: 10, padding: '8px 12px' }}>
                  {pv.toImport.map((t) => <div key={t.taskId}><b>{t.title}</b> — {t.assignee ? `for ${t.assignee}` : t.quoAssignee ? `${t.quoAssignee} (no ODIN user with that email: unassigned)` : 'unassigned'}{t.dueDate ? ` · due ${t.dueDate.slice(0, 10)}` : ''}</div>)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={() => !busy && void run('import', async () => { const r = await api.quoTasks.importOpen(pv.toImport.map((t) => t.taskId)); toast(`${r.created} Quo task${r.created === 1 ? '' : 's'} imported${r.failed.length ? ` — ${r.failed.length} failed` : ''}`); setPv(await api.quoTasks.preview()); setSt(await api.quoTasks.status()); })} style={pill(true, !!busy)}>{busy === 'import' ? 'Importing…' : `Import ${pv.toImport.length}`}</div>
                  <div onClick={() => setPv(null)} style={pill(false)}>Cancel</div>
                </div>
              </>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
