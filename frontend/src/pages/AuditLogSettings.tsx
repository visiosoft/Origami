import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { downloadCsv } from '../components/finance/financeUi';
import { auditCsvRows, changeText, headline, typeLabel, typesIn, type AuditRow } from '../data/audit';

const input: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)',
  background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none',
};
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * The audit log (Oct 2026): every change saved anywhere in the app -- who,
 * when, which record and what changed -- with Finance's own log merged in.
 * Admins only (the endpoint is admin-only too).
 */
export function AuditLogSettings() {
  const { toast } = useApp();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [f, setF] = useState({ from: '', to: '', type: '', user: '', projectId: '', q: '' });
  const [limit, setLimit] = useState(500);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => { api.projects.list().then((r: any) => setProjects(Array.isArray(r) ? r.map((p: any) => ({ id: p.id, name: p.name })) : [])).catch(() => undefined); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const q: Record<string, string> = { limit: String(limit) };
      for (const [k, v] of Object.entries(f)) if (v.trim()) q[k] = v.trim();
      api.audit.list(q)
        .then((r) => { const list = Array.isArray(r) ? r : []; setRows(list); setTypes((prev) => [...new Set([...prev, ...typesIn(list)])].sort()); })
        .catch((e: any) => { setRows([]); toastRef.current('⚠ ' + (e?.message || 'Could not load the audit log')); });
    }, 250);
    return () => clearTimeout(t);
  }, [f, limit]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const filtered = !!Object.values(f).some((v) => v);
  const list = rows || [];
  const csv = () => downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}`,
    [['at', 'When'], ['who', 'Who'], ['type', 'Type'], ['record', 'Record'], ['action', 'Action'], ['project', 'Project'], ['changes', 'Changes']], auditCsvRows(list));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--body)', lineHeight: 1.55 }}>
        Every change saved in the app: who made it, when, and what changed. Finance changes come from Finance's own log.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={f.q} onChange={set('q')} placeholder="Search records and changes" aria-label="Search the audit log" style={{ ...input, flex: '1 1 220px' }} />
        <input value={f.user} onChange={set('user')} placeholder="Person" aria-label="Person" style={{ ...input, width: 150 }} />
        <select value={f.type} onChange={set('type')} aria-label="Record type" style={{ ...input, width: 170 }}>
          <option value="">All records</option>
          {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
        <select value={f.projectId} onChange={set('projectId')} aria-label="Project" style={{ ...input, width: 190 }}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>From <input type="date" value={f.from} onChange={set('from')} style={input} /></label>
        <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>To <input type="date" value={f.to} onChange={set('to')} style={input} /></label>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
        <span>{rows ? `${list.length} ${list.length === 1 ? 'entry' : 'entries'}${list.length >= limit ? ` (latest ${limit})` : ''}` : 'Loading…'}</span>
        {filtered && <button type="button" onClick={() => setF({ from: '', to: '', type: '', user: '', projectId: '', q: '' })} style={linkBtn}>Clear all filters</button>}
        <button type="button" onClick={csv} disabled={!list.length} style={{ ...linkBtn, marginLeft: 'auto' }}>Export CSV</button>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
        {list.map((r) => {
          const isOpen = open === r.id;
          return (
            <div key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}
                style={{ display: 'flex', gap: 12, width: '100%', padding: '10px 14px', border: 0, background: isOpen ? 'var(--panel)' : 'transparent', font: 'inherit', fontSize: 12.5, textAlign: 'left', color: 'var(--ink)', cursor: r.changes.length ? 'pointer' : 'default', flexWrap: 'wrap' }}>
                <span style={{ width: 150, color: 'var(--muted)', flexShrink: 0 }}>{when(r.at)}</span>
                <span style={{ flex: '1 1 260px', minWidth: 0, lineHeight: 1.5 }}>
                  {headline(r)}
                  {r.changes.length > 0 && !isOpen && <span style={{ color: 'var(--muted)' }}> — {r.changes.slice(0, 2).map(changeText).join('; ')}{r.changes.length > 2 ? ` +${r.changes.length - 2} more` : ''}</span>}
                </span>
                {r.projectName && <span style={{ color: 'var(--muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</span>}
              </button>
              {isOpen && r.changes.length > 0 && (
                <div style={{ padding: '4px 14px 12px', paddingLeft: 'clamp(14px, 20vw, 176px)', display: 'grid', gap: 4, background: 'var(--panel)', fontSize: 12.5 }}>
                  {r.changes.map((c, i) => <div key={i} style={{ color: 'var(--body)', overflowWrap: 'anywhere' }}>{changeText(c)}</div>)}
                </div>
              )}
            </div>
          );
        })}
        {rows && !list.length && <div style={{ padding: 16, fontSize: 12.5, color: 'var(--muted)' }}>{filtered ? 'Nothing matches these filters.' : 'Nothing recorded yet. Changes appear here as people save them.'}</div>}
      </div>
      {rows && list.length >= limit && limit < 5000 && <button type="button" onClick={() => setLimit(Math.min(5000, limit * 2))} style={{ ...linkBtn, justifySelf: 'start' }}>Show older entries</button>}
    </div>
  );
}

const linkBtn: React.CSSProperties = { border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--body)', cursor: 'pointer', textDecoration: 'underline' };
