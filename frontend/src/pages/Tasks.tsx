import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { useTaskScope, TaskScopeToggle, PersonFilter, TaskSearch, matchesQuery, isMine } from '../components/TaskScope';
import { TaskBoard } from '../components/TaskBoard';
import { NewTaskDrawer } from '../components/NewTaskDrawer';
import { RequestLogTaskDrawer } from '../components/RequestLogTaskDrawer';
import { ST_COLORS, TT_COLORS, taskHeadline, type Task, type TaskTab } from '../data/tasks';

const COLS = '110px 56px 2fr 80px 100px 64px 58px';
const TABS: TaskTab[] = ['internal', 'owner', 'subcontractor'];
/** The board project is remembered so coming back lands on the same one. */
const PROJECT_KEY = 'origami.tasksProjectId';
const TAB_LABELS: Record<TaskTab, string> = { internal: 'Internal', owner: 'Owner', subcontractor: 'Subcontractor' };

export function Tasks() {
  const { can, users } = useApp();
  const { scope, setScope, filter: scopeFilter, restricted, currentUser, person, setPerson, users: allUsers } = useTaskScope();
  const [query, setQuery] = useState('');
  const canManage = can('tasks', 'manage');
  const [tab, setTab] = useState<TaskTab>('internal');
  const [pf, setPf] = useState('All projects');
  const [projOpen, setProjOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const swallow = useRef(false);
  const [mode, setMode] = useState<'board' | 'log'>('board');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  // 'general' is a real, standing selection (the General Tasks board -- work
  // not tied to any client project), not an absence-of-choice placeholder.
  const [boardProjectId, setBoardProjectId] = useState<number | 'general'>(() => {
    try {
      const stored = localStorage.getItem(PROJECT_KEY);
      if (stored === 'general') return 'general';
      const n = Number(stored);
      return Number.isFinite(n) && n > 0 ? n : 'general';
    } catch { return 'general'; }
  });
  const [logTasks, setLogTasks] = useState<Task[]>([]);

  // Deep link from an assignment email or the notification bell:
  //   /tasks?task=<id>&project=<id>   board
  //   /tasks?task=<id>&type=log       request log
  const [params, setParams] = useSearchParams();
  const linkedTaskId = params.get('task');
  const linkedIsLog = params.get('type') === 'log';
  const linkedProjectId = Number(params.get('project')) || null;

  const selectBoardProject = (id: number | 'general') => {
    setBoardProjectId(id);
    try { localStorage.setItem(PROJECT_KEY, String(id)); } catch { /* ignore */ }
  };

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
      // "General Tasks") as long as it's still valid; a deleted remembered
      // project falls back to General Tasks rather than guessing another one.
      setBoardProjectId((cur) => {
        if (linkedProjectId != null && real.some((p: any) => p.id === linkedProjectId)) return linkedProjectId;
        if (cur === 'general') return cur;
        return real.some((p: any) => p.id === cur) ? cur : 'general';
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
  const hasGeneral = logTasks.some((x) => !x.project);
  const byProject = (list: Task[]) =>
    pf === 'All projects' ? list : pf === GENERAL_PF ? list.filter((x) => !x.project) : list.filter((x) => x.project === pf);
  const tabCounts: Record<TaskTab, number> = { internal: 0, owner: 0, subcontractor: 0 };
  TABS.forEach((t) => { tabCounts[t] = scopeFilter(byProject(logTasks.filter((x) => (x as any).tab === t))).length; });
  const inTab = byProject(logTasks.filter((x) => (x as any).tab === tab));
  const tasks = scopeFilter(inTab).filter((t) => matchesQuery({ ...t, title: t.description }, query));
  const logMineCount = inTab.filter((t) => isMine(t, currentUser)).length;

  const sel = selectedId ? logTasks.find((x) => x.id === selectedId) || null : null;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Mode toggle: Asana-style board vs the request log */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999 }}>
          {([['board', 'Task Board'], ['log', 'Request Log']] as [typeof mode, string][]).map((m) => (
            <div key={m[0]} onClick={() => setMode(m[0])} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: mode === m[0] ? 'white' : 'transparent', color: mode === m[0] ? '#0B1A12' : '#7E9B93', boxShadow: mode === m[0] ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{m[1]}</div>
          ))}
        </div>
        {mode === 'board' && (
          <>
            <span style={{ fontSize: 12, color: '#7E9B93', marginLeft: 4 }}>Project:</span>
            <select value={boardProjectId} onChange={(e) => selectBoardProject(e.target.value === 'general' ? 'general' : Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit', fontSize: 13, color: '#0B1A12', outline: 'none', maxWidth: 320 }}>
              <option value="general">General Tasks</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
      </div>

      {mode === 'board' ? (
        <TaskBoard projectId={boardProjectId === 'general' ? null : boardProjectId} initialTaskId={linkedIsLog ? null : linkedTaskId} />
      ) : (
      <>
      {/* Tabs + filter + new */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <div key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#173326' : 'transparent', color: tab === t ? 'white' : '#7E9B93', border: tab === t ? 'none' : '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {TAB_LABELS[t]}
            <span style={{ fontSize: 11, fontWeight: 700, background: tab === t ? 'rgba(255,255,255,0.25)' : '#EDE3D0', padding: '1px 8px', borderRadius: 999, color: tab === t ? 'white' : '#7E9B93' }}>{tabCounts[t]}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <TaskScopeToggle
          scope={scope}
          setScope={setScope}
          restricted={restricted}
          mineCount={logMineCount}
          allCount={inTab.length}
        />
        <PersonFilter person={person} setPerson={setPerson} users={allUsers} visible={!restricted && scope === 'all'} />
        <TaskSearch value={query} onChange={setQuery} placeholder="Search requests…" />
        <div style={{ position: 'relative' }}>
          <div onClick={(e) => { e.stopPropagation(); swallow.current = true; setProjOpen((o) => !o); }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: pf === 'All projects' ? '#7E9B93' : 'white', background: pf === 'All projects' ? 'white' : '#173326', border: '1px solid rgba(20,8,31,0.08)' }}>
            <span>{pf}</span>
            <svg width={10} height={6} viewBox="0 0 10 6" fill="none" style={{ transform: projOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M1 1l4 4 4-4" stroke={pf === 'All projects' ? '#7E9B93' : 'white'} strokeWidth={1.6} strokeLinecap="round" /></svg>
          </div>
          {projOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 200, background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.08)', boxShadow: '0 12px 30px rgba(11,26,18,0.16)', padding: 5, maxHeight: 260, overflowY: 'auto' }}>
              {['All projects', ...(hasGeneral ? [GENERAL_PF] : []), ...taskProjects].map((pr) => (
                <div key={pr} onClick={() => { setPf(pr); setProjOpen(false); }} style={{ padding: '8px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: pf === pr ? 700 : 500, color: pf === pr ? '#173326' : '#43514D', background: pf === pr ? '#DCE7DE' : 'transparent' }}>{pr}</div>
              ))}
            </div>
          )}
        </div>
        {canManage && <div onClick={openNew} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: '#173326', color: 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>+ New Task</div>}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid rgba(20,8,31,0.06)', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '12px 20px', borderBottom: '1px solid rgba(20,8,31,0.06)', gap: 10, fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 760 }}>
          <span>Task #</span><span>Type</span><span>Description</span><span>Status</span><span>Assigned To</span><span>Date</span><span>Due</span>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7E9B93', fontSize: 14 }}>No tasks in this category.</div>
        ) : (
          tasks.map((t) => {
            const sc = ST_COLORS[t.status];
            const tc = TT_COLORS[t.topicType];
            const assignedUser = users.find((u) => (t.assignedToId && u.id === t.assignedToId) || u.name === t.assignedTo);
            const desc = taskHeadline(t.description).title;
            return (
              <div key={t.id} onClick={() => setSelectedId(t.id)} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(20,8,31,0.04)', cursor: 'pointer', gap: 10, minWidth: 760 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#7E9B93', fontVariantNumeric: 'tabular-nums' }}>{t.id}</span>
                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.c, textAlign: 'center' }}>{t.topicType}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.c, textAlign: 'center' }}>{t.status}</span>
                {t.assignedTo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar user={assignedUser} name={t.assignedTo} size={24} bg="#0F2417" />
                    <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assignedTo}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#7E9B93' }}>—</span>
                )}
                <span style={{ fontSize: 12, color: '#7E9B93' }}>{t.meetingDate}</span>
                <span style={{ fontSize: 12, color: '#7E9B93' }}>{t.dueDate || '—'}</span>
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
