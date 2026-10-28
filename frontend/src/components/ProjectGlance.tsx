import { useEffect, useState } from 'react';
import { api } from '../api';
import { TaskBoard } from './TaskBoard';
import { RfiLog, isOverdue as rfiOverdue, type Rfi } from './rfis/Rfis';
import { Skeleton } from './Skeleton';
import { Meetings } from '../pages/Meetings';
import { Observations } from '../pages/Observations';
import { Approvals } from '../pages/Approvals';
import { ChangeOrderWorkspace } from './finance/ChangeEvents';

/** The special actions a project shows (Oct 26 review notes). */
export type ActionView = 'tasks' | 'rfis' | 'meetings' | 'record' | 'changes' | 'approvals';

const MUTED = 'var(--muted)';
const INK = 'var(--ink)';
const DANGER = '#8E2E0A';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const usd0 = (n?: number | null) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

interface WorkCounts { open: number; overdue: number; rfiOpen: number; rfiOverdue: number; rfiAnswered: number }

/** Open / overdue tasks and RFIs for one project -- the work side, read in one go. */
function useWorkCounts(projectId: number, rfis: boolean) {
  const [c, setC] = useState<WorkCounts | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      api.projectTasks.list(projectId, { slim: true }).catch(() => []),
      rfis ? api.rfis.list(projectId).catch(() => []) : Promise.resolve([]),
    ]).then(([tasks, list]: any[]) => {
      if (!live) return;
      const t = (Array.isArray(tasks) ? tasks : []).filter((x: any) => !x.parentId && !x.completed && x.status !== 'Done');
      const r = (Array.isArray(list) ? list : []) as Rfi[];
      setC({
        open: t.length,
        overdue: t.filter((x: any) => x.dueDate && String(x.dueDate).slice(0, 10) < today()).length,
        rfiOpen: r.filter((x) => x.status === 'open' || x.status === 'draft').length,
        rfiOverdue: r.filter(rfiOverdue).length,
        rfiAnswered: r.filter((x) => x.status === 'answered').length,
      });
    });
    return () => { live = false; };
  }, [projectId, rfis]);
  return c;
}

const tile = (label: string, value: string | number, sub: string | undefined, onClick: () => void, tone?: string) => (
  <div onClick={onClick} style={{ padding: '11px 13px', background: 'var(--panel)', borderRadius: 10, cursor: 'pointer', minWidth: 0 }}>
    <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: tone || INK, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: tone || MUTED, marginTop: 1 }}>{sub}</div>}
  </div>
);

/** Top of a project's Overview: the work -- open tasks and RFIs, and what's late. */
export function WorkGlance({ projectId, showRfis, showChanges, onOpen }: { projectId: number; showRfis: boolean; showChanges?: boolean; onOpen: (v: ActionView) => void }) {
  const c = useWorkCounts(projectId, showRfis);
  // Meetings, FOR RECORD and change orders at a glance too (Oct 26 review notes).
  const [s, setS] = useState<Awaited<ReturnType<typeof api.specialActions.projectSummary>> | null>(null);
  useEffect(() => {
    let live = true;
    api.specialActions.projectSummary(projectId).then((r) => { if (live) setS(r); }).catch(() => { });
    return () => { live = false; };
  }, [projectId]);
  return (
    <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 10 }}>Special actions</div>
      {!c ? <Skeleton label="Loading…" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {tile('Open tasks', c.open, c.overdue ? `${c.overdue} overdue` : 'None overdue', () => onOpen('tasks'), c.overdue ? DANGER : undefined)}
          {showRfis && tile('Open RFIs', c.rfiOpen, c.rfiOverdue ? `${c.rfiOverdue} overdue` : 'None overdue', () => onOpen('rfis'), c.rfiOverdue ? DANGER : undefined)}
          {showRfis && tile('RFIs answered', c.rfiAnswered, c.rfiAnswered ? 'To review and close' : undefined, () => onOpen('rfis'))}
          {tile('Meetings', s ? s.counts.meetingsUpcoming : '—', s ? `${s.counts.meetings} in all` : undefined, () => onOpen('meetings'))}
          {tile('FOR RECORD', s ? s.counts.forRecord : '—', 'Observations, FYIs, decisions', () => onOpen('record'))}
          {showChanges && tile('Open change orders', s ? s.counts.changeOrdersOpen : '—', s ? `${s.counts.changeOrders} in all` : undefined, () => onOpen('changes'))}
          {tile('Approvals', '→', 'Waiting on someone', () => onOpen('approvals'))}
        </div>
      )}
    </div>
  );
}

/** Bottom of a project's Overview: the money, in a line, when the project has client billing set up. */
export function MoneyGlance({ projectId, onOpen }: { projectId: number; onOpen: () => void }) {
  const [s, setS] = useState<any | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api.finance.overview(projectId)
      .then((o: any) => { if (live) setS(o?.settings?.exists ? o.sov?.summary || null : null); })
      .catch(() => { if (live) setS(null); });
    return () => { live = false; };
  }, [projectId]);
  if (s === undefined) return null;
  return (
    <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 10 }}>Money</div>
      {!s ? (
        <div onClick={onOpen} style={{ fontSize: 12.5, color: MUTED, cursor: 'pointer' }}>No client billing set up yet — <span style={{ color: 'var(--forest)', fontWeight: 700 }}>open Financial →</span></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {tile('Contract', usd0(s.revisedContract), s.approvedChanges ? `incl. ${usd0(s.approvedChanges)} changes` : undefined, onOpen)}
          {tile('Billed', usd0(s.contractWorkInvoiced), undefined, onOpen)}
          {tile('Received', usd0(s.paid), undefined, onOpen)}
          {tile('Client owes', usd0(s.arOutstanding), s.overdueCount ? `${usd0(s.overdue)} overdue` : undefined, onOpen, s.overdueCount ? DANGER : undefined)}
        </div>
      )}
    </div>
  );
}

/**
 * A project's "Tasks & RFIs" tab: the task board and the RFI log side by
 * side in one place, switched with a toggle that shows what's open in each.
 */
type Stamped = 'tasks' | 'rfis' | 'meetings' | 'forRecord' | 'changeOrders';
const STAMP: Partial<Record<ActionView, Stamped>> = { tasks: 'tasks', rfis: 'rfis', meetings: 'meetings', record: 'forRecord', changes: 'changeOrders' };
const seenKey = (projectId: number, k: string) => `origami.seen.${projectId}.${k}`;
const readSeen = (projectId: number, k: string) => { try { return localStorage.getItem(seenKey(projectId, k)); } catch { return null; } };
const writeSeen = (projectId: number, k: string, at: string) => { try { localStorage.setItem(seenKey(projectId, k), at); } catch { /* private window: no blink memory */ } };

/**
 * A project's special actions in one place (Oct 26 review notes): Tasks, RFIs,
 * Meetings, FOR RECORD, Change Orders and Approvals, each a button that opens
 * that project's list. A button blinks when something in it changed since you
 * last opened it on this project (remembered per browser).
 */
export function TasksAndRfis({ projectId, projectName, showRfis, view, onView, showChanges }: {
  projectId: number; projectName: string; showRfis: boolean; view: ActionView; onView: (v: ActionView) => void; showChanges?: boolean;
}) {
  const c = useWorkCounts(projectId, showRfis);
  const [cur, setCur] = useState<ActionView>(view);
  useEffect(() => { setCur(view); }, [view]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.specialActions.projectSummary>> | null>(null);
  const [rights, setRights] = useState<any>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () => api.specialActions.projectSummary(projectId).then((r) => { if (live) setSummary(r); }).catch(() => { });
    load();
    const t = window.setInterval(load, 60_000);
    return () => { live = false; window.clearInterval(t); };
  }, [projectId]);
  useEffect(() => { if (showChanges) api.finance.access().then(setRights).catch(() => setRights(null)); }, [showChanges]);

  // First visit: everything counts as seen, so nothing blinks until something changes.
  useEffect(() => {
    if (!summary) return;
    const now = new Date().toISOString();
    for (const k of Object.values(STAMP)) if (k && readSeen(projectId, k) === null) writeSeen(projectId, k, now);
  }, [summary, projectId]);
  // Opening a list marks it seen.
  useEffect(() => {
    const k = STAMP[cur];
    if (!k || !summary) return;
    writeSeen(projectId, k, new Date().toISOString());
    setTick((n) => n + 1);
  }, [cur, summary, projectId]);
  const changed = (v: ActionView) => {
    const k = STAMP[v];
    const at = k && summary?.latest[k];
    const seen = k && readSeen(projectId, k);
    return v !== cur && !!at && !!seen && at > seen;
  };
  const go = (v: ActionView) => { setCur(v); onView(v); };

  const pill = (key: ActionView, label: string, count?: number, late?: number) => (
    <button type="button" key={key} onClick={() => go(key)} className={changed(key) ? 'sa-blink' : undefined} title={changed(key) ? 'Something changed here since you last looked' : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      background: cur === key ? 'var(--forest)' : 'var(--surface)', color: cur === key ? 'white' : 'var(--body)', border: '1px solid ' + (cur === key ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)'),
    }}>
      {label}
      {count != null && <span style={{ fontSize: 10.5, padding: '0 6px', borderRadius: 999, background: cur === key ? 'rgba(255,255,255,0.2)' : 'var(--c-efede8)' }}>{count}</span>}
      {!!late && <span style={{ fontSize: 10.5, padding: '0 6px', borderRadius: 999, background: '#F2DFD4', color: DANGER }}>{late} late</span>}
      {changed(key) && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: '#E08A2E' }} />}
    </button>
  );
  const canChanges = !!showChanges && !!rights && (rights.view || rights.viewChangeOrders);
  return (
    <div>
      <div role="toolbar" aria-label="Special actions" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {pill('tasks', 'Tasks', c?.open, c?.overdue)}
        {showRfis && pill('rfis', 'RFIs', c?.rfiOpen, c?.rfiOverdue)}
        {pill('meetings', 'Meetings', summary?.counts.meetingsUpcoming)}
        {pill('record', 'FOR RECORD', summary?.counts.forRecord)}
        {canChanges && pill('changes', 'Change Orders', summary?.counts.changeOrdersOpen)}
        {pill('approvals', 'Approvals')}
      </div>
      {cur === 'tasks' || (cur === 'rfis' && !showRfis) ? <TaskBoard projectId={projectId} />
        : cur === 'rfis' ? <RfiLog projectId={projectId} projectName={projectName} compact />
          : cur === 'meetings' ? <Meetings projectName={projectName} />
            : cur === 'record' ? <Observations projectName={projectName} />
              : cur === 'changes' ? (canChanges ? <ChangeOrderWorkspace projectId={projectId} rights={rights} /> : <Skeleton rows={4} />)
                : <Approvals projectName={projectName} />}
    </div>
  );
}
