import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { SavedViews } from '../SavedViews';
import { AkStats } from '../ActionKit';
import { ActionMenu, ActionTrail, OriginatorLine } from '../ActionTools';
import { PrioritySelect } from '../PrioritySelect';
import { linkPriorityDue } from '../../data/priority';
import type { Priority } from '../../data/projectTasks';
import { SortHeader, sortFromString, sortToString, useSort } from '../SortHeader';
import { useApp } from '../../AppContext';
import { SaveBar, useAutosave } from '../../autosave';
import { AssigneePicker } from '../AssigneePicker';
import { Attachments } from '../Attachments';
import type { Attachment } from '../../data/projectTasks';
import type { ActionTrailFields } from '../../api';

// ------------------------------------------------------------------ types & looks

export interface RfiContact { name: string; email?: string; company?: string; personId?: number }
export interface Rfi extends ActionTrailFields {
  id: string; projectId: number; projectName?: string; number: string; subject: string;
  status: 'draft' | 'open' | 'answered' | 'closed' | 'void';
  priority?: string; question?: string; suggestion?: string; discipline?: string; specSection?: string; drawingRef?: string;
  drawings?: { fileId: string; name: string; markupId?: string; page?: number }[] | null; to?: RfiContact | null; cc?: RfiContact[] | null;
  ownerId?: string; ownerName?: string; dateSent?: string; dateDue?: string; dateAnswered?: string; dateClosed?: string;
  answer?: string; answeredBy?: string; costImpact?: string; costAmount?: number | null; scheduleImpact?: string; scheduleDays?: number | null;
  changeOrderId?: string; changeOrderNumber?: string; sourceTaskId?: string; sourceTaskType?: string; attachments?: Attachment[];
  history?: { at: string; by: string; action: string; note?: string }[]; voidReason?: string; ballInCourt?: string;
  createdAt?: string; createdBy?: string;
}

const BG = 'var(--font-display)';
const INK = 'var(--ink)';
const MUTED = 'var(--muted)';
export const RFI_STATUS: Record<Rfi['status'], { label: string; bg: string; c: string }> = {
  draft: { label: 'Draft', bg: 'var(--c-efede8)', c: 'var(--c-5c6b65)' },
  open: { label: 'Awaiting answer', bg: 'var(--amber-light)', c: '#93520F' },
  answered: { label: 'Answered', bg: '#D6E8E5', c: '#2F6F68' },
  closed: { label: 'Closed', bg: 'var(--c-e4efe5)', c: 'var(--c-145c33)' },
  void: { label: 'Void', bg: '#F2DFD4', c: '#8E2E0A' },
};
const DISCIPLINES = ['Architectural', 'Structural', 'Civil', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Protection', 'Landscape', 'Interior', 'Owner / Client', 'Other'];
const FIELDS = ['subject', 'question', 'suggestion', 'discipline', 'specSection', 'drawingRef', 'drawings', 'to', 'cc', 'ownerId', 'dateDue', 'priority',
  'costImpact', 'costAmount', 'scheduleImpact', 'scheduleDays', 'answer', 'answeredBy', 'dateAnswered'] as const;

const input: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--surface)', fontSize: 13, fontFamily: 'inherit', color: INK, outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 };
const btn = (primary = false, danger = false): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  border: primary ? 'none' : '1px solid ' + (danger ? 'rgba(142,46,10,0.3)' : 'rgba(var(--rgb-shade), 0.14)'),
  background: primary ? 'var(--forest)' : 'var(--surface)', color: primary ? 'white' : danger ? '#8E2E0A' : 'var(--forest)',
});

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const rfiDay = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
};
/** Days since it was sent (to the answer, or today). */
export const daysOpen = (r: Rfi) => {
  if (!r.dateSent) return null;
  const end = r.dateAnswered || (r.status === 'open' ? todayIso() : r.dateClosed || todayIso());
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(r.dateSent)) / 86400000));
};
export const isOverdue = (r: Rfi) => r.status === 'open' && !!r.dateDue && r.dateDue < todayIso();

function StatusPill({ r }: { r: Rfi }) {
  const s = RFI_STATUS[r.status] || RFI_STATUS.draft;
  const late = isOverdue(r);
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', background: late ? '#F2DFD4' : s.bg, color: late ? '#8E2E0A' : s.c }}>{late ? 'Overdue' : s.label}</span>;
}

// ------------------------------------------------------------------ the log

/**
 * The RFI log -- one project's (inside a project) or every project's (the
 * RFIs page). New RFIs start as a draft with just a subject; the drawer
 * takes it from there.
 */
export function RfiLog({ projectId, projectName, openId, compact }: { projectId?: number; projectName?: string; openId?: string | null; compact?: boolean }) {
  const { toast } = useApp();
  const [rights, setRights] = useState<{ view: boolean; manage: boolean } | null>(null);
  const [rows, setRows] = useState<Rfi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'active' | 'all' | Rfi['status']>('active');
  const [q, setQ] = useState('');
  const [openRfi, setOpenRfi] = useState<string | null>(openId || null);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newProject, setNewProject] = useState<number | ''>(projectId ?? '');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  const load = () => api.rfis.list(projectId)
    .then((r) => { setRows(Array.isArray(r) ? r : []); setError(''); })
    .catch((e: Error) => setError(e.message))
    .finally(() => setLoading(false));
  useEffect(() => {
    api.rfis.access().then(setRights).catch(() => setRights({ view: false, manage: false }));
    load();
    if (!projectId) api.projects.list().then((p: any) => setProjects(Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : [])).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => { if (openId) setOpenRfi(openId); }, [openId]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => status === 'all' ? true : status === 'active' ? r.status !== 'closed' && r.status !== 'void' : r.status === status)
      .filter((r) => !t || [r.number, r.subject, r.to?.name, r.to?.company, r.projectName, r.drawingRef, r.discipline].some((x) => (x || '').toLowerCase().includes(t)));
  }, [rows, status, q]);
  const { sorted, sort, setSort, toggle } = useSort(shown, {
    number: (r) => r.number, subject: (r) => r.subject, project: (r) => r.projectName, to: (r) => r.to?.name, status: (r) => RFI_STATUS[r.status]?.label || r.status,
    sent: (r) => r.dateSent, due: (r) => r.dateDue, days: (r) => daysOpen(r), ball: (r) => r.ballInCourt,
  }, null, { sent: 'desc', due: 'asc', days: 'desc' });
  const viewValue = { status, q, sort: sortToString(sort) };
  const applyView = (v: typeof viewValue) => {
    setStatus(v.status as typeof status); setQ(v.q || ''); setSort(sortFromString(v.sort));
  };
  // The RFI dashboard (Oct 16): the numbers at a glance; each card filters the list.
  const stats = useMemo(() => {
    const live = rows.filter((r) => r.status !== 'void');
    const days = live.map(daysOpen).filter((d): d is number => d != null);
    return {
      draft: live.filter((r) => r.status === 'draft').length,
      avg: days.length ? Math.round(days.reduce((a, d) => a + d, 0) / days.length) : null,
      cost: live.filter((r) => r.costImpact === 'yes' && r.status !== 'closed').length,
      closed: live.filter((r) => r.status === 'closed').length,
    };
  }, [rows]);
  const counts = useMemo(() => ({
    open: rows.filter((r) => r.status === 'open').length,
    overdue: rows.filter(isOverdue).length,
    answered: rows.filter((r) => r.status === 'answered').length,
  }), [rows]);

  const create = () => {
    const subject = newSubject.trim();
    if (!subject) return;
    const pid = projectId ?? (newProject || undefined);
    if (!pid) { toast('Pick the project'); return; }
    api.rfis.create({ projectId: pid, subject })
      .then((r) => { setRows((prev) => [r, ...prev]); setCreating(false); setNewSubject(''); setOpenRfi(r.id); })
      .catch((e: Error) => toast('⚠ ' + e.message));
  };

  if (rights && !rights.view) {
    return <div style={{ padding: 20, fontSize: 13, color: MUTED }}>Your role doesn't include RFIs. An administrator can add it under Admin → Roles.</div>;
  }

  const open = rows.find((r) => r.id === openRfi) || null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {!compact && (
          <div style={{ marginRight: 'auto' }}>
            <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: INK }}>RFIs{projectName ? ` · ${projectName}` : ''}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              {counts.open} awaiting an answer{counts.overdue ? ` · ` : ''}{counts.overdue ? <b style={{ color: '#8E2E0A' }}>{counts.overdue} overdue</b> : null} · {counts.answered} answered, to review and close
            </div>
          </div>
        )}
        {compact && (
          <div style={{ fontSize: 12, color: MUTED, marginRight: 'auto' }}>
            {counts.open} awaiting an answer{counts.overdue ? <> · <b style={{ color: '#8E2E0A' }}>{counts.overdue} overdue</b></> : null} · {counts.answered} answered
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search RFIs…" style={{ ...input, width: 200, borderRadius: 999, padding: '7px 12px' }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ ...input, width: 160, padding: '7px 10px' }}>
          <option value="active">Not closed</option>
          <option value="all">All</option>
          {(Object.keys(RFI_STATUS) as Rfi['status'][]).map((k) => <option key={k} value={k}>{RFI_STATUS[k].label}</option>)}
        </select>
        {rights?.manage && <button type="button" onClick={() => setCreating(true)} style={btn(true)}>+ New RFI</button>}
      </div>
      {!compact && !loading && rows.length > 0 && (
        <div style={{ marginBottom: 14 }}><AkStats items={[
          { key: 'open', label: 'Awaiting an answer', value: counts.open, sub: 'sent, not answered', onClick: () => setStatus('open'), on: status === 'open' },
          { key: 'late', label: 'Overdue', value: counts.overdue, sub: 'past the answer date', tone: counts.overdue ? 'dark' : undefined },
          { key: 'ans', label: 'Answered', value: counts.answered, sub: 'to review and close', tone: counts.answered ? 'yellow' : undefined, onClick: () => setStatus('answered'), on: status === 'answered' },
          { key: 'draft', label: 'Drafts', value: stats.draft, sub: 'not sent yet', onClick: () => setStatus('draft'), on: status === 'draft' },
          { key: 'cost', label: 'Cost impact', value: stats.cost, sub: 'open RFIs that change the price' },
          { key: 'avg', label: 'Average days open', value: stats.avg ?? '—', sub: `${stats.closed} closed so far` },
        ]} /></div>
      )}
      <div style={{ marginBottom: 12 }}><SavedViews page={projectId ? 'rfis.project' : 'rfis'} value={viewValue} defaults={{ status: 'active', q: '', sort: '' }} onApply={applyView} /></div>

      {creating && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 12, background: 'var(--panel)', borderRadius: 'var(--r-12)', marginBottom: 12 }}>
          {!projectId && (
            <select value={newProject} onChange={(e) => setNewProject(e.target.value ? Number(e.target.value) : '')} style={{ ...input, width: 220 }}>
              <option value="">Project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <input autoFocus value={newSubject} onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="Subject, e.g. Header size at kitchen opening" style={{ ...input, flex: 1, minWidth: 220 }} />
          <button type="button" onClick={create} style={btn(true)}>Create draft</button>
          <button type="button" onClick={() => setCreating(false)} style={btn()}>Cancel</button>
        </div>
      )}

      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7E4DB', fontSize: 12.5, fontWeight: 600, color: '#8E2E0A', marginBottom: 12 }}>{error}</div>}

      {loading ? <div style={{ fontSize: 13, color: MUTED, padding: 12 }}>Loading RFIs…</div>
        : !shown.length ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: MUTED, background: 'var(--panel)', borderRadius: 'var(--r-12)' }}>
            {rows.length ? 'No RFIs match.' : 'No RFIs yet. When something on the drawings needs an answer from the architect, engineer or owner, start one here — or use “Convert to RFI” on a task.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: MUTED, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {([['number', 'No.'], ['subject', 'Subject'], ...(projectId ? [] : [['project', 'Project']]), ['to', 'To'], ['status', 'Status'], ['sent', 'Sent'], ['due', 'Due'], ['days', 'Days'], ['ball', 'Ball in court'], ['', 'Impact']] as [string, string][]).map(([k, h]) => (
                    <th key={h} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.08)', fontWeight: 700, whiteSpace: 'nowrap' }}>{k ? <SortHeader k={k} sort={sort} onSort={toggle}>{h}</SortHeader> : h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const d = daysOpen(r);
                  return (
                    <tr key={r.id} onClick={() => setOpenRfi(r.id)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(var(--rgb-shade), 0.05)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--forest)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.number}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: INK, maxWidth: 320 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</div>
                        {(r.drawingRef || r.discipline) && <div style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>{[r.discipline, r.drawingRef].filter(Boolean).join(' · ')}</div>}
                      </td>
                      {!projectId && <td style={{ padding: '10px 12px', color: 'var(--body)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</td>}
                      <td style={{ padding: '10px 12px', color: 'var(--body)', whiteSpace: 'nowrap' }}>{r.to?.name || <span style={{ color: 'var(--c-b5bdb8)' }}>—</span>}</td>
                      <td style={{ padding: '10px 12px' }}><StatusPill r={r} /></td>
                      <td style={{ padding: '10px 12px', color: 'var(--body)', whiteSpace: 'nowrap' }}>{rfiDay(r.dateSent)}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: isOverdue(r) ? 700 : 400, color: isOverdue(r) ? '#8E2E0A' : 'var(--body)' }}>{rfiDay(r.dateDue)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--body)', fontVariantNumeric: 'tabular-nums' }}>{d ?? ''}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--body)', whiteSpace: 'nowrap' }}>{r.ballInCourt}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: 11.5 }}>
                        {r.costImpact === 'yes' && <span title="Cost impact" style={{ color: '#8E2E0A', fontWeight: 700, marginRight: 8 }}>$</span>}
                        {r.scheduleImpact === 'yes' && <span title="Schedule impact" style={{ color: '#93520F', fontWeight: 700, marginRight: 8 }}>⏱</span>}
                        {r.changeOrderNumber && <span style={{ color: 'var(--forest)', fontWeight: 700 }}>{r.changeOrderNumber}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {open && (
        <RfiDrawer
          rfi={open}
          canManage={!!rights?.manage}
          onClose={() => setOpenRfi(null)}
          onChanged={(r) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...r } : x)))}
          onDeleted={(id) => { setRows((prev) => prev.filter((x) => x.id !== id)); setOpenRfi(null); }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the drawer

type Panel = null | 'send' | 'answer' | 'void' | 'close';

/**
 * One RFI. Text fields save themselves (3 s after typing stops, or Save);
 * sending, answering, closing and voiding are explicit steps with their own
 * buttons, each recorded in the history.
 */
export function RfiDrawer({ rfi, canManage, onClose, onChanged, onDeleted }: {
  rfi: Rfi; canManage: boolean; onClose: () => void; onChanged: (r: Rfi) => void; onDeleted: (id: string) => void;
}) {
  const { toast } = useApp();
  const [rec, setRec] = useState<Rfi>(rfi);
  const [draft, setDraft] = useState<Rfi>(rfi);
  const [session, setSession] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [people, setPeople] = useState<{ id: number; name: string; company?: string; email?: string; role?: string; kind?: string }[]>([]);
  const [files, setFiles] = useState<{ id: string; name: string; folderPath?: string[]; isLatest?: boolean }[]>([]);
  const [fileQuery, setFileQuery] = useState('');
  const [answerForm, setAnswerForm] = useState({ answer: '', answeredBy: '', dateAnswered: todayIso() });

  // A fresh record (another RFI opened) starts a new editing session.
  useEffect(() => { setRec(rfi); setDraft(rfi); setSession((n) => n + 1); setPanel(null); }, [rfi.id]);
  useEffect(() => {
    api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => setStorageReady(false));
    // Recipients: the project's People (architect, engineers, owner…); drawings: its File Room.
    if (rfi.projectName) api.people.list(rfi.projectName).then((p: any) => setPeople(Array.isArray(p) ? p : [])).catch(() => { });
    api.fileRoom.list(rfi.projectId).then((d: any) => setFiles(Array.isArray(d?.files) ? d.files : [])).catch(() => { });
  }, [rfi.id, rfi.projectId, rfi.projectName]);

  const editable = canManage && rec.status !== 'closed' && rec.status !== 'void';
  const auto = useAutosave<Rfi>({
    draft, saved: rec, fields: [...FIELDS] as (keyof Rfi)[], enabled: editable && !!draft.subject?.trim(), label: 'RFI', resetKey: `${rfi.id}-${session}`,
    save: (changes) => api.rfis.update(rec.id, changes) as Promise<Rfi>,
    onSaved: (row) => { setRec(row); onChanged(row); },
  });
  const set = (patch: Partial<Rfi>) => setDraft((d) => ({ ...d, ...patch }));
  // Which of priority / answer date was filled in from the other.
  const autoPD = useRef<'priority' | 'due' | null>(null);

  /** Actions: save any pending edits first, then take the server's record as the new baseline. */
  const act = async (fn: () => Promise<Rfi>, done: string) => {
    setBusy(true);
    try {
      if (auto.dirty && !(await auto.saveNow())) throw new Error('Save your edits first');
      const r = await fn();
      setRec(r); setDraft(r); setSession((n) => n + 1); onChanged(r); setPanel(null); setNote('');
      toast(done);
    } catch (e) { toast('⚠ ' + (e as Error).message); }
    finally { setBusy(false); }
  };

  // Through the shared conversion, so both records note it and the RFI links the change order.
  const createChangeOrder = () => act(async () => {
    await api.specialActions.convert({ from: { kind: 'rfi', id: rec.id }, to: 'co' });
    return api.rfis.get(rec.id) as Promise<Rfi>;
  }, 'Change order drafted — find it in the project’s Financial tab');
  const reloadTrail = () => { api.rfis.get(rec.id).then((r: Rfi) => { setRec((cur) => ({ ...cur, history: r.history, derivedRefs: r.derivedRefs, changeOrderId: r.changeOrderId, changeOrderNumber: r.changeOrderNumber })); onChanged(r); }).catch(() => { }); };

  const pickPerson = (id: string) => {
    const p = people.find((x) => String(x.id) === id);
    if (p) set({ to: { name: p.name, email: p.email || '', company: p.company || '', personId: p.id } });
  };
  const addCc = (id: string) => {
    const p = people.find((x) => String(x.id) === id);
    if (!p) return;
    const cc = draft.cc || [];
    if (!cc.some((c) => c.personId === p.id)) set({ cc: [...cc, { name: p.name, email: p.email || '', company: p.company || '', personId: p.id }] });
  };
  const matchingFiles = useMemo(() => {
    const t = fileQuery.trim().toLowerCase();
    const have = new Set((draft.drawings || []).map((d) => d.fileId));
    return files.filter((f) => f.isLatest !== false && !have.has(f.id) && (!t || f.name.toLowerCase().includes(t) || (f.folderPath || []).join('/').toLowerCase().includes(t))).slice(0, 8);
  }, [files, fileQuery, draft.drawings]);

  const section = (title: string, children: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
        <div style={{ marginLeft: 'auto' }}>{extra}</div>
      </div>
      {children}
    </div>
  );
  const ro = !editable;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), 0.5)', zIndex: 130, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', width: 820, maxWidth: '96vw', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(var(--rgb-shade), 0.15)', animation: 'scaleIn 0.2s ease' }}>
        {editable && (
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', padding: '10px 24px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
            <SaveBar auto={auto} blocked={!draft.subject?.trim() ? 'Give it a subject to save' : undefined} />
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontFamily: BG, fontSize: 15, fontWeight: 800, color: 'var(--forest)' }}>{rec.number}</span>
            <StatusPill r={rec} />
            <span style={{ fontSize: 12, color: MUTED }}>{rec.projectName}</span>
            <div onClick={onClose} style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px solid rgba(var(--rgb-shade), 0.08)' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ stroke: MUTED }} strokeWidth={2} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
            </div>
          </div>
          {ro ? <div style={{ fontFamily: BG, fontSize: 19, fontWeight: 700, color: INK }}>{rec.subject}</div>
            : <input value={draft.subject || ''} onChange={(e) => set({ subject: e.target.value })} style={{ ...input, fontFamily: BG, fontSize: 18, fontWeight: 700, border: '1px solid transparent', padding: '4px 6px', marginLeft: -6 }} />}
          {rec.status === 'void' && rec.voidReason && <div style={{ fontSize: 12.5, color: '#8E2E0A', marginTop: 6 }}>Voided: {rec.voidReason}</div>}
          <div style={{ marginTop: 6 }}><OriginatorLine by={rec.createdBy} at={rec.createdAt} number={rec.number} /></div>
          <div style={{ marginTop: 8 }}><ActionTrail sourceType={rec.sourceType || (rec.sourceTaskId ? rec.sourceTaskType || 'board' : null)} sourceId={rec.sourceId || rec.sourceTaskId} sourceLabel={rec.sourceLabel || 'a task'} derived={rec.derivedRefs} /></div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {canManage && rec.status === 'draft' && <>
              <button type="button" disabled={busy} onClick={() => setPanel('send')} style={btn(true)}>Send by email</button>
              <button type="button" disabled={busy} onClick={() => act(() => api.rfis.markSent(rec.id), 'Marked as sent')} style={btn()}>Mark as sent</button>
            </>}
            {canManage && rec.status === 'open' && <>
              <button type="button" disabled={busy} onClick={() => { setAnswerForm({ answer: draft.answer || '', answeredBy: draft.answeredBy || rec.to?.name || '', dateAnswered: todayIso() }); setPanel('answer'); }} style={btn(true)}>Record answer</button>
              <button type="button" disabled={busy} onClick={() => setPanel('send')} style={btn()}>Re-send</button>
            </>}
            {canManage && rec.status === 'answered' && <>
              <button type="button" disabled={busy} onClick={() => setPanel('close')} style={btn(true)}>Close RFI</button>
              {draft.costImpact === 'yes' && !rec.changeOrderId && <button type="button" disabled={busy} onClick={createChangeOrder} style={btn()}>Create change order</button>}
            </>}
            {canManage && (rec.status === 'closed' || rec.status === 'void') && <button type="button" disabled={busy} onClick={() => act(() => api.rfis.reopen(rec.id), 'Reopened')} style={btn()}>Reopen</button>}
            <a href={api.rfis.pdfUrl(rec.id)} target="_blank" rel="noopener noreferrer" style={{ ...btn(), textDecoration: 'none' }}>PDF</a>
            {canManage && rec.status !== 'void' && rec.status !== 'closed' && (
              rec.status === 'draft' && !rec.dateSent
                ? <button type="button" disabled={busy} onClick={() => { if (confirm(`Delete draft ${rec.number}?`)) api.rfis.remove(rec.id).then(() => { onDeleted(rec.id); toast('Draft deleted'); }).catch((e: Error) => toast('⚠ ' + e.message)); }} style={{ ...btn(false, true), marginLeft: 'auto' }}>Delete draft</button>
                : <button type="button" disabled={busy} onClick={() => setPanel('void')} style={{ ...btn(false, true), marginLeft: 'auto' }}>Void</button>
            )}
          </div>

          {panel === 'send' && (
            <div style={{ marginTop: 12, padding: 14, background: 'var(--panel)', borderRadius: 'var(--r-12)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--body)', marginBottom: 8, lineHeight: 1.5 }}>
                {draft.to?.email
                  ? <>Emails <b>{draft.to.name}</b> ({draft.to.email}){(draft.cc || []).length ? `, copying ${(draft.cc || []).map((c) => c.name).join(', ')}` : ''} and you, with the RFI attached as a PDF. Replies come back to {draft.ownerName || 'the owner'}.
                    {!rec.dateDue && !draft.dateDue ? ' The answer is due in 7 working days unless you set a date below.' : ''}</>
                  : <b style={{ color: '#8E2E0A' }}>Pick who it goes to (with an email address) under Routing first.</b>}
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="A short note above the question (optional)" style={{ ...input, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" disabled={busy || !draft.to?.email} onClick={() => act(() => api.rfis.send(rec.id, note), `${rec.number} sent to ${draft.to?.name}`)} style={btn(true)}>{busy ? 'Sending…' : 'Send'}</button>
                <button type="button" onClick={() => setPanel(null)} style={btn()}>Cancel</button>
              </div>
            </div>
          )}
          {panel === 'answer' && (
            <div style={{ marginTop: 12, padding: 14, background: 'var(--panel)', borderRadius: 'var(--r-12)' }}>
              <div style={lbl}>The answer</div>
              <textarea autoFocus value={answerForm.answer} onChange={(e) => setAnswerForm({ ...answerForm, answer: e.target.value })} rows={5} placeholder="Paste the reply from the email" style={{ ...input, resize: 'vertical' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
                <div><div style={lbl}>Answered by</div><input value={answerForm.answeredBy} onChange={(e) => setAnswerForm({ ...answerForm, answeredBy: e.target.value })} style={input} /></div>
                <div><div style={lbl}>Date answered</div><input type="date" value={answerForm.dateAnswered} onChange={(e) => setAnswerForm({ ...answerForm, dateAnswered: e.target.value })} style={input} /></div>
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Set cost and schedule impact under Impact once it’s recorded.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" disabled={busy || !answerForm.answer.trim()} onClick={() => act(() => api.rfis.answer(rec.id, answerForm), 'Answer recorded')} style={btn(true)}>Save answer</button>
                <button type="button" onClick={() => setPanel(null)} style={btn()}>Cancel</button>
              </div>
            </div>
          )}
          {(panel === 'void' || panel === 'close') && (
            <div style={{ marginTop: 12, padding: 14, background: panel === 'void' ? '#FBEDE6' : 'var(--panel)', borderRadius: 'var(--r-12)' }}>
              <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={panel === 'void' ? 'Why is it void? (e.g. duplicate of RFI-004, withdrawn)' : 'Closing note (optional)'} style={{ ...input, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {panel === 'void'
                  ? <button type="button" disabled={busy || !note.trim()} onClick={() => act(() => api.rfis.void(rec.id, note), `${rec.number} voided`)} style={{ ...btn(true), background: '#8E2E0A' }}>Void {rec.number}</button>
                  : <button type="button" disabled={busy} onClick={() => act(() => api.rfis.close(rec.id, note), `${rec.number} closed`)} style={btn(true)}>Close {rec.number}</button>}
                <button type="button" onClick={() => { setPanel(null); setNote(''); }} style={btn()}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {section('Question', <>
          <textarea readOnly={ro} value={draft.question || ''} onChange={(e) => set({ question: e.target.value })} rows={5} placeholder="What needs answering, precisely — what the drawings say, what's on site, what's unclear." style={{ ...input, resize: 'vertical', lineHeight: 1.55 }} />
          <div style={{ ...lbl, marginTop: 12 }}>Proposed solution <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>— optional, speeds up the answer</span></div>
          <textarea readOnly={ro} value={draft.suggestion || ''} onChange={(e) => set({ suggestion: e.target.value })} rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.55 }} />
        </>)}

        {(rec.answer || rec.status === 'answered' || rec.status === 'closed') && section('Answer', <>
          <textarea readOnly={ro} value={draft.answer || ''} onChange={(e) => set({ answer: e.target.value })} rows={4} style={{ ...input, resize: 'vertical', lineHeight: 1.55, background: '#F4F8F4' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
            <div><div style={lbl}>Answered by</div><input readOnly={ro} value={draft.answeredBy || ''} onChange={(e) => set({ answeredBy: e.target.value })} style={input} /></div>
            <div><div style={lbl}>Date answered</div><input readOnly={ro} type="date" value={draft.dateAnswered || ''} onChange={(e) => set({ dateAnswered: e.target.value })} style={input} /></div>
          </div>
        </>)}

        {section('Reference', <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <div><div style={lbl}>Discipline</div>
              <select disabled={ro} value={draft.discipline || ''} onChange={(e) => set({ discipline: e.target.value })} style={input}>
                <option value="">—</option>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
              </select></div>
            <div><div style={lbl}>Sheet / detail</div><input readOnly={ro} value={draft.drawingRef || ''} onChange={(e) => set({ drawingRef: e.target.value })} placeholder="A-201, detail 5" style={input} /></div>
            <div><div style={lbl}>Spec section</div><input readOnly={ro} value={draft.specSection || ''} onChange={(e) => set({ specSection: e.target.value })} placeholder="06 10 00" style={input} /></div>
          </div>
          <div style={{ ...lbl, marginTop: 12 }}>Drawings in the File Room</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {(draft.drawings || []).map((d) => (
              <span key={d.fileId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--mist)', fontSize: 12, fontWeight: 600 }}>
                <a href={`/planroom?file=${encodeURIComponent(d.fileId)}${d.markupId ? `&markup=${encodeURIComponent(d.markupId)}` : ''}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--forest)', textDecoration: 'none' }}>{d.name}{d.page ? ` · p. ${d.page}` : ''}{d.markupId ? ' · markup' : ''}</a>
                {!ro && <span onClick={() => set({ drawings: (draft.drawings || []).filter((x) => x.fileId !== d.fileId) })} style={{ cursor: 'pointer', color: MUTED }} title="Remove">×</span>}
              </span>
            ))}
            {!(draft.drawings || []).length && <span style={{ fontSize: 12, color: 'var(--c-b5bdb8)' }}>None linked</span>}
          </div>
          {!ro && (files.length ? (
            <div>
              <input value={fileQuery} onChange={(e) => setFileQuery(e.target.value)} placeholder={`Find a drawing in this project’s File Room (${files.length} files)…`} style={input} />
              {fileQuery.trim() && (
                <div style={{ border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 9, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                  {matchingFiles.length ? matchingFiles.map((f) => (
                    <div key={f.id} onClick={() => { set({ drawings: [...(draft.drawings || []), { fileId: f.id, name: f.name }] }); setFileQuery(''); }}
                      style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                      <b>{f.name}</b> <span style={{ color: MUTED }}>{(f.folderPath || []).join(' › ')}</span>
                    </div>
                  )) : <div style={{ padding: '8px 11px', fontSize: 12, color: MUTED }}>No match.</div>}
                </div>
              )}
            </div>
          ) : <div style={{ fontSize: 12, color: MUTED }}>No files in this project’s File Room yet — upload the drawing set under Plan & File Room to link sheets here.</div>)}
        </>)}

        {section('Routing', <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <div style={lbl}>To</div>
              {!ro && people.length > 0 && (
                <select value="" onChange={(e) => pickPerson(e.target.value)} style={{ ...input, marginBottom: 6 }}>
                  <option value="">Pick from this project’s people…</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.company ? ` — ${p.company}` : ''}{p.role ? ` (${p.role})` : ''}</option>)}
                </select>
              )}
              <div style={{ display: 'grid', gap: 6 }}>
                <input readOnly={ro} value={draft.to?.name || ''} onChange={(e) => set({ to: { ...(draft.to || { name: '' }), name: e.target.value } })} placeholder="Name" style={input} />
                <input readOnly={ro} value={draft.to?.email || ''} onChange={(e) => set({ to: { ...(draft.to || { name: '' }), email: e.target.value } })} placeholder="Email" style={input} />
                <input readOnly={ro} value={draft.to?.company || ''} onChange={(e) => set({ to: { ...(draft.to || { name: '' }), company: e.target.value } })} placeholder="Company" style={input} />
              </div>
            </div>
            <div>
              <div style={lbl}>Copy to</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {(draft.cc || []).map((c, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--panel)', fontSize: 12 }}>
                    {c.name}{c.email ? '' : <span style={{ color: '#8E2E0A' }} title="No email — won't be copied"> ⚠</span>}
                    {!ro && <span onClick={() => set({ cc: (draft.cc || []).filter((_, j) => j !== i) })} style={{ cursor: 'pointer', color: MUTED }}>×</span>}
                  </span>
                ))}
                {!(draft.cc || []).length && <span style={{ fontSize: 12, color: 'var(--c-b5bdb8)' }}>Nobody</span>}
              </div>
              {!ro && people.length > 0 && (
                <select value="" onChange={(e) => addCc(e.target.value)} style={input}>
                  <option value="">Add someone…</option>
                  {people.filter((p) => p.email).map((p) => <option key={p.id} value={p.id}>{p.name}{p.company ? ` — ${p.company}` : ''}</option>)}
                </select>
              )}
              <div style={{ ...lbl, marginTop: 12 }}>Owner (chases the answer)</div>
              <AssigneePicker valueId={draft.ownerId} valueName={draft.ownerName} disabled={ro} onChange={(u) => set({ ownerId: u?.id ?? '', ownerName: u?.name ?? '' })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 12 }}>
            <div><div style={lbl}>Answer needed by</div><input readOnly={ro} type="date" value={draft.dateDue || ''} onChange={(e) => { const r = linkPriorityDue({ priority: draft.priority as Priority, dueDate: draft.dateDue, auto: autoPD.current }, { dueDate: e.target.value }); autoPD.current = r.auto; set({ dateDue: r.dueDate, priority: r.priority }); }} style={input} />
              {autoPD.current === 'due' && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Set from the priority</div>}</div>
            <div><div style={lbl}>Priority</div>
              <PrioritySelect disabled={ro} value={draft.priority} style={input} onChange={(p) => { const r = linkPriorityDue({ priority: draft.priority as Priority, dueDate: draft.dateDue, auto: autoPD.current }, { priority: p }); autoPD.current = r.auto; set({ priority: r.priority, dateDue: r.dueDate }); }} />
              {autoPD.current === 'priority' && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Set from the date</div>}</div>
            <div><div style={lbl}>Sent</div><div style={{ fontSize: 13, padding: '9px 0', color: 'var(--body)' }}>{rec.dateSent ? rfiDay(rec.dateSent) : 'Not yet'}{daysOpen(rec) != null ? ` · ${daysOpen(rec)} day${daysOpen(rec) === 1 ? '' : 's'} open` : ''}</div></div>
          </div>
        </>)}

        {section('Impact', <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <div><div style={lbl}>Cost impact</div>
              <select disabled={ro} value={draft.costImpact || ''} onChange={(e) => set({ costImpact: e.target.value })} style={input}>
                <option value="">Not stated</option><option value="none">None</option><option value="tbd">To be determined</option><option value="yes">Yes</option>
              </select></div>
            {draft.costImpact === 'yes' && <div><div style={lbl}>Estimated amount ($)</div><input readOnly={ro} type="number" min={0} step="0.01" value={draft.costAmount ?? ''} onChange={(e) => set({ costAmount: e.target.value === '' ? null : Number(e.target.value) })} style={input} /></div>}
            <div><div style={lbl}>Schedule impact</div>
              <select disabled={ro} value={draft.scheduleImpact || ''} onChange={(e) => set({ scheduleImpact: e.target.value })} style={input}>
                <option value="">Not stated</option><option value="none">None</option><option value="tbd">To be determined</option><option value="yes">Yes</option>
              </select></div>
            {draft.scheduleImpact === 'yes' && <div><div style={lbl}>Days</div><input readOnly={ro} type="number" min={0} value={draft.scheduleDays ?? ''} onChange={(e) => set({ scheduleDays: e.target.value === '' ? null : Number(e.target.value) })} style={input} /></div>}
          </div>
          {rec.changeOrderNumber && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--forest)', fontWeight: 600 }}>Change order {rec.changeOrderNumber} drafted from this RFI — open it in the project’s Financial tab.</div>}
        </>)}

        {section('Files', (
          <Attachments
            scope="rfis" taskId={rec.id} attachments={rec.attachments || []} canManage={canManage} storageReady={storageReady}
            onUpload={async (fs) => { const a = await api.rfis.upload(rec.id, fs); setRec((r) => ({ ...r, attachments: a })); toast(fs.length === 1 ? 'File attached' : `${fs.length} files attached`); }}
            onRemove={async (att) => { const a = await api.rfis.removeAttachment(rec.id, att.id); setRec((r) => ({ ...r, attachments: a })); }}
            onAddLink={async (name, url) => { const a = await api.rfis.link(rec.id, name, url); setRec((r) => ({ ...r, attachments: a })); }}
          />
        ))}

        {canManage && section('Duplicate or convert', <ActionMenu kind="rfi" id={rec.id} projectId={rec.projectId} onMade={reloadTrail} />)}

        {section('History', (
          <div style={{ display: 'grid', gap: 7 }}>
            {[...(rec.history || [])].reverse().map((h, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--body)', lineHeight: 1.45 }}>
                <b style={{ color: INK }}>{h.by}</b> {h.action}
                <span style={{ color: MUTED }}> · {new Date(h.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                {h.note && <div style={{ color: MUTED, fontStyle: 'italic' }}>“{h.note}”</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ from a task

