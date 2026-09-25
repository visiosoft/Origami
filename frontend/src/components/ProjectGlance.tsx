import { useEffect, useState } from 'react';
import { api } from '../api';
import { TaskBoard } from './TaskBoard';
import { RfiLog, isOverdue as rfiOverdue, type Rfi } from './rfis/Rfis';

const MUTED = '#7E9B93';
const INK = '#0B1A12';
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
      api.projectTasks.list(projectId).catch(() => []),
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
  <div onClick={onClick} style={{ padding: '11px 13px', background: '#FBF8F2', borderRadius: 10, cursor: 'pointer', minWidth: 0 }}>
    <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: tone || INK, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: tone || MUTED, marginTop: 1 }}>{sub}</div>}
  </div>
);

/** Top of a project's Overview: the work -- open tasks and RFIs, and what's late. */
export function WorkGlance({ projectId, showRfis, onTasks, onRfis }: { projectId: number; showRfis: boolean; onTasks: () => void; onRfis: () => void }) {
  const c = useWorkCounts(projectId, showRfis);
  return (
    <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 10 }}>Tasks & RFIs</div>
      {!c ? <div style={{ fontSize: 12, color: MUTED }}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {tile('Open tasks', c.open, c.overdue ? `${c.overdue} overdue` : 'None overdue', onTasks, c.overdue ? DANGER : undefined)}
          {showRfis && tile('Open RFIs', c.rfiOpen, c.rfiOverdue ? `${c.rfiOverdue} overdue` : 'None overdue', onRfis, c.rfiOverdue ? DANGER : undefined)}
          {showRfis && tile('RFIs answered', c.rfiAnswered, c.rfiAnswered ? 'To review and close' : undefined, onRfis)}
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
    <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: MUTED, marginBottom: 10 }}>Money</div>
      {!s ? (
        <div onClick={onOpen} style={{ fontSize: 12.5, color: MUTED, cursor: 'pointer' }}>No client billing set up yet — <span style={{ color: '#173326', fontWeight: 700 }}>open Financial →</span></div>
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
export function TasksAndRfis({ projectId, projectName, showRfis, view, onView }: {
  projectId: number; projectName: string; showRfis: boolean; view: 'tasks' | 'rfis'; onView: (v: 'tasks' | 'rfis') => void;
}) {
  const c = useWorkCounts(projectId, showRfis);
  const pill = (key: 'tasks' | 'rfis', label: string, count?: number, late?: number) => (
    <div onClick={() => onView(key)} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
      background: view === key ? '#173326' : 'white', color: view === key ? 'white' : '#43514D', border: '1px solid ' + (view === key ? '#173326' : 'rgba(20,8,31,0.12)'),
    }}>
      {label}
      {count != null && <span style={{ fontSize: 10.5, padding: '0 6px', borderRadius: 999, background: view === key ? 'rgba(255,255,255,0.2)' : '#EFEDE8' }}>{count}</span>}
      {!!late && <span style={{ fontSize: 10.5, padding: '0 6px', borderRadius: 999, background: '#F2DFD4', color: DANGER }}>{late} late</span>}
    </div>
  );
  const shown = showRfis ? view : 'tasks';
  return (
    <div>
      {showRfis && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {pill('tasks', 'Tasks', c?.open, c?.overdue)}
          {pill('rfis', 'RFIs', c?.rfiOpen, c?.rfiOverdue)}
        </div>
      )}
      {shown === 'tasks' ? <TaskBoard projectId={projectId} /> : <RfiLog projectId={projectId} projectName={projectName} compact />}
    </div>
  );
}
