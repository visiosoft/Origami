import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';
import {
  PRIORITIES, PRIORITY_STYLE, TASK_STATUSES, STATUS_STYLE, topLevelBySection, subtasksOf,
  checklistProgress,
  type ProjectSection, type ProjectTask, type Priority, type TaskStatus,
  type Attachment as TaskAttachment, type ChecklistItem,
} from '../data/projectTasks';
import { Avatar } from './Avatar';
import { AssigneePicker } from './AssigneePicker';
import { Attachments } from './Attachments';
import { ActivityFeed } from './ActivityFeed';
import { Checklist } from './Checklist';
import { LabelPicker, LabelChip } from './LabelPicker';
import { useTaskScope, TaskScopeToggle, PersonFilter, TaskSearch, matchesQuery, isMine } from './TaskScope';
import { filesFromClipboard, nameClipboardFile } from './Attachments';

const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};

function StatusPill({ s }: { s?: TaskStatus }) {
  if (!s || s === 'Not started') return null;
  const st = STATUS_STYLE[s];
  return <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: st.bg, color: st.c }}>{s}</span>;
}

function PriorityPill({ p }: { p?: Priority }) {
  if (!p) return null;
  const s = PRIORITY_STYLE[p];
  return <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.c }}>{p}</span>;
}

export function TaskBoard({ projectId }: { projectId: number }) {
  const { can, toast, users } = useApp();
  const { scope, setScope, filter: scopeFilter, restricted, currentUser, person, setPerson, users: allUsers } = useTaskScope();
  const [query, setQuery] = useState('');
  const canManage = can('tasks', 'manage');
  const isMobile = useWindowWidth() <= 720;

  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Uploads need a connected Google account; links work regardless.
  const [storageReady, setStorageReady] = useState(false);
  // Phase tasks belong to the project's delivery programme and have their own
  // board; keep them out of here unless asked for.
  const [showPhaseTasks, setShowPhaseTasks] = useState(false);
  const loadedProject = useRef<number | null>(null);

  const load = () => {
    api.projectTasks.board(projectId)
      .then((res: any) => { if (res) { setSections(res.sections || []); setTasks(res.tasks || []); } })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => { setLoading(true); loadedProject.current = projectId; load(); /* eslint-disable-next-line */ }, [projectId]);
  // Assignees come from useApp().users — already loaded app-wide, no fetch needed.
  useEffect(() => { api.google.status().then((s) => setStorageReady(!!s?.connected)).catch(() => setStorageReady(false)); }, []);

  const inScopeOfBoard = showPhaseTasks ? tasks : tasks.filter((t) => !t.phaseId);
  const visibleTasks = scopeFilter(inScopeOfBoard).filter((t) => matchesQuery(t, query));
  const phaseTaskCount = tasks.filter((t) => t.phaseId && !t.parentId).length;
  // Counts are absolute, not relative to the active scope.
  const mineCount = inScopeOfBoard.filter((t) => !t.parentId && isMine(t, currentUser)).length;
  const allCount = inScopeOfBoard.filter((t) => !t.parentId).length;
  const selected = tasks.find((t) => t.id === selectedId) || null;
  // Labels already in use on this board, offered as suggestions.
  const allLabels = Array.from(new Set(tasks.flatMap((t) => t.labels ?? []))).sort();

  // ---- task mutations (optimistic + persist) ----
  const patchLocal = (id: string, patch: Partial<ProjectTask>) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const updateTask = (id: string, patch: Partial<ProjectTask>) => {
    patchLocal(id, patch);
    api.projectTasks.update(id, patch).catch(() => toast('⚠ Failed to save'));
  };
  const addTask = (sectionId: string, title: string, parentId: string | null = null) => {
    const t = title.trim(); if (!t) return;
    const order = tasks.filter((x) => x.sectionId === sectionId && !x.parentId).length;
    // Adding while filtered to "My tasks" assigns it to you — otherwise the new
    // task is created unassigned and immediately filtered out of view.
    const mine = scope === 'mine' && currentUser
      ? { assigneeId: currentUser.id, assignee: currentUser.name }
      : {};
    api.projectTasks.create({ projectId, sectionId, title: t, order, parentId, ...mine }).then((res: any) => {
      if (res) setTasks((prev) => [...prev, res as ProjectTask]);
    }).catch(() => toast('⚠ Failed to add task'));
  };
  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parentId !== id));
    if (selectedId === id) setSelectedId(null);
    api.projectTasks.remove(id).catch(() => toast('⚠ Failed to delete'));
  };
  const moveTask = (id: string, sectionId: string) => {
    const t = tasks.find((x) => x.id === id); if (!t || t.sectionId === sectionId) return;
    updateTask(id, { sectionId });
  };

  // ---- section mutations ----
  const addSection = () => {
    api.projectSections.create({ projectId, name: 'New Section', order: sections.length })
      .then((res: any) => { if (res) setSections((prev) => [...prev, res as ProjectSection]); })
      .catch(() => toast('⚠ Failed to add section'));
  };
  const renameSection = (id: string, name: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    api.projectSections.update(id, { name }).catch(() => { });
  };
  const deleteSection = (id: string) => {
    if (sections.length <= 1) { toast('Keep at least one section'); return; }
    const rest = sections.filter((s) => s.id !== id);
    const target = rest[0].id;
    if (!confirm('Delete this section? Its tasks move to "' + rest[0].name + '".')) return;
    // move tasks to the first remaining section, then delete the section
    tasks.filter((t) => t.sectionId === id).forEach((t) => updateTask(t.id, { sectionId: target }));
    setSections(rest);
    api.projectSections.remove(id).catch(() => { });
  };

  // ---- subtasks / attachments / comments (on selected task) ----
  const toggleSub = (sub: ProjectTask) => updateTask(sub.id, { completed: !sub.completed });
  const addSubtask = () => { if (!selected) return; addTask(selected.sectionId, subDraft, selected.id); setSubDraft(''); };
  // Comments and attachments are written server-side so the author, timestamp
  // and history entry are recorded consistently; the response is the fresh task.
  const replaceTask = (res: any) => { if (res?.id) setTasks((prev) => prev.map((t) => (t.id === res.id ? (res as ProjectTask) : t))); };

  const addComment = async (text: string) => {
    if (!selected) return;
    try { replaceTask(await api.projectTasks.addComment(selected.id, text)); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Failed to comment')); }
  };
  const uploadFiles = async (files: File[]) => {
    if (!selected) return;
    replaceTask(await api.projectTasks.uploadAttachments(selected.id, files));
    toast(files.length === 1 ? 'File attached' : `${files.length} files attached`);
  };
  const addLink = async (name: string, url: string) => {
    if (!selected) return;
    replaceTask(await api.projectTasks.addLink(selected.id, name, url));
  };
  const removeAttachment = async (att: TaskAttachment) => {
    if (!selected) return;
    try { replaceTask(await api.projectTasks.removeAttachment(selected.id, att.id)); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Failed to remove')); }
  };

  /** Persist a manual card order after a drag inside one column. */
  const reorderIn = (sectionId: string, draggedId: string, index: number) => {
    const current = topLevelBySection(tasks, sectionId).filter((t) => t.id !== draggedId);
    const dragged = tasks.find((t) => t.id === draggedId);
    if (!dragged) return;
    const next = [...current.slice(0, index), dragged, ...current.slice(index)];
    const ids = next.map((t) => t.id);
    setTasks((prev) => prev.map((t) => {
      const at = ids.indexOf(t.id);
      return at === -1 ? t : { ...t, order: at, sectionId };
    }));
    if (dragged.sectionId !== sectionId) {
      api.projectTasks.update(draggedId, { sectionId }).catch(() => toast('⚠ Failed to move'));
    }
    api.projectTasks.reorder(sectionId, ids).catch(() => toast('⚠ Failed to reorder'));
  };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93', padding: 20 }}>Loading tasks…</div>;

  // ---- task card ----
  // Card JSX is inlined (not a nested component) so a re-render during drag
  // reconciles the same DOM node instead of remounting it — which would cancel
  // the native HTML5 drag. Keep this inline.
  const renderCard = (t: ProjectTask, index = 0) => {
    const subs = subtasksOf(tasks, t.id);
    const doneSubs = subs.filter((s) => s.completed).length;
    const check = checklistProgress(t.checklist);
    return (
      <div
        key={t.id}
        draggable={canManage}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); }}
        onDragEnd={() => { setDragId(null); setDragOver(null); setDropIndex(null); }}
        onDragOver={(e) => {
          // Reorder within a column: remember which slot we're hovering.
          if (!canManage || !dragId || dragId === t.id) return;
          e.preventDefault();
          const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const after = e.clientY > box.top + box.height / 2;
          setDropIndex(index + (after ? 1 : 0));
          setDragOver(t.sectionId);
        }}
        onClick={() => setSelectedId(t.id)}
        style={{ background: 'white', borderRadius: 10, border: '1px solid rgba(20,8,31,0.06)', padding: 11, cursor: canManage ? 'grab' : 'pointer', opacity: dragId === t.id ? 0.4 : 1, boxShadow: '0 1px 2px rgba(20,8,31,0.04)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input type="checkbox" checked={t.completed} disabled={!canManage} onClick={(e) => e.stopPropagation()} onChange={() => updateTask(t.id, { completed: !t.completed })} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12', textDecoration: t.completed ? 'line-through' : 'none', opacity: t.completed ? 0.6 : 1 }}>{t.title}</div>
            {(t.labels?.length || 0) > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {t.labels!.map((l) => <LabelChip key={l} label={l} />)}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
              <StatusPill s={t.status} />
              <PriorityPill p={t.priority} />
              {t.dueDate && <span style={{ fontSize: 10, color: '#7E9B93' }}>📅 {t.dueDate}</span>}
              {subs.length > 0 && <span style={{ fontSize: 10, color: '#7E9B93' }}>☑ {doneSubs}/{subs.length}</span>}
              {check.total > 0 && <span style={{ fontSize: 10, color: '#7E9B93' }}>✓ {check.done}/{check.total}</span>}
              {(t.comments?.length || 0) > 0 && <span style={{ fontSize: 10, color: '#7E9B93' }}>💬 {t.comments!.length}</span>}
              {(t.attachments?.length || 0) > 0 && <span style={{ fontSize: 10, color: '#7E9B93' }}>📎 {t.attachments!.length}</span>}
              {t.assignee && (
                <span style={{ marginLeft: 'auto' }}>
                  <Avatar user={users.find((u) => u.id === t.assigneeId)} name={t.assignee} size={22} title={t.assignee} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---- board view ----
  const boardView = (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
      {sections.map((sec) => {
        const secTasks = topLevelBySection(visibleTasks, sec.id);
        const isOver = dragOver === sec.id;
        return (
          <div key={sec.id}
            onDragOver={(e) => { if (canManage) { e.preventDefault(); if (dragOver !== sec.id) setDragOver(sec.id); } }}
            onDragLeave={() => { if (dragOver === sec.id) setDragOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) {
                // A slot was hovered -> reorder into it; otherwise just move columns.
                if (dropIndex != null) reorderIn(sec.id, id, dropIndex);
                else moveTask(id, sec.id);
              }
              setDragOver(null); setDragId(null); setDropIndex(null);
            }}
            style={{ width: 270, flexShrink: 0, background: isOver ? '#EEF3EE' : '#FBF8F2', borderRadius: 12, border: isOver ? '2px dashed #7E9B93' : '1px solid rgba(20,8,31,0.05)', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px' }}>
              <input value={sec.name} disabled={!canManage} onChange={(e) => renameSection(sec.id, e.target.value)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 700, color: '#0B1A12', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', background: '#EDE3D0', padding: '1px 7px', borderRadius: 999 }}>{secTasks.length}</span>
              {canManage && <span onClick={() => deleteSection(sec.id)} title="Delete section" style={{ fontSize: 13, color: '#B99', cursor: 'pointer' }}>×</span>}
            </div>
            <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto' }}>
              {secTasks.map((t, i) => renderCard(t, i))}
              {addingIn === sec.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea autoFocus value={addDraft} onChange={(e) => setAddDraft(e.target.value)} placeholder="Task title…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask(sec.id, addDraft); setAddDraft(''); } }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div onClick={() => { addTask(sec.id, addDraft); setAddDraft(''); }} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Add</div>
                    <div onClick={() => { setAddingIn(null); setAddDraft(''); }} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#7E9B93' }}>Cancel</div>
                  </div>
                </div>
              ) : canManage && (
                <div onClick={() => { setAddingIn(sec.id); setAddDraft(''); }} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#7E9B93', cursor: 'pointer' }}>+ Add task</div>
              )}
            </div>
          </div>
        );
      })}
      {canManage && <div onClick={addSection} style={{ width: 190, flexShrink: 0, padding: '11px 14px', borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#173326', border: '1px dashed rgba(23,51,38,0.3)', background: 'white' }}>+ Add section</div>}
    </div>
  );

  // ---- list view ----
  const listView = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sections.map((sec) => {
        const secTasks = topLevelBySection(visibleTasks, sec.id);
        return (
          <div key={sec.id}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#173326', marginBottom: 8 }}>{sec.name} <span style={{ color: '#7E9B93' }}>· {secTasks.length}</span></div>
            <div style={{ background: 'white', borderRadius: 12, border: '1px solid rgba(20,8,31,0.06)', overflow: 'hidden' }}>
              {secTasks.length === 0 && <div style={{ padding: '12px 14px', fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No tasks</div>}
              {secTasks.map((t) => (
                <div key={t.id} onClick={() => setSelectedId(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid rgba(20,8,31,0.04)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={t.completed} disabled={!canManage} onClick={(e) => e.stopPropagation()} onChange={() => updateTask(t.id, { completed: !t.completed })} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#0B1A12', textDecoration: t.completed ? 'line-through' : 'none', opacity: t.completed ? 0.6 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  <PriorityPill p={t.priority} />
                  {t.dueDate && <span style={{ fontSize: 10.5, color: '#7E9B93' }}>{t.dueDate}</span>}
                  {t.assignee && <Avatar user={users.find((u) => u.id === t.assigneeId)} name={t.assignee} size={22} title={t.assignee} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', padding: 3, borderRadius: 999 }}>
          {(['board', 'list'] as const).map((v) => (
            <div key={v} onClick={() => setView(v)} style={{ padding: '6px 15px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: view === v ? 'white' : 'transparent', color: view === v ? '#0B1A12' : '#7E9B93', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{v === 'board' ? 'Board' : 'List'}</div>
          ))}
        </div>
        <TaskScopeToggle
          scope={scope}
          setScope={setScope}
          restricted={restricted}
          mineCount={mineCount}
          allCount={allCount}
        />
        <PersonFilter person={person} setPerson={setPerson} users={allUsers} visible={!restricted && scope === 'all'} />
        <TaskSearch value={query} onChange={setQuery} />
        {phaseTaskCount > 0 && (
          <div
            onClick={() => setShowPhaseTasks((v) => !v)}
            title="Tasks from the project's delivery programme, which has its own Phase Board"
            style={{ padding: '6px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: showPhaseTasks ? '#173326' : '#EFEDE8', color: showPhaseTasks ? 'white' : '#43514D' }}
          >
            {showPhaseTasks ? 'Hide' : 'Show'} phase tasks ({phaseTaskCount})
          </div>
        )}
        <span style={{ fontSize: 11.5, color: '#7E9B93' }}>{visibleTasks.filter((t) => !t.parentId).length} tasks · {visibleTasks.filter((t) => !t.parentId && t.completed).length} done</span>
      </div>

      {view === 'board' ? boardView : listView}

      {/* Task detail panel */}
      {selected && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 130, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: isMobile ? '100%' : 440, maxWidth: '96vw', height: '100%', background: 'white', overflowY: 'auto', boxShadow: '-14px 0 46px rgba(11,26,18,0.22)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={selected.completed} disabled={!canManage} onChange={() => updateTask(selected.id, { completed: !selected.completed })} style={{ marginTop: 5 }} />
              <textarea value={selected.title} disabled={!canManage} onChange={(e) => patchLocal(selected.id, { title: e.target.value })} onBlur={(e) => updateTask(selected.id, { title: e.target.value })} rows={1} style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontFamily: BG, fontSize: 18, fontWeight: 700, color: '#0B1A12', background: 'transparent' }} />
              <div onClick={() => setSelectedId(null)} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93', flexShrink: 0 }}>×</div>
            </div>

            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Assignee">
                <AssigneePicker
                  valueId={selected.assigneeId}
                  valueName={selected.assignee}
                  disabled={!canManage}
                  onChange={(u) => updateTask(selected.id, { assigneeId: u?.id ?? '', assignee: u?.name ?? '' })}
                />
              </Field>
              <Field label="Status">
                <select disabled={!canManage} value={selected.status || 'Not started'} onChange={(e) => updateTask(selected.id, { status: e.target.value as TaskStatus })} style={{ ...inputStyle, width: '100%' }}>
                  {TASK_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </Field>
              <Field label="Due date"><input type="date" disabled={!canManage} value={selected.dueDate || ''} onChange={(e) => updateTask(selected.id, { dueDate: e.target.value })} style={{ ...inputStyle, width: '100%' }} /></Field>
              <Field label="Priority"><select disabled={!canManage} value={selected.priority || ''} onChange={(e) => updateTask(selected.id, { priority: e.target.value as Priority })} style={{ ...inputStyle, width: '100%' }}><option value="">None</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
              <Field label="Section"><select disabled={!canManage} value={selected.sectionId} onChange={(e) => updateTask(selected.id, { sectionId: e.target.value })} style={{ ...inputStyle, width: '100%' }}>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            </div>

            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <FieldLabel>Description</FieldLabel>
              <textarea disabled={!canManage} value={selected.description || ''} onChange={(e) => patchLocal(selected.id, { description: e.target.value })}
                onPaste={(e) => {
                  // An image pasted into the description becomes an attachment
                  // rather than nothing at all; text pastes are left alone.
                  const files = filesFromClipboard(e).map(nameClipboardFile);
                  if (!files.length || !canManage) return;
                  e.preventDefault();
                  uploadFiles(files).catch((err: Error) => toast('⚠ ' + (err.message || 'Upload failed')));
                }} onBlur={(e) => updateTask(selected.id, { description: e.target.value })} rows={8} placeholder="Add details…" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
            </div>

            {/* Subtasks */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <FieldLabel>Subtasks</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {subtasksOf(tasks, selected.id).map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#FBF8F2', borderRadius: 8 }}>
                    <input type="checkbox" checked={s.completed} disabled={!canManage} onChange={() => toggleSub(s)} />
                    <span style={{ flex: 1, fontSize: 12.5, color: '#0B1A12', textDecoration: s.completed ? 'line-through' : 'none', opacity: s.completed ? 0.6 : 1 }}>{s.title}</span>
                    {canManage && <span onClick={() => deleteTask(s.id)} style={{ fontSize: 12, color: '#8E2E0A', cursor: 'pointer' }}>×</span>}
                  </div>
                ))}
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input value={subDraft} onChange={(e) => setSubDraft(e.target.value)} placeholder="Add a subtask…" style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }} />
                  <div onClick={addSubtask} style={{ padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Add</div>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <Checklist
                items={selected.checklist ?? []}
                canManage={canManage}
                onChange={(checklist: ChecklistItem[]) => updateTask(selected.id, { checklist })}
              />
            </div>

            {/* Labels */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <LabelPicker
                labels={selected.labels ?? []}
                canManage={canManage}
                suggestions={allLabels}
                onChange={(labels) => updateTask(selected.id, { labels })}
              />
            </div>

            {/* Attachments — paste a screenshot, drop files, or add a link */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <Attachments
                scope="project-tasks"
                taskId={selected.id}
                attachments={selected.attachments ?? []}
                canManage={canManage}
                storageReady={storageReady}
                onUpload={uploadFiles}
                onRemove={removeAttachment}
                onAddLink={addLink}
              />
            </div>

            {/* Activity — comments plus a record of what changed */}
            <div style={{ padding: '16px 22px' }}>
              <ActivityFeed
                comments={selected.comments ?? []}
                activity={selected.activity ?? []}
                canManage={canManage}
                onComment={addComment}
              />
            </div>

            {canManage && (
              <div style={{ padding: '0 22px 24px' }}>
                <div onClick={() => deleteTask(selected.id)} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete task</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><FieldLabel>{label}</FieldLabel>{children}</div>;
}
