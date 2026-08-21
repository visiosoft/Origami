import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';
import { Avatar } from '../components/Avatar';
import { AssigneePicker } from '../components/AssigneePicker';
import { Attachments } from '../components/Attachments';
import { ActivityFeed } from '../components/ActivityFeed';
import { Checklist } from '../components/Checklist';
import { LabelPicker } from '../components/LabelPicker';
import { useTaskScope, TaskScopeToggle, PersonFilter, TaskSearch, matchesQuery, isMine } from '../components/TaskScope';
import type { Attachment as TaskAttachment, ChecklistItem } from '../data/projectTasks';
import { TaskBoard } from '../components/TaskBoard';
import { ST_COLORS, TT_COLORS, MT_COLORS, getLeadTime, type Task, type TaskTab } from '../data/tasks';

const BG = "'Bricolage Grotesque', serif";
const COLS = '110px 56px 2fr 80px 100px 64px 58px';
const TABS: TaskTab[] = ['internal', 'owner', 'subcontractor'];
/** The board project is remembered so coming back lands on the same one. */
const PROJECT_KEY = 'origami.tasksProjectId';
const TAB_LABELS: Record<TaskTab, string> = { internal: 'Internal', owner: 'Owner', subcontractor: 'Subcontractor' };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' };

interface NewTask { tab: TaskTab; meetingType: string; meetingDate: string; assignedTo: string; originator: string; topicType: string; status: string; dueDate: string; project: string; description: string; linkedFile: string }
const blankTask = (tab: TaskTab): NewTask => ({ tab, meetingType: 'Internal', meetingDate: '', assignedTo: '', originator: '', topicType: 'Task', status: 'Open', dueDate: '', project: '', description: '', linkedFile: '' });

export function Tasks() {
  const { toast, can, users } = useApp();
  const { scope, setScope, filter: scopeFilter, restricted, currentUser, person, setPerson, users: allUsers } = useTaskScope();
  const [query, setQuery] = useState('');
  const canManage = can('tasks', 'manage');
  const [tab, setTab] = useState<TaskTab>('internal');
  const [pf, setPf] = useState('All projects');
  const [projOpen, setProjOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  // Uploads need a connected Google account; links work regardless.
  const [storageReady, setStorageReady] = useState(false);
  const swallow = useRef(false);
  const [mode, setMode] = useState<'board' | 'log'>('board');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [boardProjectId, setBoardProjectId] = useState<number | null>(() => {
    try {
      const stored = Number(localStorage.getItem(PROJECT_KEY));
      return Number.isFinite(stored) && stored > 0 ? stored : null;
    } catch { return null; }
  });
  const [logTasks, setLogTasks] = useState<Task[]>([]);
  const [nt, setNt] = useState<NewTask>(blankTask('internal'));

  const selectBoardProject = (id: number) => {
    setBoardProjectId(id);
    try { localStorage.setItem(PROJECT_KEY, String(id)); } catch { /* ignore */ }
  };

  const reloadLog = () => { api.tasks.list().then((r: any) => { if (Array.isArray(r)) setLogTasks(r as Task[]); }).catch(() => { }); };
  useEffect(() => {
    api.projects.list().then((r: any) => {
      if (Array.isArray(r) && r.length) {
        setProjects(r.map((p) => ({ id: p.id, name: p.name })));
        // Keep the remembered project only while it still exists, so a deleted
        // one doesn't leave the board pointing at nothing.
        setBoardProjectId((cur) => (cur != null && r.some((p: any) => p.id === cur) ? cur : r[0].id));
      }
    }).catch(() => { });
    api.google.status().then((g) => setStorageReady(!!g?.connected)).catch(() => setStorageReady(false));
    reloadLog();
  }, []);

  useEffect(() => {
    const onDoc = () => { if (swallow.current) { swallow.current = false; return; } setProjOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  /** Replace one task in local state with the server's fresh copy. */
  const replaceTask = (res: any) => { if (res?.id) setLogTasks((prev) => prev.map((t) => (t.id === res.id ? (res as Task) : t))); };

  /** Patch a Request Log task. The log used to be read-only — it now saves. */
  const saveTask = (id: string, patch: Partial<Task>) => {
    setLogTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    api.tasks.update(id, patch).then(replaceTask).catch((e: Error) => toast('⚠ ' + (e.message || 'Failed to save')));
  };

  const addComment = async (id: string, text: string) => {
    try { replaceTask(await api.tasks.addComment(id, text)); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Failed to comment')); }
  };
  const uploadFiles = async (id: string, files: File[]) => {
    replaceTask(await api.tasks.uploadAttachments(id, files));
    toast(files.length === 1 ? 'File attached' : `${files.length} files attached`);
  };
  const addLink = async (id: string, name: string, url: string) => { replaceTask(await api.tasks.addLink(id, name, url)); };
  const removeAttachment = async (id: string, att: TaskAttachment) => {
    try { replaceTask(await api.tasks.removeAttachment(id, att.id)); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Failed to remove')); }
  };
  const deleteTask = (id: string) => {
    if (!confirm('Delete this task?')) return;
    setLogTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
    api.tasks.remove(id).catch(() => toast('⚠ Failed to delete'));
  };

  // Labels already in use, offered as suggestions.
  const allLabels = Array.from(new Set(logTasks.flatMap((t) => t.labels ?? []))).sort();

  const openNew = () => {
    // Default the assignee to you when filtered to "My tasks", so a new request
    // doesn't disappear the moment it's created.
    const draft = blankTask(tab);
    if (scope === 'mine' && currentUser) draft.assignedTo = currentUser.name;
    setNt(draft);
    setShowNew(true);
  };
  const createTask = () => {
    if (nt.description.trim().length < 3) { toast('Add a task description'); return; }
    api.tasks.create({ ...nt }).then(() => { toast('Task created'); setShowNew(false); reloadLog(); }).catch(() => toast('⚠ Failed to create task'));
  };

  const taskProjects: string[] = [];
  logTasks.forEach((x) => { if (x.project && !taskProjects.includes(x.project)) taskProjects.push(x.project); });
  const byProject = (list: Task[]) => (pf === 'All projects' ? list : list.filter((x) => x.project === pf));
  const tabCounts: Record<TaskTab, number> = { internal: 0, owner: 0, subcontractor: 0 };
  TABS.forEach((t) => { tabCounts[t] = scopeFilter(byProject(logTasks.filter((x) => (x as any).tab === t))).length; });
  const inTab = byProject(logTasks.filter((x) => (x as any).tab === tab));
  const tasks = scopeFilter(inTab).filter((t) => matchesQuery({ ...t, title: t.description }, query));
  const logMineCount = inTab.filter((t) => isMine(t, currentUser)).length;

  const sel = selectedId ? logTasks.find((x) => x.id === selectedId) || null : null;
  const lt = sel ? getLeadTime(sel) : null;

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
            <select value={boardProjectId ?? ''} onChange={(e) => selectBoardProject(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit', fontSize: 13, color: '#0B1A12', outline: 'none', maxWidth: 320 }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
      </div>

      {mode === 'board' ? (
        boardProjectId != null ? <TaskBoard projectId={boardProjectId} /> : <div style={{ fontSize: 13, color: '#7E9B93' }}>No projects yet.</div>
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
              {['All projects', ...taskProjects].map((pr) => (
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
            const desc = t.description.length > 80 ? t.description.slice(0, 80) + '…' : t.description;
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

      {/* Task detail modal */}
      {sel && lt && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 100, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: 760, maxWidth: '95vw', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,8,31,0.15)', animation: 'scaleIn 0.2s ease' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#7E9B93', fontVariantNumeric: 'tabular-nums', background: '#FBF8F2', padding: '3px 10px', borderRadius: 6 }}>{sel.id}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: ST_COLORS[sel.status].bg, color: ST_COLORS[sel.status].c }}>{sel.status}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: TT_COLORS[sel.topicType].bg, color: TT_COLORS[sel.topicType].c }}>{sel.topicType}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: MT_COLORS[sel.meetingType].bg, color: MT_COLORS[sel.meetingType].c }}>{sel.meetingType}</span>
                </div>
                <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.4 }}>{sel.description}</div>
              </div>
              <div onClick={() => setSelectedId(null)} style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px solid rgba(20,8,31,0.08)', marginLeft: 16, flexShrink: 0 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
              </div>
            </div>

            {/* Meta */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Assigned To</div>
                  <AssigneePicker
                    valueId={sel.assignedToId}
                    valueName={sel.assignedTo}
                    disabled={!canManage}
                    onChange={(u) => saveTask(sel.id, { assignedToId: u?.id ?? '', assignedTo: u?.name ?? '' })}
                  />
                </div>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Status</div>
                  <select
                    disabled={!canManage}
                    value={sel.status}
                    onChange={(e) => saveTask(sel.id, { status: e.target.value as Task['status'] })}
                    style={{ ...inputStyle, padding: '7px 9px' }}
                  >
                    {(['Open', 'In Progress', 'Closed'] as const).map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Meeting Date</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sel.meetingDate}</div>
                </div>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Project</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#173326' }}>{sel.project}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
                <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Due Date</div>
                  <input
                    type="date"
                    disabled={!canManage}
                    value={sel.dueDate || ''}
                    onChange={(e) => saveTask(sel.id, { dueDate: e.target.value })}
                    style={{ ...inputStyle, padding: '7px 9px' }}
                  />
                </div>
                {([['Date Closed', sel.dateClosed || '—'], ['Days Open', sel.daysOpen > 0 ? sel.daysOpen + ' days' : '—'], ['Originator', sel.originator || '—']] as [string, string][]).map((r) => (
                  <div key={r[0]} style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r[1]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93', marginBottom: 10 }}>Description</div>
              <div style={{ padding: '14px 16px', background: '#FBF8F2', borderRadius: 10 }}>
                <textarea
                  disabled={!canManage}
                  defaultValue={sel.description}
                  key={'d' + sel.id}
                  onBlur={(e) => { if (e.target.value !== sel.description) saveTask(sel.id, { description: e.target.value }); }}
                  rows={3}
                  style={{ ...inputStyle, background: 'white', resize: 'vertical', lineHeight: 1.6 }}
                />
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(20,8,31,0.07)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2F7D4A', marginBottom: 6 }}>Resolution</div>
                  <textarea
                    disabled={!canManage}
                    defaultValue={sel.resolution}
                    key={'r' + sel.id}
                    onBlur={(e) => { if (e.target.value !== sel.resolution) saveTask(sel.id, { resolution: e.target.value }); }}
                    rows={2}
                    placeholder="How was this resolved?"
                    style={{ ...inputStyle, background: 'white', resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginTop: 18 }}>
                <Checklist
                  items={sel.checklist ?? []}
                  canManage={canManage}
                  onChange={(checklist: ChecklistItem[]) => saveTask(sel.id, { checklist })}
                />
                <LabelPicker
                  labels={sel.labels ?? []}
                  canManage={canManage}
                  suggestions={allLabels}
                  onChange={(labels) => saveTask(sel.id, { labels })}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <Attachments
                  scope="tasks"
                  taskId={sel.id}
                  attachments={sel.attachments ?? []}
                  canManage={canManage}
                  storageReady={storageReady}
                  onUpload={(files) => uploadFiles(sel.id, files)}
                  onRemove={(att) => removeAttachment(sel.id, att)}
                  onAddLink={(name, url) => addLink(sel.id, name, url)}
                />
              </div>
            </div>

            {/* Due date & lead time */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7E9B93' }}>Due Date & Lead Time</div>
                <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 999, background: lt.bg, color: lt.color, whiteSpace: 'nowrap' }}>{lt.label}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {([['Lead Time', lt.leadTime + ' days'], ['Open Days', lt.openDays + ' days'], ['Variance', lt.variance === 0 ? 'On target' : lt.variance > 0 ? '+' + lt.variance + ' days' : lt.variance + ' days']] as [string, string][]).map((r, i) => (
                  <div key={r[0]} style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: i === 2 ? lt.color : '#0B1A12' }}>{r[1]}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Date Change Audit Trail</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {lt.audit.map((au, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#FBF8F2', borderRadius: 9 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 999, background: au.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0B1A12' }}>{au.what}</div>
                        <div style={{ fontSize: 10.5, color: '#7E9B93', marginTop: 2 }}>{au.by} · {au.when}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: au.chipBg, color: au.chipC, flexShrink: 0 }}>{au.chip}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '11px 13px', background: '#EEF3EE', borderRadius: 10, fontSize: 10.5, color: '#43514D', lineHeight: 1.55 }}>Lead time is inherited from the task template ({lt.source}). Moving a due date needs approval from the task owner, and every change is logged above.</div>
            </div>

            {/* Activity — real comments and a record of what changed */}
            <div style={{ padding: '20px 28px' }}>
              <ActivityFeed
                comments={sel.comments ?? []}
                activity={sel.activity ?? []}
                canManage={canManage}
                onComment={(text) => addComment(sel.id, text)}
              />
            </div>

            {canManage && (
              <div style={{ padding: '0 28px 26px' }}>
                <div onClick={() => deleteTask(sel.id)} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete task</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New task — right-side drawer */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex: 200, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: 460, maxWidth: '96vw', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,8,31,0.18)', animation: 'scaleIn 0.2s ease', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(20,8,31,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>New Task</div>
              <div onClick={() => setShowNew(false)} style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93' }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
              </div>
            </div>
            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1 }}>
              <Fld label="Meeting Type"><select value={nt.meetingType} onChange={(e) => setNt({ ...nt, meetingType: e.target.value })} style={inputStyle}>{['Internal', 'Owner', 'Subcontractor'].map((o) => <option key={o}>{o}</option>)}</select></Fld>
              <Fld label="Meeting Date"><input type="date" value={nt.meetingDate} onChange={(e) => setNt({ ...nt, meetingDate: e.target.value })} style={inputStyle} /></Fld>
              <Fld label="Assigned To"><select value={nt.assignedTo} onChange={(e) => setNt({ ...nt, assignedTo: e.target.value })} style={inputStyle}><option value="">Select person…</option>{users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</select></Fld>
              <Fld label="Originator"><select value={nt.originator} onChange={(e) => setNt({ ...nt, originator: e.target.value })} style={inputStyle}><option value="">Select person…</option>{users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</select></Fld>
              <Fld label="Topic Type"><select value={nt.topicType} onChange={(e) => setNt({ ...nt, topicType: e.target.value })} style={inputStyle}>{['Task', 'FYI', 'RFI'].map((o) => <option key={o}>{o}</option>)}</select></Fld>
              <Fld label="Status"><select value={nt.status} onChange={(e) => setNt({ ...nt, status: e.target.value })} style={inputStyle}>{['Open', 'In Progress', 'Closed'].map((o) => <option key={o}>{o}</option>)}</select></Fld>
              <Fld label="Due Date"><input type="date" value={nt.dueDate} onChange={(e) => setNt({ ...nt, dueDate: e.target.value })} style={inputStyle} /></Fld>
              <Fld label="Project"><select value={nt.project} onChange={(e) => setNt({ ...nt, project: e.target.value })} style={inputStyle}><option value="">Select project…</option>{projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></Fld>
              <Fld label="Description *" span><textarea value={nt.description} onChange={(e) => setNt({ ...nt, description: e.target.value })} rows={4} placeholder="Describe the task…" style={{ ...inputStyle, resize: 'vertical' }} /></Fld>
              <Fld label="Link to File" span><input value={nt.linkedFile} onChange={(e) => setNt({ ...nt, linkedFile: e.target.value })} placeholder="Attach or paste link" style={inputStyle} /></Fld>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(20,8,31,0.08)', display: 'flex', gap: 12, justifyContent: 'flex-end', flexShrink: 0 }}>
              <div onClick={() => setShowNew(false)} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,0.12)', background: 'white' }}>Cancel</div>
              <div onClick={createTask} style={{ padding: '10px 20px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#173326', color: 'white', boxShadow: '0 4px 14px rgba(210,130,46,0.3)' }}>Create Task</div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function Fld({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
