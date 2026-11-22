import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import type { Epic, ProjectTask } from '../data/projectTasks';
import { todayISO } from '../data/localDate';

/**
 * Epics (Nov 17 sync): named groups that tie related tasks together on a
 * board -- "Permits", "PG&E service" -- with progress and a target date.
 * Pick one to filter the board; "Group by epic" lays the list out by epic.
 */
export const EPIC_COLORS = ['#5B7C99', '#2F7D5B', '#B0662F', '#8A5BA6', '#B2445A', '#7A7A2E', '#3E8A9A'];
export const NO_EPIC = '__none';

export function useEpics(projectId: number | null | 'all') {
  const [epics, setEpics] = useState<Epic[]>([]);
  const load = useCallback(() => {
    if (projectId === 'all') { setEpics([]); return; }
    api.epics.list(projectId).then((r) => setEpics(Array.isArray(r) ? r : [])).catch(() => setEpics([]));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  return { epics, reload: load };
}

/** Progress worked out here from the board's own tasks, so it follows edits at once. */
export function epicCounts(epicId: string, tasks: ProjectTask[]) {
  const mine = tasks.filter((t) => t.epicId === epicId && !t.parentId);
  return { total: mine.length, done: mine.filter((t) => t.completed || t.status === 'Done' || t.status === 'Confirmed' || !!t.archivedAt).length };
}

const chip = (on: boolean, color?: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  border: '1px solid ' + (on ? color || 'var(--ink)' : 'rgba(var(--rgb-shade), .14)'),
  background: on ? color || 'var(--ink)' : 'var(--surface)', color: on ? '#fff' : 'var(--body)',
});
const dot = (color: string): CSSProperties => ({ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 });

/** The row of epics above the board: filter, progress, add / rename / remove. */
export function EpicStrip({ projectId, epics, tasks, active, onPick, onChanged, canManage, grouped, onGrouped }: {
  projectId: number | null; epics: Epic[]; tasks: ProjectTask[]; active: string; onPick: (id: string) => void;
  onChanged: () => void; canManage: boolean; grouped: boolean; onGrouped: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const name = window.prompt('Name the epic (e.g. “PG&E service”, “Permits”):')?.trim();
    if (!name) return;
    setBusy(true);
    try { await api.epics.create({ projectId, name, color: EPIC_COLORS[epics.length % EPIC_COLORS.length] }); onChanged(); }
    catch (e) { window.alert((e as Error).message || 'Could not add the epic'); }
    finally { setBusy(false); }
  };
  const edit = async (e: Epic) => {
    const name = window.prompt('Rename the epic (leave empty to remove it — its tasks stay, just without an epic):', e.name);
    if (name === null) return;
    try {
      if (!name.trim()) {
        if (!window.confirm(`Remove the epic “${e.name}”? Its tasks stay on the board.`)) return;
        await api.epics.remove(e.id); if (active === e.id) onPick('');
      } else {
        const due = window.prompt('Target date (YYYY-MM-DD, or empty for none):', e.dueDate || '');
        await api.epics.update(e.id, { name: name.trim(), ...(due !== null ? { dueDate: due.trim() || null } : {}) });
      }
      onChanged();
    } catch (err) { window.alert((err as Error).message || 'Could not change the epic'); }
  };
  if (!epics.length && !canManage) return null;
  const noEpic = tasks.filter((t) => !t.parentId && !t.epicId).length;
  return (
    <div className="epic-strip" role="group" aria-label="Epics" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginRight: 2 }}>Epics</span>
      {epics.length > 0 && <button type="button" style={chip(!active)} onClick={() => onPick('')} aria-pressed={!active}>All</button>}
      {epics.map((e) => {
        const c = epicCounts(e.id, tasks);
        const on = active === e.id;
        const late = !!e.dueDate && c.done < c.total && e.dueDate < todayISO();
        return (
          <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button type="button" style={chip(on, e.color)} onClick={() => onPick(on ? '' : e.id)} aria-pressed={on}
              title={`${e.name}: ${c.done} of ${c.total} done${e.dueDate ? ` · target ${e.dueDate}` : ''}`}>
              {!on && <span style={dot(e.color)} aria-hidden />}
              {e.name}
              <span style={{ fontWeight: 600, opacity: 0.8 }}>{c.done}/{c.total}</span>
              {e.dueDate && <span style={{ fontWeight: 600, opacity: 0.8, color: late && !on ? '#9A4318' : undefined }}>· {new Date(e.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            </button>
            {canManage && <button type="button" onClick={() => edit(e)} aria-label={`Edit ${e.name}`} title="Rename, set a target date, or remove"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: '0 4px' }}>✎</button>}
          </span>
        );
      })}
      {epics.length > 0 && noEpic > 0 && <button type="button" style={chip(active === NO_EPIC)} onClick={() => onPick(active === NO_EPIC ? '' : NO_EPIC)} aria-pressed={active === NO_EPIC}>No epic {noEpic}</button>}
      {canManage && <button type="button" disabled={busy} onClick={add} style={{ ...chip(false), borderStyle: 'dashed' }}>+ Epic</button>}
      {epics.length > 0 && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--body)', marginLeft: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={grouped} onChange={(e) => onGrouped(e.target.checked)} /> Group by epic (List)
        </label>
      )}
    </div>
  );
}

/** A small coloured tag on a card. */
export function EpicTag({ epic }: { epic?: Epic | null }) {
  if (!epic) return null;
  return <span title={`Epic: ${epic.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: epic.color + '1f', color: epic.color, border: `1px solid ${epic.color}55` }}><span style={dot(epic.color)} aria-hidden />{epic.name}</span>;
}

/** The drawer's Epic field. */
export function EpicSelect({ epics, value, onChange, disabled }: { epics: Epic[]; value?: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <select value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} aria-label="Epic"
      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), .14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' }}>
      <option value="">No epic</option>
      {epics.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      {value && !epics.some((e) => e.id === value) && <option value={value}>(removed epic)</option>}
    </select>
  );
}

/**
 * "Merge duplicates into this task" (Nov 17, Astrid): pick the duplicates on
 * the same board; their files, comments and history come here and each becomes
 * a closed subtask of this one. Nothing is deleted.
 */
export function MergeDialog({ keep, tasks, numberOf, onClose, onMerged }: {
  keep: ProjectTask; tasks: ProjectTask[]; numberOf: (t: ProjectTask) => string; onClose: () => void; onMerged: (t: ProjectTask) => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // "PG&E service" and "PGE meter" share "pge": compare letters and digits only.
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = norm(keep.title).split(/\s+/).filter((w) => w.length > 2);
  const candidates = useMemo(() => {
    const qn = q.trim().toLowerCase();
    return tasks
      .filter((t) => t.id !== keep.id && !t.parentId && !t.contextOnly && (t.projectId ?? null) === (keep.projectId ?? null))
      .map((t) => ({ t, score: words.filter((w) => norm(t.title).includes(w)).length }))
      .filter(({ t }) => !qn || `${t.title} ${numberOf(t)}`.toLowerCase().includes(qn))
      .sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title))
      .slice(0, 40);
  }, [tasks, keep, q, words, numberOf]);
  const chosen = tasks.filter((t) => picked.has(t.id));
  const files = chosen.reduce((n, t) => n + (t.attachments?.length || 0), 0);
  const comments = chosen.reduce((n, t) => n + (t.commentCount ?? t.comments?.length ?? 0), 0);
  const subs = chosen.reduce((n, t) => n + tasks.filter((s) => s.parentId === t.id).length, 0);
  const go = async () => {
    if (!picked.size) return;
    if (!window.confirm(`Merge ${picked.size} task${picked.size === 1 ? '' : 's'} into “${keep.title}”? Their files, comments and history move here; each becomes a closed subtask of this task.`)) return;
    setBusy(true); setErr('');
    try { onMerged(await api.projectTasks.merge(keep.id, [...picked])); }
    catch (e) { setErr((e as Error).message || 'Could not merge'); }
    finally { setBusy(false); }
  };
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), .45)', zIndex: 300, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Merge duplicate tasks" onClick={(e) => e.stopPropagation()}
        style={{ width: 520, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 8px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Merge duplicates into this task</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Keeping <b style={{ color: 'var(--ink)' }}>{numberOf(keep)} {keep.title}</b>. Pick the duplicates: their files, comments and history move here, their subtasks move under this task, and each becomes a closed subtask marked “Merged into…”. Nothing is deleted.</div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a task…" aria-label="Find a task"
            style={{ marginTop: 10, width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .14)', fontFamily: 'inherit', fontSize: 13 }} />
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 10px', flex: 1 }}>
          {candidates.map(({ t, score }) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, cursor: 'pointer', background: picked.has(t.id) ? 'var(--panel)' : 'transparent' }}>
              <input type="checkbox" checked={picked.has(t.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{[numberOf(t), t.assignee, t.status, `${t.attachments?.length || 0} files`].filter(Boolean).join(' · ')}{score > 0 ? ' · similar name' : ''}</span>
              </span>
            </label>
          ))}
          {!candidates.length && <div style={{ padding: 12, fontSize: 12.5, color: 'var(--muted)' }}>No other tasks on this board match.</div>}
        </div>
        <div style={{ padding: '10px 18px 16px', borderTop: '1px solid rgba(var(--rgb-shade), .08)' }}>
          {picked.size > 0 && <div style={{ fontSize: 12, color: 'var(--body)', marginBottom: 8 }}>Moves here: {files} file{files === 1 ? '' : 's'}, {comments} comment{comments === 1 ? '' : 's'}, {subs} subtask{subs === 1 ? '' : 's'}, and the full history.</div>}
          {err && <div role="alert" style={{ fontSize: 12, color: '#8E2E0A', marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ ...chip(false), padding: '7px 14px' }}>Cancel</button>
            <button type="button" disabled={!picked.size || busy} onClick={go} style={{ ...chip(true, 'var(--forest)'), padding: '7px 14px', opacity: !picked.size || busy ? 0.6 : 1 }}>{busy ? 'Merging…' : `Merge ${picked.size || ''}`}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
