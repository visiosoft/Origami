import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

type Row = { id: number; name: string; stage: string; on?: string; since?: string };
type Plan = { on: boolean; afterDays: number; due: Row[]; waiting: Row[]; undated: Row[] };
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

/**
 * Auto-archive (Nov 13 sync): closed-out and cancelled projects move to the
 * archive 10 days after reaching that stage. Off until an administrator
 * presses Apply here, after seeing what it would do.
 */
export function ArchiveBanner({ onChanged }: { onChanged: () => void }) {
  const { toast } = useApp();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => { api.projects.archivePlan().then(setPlan).catch(() => setPlan(null)); };
  useEffect(load, []);
  if (!plan || plan.on || !(plan.due.length + plan.undated.length + plan.waiting.length)) return null;
  const apply = async () => {
    setBusy(true);
    try { const r = await api.projects.applyArchive(); toast(`${r.archived} archived; ${r.counting} start their ${plan.afterDays} days today`); load(); onChanged(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not changed')); }
    finally { setBusy(false); }
  };
  const list = (rows: Row[], what: (r: Row) => string) => rows.map((r) => <li key={r.id}>{r.name} <span style={{ opacity: 0.75 }}>· {r.stage} · {what(r)}</span></li>);
  return (
    <div role="status" aria-label="Auto-archive" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--amber-light)', color: 'var(--amber-deep)', fontSize: 13, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 240 }}>
          <b>Archive closed-out and cancelled projects {plan.afterDays} days after they get there?</b>{' '}
          {plan.due.length} would be archived now; {plan.undated.length} have no date yet and would start counting today.{' '}
          <button type="button" onClick={() => setOpen((v) => !v)} style={{ border: 0, background: 'none', color: 'inherit', textDecoration: 'underline', font: 'inherit', cursor: 'pointer', padding: 0 }}>{open ? 'Hide' : 'Show which'}</button>
        </span>
        <button type="button" disabled={busy} onClick={() => void apply()} style={{ padding: '8px 14px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Applying…' : 'Apply and switch on'}</button>
      </div>
      {open && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          {list(plan.due, (r) => `since ${day(r.since)} — archived now`)}
          {list(plan.waiting, (r) => `archived ${day(r.on)}`)}
          {list(plan.undated, (r) => `archived ${day(r.on)}`)}
        </ul>
      )}
    </div>
  );
}

/** The archived projects, with Restore (the 10 days start again from today). */
export function ArchivedProjects({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => { api.projects.list('only').then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); };
  useEffect(load, []);
  const restore = async (p: any) => {
    try { await api.projects.restore(p.id); toast(`${p.name} restored — back in the archive in 10 days unless its stage changes`); load(); onChanged(); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not restored')); }
  };
  return (
    <div aria-label="Archived projects" style={{ background: 'var(--surface)', borderRadius: 14, padding: 14, marginBottom: 16, display: 'grid', gap: 6 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Archived projects</div>
      {rows === null ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</div> : !rows.length ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Nothing archived.</div> : rows.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderTop: '1px solid rgba(var(--rgb-shade), 0.06)', fontSize: 13 }}>
          <a href={`/projects?open=${p.id}`} style={{ flex: 1, color: 'var(--ink)', fontWeight: 600 }}>{p.name}</a>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.stage} · archived {day(p.archivedAt)}</span>
          {canManage && <button type="button" onClick={() => void restore(p)} style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.15)', background: 'var(--surface)', font: 'inherit', fontSize: 12, cursor: 'pointer' }}>Restore</button>}
        </div>
      ))}
    </div>
  );
}
