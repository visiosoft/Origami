import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { isLogClosed, logStatusTone } from '../data/logStatuses';
import { taskHeadline, type Task } from '../data/tasks';
import { PRIORITY_STYLE, type ProjectTask } from '../data/projectTasks';
import { isMine, raisedBy } from '../components/TaskScope';
import { NewTaskDrawer } from '../components/NewTaskDrawer';
import { RequestLogTaskDrawer } from '../components/RequestLogTaskDrawer';
import { PhaseTaskPanel } from '../components/PhaseTaskPanel';
import { StatusBadge, mondayOf } from '../components/Timesheets';
import { MyWorkforceRequests } from '../components/WorkforceRequests';
import { ACCENT, BG, INK, LINE, MUTED, card, fmtDate, todayISO } from '../components/manpowerUi';

/**
 * The superintendent's own home: today's daily log, their tasks, the requests
 * they've raised for others, their timesheets and their daily log history --
 * and nothing about the company's projects or money.
 */
export const isSiteSuper = (roleKey?: string) => roleKey === 'site_super';

interface Row { key: string; title: string; context: string; dueDate?: string; status?: string; priority?: string; who?: string; open: () => void }
interface Log { id: string; projectId: number; date: string; status: string; supervisorId?: string; rejectionNote?: string; submittedAt?: string }
interface Sheet { id: string; weekStart: string; status: string; totalHours: number }

const btnDark: React.CSSProperties = { padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: ACCENT, color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' };
const btnLight: React.CSSProperties = { ...btnDark, background: 'var(--surface)', color: ACCENT, border: '1px solid rgba(var(--rgb-forest), 0.25)' };
const LOG_TONE: Record<string, [string, string, string]> = {
  draft: ['Draft', 'var(--c-efede8)', 'var(--c-5c6b65)'], submitted: ['Submitted', 'var(--c-fbf0cc)', 'var(--c-8a6d12)'],
  approved: ['Approved', 'var(--c-d2ead3)', 'var(--c-1e6b36)'], rejected: ['Sent back', '#F2DFD4', '#8E2E0A'],
};
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isOverdue = (due?: string) => !!due && /^\d{4}-\d{2}-\d{2}$/.test(due) && due < todayISO();

/** Everything the superintendent's screens read, loaded once. */
function useSiteWork() {
  const { currentUser } = useApp();
  const [board, setBoard] = useState<ProjectTask[]>([]);
  const [log, setLog] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Record<number, string>>({});
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => Promise.all([
    api.projectTasks.list().then((r: any) => { if (Array.isArray(r)) setBoard(r); }).catch(() => { }),
    api.tasks.list().then((r: any) => { if (Array.isArray(r)) setLog(r); }).catch(() => { }),
  ]).finally(() => setLoaded(true)), []);
  useEffect(() => {
    void reload();
    api.projects.list().then((r: any) => { if (Array.isArray(r)) setProjects(Object.fromEntries(r.map((p: any) => [p.id, p.name]))); }).catch(() => { });
  }, [reload]);
  const me = currentUser;
  const myBoard = board.filter((t) => !t.parentId && isMine(t as any, me, true));
  const myLog = log.filter((t) => isMine(t, me, true));
  const raised = log.filter((t) => raisedBy(t, me?.id) && !isMine(t, me));
  return { board, setBoard, log, setLog, projects, loaded, reload, myBoard, myLog, raised };
}

/** Task lists with the drawers that open them. */
function useTaskRows(w: ReturnType<typeof useSiteWork>) {
  const { currentUser } = useApp();
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const projectName = (id: number | null) => (id == null ? 'General Tasks' : w.projects[id] || 'Project');
  const boardRow = (t: ProjectTask): Row => ({
    key: 'b' + t.id, title: t.title, context: projectName(t.projectId), dueDate: t.dueDate, status: t.completed ? 'Done' : t.status || 'Not started',
    priority: t.priority, open: () => setOpenBoard(t.id),
  });
  const logRow = (t: Task): Row => ({
    key: 'l' + t.id, title: taskHeadline(t.description).title || t.id, context: `${t.id} · ${t.project || 'General'}`, dueDate: t.dueDate, status: t.status,
    who: isMine(t, currentUser) ? undefined : t.assignedTo, open: () => setOpenLog(t.id),
  });
  const logTask = openLog ? w.log.find((t) => t.id === openLog) : null;
  const boardTask = openBoard ? w.board.find((t) => t.id === openBoard) : null;
  const drawers = (
    <>
      {logTask && (
        <RequestLogTaskDrawer task={logTask} onClose={() => setOpenLog(null)}
          onChanged={(res) => w.setLog((prev) => prev.map((x) => (x.id === res.id ? res : x)))}
          onDeleted={(id) => { w.setLog((prev) => prev.filter((x) => x.id !== id)); setOpenLog(null); }} />
      )}
      {boardTask && (
        <PhaseTaskPanel task={boardTask} tasks={w.board.filter((t) => t.projectId === boardTask.projectId)}
          phaseName={projectName(boardTask.projectId)} phaseColor={ACCENT}
          onClose={() => setOpenBoard(null)}
          onSaved={(row) => w.setBoard((prev) => prev.map((x) => (x.id === row.id ? { ...x, ...row } : x)))}
          onReload={() => void w.reload()} />
      )}
    </>
  );
  return { boardRow, logRow, drawers };
}

function Section({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ ...card, padding: 18, display: 'grid', gap: 12, alignContent: 'start', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 16, color: INK, flex: 1 }}>
          {title}{count != null && <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}> ({count})</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TaskList({ rows, empty, limit }: { rows: Row[]; empty: string; limit?: number }) {
  if (!rows.length) return <div style={{ fontSize: 12.5, color: 'var(--c-9aa39d)', fontStyle: 'italic' }}>{empty}</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.slice(0, limit ?? rows.length).map((t) => {
        const ps = t.priority ? (PRIORITY_STYLE as any)[t.priority] : null;
        const tone = t.status ? logStatusTone(t.status) : null;
        const late = isOverdue(t.dueDate) && !isLogClosed(t.status || '') && t.status !== 'Done';
        return (
          <div key={t.key} onClick={t.open} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--panel)', borderRadius: 10, cursor: 'pointer', flexWrap: 'wrap', borderLeft: late ? '3px solid #C2410C' : '3px solid transparent' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{t.title}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{t.context}{t.who ? ` · for ${t.who}` : ''}</div>
            </div>
            {t.dueDate && <span style={{ fontSize: 11, fontWeight: late ? 700 : 500, color: late ? '#C2410C' : MUTED }}>{late ? 'Overdue · ' : 'Due '}{fmtDate(t.dueDate)}</span>}
            {ps && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ps.bg, color: ps.c }}>{t.priority}</span>}
            {tone && t.status && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: tone.bg, color: tone.c }}>{t.status}</span>}
          </div>
        );
      })}
    </div>
  );
}

const byDue = (a: Row, b: Row) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999');

/** Dashboard for the Site Superintendent role. */
export function SuperintendentDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const w = useSiteWork();
  const { boardRow, logRow, drawers } = useTaskRows(w);
  const [showNew, setShowNew] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);

  useEffect(() => {
    api.dailyLogs.list().then((r: any) => setLogs((Array.isArray(r) ? r : []).filter((l: Log) => l.supervisorId === currentUser?.id))).catch(() => { });
    api.timesheets.me().then((r: any) => setEmployeeId(r?.employee?.id || null)).catch(() => setEmployeeId(null));
  }, [currentUser?.id]);
  useEffect(() => {
    if (!employeeId) return;
    api.timesheets.list({ employeeId, from: addDays(mondayOf(todayISO()), -56) }).then((r: any) => setSheets(Array.isArray(r) ? r : [])).catch(() => { });
  }, [employeeId]);

  const openTasks = useMemo(() => [
    ...w.myBoard.filter((t) => !t.completed && t.status !== 'Done').map(boardRow),
    ...w.myLog.filter((t) => !isLogClosed(t.status)).map(logRow),
  ].sort(byDue), [w.myBoard, w.myLog, w.projects]);
  const openRaised = useMemo(() => w.raised.filter((t) => !isLogClosed(t.status)).map(logRow).sort(byDue), [w.raised]);
  const overdue = openTasks.filter((t) => isOverdue(t.dueDate)).length;

  const today = todayISO();
  const todays = logs.filter((l) => l.date === today);
  const thisWeek = sheets.find((s) => s.weekStart === mondayOf(today));
  const first = (currentUser?.name || '').split(' ')[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const openLog = (l?: Log) => navigate(l ? `/daily-log?project=${l.projectId}&date=${l.date}` : '/daily-log');

  return (
    <div style={{ display: 'grid', gap: 16, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ ...card, padding: '20px 22px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', background: 'linear-gradient(120deg, #E8F0EA, var(--panel))' }}>
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div style={{ fontFamily: BG, fontSize: 26, fontWeight: 700, color: INK, marginTop: 4, textWrap: 'balance' as any }}>{hello}{first ? `, ${first}` : ''}.</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            {openTasks.length ? `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}` : 'No open tasks'}
            {overdue ? ` · ${overdue} overdue` : ''}
            {' · '}{todays.length ? `today’s log: ${todays.map((l) => LOG_TONE[l.status]?.[0] || l.status).join(', ').toLowerCase()}` : 'no daily log yet today'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span onClick={() => openLog(todays[0])} style={btnDark}>{todays.length ? 'Open today’s daily log' : 'Start today’s daily log'}</span>
          <span onClick={() => setShowNew(true)} style={btnLight}>+ New request</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16, alignItems: 'start' }}>
        <Section title="My tasks" count={openTasks.length} action={<span onClick={() => navigate('/tasks')} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>All my tasks →</span>}>
          <TaskList rows={openTasks} limit={8} empty={w.loaded ? 'Nothing assigned to you right now.' : 'Loading…'} />
        </Section>
        <Section title="Requests I raised" count={openRaised.length} action={<span onClick={() => setShowNew(true)} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ New request</span>}>
          <TaskList rows={openRaised} limit={8} empty="Need something from the office or another team member? Raise a request — it goes on the Request Log and they’re emailed." />
        </Section>

        <MyWorkforceRequests projectNames={w.projects} />

        <Section title="My daily logs" count={logs.length} action={<span onClick={() => openLog()} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>Daily log →</span>}>
          {!logs.length ? <div style={{ fontSize: 12.5, color: 'var(--c-9aa39d)', fontStyle: 'italic' }}>Logs you fill in on site show up here.</div> : (
            <div style={{ display: 'grid' }}>
              {logs.slice(0, 10).map((l) => {
                const [label, bg, fg] = LOG_TONE[l.status] || LOG_TONE.draft;
                return (
                  <div key={l.id} onClick={() => openLog(l)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 2px', borderTop: '1px solid ' + LINE, cursor: 'pointer', fontSize: 12.5, flexWrap: 'wrap' }}>
                    <span style={{ width: 92, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(l.date)}</span>
                    <span style={{ flex: '1 1 140px', color: 'var(--body)', minWidth: 0 }}>{w.projects[l.projectId] || 'Project'}{l.status === 'rejected' && l.rejectionNote ? <span style={{ color: '#8E2E0A' }}> — {l.rejectionNote}</span> : null}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color: fg }}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="My timesheets" action={<span onClick={() => navigate('/my-timesheet')} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>My Timesheet →</span>}>
          {employeeId === null ? <div style={{ fontSize: 12.5, color: MUTED }}>Your login isn’t linked to an employee record yet — ask HR to link it.</div> : (
            <>
              <div onClick={() => navigate('/my-timesheet')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--panel)', borderRadius: 10, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>This week</div>
                  <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700, color: INK }}>{thisWeek ? `${thisWeek.totalHours} h` : 'Not started'}</div>
                </div>
                {thisWeek && <StatusBadge status={thisWeek.status} />}
              </div>
              {sheets.filter((s) => s !== thisWeek).slice(0, 6).map((s) => (
                <div key={s.id} onClick={() => navigate(`/my-timesheet?week=${s.weekStart}`)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 2px', borderTop: '1px solid ' + LINE, cursor: 'pointer', fontSize: 12.5 }}>
                  <span style={{ flex: 1 }}>{fmtDate(s.weekStart)} – {fmtDate(addDays(s.weekStart, 6))}</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.totalHours} h</b>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </>
          )}
        </Section>
      </div>

      {showNew && <NewTaskDrawer onClose={() => setShowNew(false)} onCreated={() => void w.reload()} />}
      {drawers}
    </div>
  );
}

/** Tasks page for the Site Superintendent role: their own work and their requests, nobody else's. */
export function SuperintendentTasks() {
  const w = useSiteWork();
  const { boardRow, logRow, drawers } = useTaskRows(w);
  const [showNew, setShowNew] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const done = (t: ProjectTask | Task) => ('completed' in t ? t.completed || t.status === 'Done' : isLogClosed((t as Task).status));
  const open = [...w.myBoard.filter((t) => !done(t)).map(boardRow), ...w.myLog.filter((t) => !done(t)).map(logRow)].sort(byDue);
  const closed = [...w.myBoard.filter(done).map(boardRow), ...w.myLog.filter(done).map(logRow)];
  const raisedOpen = w.raised.filter((t) => !done(t)).map(logRow).sort(byDue);
  const raisedDone = w.raised.filter(done).map(logRow);

  return (
    <div style={{ display: 'grid', gap: 16, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: MUTED, flex: 1, minWidth: 240 }}>Tasks assigned to you or that you collaborate on, and the requests you’ve raised for others.</div>
        <span onClick={() => setShowDone((v) => !v)} style={btnLight}>{showDone ? 'Hide finished' : 'Show finished'}</span>
        <span onClick={() => setShowNew(true)} style={btnDark}>+ New request</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16, alignItems: 'start' }}>
        <Section title="My tasks" count={open.length}>
          <TaskList rows={open} empty={w.loaded ? 'Nothing assigned to you right now.' : 'Loading…'} />
          {showDone && closed.length > 0 && <><div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>Finished</div><TaskList rows={closed} empty="" /></>}
        </Section>
        <Section title="Requests I raised" count={raisedOpen.length}>
          <TaskList rows={raisedOpen} empty="No open requests. Use + New request to ask the office or a team member for something." />
          {showDone && raisedDone.length > 0 && <><div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>Closed</div><TaskList rows={raisedDone} empty="" /></>}
        </Section>
      </div>
      {showNew && <NewTaskDrawer onClose={() => setShowNew(false)} onCreated={() => void w.reload()} />}
      {drawers}
    </div>
  );
}
