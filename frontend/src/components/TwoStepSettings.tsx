import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

/** My two-step sign-in (Nov 13): on since when, backup codes left, and new backup codes. */
export function TwoStepSettings() {
  const { toast } = useApp();
  const [me, setMe] = useState<any>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.auth.me().then(setMe).catch(() => undefined); }, []);
  if (!me) return null;
  if (!me.twoFactor) return <div style={{ fontSize: 13.5, color: 'var(--body)' }}>{me.tier === 'internal' ? 'You’ll set up two-step sign-in with an authenticator app the next time you sign in.' : 'Two-step sign-in is for staff accounts.'}</div>;
  const renew = async () => {
    setBusy(true);
    try { setCodes((await api.auth.newBackupCodes(code.trim())).backupCodes); setCode(''); toast('New backup codes made — the old ones no longer work'); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not done')); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
      <div style={{ fontSize: 13.5, color: 'var(--body)' }}>
        Two-step sign-in is <b>on</b>{me.totpEnabledAt ? ` since ${new Date(me.totpEnabledAt).toLocaleDateString()}` : ''}. {me.backupCodesLeft ?? 0} backup code{me.backupCodesLeft === 1 ? '' : 's'} left.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input aria-label="Code from your app" inputMode="numeric" placeholder="Code from your app" value={code} onChange={(e) => setCode(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 16, width: 180 }} />
        <button type="button" disabled={busy || code.trim().length < 6} onClick={() => void renew()} style={{ padding: '9px 16px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>New backup codes</button>
      </div>
      {codes && <div aria-label="Backup codes" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, padding: 14, borderRadius: 10, background: 'var(--mist)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 15 }}>{codes.map((c) => <span key={c}>{c}</span>)}</div>}
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Lost your phone? Use a backup code to sign in, or ask an administrator to reset your two-step sign-in.</div>
    </div>
  );
}
