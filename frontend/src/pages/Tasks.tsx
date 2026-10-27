import { useEffect, useRef, useState } from 'react';
import { createdByText } from '../data/projectTasks';
import { logStatusTone } from '../data/logStatuses';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { useTaskScope, TaskScopeToggle, PersonFilter, TaskSearch, matchesQuery, isMine, type TaskScope } from '../components/TaskScope';
import { TaskBoard } from '../components/TaskBoard';
import { NewTaskDrawer } from '../components/NewTaskDrawer';
import { RequestLogTaskDrawer } from '../components/RequestLogTaskDrawer';
import { TT_COLORS, logTaskTitle, type Task, type TaskTab } from '../data/tasks';
import { SavedViews } from '../components/SavedViews';
import { SortHeader, sortFromString, sortToString, useSort } from '../components/SortHeader';
import { leadLabel, useLinkTargets } from '../data/linkTargets';

const COLS = '110px 56px 2fr 80px 100px 64px 58px';
const TABS: TaskTab[] = ['internal', 'owner', 'subcontractor'];
/** The board project is remembered so coming back lands on the same one. */
const TAB_LABELS: Record<TaskTab, string> = { internal: 'Internal', owner: 'Owner', subcontractor: 'Subcontractor' };

/** initialMode 'log' opens on the Request Log (Special Actions → Task). */
/** The board picker: a project, General, everything, or a lead's tasks ('lead:<id>'). */
type BoardSel = number | 'general' | 'all' | `lead:${string}`;
const LEAD_PF = 'Lead · ';

export function Tasks({ initialMode = 'board' }: { initialMode?: 'board' | 'log' } = {}) {
  const { can, users } = useApp();
  const { scope, setScope, filter: scopeFilter, restricted, currentUser, person, setPerson, users: allUsers, counts: scopeCounts } = useTaskScope();
  const [query, setQuery] = useState('');
  const canManage = can('tasks', 'manage');
  const [tab, setTab] = useState<TaskTab>('internal');
  const [pf, setPf] = useState('All projects');
  const [projOpen, setProjOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const swallow = useRef(false);
  const [mode, setMode] = useState<'board' | 'log'>(initialMode);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  // 'general' is a real, standing selection (the General Tasks board -- work
  // not tied to any client project), not an absence-of-choice placeholder.
  // The Task page always opens on every task, everyone's (Oct 27 backlog: "Filters for task").
  // A saved view brings back a board and filters someone uses often.
  const [boardProjectId, setBoardProjectId] = useState<BoardSel>('all');
  useEffect(() => { if (!restricted) setScope('all'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const boardLead = typeof boardProjectId === 'string' && boardProjectId.startsWith('lead:') ? boardProjectId.slice(5) : null;
  const targets = useLinkTargets();
  const [logTasks, setLogTasks] = useState<Task[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Deep link from an assignment email or the notification bell:
  //   /tasks?task=<id>&project=<id>   board
  //   /tasks?task=<id>&type=log       request log
  const [params, setParams] = useSearchParams();
  const linkedTaskId = params.get('task');
  const linkedIsLog = params.get('type') === 'log';
  const linkedProjectId = Number(params.get('project')) || null;
  // The linked board task, kept after the URL is tidied so the board can open it once it has loaded.
  const [deepTask] = useState<string | null>(() => (params.get('type') === 'log' ? null : params.get('task')));

  const selectBoardProject = (id: BoardSel) => setBoardProjectId(id);

  const reloadLog = () => { api.tasks.list().then((r: any) => { if (Array.isArray(r)) setLogTasks(r as Task[]); }).catch(() => { }); };
  useEffect(() => {
    api.projects.list().then((r: any) => {
      // A lead gets a placeholder row the moment it exists so it has a place
      // on the Projects page (sitting in "Kickoff"), but there's no real
      // phase/task work to board until it's actually converted -- so it has
      // no business in this picker.
      const real = Array.isArray(r) ? r.filter((p: any) => p.stage !== 'Kickoff') : [];
      setProjects(real.map((p: any) => ({ id: p.id, name: p.name })));
      // A project named in the URL wins outright, for a deep link to land on
      // the right board. Otherwise keep the remembered selection (including
      // "General Tasks" or "All tasks") as long as it's still valid; a deleted
      // remembered project falls back to All tasks rather than guessing another one.
      setBoardProjectId((cur) => {
        if (linkedProjectId != null && real.some((p: any) => p.id === linkedProjectId)) return linkedProjectId;
        if (typeof cur === 'string') return cur;
        return real.some((p: any) => p.id === cur) ? cur : 'all';
      });
    }).catch(() => { });
    reloadLog();
  }, []);

  /**
   * Apply a deep link once. The task id is cleared from the URL afterwards so
   * closing the drawer and reopening another task doesn't snap back to this one,
   * while `project` stays so a refresh still lands on the right board.
   */
  useEffect(() => {
    if (!linkedTaskId) return;
    if (linkedIsLog) {
      setMode('log');
      setSelectedId(linkedTaskId);
    } else {
      setMode('board');
      // Look in every task (General, subtasks, any project) until the linked project's board is known.
      setBoardProjectId('all');
    }
    const next = new URLSearchParams(params);
    next.delete('task');
    next.delete('type');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedTaskId]);

  useEffect(() => {
    const onDoc = () => { if (swallow.current) { swallow.current = false; return; } setProjOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  // Labels already in use, offered as suggestions.
  const allLabels = Array.from(new Set(logTasks.flatMap((t) => t.labels ?? []))).sort();

  const openNew = () => setShowNew(true);

  const GENERAL_PF = 'General (no project)';
  const taskProjects: string[] = [];
  logTasks.forEach((x) => { if (x.project && !taskProjects.includes(x.project)) taskProjects.push(x.project); });
  // Leads come after the projects, as "Lead · name".
  logTasks.forEach((x) => { const l = leadLabel(x.leadName); if (l && !taskProjects.includes(l)) taskProjects.push(l); });
  const hasGeneral = logTasks.some((x) => !x.project && !x.leadId);
  const byProject = (list: Task[]) =>
    pf === 'All projects' ? list : pf === GENERAL_PF ? list.filter((x) => !x.project && !x.leadId) : pf.startsWith(LEAD_PF) ? list.filter((x) => leadLabel(x.leadName) === pf) : list.filter((x) => x.project === pf);
  const tabCounts: Record<TaskTab, number> = { internal: 0, owner: 0, subcontractor: 0 };
  // Confirmed entries leave the list a week later; "Archived" shows them.
  const liveLog = logTasks.filter((x) => (showArchived ? !!x.archivedAt : !x.archivedAt));
  const archivedCount = logTasks.filter((x) => x.archivedAt).length;
  TABS.forEach((t) => { tabCounts[t] = scopeFilter(byProject(liveLog.filter((x) => (x as any).tab === t))).length; });
  const inTab = byProject(liveLog.filter((x) => (x as any).tab === tab));
  const tasks = scopeFilter(inTab).filter((t) => matchesQuery({ ...t, title: [t.serial, t.subject, t.description].filter(Boolean).join(' ') }, query));
  const logMineCount = inTab.filter((t) => isMine(t, currentUser)).length;
  const { sorted, sort, setSort, toggle } = useSort(tasks, {
    id: (t) => t.id, type: (t) => t.topicType, subject: (t) => logTaskTitle(t), status: (t) => t.status, who: (t) => t.assignedTo, date: (t) => t.meetingDate, due: (t) => t.dueDate,
  }, null, { date: 'desc' });
  const viewValue = { tab, pf, query, scope, person, sort: sortToString(sort) };

  const sel = selectedId ? logTasks.find((x) => x.id === selectedId) || null : null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Mode toggle: Asana-style board vs the request log */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: 'var(--c-efede8)', padding: 3, borderRadius: 999 }}>
          {([['board', 'Task Board'], ['log', 'Request Log']] as [typeof mode, string][]).map((m) => (
            <div key={m[0]} onClick={() => setMode(m[0])} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: mode === m[0] ? 'var(--seg-on)' : 'transparent', color: mode === m[0] ? 'var(--ink)' : 'var(--muted)', boxShadow: mode === m[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{m[1]}</div>
          ))}
        </div>
        {mode === 'board' && (
          <>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>Project:</span>
            <select value={boardProjectId} onChange={(e) => { const v = e.target.value; selectBoardProject(v === 'general' || v === 'all' || v.startsWith('lead:') ? v as BoardSel : Number(v)); }} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none', maxWidth: 320 }}>
              <option value="all">All tasks — every project and General</option>
              <option value="general">General Tasks</option>
              <optgroup label="Projects">{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
              {/* Work for a lead, before there's a signed contract. */}
              {(targets.leads.length > 0 || boardLead) && (
                <optgroup label="Leads (no contract yet)">
                  {boardLead && !targets.leads.some((l) => l.id === boardLead) && <option value={boardProjectId}>{boardLead}</option>}
                  {targets.leads.map((l) => <option key={l.id} value={'lead:' + l.id}>{l.name}</option>)}
                </optgroup>
              )}
            </select>
          </>
        )}
      </div>

      {mode === 'board' ? (
        <TaskBoard projectId={boardProjectId === 'general' || boardLead ? null : boardProjectId as number | 'all'} leadId={boardLead} initialTaskId={deepTask}
          board={{ value: String(boardProjectId), set: (v) => selectBoardProject(v === 'all' || v === 'general' || v.startsWith('lead:') ? v as BoardSel : (Number(v) || 'all')) }} />
      ) : (
      <>
      {/* Tabs + filter + new */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <div key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? 'var(--forest)' : 'transparent', color: tab === t ? 'white' : 'var(--muted)', border: tab === t ? 'none' : '1px solid rgba(var(--rgb-shade), 0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {TAB_LABELS[t]}
            <span style={{ fontSize: 11, fontWeight: 700, background: tab === t ? 'rgba(255,255,255,0.25)' : 'var(--sand)', padding: '1px 8px', borderRadius: 999, color: tab === t ? 'white' : 'var(--muted)' }}>{tabCounts[t]}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <TaskScopeToggle
          scope={scope}
          setScope={setScope}
          restricted={restricted}
          mineCount={logMineCount}
          allCount={inTab.length}
          counts={scopeCounts(inTab as any[])}
        />
        <PersonFilter person={person} setPerson={setPerson} users={allUsers} scope={scope} visible={!restricted && (scope === 'assigned' || scope === 'from')} />
        <TaskSearch value={query} onChange={setQuery} placeholder="Search requests…" />
        {(archivedCount > 0 || showArchived) && (
          <div onClick={() => setShowArchived((v) => !v)} title="Confirmed entries move here 7 days after they're confirmed"
            style={{ padding: '9px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(var(--rgb-shade), 0.12)', background: showArchived ? 'var(--ink)' : 'var(--surface)', color: showArchived ? '#FDFCF9' : 'var(--muted)', whiteSpace: 'nowrap' }}>
            {showArchived ? '← Back to the log' : `Archived ${archivedCount}`}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <div onClick={(e) => { e.stopPropagation(); swallow.current = true; setProjOpen((o) => !o); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: pf === 'All projects' ? 'var(--muted)' : 'white', background: pf === 'All projects' ? 'var(--surface)' : 'var(--forest)', border: '1px solid rgba(var(--rgb-shade), 0.08)' }}>
            <span>{pf}</span>
            <svg width={10} height={6} viewBox="0 0 10 6" fill="none" style={{ transform: projOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M1 1l4 4 4-4" stroke={pf === 'All projects' ? '#7E9B93' : 'white'} strokeWidth={1.6} strokeLinecap="round" /></svg>
          </div>
          {projOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 200, background: 'var(--surface)', borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), 0.08)', boxShadow: '0 12px 30px rgba(var(--rgb-ink), 0.16)', padding: 5, maxHeight: 260, overflowY: 'auto' }}>
              {['All projects', ...(hasGeneral ? [GENERAL_PF] : []), ...taskProjects].map((pr) => (
                <div key={pr} onClick={() => { setPf(pr); setProjOpen(false); }} style={{ padding: '8px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: pf === pr ? 700 : 500, color: pf === pr ? 'var(--forest)' : 'var(--body)', background: pf === pr ? 'var(--mint)' : 'transparent' }}>{pr}</div>
              ))}
            </div>
          )}
        </div>
        {canManage && <div onClick={openNew} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: 'var(--forest)', color: 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>+ New Task</div>}
      </div>

      {!restricted && (
        <div style={{ marginBottom: 12 }}>
          <SavedViews page="tasks.log" value={viewValue} defaults={{ tab: 'internal', pf: 'All projects', query: '', scope: 'all', person: '', sort: '' }}
            onApply={(v) => { setTab(v.tab as TaskTab); setPf(String(v.pf || 'All projects')); setQuery(String(v.query || '')); setScope(v.scope as TaskScope); setPerson(String(v.person || '')); setSort(sortFromString(v.sort)); }} />
        </div>
      )}
      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-14)', border: '1px solid rgba(var(--rgb-shade), 0.06)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '12px 20px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', gap: 10, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 760 }}>
          {([['id', 'Task #'], ['type', 'Type'], ['subject', 'Subject'], ['status', 'Status'], ['who', 'Assigned To'], ['date', 'Date'], ['due', 'Due']] as [string, string][]).map(([k, h]) => <SortHeader key={k} k={k} sort={sort} onSort={toggle}>{h}</SortHeader>)}
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No tasks in this category.</div>
        ) : (
          sorted.map((t) => {
            const sc = logStatusTone(t.status);
            const tc = TT_COLORS[t.topicType];
            const assignedUser = users.find((u) => (t.assignedToId && u.id === t.assignedToId) || u.name === t.assignedTo);
            const desc = logTaskTitle(t);
            return (
              <div key={t.id} onClick={() => setSelectedId(t.id)} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)', cursor: 'pointer', gap: 10, minWidth: 760 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{t.serial || t.id}</span>
                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.c, textAlign: 'center' }}>{t.topicType}</span>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, overflowWrap: 'anywhere' }}>{desc}</span>
                  {(createdByText(t) || t.project || t.leadName) && <span style={{ fontSize: 11, color: 'var(--muted)', overflowWrap: 'anywhere' }}>{[t.project, leadLabel(t.leadName), createdByText(t)].filter(Boolean).join(' · ')}</span>}
                </span>
                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.c, textAlign: 'center' }}>{t.status}</span>
                {t.assignedTo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar user={assignedUser} name={t.assignedTo} size={24} bg="var(--sidebar)" />
                    <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assignedTo}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.meetingDate}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.dueDate || '—'}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Task detail — the same drawer the CRM opens */}
      {sel && (
        <RequestLogTaskDrawer
          task={sel}
          allLabels={allLabels}
          onClose={() => setSelectedId(null)}
          onChanged={(res) => setLogTasks((prev) => prev.map((x) => (x.id === res.id ? res : x)))}
          onDeleted={(id) => setLogTasks((prev) => prev.filter((x) => x.id !== id))}
        />
      )}

      {/* New task — right-side drawer, shared with every other "add task" entry point */}
      {showNew && (
        <NewTaskDrawer
          onClose={() => setShowNew(false)}
          onCreated={reloadLog}
          defaultAssignedTo={scope === 'mine' ? currentUser?.name : undefined}
        />
      )}
      </>
      )}
    </div>
  );
}
