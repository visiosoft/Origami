import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { DEFAULT_LOG_STATUSES, loadLogStatuses, logStatusTone, setLogStatuses, type LogStatus } from '../data/logStatuses';

const BG = "'Bricolage Grotesque', serif";
const input: React.CSSProperties = { boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', fontSize: 13, fontFamily: 'inherit', background: 'white', color: '#0B1A12' };
const COLORS = ['#8E2E0A', '#93520F', '#2F6F68', '#1C5230', '#3C5C8A', '#6B3FA0', '#5C6B65'];

/**
 * Settings -> Request Log statuses. The office's own list for the Request
 * Log (the task board keeps its fixed Not started / In progress / On hold /
 * Done). "Counts as closed" statuses end a task: the close date is stamped
 * and it drops out of open counts and reminders. "Open" (where new tasks
 * start) and "Closed" can be renamed around but not removed.
 */
export function RequestLogStatusSettings() {
  const { toast, currentRole } = useApp();
  const isAdmin = currentRole?.key === 'admin';
  const [list, setList] = useState<LogStatus[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { loadLogStatuses(true).then((l) => setList(l.map((s) => ({ ...s })))); }, []);

  if (!list) return <div style={{ fontSize: 13, color: '#7E9B93' }}>Loading…</div>;
  const set = (i: number, patch: Partial<LogStatus>) => setList(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; setList(next); };
  const fixed = (s: LogStatus) => s.name === 'Open' || s.name === 'Closed';

  const save = () => {
    const names = list.map((s) => s.name.trim().toLowerCase());
    if (names.some((n) => !n)) { setError('Every status needs a name.'); return; }
    if (new Set(names).size !== names.length) { setError('Two statuses have the same name.'); return; }
    setSaving(true); setError('');
    api.tasks.saveStatuses(list)
      .then((saved) => { setLogStatuses(saved as LogStatus[]); setList((saved as LogStatus[]).map((s) => ({ ...s }))); toast('Request Log statuses saved'); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: '#0B1A12' }}>Request Log statuses</div>
      <div style={{ fontSize: 12.5, color: '#5C6B65', marginTop: 4, marginBottom: 16, lineHeight: 1.6 }}>
        The choices in the Request Log’s Status field. Statuses marked <b>counts as closed</b> finish a task — its close date is
        stamped and it stops showing as open or in reminders. “On hold” matches the task board’s On hold.
      </div>
      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7E4DB', fontSize: 12.5, fontWeight: 600, color: '#8E2E0A', marginBottom: 12 }}>{error}</div>}
      <div style={{ background: 'white', border: '1px solid rgba(20,8,31,0.08)', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
        {list.map((s, i) => {
          const tone = logStatusTone(s.name);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'grid', gap: 0 }}>
                <span onClick={() => move(i, -1)} style={{ cursor: 'pointer', fontSize: 10, color: '#7E9B93', lineHeight: 1 }}>▲</span>
                <span onClick={() => move(i, 1)} style={{ cursor: 'pointer', fontSize: 10, color: '#7E9B93', lineHeight: 1 }}>▼</span>
              </span>
              <input value={s.name} disabled={!isAdmin || fixed(s)} onChange={(e) => set(i, { name: e.target.value })} maxLength={30} style={{ ...input, width: 200 }} />
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.color ? s.color + '22' : tone.bg, color: s.color || tone.c }}>{s.name || '—'}</span>
              {!fixed(s) && isAdmin && (
                <span style={{ display: 'flex', gap: 3 }}>
                  {COLORS.map((c) => <span key={c} onClick={() => set(i, { color: s.color === c ? undefined : c })} title="Badge colour" style={{ width: 14, height: 14, borderRadius: 999, background: c, cursor: 'pointer', outline: s.color === c ? '2px solid #0B1A12' : 'none', outlineOffset: 1 }} />)}
                </span>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#43514D', marginLeft: 'auto' }}>
                <input type="checkbox" checked={!!s.closed} disabled={!isAdmin || s.name === 'Closed' || s.name === 'Open'} onChange={(e) => set(i, { closed: e.target.checked })} />
                counts as closed
              </label>
              {isAdmin && !fixed(s) && <span onClick={() => setList(list.filter((_, j) => j !== i))} title="Remove" style={{ cursor: 'pointer', color: '#8E2E0A', fontWeight: 700, padding: '0 4px' }}>×</span>}
            </div>
          );
        })}
      </div>
      {isAdmin ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span onClick={() => list.length < 12 && setList([...list, { name: '' }])} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: list.length < 12 ? 'pointer' : 'default', border: '1px solid rgba(20,8,31,0.14)', color: '#173326' }}>+ Add status</span>
          <span onClick={() => setList(DEFAULT_LOG_STATUSES.map((s) => ({ ...s })))} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#7E9B93' }}>Back to the defaults</span>
          <span onClick={saving ? undefined : save} style={{ marginLeft: 'auto', padding: '8px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>{saving ? 'Saving…' : 'Save'}</span>
        </div>
      ) : <div style={{ fontSize: 12, color: '#7E9B93', marginTop: 10 }}>Only an administrator can change these.</div>}
      <div style={{ fontSize: 11.5, color: '#7E9B93', marginTop: 12, lineHeight: 1.5 }}>
        Removing a status doesn’t change tasks that already have it — they keep it until someone picks another.
      </div>
    </div>
  );
}
