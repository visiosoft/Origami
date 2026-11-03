import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

/**
 * Logins that aren't in People (Oct 30 sync): projects are given to a person
 * through their People record, so these can't be given any project until
 * they're added. New logins are added on their own; this catches the rest.
 */
export function UnlinkedLogins({ canFix }: { canFix: boolean }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<{ id: string; name: string; email: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => { api.users.unlinked().then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); };
  useEffect(load, []);
  if (!rows.length) return null;
  const fix = async () => {
    setBusy(true);
    try { const r = await api.users.linkPeople(); toast(`${r.linked} login${r.linked === 1 ? '' : 's'} added to People — you can give them projects now`); load(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not added')); }
    finally { setBusy(false); }
  };
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13, marginBottom: 14 }}>
      <span style={{ flex: 1, minWidth: 240 }}>
        <b>{rows.length} login{rows.length === 1 ? ' isn’t' : 's aren’t'} in People</b>, so {rows.length === 1 ? 'it' : 'they'} can’t be given projects: {rows.slice(0, 4).map((r) => r.name || r.email).join(', ')}{rows.length > 4 ? ` and ${rows.length - 4} more` : ''}.
      </span>
      {canFix && <button type="button" disabled={busy} onClick={() => void fix()} style={{ padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Adding…' : 'Add them to People'}</button>}
    </div>
  );
}
