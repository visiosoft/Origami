import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api, type ActionKind, type DerivedRef, type MadeAction } from '../api';
import { useApp } from '../AppContext';

/** Where a special action opens. */
export function actionHref(kind: ActionKind | string, id: string, o: { projectId?: number | null; topicType?: string } = {}) {
  const e = encodeURIComponent(id);
  if (kind === 'log') return o.topicType && o.topicType !== 'Task' ? `/observations?item=${e}` : `/tasks?task=${e}&type=log`;
  if (kind === 'board') return `/tasks?task=${e}${o.projectId != null ? `&project=${o.projectId}` : ''}`;
  if (kind === 'meeting') return `/meetings?open=${e}`;
  if (kind === 'rfi') return `/rfis?rfi=${e}`;
  return `/changeorders?co=${e}`;
}

/** What each kind can become. A Special Actions Log entry can switch between a task and a FOR RECORD item. */
const TARGETS: { to: ActionKind; topicType?: string; label: string; from: ActionKind[] }[] = [
  { to: 'log', topicType: 'Task', label: 'Task (Special Actions Log)', from: ['log', 'board', 'meeting', 'rfi', 'co'] },
  { to: 'log', topicType: 'Observation', label: 'FOR RECORD: Observation', from: ['log', 'board', 'meeting', 'rfi'] },
  { to: 'log', topicType: 'FYI', label: 'FOR RECORD: FYI', from: ['log', 'board', 'meeting', 'rfi'] },
  { to: 'log', topicType: 'Decision', label: 'FOR RECORD: Decision', from: ['log', 'board', 'meeting', 'rfi'] },
  { to: 'rfi', label: 'RFI', from: ['log', 'board', 'meeting'] },
  { to: 'co', label: 'Change order', from: ['log', 'board', 'meeting', 'rfi'] },
  { to: 'meeting', label: 'Meeting', from: ['log', 'board', 'rfi'] },
];

const pillBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  border: '1px solid rgba(var(--rgb-shade), .14)', background: 'var(--surface)', color: 'var(--body)',
};

/**
 * "Duplicate…" and "Convert to ▾" for one special action. The original is never
 * changed beyond a note in its history: "Converted to RFI-004".
 */
export interface MoreItem { label: string; danger?: boolean; onClick: () => void }

export function ActionMenu({ kind, id, topicType, projectId, projectName, onMade, disabled, parts = 'both', extraItems = [] }: {
  kind: ActionKind; id: string; topicType?: string; projectId?: number | null;
  /** Special Actions Log entries know their project by name only. */
  projectName?: string;
  /** After a conversion or duplicate: refresh the record (its history now says so). */
  onMade?: (made: MadeAction[]) => void;
  disabled?: boolean;
  /** Nov 19: task panels show Duplicate in the top bar and Convert to up by the title. */
  /** Nov 22: 'menu' -- one "More ▾" button holding Duplicate, Convert to and the extra items (task panels). */
  parts?: 'both' | 'duplicate' | 'convert' | 'menu';
  extraItems?: MoreItem[];
}) {
  const { toast } = useApp();
  const [dup, setDup] = useState(false);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const toggle = () => {
    // Open towards the side with room, so it never runs off a phone screen.
    const r = wrap.current?.getBoundingClientRect();
    setAlignRight(!!r && r.left + 250 > window.innerWidth);
    setOpen(!open);
  };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key, true); };
  }, [open]);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<MadeAction | null>(null);
  const targets = TARGETS.filter((t) => t.from.includes(kind) && !(t.to === kind && (kind !== 'log' || (t.topicType || 'Task') === (topicType || 'Task'))));
  const convert = async (i: number) => {
    const t = targets[i];
    if (!t) return;
    if (!window.confirm(`Make a new ${t.label} from this? This one stays as it is, with a note that it was converted.`)) return;
    setBusy(true);
    try {
      const m = await api.specialActions.convert({ from: { kind, id }, to: t.to, topicType: t.topicType });
      setMade(m); onMade?.([m]); toast(`Made ${m.label}`);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not convert')); }
    finally { setBusy(false); }
  };
  if (parts === 'menu') {
    const item = (label: string, onClick: () => void, o: { danger?: boolean; indent?: boolean } = {}) => (
      <button key={label} type="button" role="menuitem" disabled={disabled || busy} onClick={() => { setOpen(false); onClick(); }}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: o.indent ? '7px 14px 7px 24px' : '8px 14px', border: 0, background: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: o.danger ? 700 : 600, color: o.danger ? '#8E2E0A' : 'var(--ink)', cursor: 'pointer', borderRadius: 8 }}>{label}</button>
    );
    return (
      <div ref={wrap} style={{ position: 'relative', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <button type="button" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={toggle} style={pillBtn} aria-label="More actions">{busy ? 'Working…' : <><span className="more-word">More ▾</span><span className="more-dots" style={{ display: 'none', fontSize: 15, lineHeight: 1 }}>⋯</span></>}</button>
        {open && (
          <div role="menu" aria-label="More actions" className="more-menu"
            style={{ position: 'absolute', top: 'calc(100% + 6px)', ...(alignRight ? { right: 0 } : { left: 0 }), zIndex: 40, minWidth: 230, maxWidth: 'calc(100vw - 32px)', padding: 6, borderRadius: 12, background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), .12)', boxShadow: '0 12px 32px rgba(var(--rgb-ink), .18)' }}>
            {item('Duplicate…', () => setDup(true))}
            {targets.length > 0 && <div style={{ padding: '8px 14px 2px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Convert to</div>}
            {targets.map((t, i) => item(t.label, () => { void convert(i); }, { indent: true }))}
            {extraItems.filter((x) => !x.danger).map((x) => item(x.label, x.onClick))}
            {extraItems.some((x) => x.danger) && <div style={{ height: 1, background: 'rgba(var(--rgb-shade), .1)', margin: '6px 4px' }} />}
            {extraItems.filter((x) => x.danger).map((x) => item(x.label, x.onClick, { danger: true }))}
          </div>
        )}
        {made && <Link to={actionHref(made.kind, made.id, { projectId: made.projectId })} style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)', whiteSpace: 'nowrap' }}>Open {made.label} →</Link>}
        {dup && <DuplicateDialog kind={kind} id={id} projectId={projectId ?? null} projectName={projectName} onClose={() => setDup(false)} onMade={(m) => onMade?.(m)} />}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {parts !== 'convert' && <button type="button" disabled={disabled || busy} onClick={() => setDup(true)} style={pillBtn}>Duplicate…</button>}
      {parts !== 'duplicate' && targets.length > 0 && (
        <select aria-label="Convert to" disabled={disabled || busy} value="" onChange={(e) => { void convert(Number(e.target.value)); }} style={{ ...pillBtn, paddingRight: 10 }}>
          <option value="">{busy ? 'Converting…' : 'Convert to ▾'}</option>
          {targets.map((t, i) => <option key={t.label} value={i}>{t.label}</option>)}
        </select>
      )}
      {made && <Link to={actionHref(made.kind, made.id, { projectId: made.projectId })} style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)' }}>Open {made.label} →</Link>}
      {dup && <DuplicateDialog kind={kind} id={id} projectId={projectId ?? null} projectName={projectName} onClose={() => setDup(false)} onMade={(m) => onMade?.(m)} />}
    </div>
  );
}

/** Pick one or more projects; one copy is made on each. */
export function DuplicateDialog({ kind, id, projectId, projectName, onClose, onMade }: {
  kind: ActionKind; id: string; projectId: number | null; projectName?: string; onClose: () => void; onMade?: (m: MadeAction[]) => void;
}) {
  const { toast } = useApp();
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [picked, setPicked] = useState<Set<number | null>>(new Set([projectId]));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.specialActions.duplicate>> | null>(null);
  const noProjectOk = kind === 'log' || kind === 'board' || kind === 'meeting';
  useEffect(() => {
    api.projects.list().then((r: any) => {
      const list = (Array.isArray(r) ? r : []).map((p: any) => ({ id: p.id as number, name: String(p.name) })).sort((a, b) => a.name.localeCompare(b.name));
      setProjects(list);
      // Known by name only: tick that project instead of "no project".
      const named = projectId == null && projectName ? list.find((p) => p.name.trim().toLowerCase() === projectName.trim().toLowerCase()) : undefined;
      if (named) setPicked(new Set([named.id]));
    }).catch(() => setProjects([]));
  }, [projectId, projectName]);
  const shown = useMemo(() => projects.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())), [projects, q]);
  const toggle = (pid: number | null) => setPicked((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const go = async () => {
    const ids = [...picked].filter((p) => p !== null || noProjectOk);
    if (!ids.length) { toast('Pick at least one project'); return; }
    setBusy(true);
    try { const r = await api.specialActions.duplicate({ kind, id, projectIds: ids }); setResult(r); if (r.created.length) onMade?.(r.created); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not duplicate')); }
    finally { setBusy(false); }
  };
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' };
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(var(--rgb-shade), .45)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-label="Duplicate" onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 60px rgba(var(--rgb-shade), .3)' }}>
        <div style={{ padding: '18px 20px 10px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Duplicate</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>One copy on each project you tick. Copies start fresh — status, answers and files aren’t copied — and each says where it came from.</div>
        </div>
        {!result ? (
          <>
            <div style={{ padding: '0 20px 8px' }}>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" style={{ width: '100%', boxSizing: 'border-box', height: 36, borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), .14)', padding: '0 14px', font: 'inherit', fontSize: 13, background: 'var(--surface)', color: 'var(--ink)' }} />
            </div>
            <div style={{ overflowY: 'auto', padding: '0 12px', flex: 1, minHeight: 120 }}>
              {noProjectOk && !q && (
                <label style={row}><input type="checkbox" checked={picked.has(null)} onChange={() => toggle(null)} />No project (general)</label>
              )}
              {shown.map((p) => (
                <label key={p.id} style={row}>
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {(p.id === projectId || (projectId == null && projectName && p.name === projectName)) && <span style={{ fontSize: 11, color: 'var(--muted)' }}>this project</span>}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', padding: '12px 20px 16px', borderTop: '1px solid rgba(var(--rgb-shade), .08)' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 'auto' }}>{picked.size} selected</span>
              <button type="button" onClick={onClose} style={pillBtn}>Cancel</button>
              <button type="button" disabled={busy || !picked.size} onClick={go} style={{ ...pillBtn, background: 'var(--forest)', color: '#fff', borderColor: 'var(--forest)' }}>{busy ? 'Duplicating…' : `Duplicate${picked.size > 1 ? ` to ${picked.size}` : ''}`}</button>
            </div>
          </>
        ) : (
          <div style={{ padding: '6px 20px 18px', display: 'grid', gap: 8 }}>
            {result.created.map((m) => (
              <Link key={m.id} to={actionHref(m.kind, m.id, { projectId: m.projectId })} onClick={onClose} style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 700 }}>
                ✓ {m.label}{m.projectName ? ` — ${m.projectName}` : ''}
              </Link>
            ))}
            {result.failed.map((f) => <div key={String(f.projectId)} style={{ fontSize: 12.5, color: '#8E2E0A' }}>✕ {f.projectName}: {f.reason}</div>)}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={onClose} style={pillBtn}>Done</button></div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** "From RFI-004" and "Converted to CO-003" chips, each opening the other record. */
export function ActionTrail({ sourceType, sourceId, sourceLabel, derived }: { sourceType?: string | null; sourceId?: string | null; sourceLabel?: string | null; derived?: DerivedRef[] | null }) {
  const list = Array.isArray(derived) ? derived : [];
  if (!sourceId && !list.length) return null;
  const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: 'var(--panel)', color: 'var(--body)', textDecoration: 'none' };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {sourceId && sourceType === 'quo' && <span style={chip} title="Came in from Quo">↩ From {sourceLabel || 'Quo'}</span>}
      {sourceId && sourceType && sourceType !== 'quo' && <Link to={actionHref(sourceType, sourceId)} style={chip} title="Made from this">↩ From {sourceLabel || sourceId}</Link>}
      {list.map((d) => (
        <Link key={d.kind + d.id} to={actionHref(d.kind, d.id)} style={chip} title={`${d.how === 'converted' ? 'Converted' : 'Duplicated'} by ${d.by}`}>
          → {d.how === 'converted' ? 'Converted to' : 'Copied as'} {d.label}{d.projectName ? ` · ${d.projectName}` : ''}
        </Link>
      ))}
    </div>
  );
}

/** "Originator: Sara Reyes · Oct 17, 2026 · RFI-004" -- at the top of every special action. */
export function OriginatorLine({ by, at, number, label = 'Originator', project, source }: {
  by?: string | null; at?: string | null; number?: string | null;
  /** What "by" is called: Originator, or Assigner on tasks (whoever entered it, and confirms it). */
  label?: string;
  /** The project (or lead) it belongs to, so a task opened from All projects says where it lives. */
  project?: string | null;
  /** Tasks: who asked for it, when that's someone other than the assigner. */
  source?: string | null;
}) {
  const when = at && !Number.isNaN(Date.parse(at)) ? new Date(at.length > 10 ? at : at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  if (!by && !when && !project) return null;
  const tag = { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
  return (
    <div style={{ fontSize: 12, color: 'var(--muted)', display: 'grid', gap: 3 }}>
      {project && <div style={{ color: 'var(--forest)', fontWeight: 700, overflowWrap: 'anywhere' }}>{project}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={tag}>{label}</span>
        <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{by || '—'}</b>
        {source && source.trim().toLowerCase() !== String(by || '').trim().toLowerCase() && <><span style={{ ...tag, marginLeft: 4 }}>Source</span><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{source}</b></>}
        {when && <span>· {when}</span>}
        {number && <span>· {number}</span>}
      </div>
    </div>
  );
}
