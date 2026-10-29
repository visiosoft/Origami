import { CloseButton } from './CloseButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskNumber } from '../data/taskNumbers';
import { PriorityHelp } from './PriorityHelp';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme';
import './TaskBoard.css';
import { createdByOf, PRIORITY_ORDER } from '../data/projectTasks';
import { SavedViews } from './SavedViews';
import { SortHeader, sortFromString, sortRows, sortToString, type SortState } from './SortHeader';
import { ActionMenu, ActionTrail, OriginatorLine } from './ActionTools';
import { CollaboratorPicker } from './CollaboratorPicker';
import { DraftScope, SaveBar } from '../autosave';
import { api, persist } from '../api';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';
import {
  PRIORITY_STYLE, TASK_STATUSES, STATUS_STYLE, STATUS_HINT, statusLabel, topLevelBySection,
  checklistProgress,
  type ProjectSection, type ProjectTask, type Priority, type TaskStatus,
  type Attachment as TaskAttachment, type ChecklistItem,
} from '../data/projectTasks';
import { Avatar } from './Avatar';
import { AssigneePicker } from './AssigneePicker';
import { askCompletionNote, askHoldReason } from './CompletionNote';
import { SubtaskForm, type NewSubtask } from './SubtaskForm';
import { QuickAddTask, quickTaskFields } from './QuickAddTask';
import { TaskLinkBadge } from './TaskLinkBadge';
import { AvatarStack, taskPeople } from './AvatarStack';
import { Attachments } from './Attachments';
import { ActivityFeed } from './ActivityFeed';
import { Checklist } from './Checklist';
import { LabelPicker, LabelChip } from './LabelPicker';
import { LeadSelect } from './LeadSelect';
import { leadLabel } from '../data/linkTargets';
import { useTaskScope, TaskScopeToggle, PersonFilter, TaskSearch, matchesQuery, isMine, type TaskScope as TaskScopeKind } from './TaskScope';
import { linkPriorityDue, PRIORITY_HINT } from '../data/priority';
import { filesFromClipboard, nameClipboardFile } from './Attachments';
import { Skeleton } from './Skeleton';

const BG = 'var(--font-display)';
const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit',
  fontSize: 13, color: 'var(--ink)', outline: 'none',
};

function StatusPill({ s }: { s?: TaskStatus }) {
  if (!s || s === 'Not started') return null;
  const st = STATUS_STYLE[s];
  return <span title={STATUS_HINT[s]} style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: st.bg, color: st.c }}>{statusLabel(s)}</span>;
}

function PriorityPill({ p }: { p?: Priority }) {
  if (!p) return null;
  const s = PRIORITY_STYLE[p];
  return <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.c }}>{p}</span>;
}

/**
 * `initialTaskId` opens one task straight away -- used by assignment emails and
 * the notification bell. It can only be applied after the board has loaded,
 * since the drawer resolves its task out of `tasks`.
 */
/** The fields the task panel edits; they autosave together. */
const BOARD_FIELDS: (keyof ProjectTask)[] = ['completed', 'title', 'assigneeId', 'assignee', 'collaborators', 'status', 'startDate', 'dueDate', 'priority', 'sectionId', 'description', 'checklist', 'labels', 'leadId', 'holdReason', 'completionNote', 'requestedById', 'requestedBy'];

/** "Q3 PRD draft" -> "QP": the card's tile. */
const initialsOf = (title: string) => {
  const words = (title || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || words[0]?.[1] || '')).toUpperCase() || '·';
};

/** "All projects": every board task, in one column per task bucket. */
const ALL_BUCKETS = TASK_STATUSES.map((st, i) => ({ id: 'B:' + st, name: statusLabel(st), order: i, projectId: null })) as unknown as ProjectSection[];
/** A status in any of its spellings (To Do, Complete, Blocked…) as the stored bucket value. */
const normStatus = (s?: string | null): TaskStatus => {
  const v = String(s || '').trim();
  if (TASK_STATUSES.includes(v as TaskStatus)) return v as TaskStatus;
  if (/^(done|complete|completed)$/i.test(v)) return 'Done' as TaskStatus;
  if (/^(in[\s-]*progress|doing)$/i.test(v)) return 'In progress' as TaskStatus;
  if (/^(blocked|on[\s-]*hold|hold)$/i.test(v)) return 'On hold' as TaskStatus;
  if (/^(assigned|confirmed)$/i.test(v)) return (v[0].toUpperCase() + v.slice(1).toLowerCase()) as TaskStatus;
  return 'Not started' as TaskStatus;
};
/** Completed means Done -- whatever an older status says. */
const isFinished = (t: { completed?: boolean | null; status?: string | null }) => !!t.completed || normStatus(t.status) === 'Done' || normStatus(t.status) === 'Confirmed';
const CLOSE_OPT = '__close';
/** A column that finishes whatever lands in it. */
const holdColumn = (name?: string | null) => /^(on[\s-]*hold|blocked)$/i.test(String(name || '').trim());
const finishingColumn = (name?: string | null) => /^(done|complete|completed|confirmed)$/i.test(String(name || '').trim());
const bucketCol = (t: { completed?: boolean | null; status?: string | null }) => {
  const st = normStatus(t.status);
  return 'B:' + (t.completed && st !== 'Confirmed' ? 'Done' : st);
};

/**
 * projectId: a project, null for General Tasks, or 'all' -- every task across
 * every project and General, in bucket columns (moving a card sets its status).
 */
const SORT_OPTIONS: [string, string][] = [['', 'Board order'], ['due', 'Due date'], ['priority', 'Priority'], ['status', 'Status'], ['name', 'Name'], ['who', 'Assignee'], ['created', 'Created']];

/** Sort the cards in every column (Board, Timeline and List); "Board order" keeps the drag order. */
function TaskSort({ sort, onChange }: { sort: SortState | null; onChange: (s: SortState | null) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <select aria-label="Sort tasks" value={sort?.key || ''} onChange={(e) => onChange(e.target.value ? { key: e.target.value, dir: sort?.dir || 'asc' } : null)}
        style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: sort ? 'var(--ink)' : 'var(--muted)' }}>
        {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{k ? `Sort: ${l}` : l}</option>)}
      </select>
      {sort && (
        <button type="button" aria-label={sort.dir === 'asc' ? 'Ascending — switch to descending' : 'Descending — switch to ascending'} title={sort.dir === 'asc' ? 'Ascending' : 'Descending'}
          onClick={() => onChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          style={{ width: 28, height: 28, borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, color: 'var(--ink)' }}>{sort.dir === 'asc' ? '↑' : '↓'}</button>
      )}
    </span>
  );
}

export function TaskBoard({ projectId, leadId, initialTaskId, board }: {
  projectId: number | null | 'all';
  /** The Task page's board picker, so a saved view remembers which board it was made on. */
  board?: { value: string; set: (v: string) => void };
  /** A lead's tasks: the General board's columns, showing (and adding) only tasks linked to this lead. */
  leadId?: string | null;
  initialTaskId?: string | null;
}) {
  const all = projectId === 'all';
  const numberOf = useTaskNumber();
  const { can, toast, users, authUser } = useApp();
  const { scope, setScope, filter: scopeFilter, restricted, currentUser, person, setPerson, users: allUsers, counts: scopeCounts } = useTaskScope();
  const [query, setQuery] = useState('');
  const canManage = can('tasks', 'manage');
  // New cards belong to one project's board, not the all-projects view.
  const canAdd = canManage && !all;
  // The board's columns (their titles, adding, deleting and order) are set by an administrator.
  // Leadership only -- administrators and principals (Oct 27 sync: "locked to our i-2 internal team").
  const canShape = ['admin', 'principal'].includes(authUser?.roleKey || '') && !all;
  // Each task's real column is kept, and its bucket column shown, on the all-projects view.
  const inBucket = (t: ProjectTask): ProjectTask => (all ? { ...t, homeSectionId: (t as any).homeSectionId ?? t.sectionId, sectionId: bucketCol(t) } as ProjectTask : t);
  const [projectNames, setProjectNames] = useState<Record<number, string>>({});
  const isMobile = useWindowWidth() <= 720;

  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  // How many cards each board column shows (see the board view).
  const [colLimit, setColLimit] = useState<Record<string, number>>({});
  // Subtasks by parent and tasks by id, built once per change to the list -- each
  // card looks these up, and scanning the whole list per card got slow as tasks grew.
  const { subsByParent, taskById } = useMemo(() => {
    const subs = new Map<string, ProjectTask[]>();
    const byId = new Map<string, ProjectTask>();
    for (const t of tasks) {
      byId.set(t.id, t);
      if (t.parentId) subs.set(t.parentId, [...(subs.get(t.parentId) || []), t]);
    }
    for (const list of subs.values()) list.sort((a, b) => a.order - b.order);
    return { subsByParent: subs, taskById: byId };
  }, [tasks]);
  const subsOf = (id: string) => subsByParent.get(id) || [];
  const commentsOf = (t: ProjectTask) => t.comments?.length ?? t.commentCount ?? 0;
  const [loading, setLoading] = useState(true);
  // Dashboard first (Oct 16); the last view picked is remembered.
  const [view, setViewState] = useState<'board' | 'list' | 'timeline' | 'dashboard'>(() => {
    try { const v = localStorage.getItem('origami.taskView'); return v === 'board' || v === 'list' || v === 'timeline' ? v : 'dashboard'; } catch { return 'dashboard'; }
  });
  const setView = (v: 'board' | 'list' | 'timeline' | 'dashboard') => { setViewState(v); try { localStorage.setItem('origami.taskView', v); } catch { /* private window */ } };
  // Confirmed tasks are archived after 7 days: off the board unless asked for.
  const [showArchived, setShowArchived] = useState(false);
  // Which of priority / due date was filled in automatically, per task -- so a hand-typed one is never overwritten.
  const autoPD = useRef<Record<string, 'priority' | 'due' | null>>({});
  const [theme] = useTheme();
  const isNew = theme === 'coterie';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  // The subtask being edited in the task drawer.
  const [editingSub, setEditingSub] = useState<string | null>(null);
  // Which parents are expanded, plus the inline subtask composer.
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({});
  const [addingSubIn, setAddingSubIn] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Uploads need a connected Google account; links work regardless.
  const [storageReady, setStorageReady] = useState(false);
  // Phase tasks belong to the project's delivery programme and have their own
  // board; keep them out of here unless asked for.
  const [showPhaseTasks, setShowPhaseTasks] = useState(false);
  // List view: sorted within each section (null keeps the board's own order).
  const [listSort, setListSort] = useState<SortState | null>(null);
  const toggleListSort = (k: string) => setListSort((s) => (s?.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }));
  const LIST_BY: Record<string, (t: ProjectTask) => string | number | null | undefined> = {
    name: (t) => t.title, due: (t) => t.dueDate, who: (t) => t.assignee, status: (t) => statusLabel(t.status),
    priority: (t) => (t.priority ? PRIORITY_ORDER.indexOf(t.priority) : null),
    created: (t) => t.createdAt,
  };
  const loadedProject = useRef<number | null>(null);
  // The emailed task opens once, not again on every reload.
  const openedLink = useRef(false);

  const load = () => {
    // Slim lists: each task's comments and history come with it when it's opened (below).
    (all ? (api.projectTasks.list(undefined, { slim: true }) as Promise<any>).then((rows: any) => ({ sections: ALL_BUCKETS, tasks: Array.isArray(rows) ? rows : [] })) : api.projectTasks.board(projectId, { slim: true }))
      .then((res: any) => {
        if (!res) return;
        setSections(res.sections || []);
        setTasks((res.tasks || []).filter((t: ProjectTask) => !leadId || t.leadId === leadId).map(inBucket));
        // Open the deep-linked task now that it exists in `tasks`.
        if (initialTaskId && !openedLink.current && (res.tasks || []).some((t: ProjectTask) => t.id === initialTaskId)) {
          openedLink.current = true;
          setSelectedId(initialTaskId);
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => { setLoading(true); loadedProject.current = all ? -1 : projectId; load(); }, [projectId, leadId]);
  useEffect(() => {
    api.projects.list().then((r: any) => setProjectNames(Object.fromEntries((Array.isArray(r) ? r : []).map((p: any) => [p.id, p.name])))).catch(() => { });
  }, []);
  // Assignees come from useApp().users — already loaded app-wide, no fetch needed.
  useEffect(() => { api.google.status().then((s) => setStorageReady(!!s?.connected)).catch(() => setStorageReady(false)); }, []);

  const archivedCount = tasks.filter((t) => t.archivedAt && !t.parentId).length;
  const inScopeOfBoard = (showPhaseTasks ? tasks : tasks.filter((t) => !t.phaseId)).filter((t) => (showArchived ? !!t.archivedAt : !t.archivedAt));
  // On a project's own board a finished card always shows in its Done column (not "In Review" or To Do).
  const doneColId = all ? undefined : sections.find((s) => /^(done|complete|completed)$/i.test(s.name.trim()))?.id;
  const inDoneCol = (id: string) => /^(done|complete|completed|confirmed)$/i.test(sections.find((s) => s.id === id)?.name.trim() || '');
  const placed = (t: ProjectTask): ProjectTask => (doneColId && !t.parentId && isFinished(t) && !inDoneCol(t.sectionId) ? { ...t, sectionId: doneColId } : t);
  // Search also finds the task's full number (NARV-T-2026-0007).
  const visibleTasks = scopeFilter(inScopeOfBoard).filter((t) => matchesQuery(t, query) || (!!query.trim() && numberOf(t).toLowerCase().includes(query.trim().toLowerCase()))).map(placed);
  const phaseTaskCount = tasks.filter((t) => t.phaseId && !t.parentId).length;
  // Counts are absolute, not relative to the active scope.
  const mineCount = inScopeOfBoard.filter((t) => !t.parentId && isMine(t, currentUser)).length;
  const allCount = inScopeOfBoard.filter((t) => !t.parentId).length;
  const selected = tasks.find((t) => t.id === selectedId) || null;
  // The open task in full -- its comments and history -- since the list leaves them out.
  const fetchingFull = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || selected.comments !== undefined || fetchingFull.current === selected.id) return;
    const id = selected.id;
    fetchingFull.current = id;
    api.projectTasks.get(id)
      .then((full) => setTasks((cur) => cur.map((t) => (t.id === id ? inBucket({ ...t, ...full }) : t))))
      .catch(() => { })
      .finally(() => { if (fetchingFull.current === id) fetchingFull.current = null; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  // Labels already in use on this board, offered as suggestions.
  const allLabels = Array.from(new Set(tasks.flatMap((t) => t.labels ?? []))).sort();

  // ---- task mutations (optimistic + persist) ----
  const patchLocal = (id: string, patch: Partial<ProjectTask>) => setTasks((prev) => prev.map((t) => (t.id === id ? inBucket({ ...t, ...patch, ...(all && patch.sectionId ? { homeSectionId: patch.sectionId, sectionId: t.sectionId } : {}) } as ProjectTask) : t)));
  /** Finishing a task asks what was done (Oct 20 SOP); null when they cancel. */
  const needsNote = (t: ProjectTask | undefined, patch: Partial<ProjectTask>) => {
    if (!t || isFinished(t) || patch.completionNote) return false;
    const into = patch.sectionId ? sections.find((s) => s.id === patch.sectionId)?.name : '';
    return patch.completed === true || (patch.status !== undefined && isFinished({ status: patch.status })) || finishingColumn(into);
  };
  /** Putting a task on hold (status, or dragged into an On hold column) asks why. */
  const needsHoldReason = (t: ProjectTask | undefined, patch: Partial<ProjectTask>) => {
    if (!t || t.status === 'On hold' || (patch.holdReason || '').trim()) return false;
    const into = patch.sectionId ? sections.find((s) => s.id === patch.sectionId)?.name : '';
    return patch.status === 'On hold' || holdColumn(into);
  };
  const withCompletionNote = async (t: ProjectTask | undefined, patch: Partial<ProjectTask>): Promise<Partial<ProjectTask> | null> => {
    if (needsHoldReason(t, patch)) {
      const reason = await askHoldReason(t!.title);
      return reason ? { ...patch, holdReason: reason } : null;
    }
    if (!needsNote(t, patch)) return patch;
    const note = await askCompletionNote(t!.title);
    return note ? { ...patch, completionNote: note } : null;
  };
  const updateTask = async (id: string, raw: Partial<ProjectTask>) => {
    const before = tasks.find((x) => x.id === id);
    const finishing = raw.completed === true || raw.status === 'Done' || raw.status === 'Confirmed';
    const openSubs = finishing && before && !before.parentId ? subsOf(id).filter((s) => !s.completed).length : 0;
    if (openSubs) { toast(`Finish its ${openSubs} open subtask${openSubs === 1 ? '' : 's'} first`); return; }
    const patch = await withCompletionNote(before, raw);
    if (!patch) return;
    patchLocal(id, patch);
    // The server keeps the status and its column together, and fills the start / confirmed dates.
    api.projectTasks.update(id, patch)
      .then((res: any) => { if (res?.id) patchLocal(id, { status: res.status, sectionId: res.sectionId, completed: res.completed, startDate: res.startDate, confirmedAt: res.confirmedAt, archivedAt: res.archivedAt }); })
      .catch((e: Error) => {
        // Refused (e.g. a parent with open subtasks): put the card back as it was.
        if (before) patchLocal(id, Object.fromEntries(Object.keys(patch).map((k) => [k, (before as any)[k]])) as Partial<ProjectTask>);
        toast('⚠ ' + (e.message || 'Failed to save'));
      });
  };
  const addTask = (sectionId: string, title: string, parentId: string | null = null, extra: Partial<NewSubtask> & { description?: string } = {}) => {
    const t = title.trim(); if (!t) return;
    const order = tasks.filter((x) => x.sectionId === sectionId && !x.parentId).length;
    // Adding while filtered to "My tasks" assigns it to you — otherwise the new
    // task is created unassigned and immediately filtered out of view.
    const mine = scope === 'mine' && currentUser
      ? { assigneeId: currentUser.id, assignee: currentUser.name }
      : {};
    const parent = parentId ? tasks.find((x) => x.id === parentId) : null;
    // On the all-projects view a subtask goes on its parent's own board and column.
    const home = all ? { projectId: parent?.projectId ?? null, sectionId: (parent as any)?.homeSectionId } : { projectId, sectionId };
    const lead = leadId ? { leadId } : parent?.leadId ? { leadId: parent.leadId } : {};
    return api.projectTasks.create({ ...home, ...lead, phaseId: parent?.phaseId, title: t, order, parentId, ...mine, ...extra }).then((res: any) => {
      if (res) setTasks((prev) => [...prev, inBucket(res as ProjectTask)]);
    }).catch((e: Error) => toast('⚠ ' + (e.message || 'Failed to add task')));
  };
  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parentId !== id));
    if (selectedId === id) setSelectedId(null);
    api.projectTasks.remove(id).catch(() => toast('⚠ Failed to delete'));
  };
  /** "Close task": complete and into the archive at once (Reopen from Archived). */
  const closeTask = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const open = subsOf(id).filter((s) => !isFinished(s)).length;
    if (open) { toast(`Finish its ${open} open subtask${open === 1 ? '' : 's'} first`); return; }
    if (!window.confirm(`Close “${t.title}” and move it to the archive? You can reopen it from Archived.`)) return;
    api.projectTasks.update(id, { close: true } as any)
      .then(() => { if (selectedId === id) setSelectedId(null); toast('Task closed and archived'); load(); })
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Not closed')));
  };
  const reopenTask = (id: string) => {
    api.projectTasks.update(id, { status: 'In progress' })
      .then(() => { toast('Task reopened'); load(); })
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Not reopened')));
  };
  const moveTask = (id: string, sectionId: string) => {
    if (sectionId === CLOSE_OPT) { closeTask(id); return; }
    const t = tasks.find((x) => x.id === id); if (!t || t.sectionId === sectionId) return;
    // A bucket column on the all-projects view: moving there sets the status.
    if (all) { updateTask(id, { status: sectionId.slice(2) as TaskStatus }); return; }
    updateTask(id, { sectionId });
  };

  // ---- section mutations ----
  // Columns are the same on every board (Oct 27 sync): each change here applies to every project's board and General.
  const addSection = () => {
    api.projectSections.addEverywhere('New Section')
      .then(() => { load(); toast('Column added to every board'); })
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Failed to add the column')));
  };
  /** Typing changes this board; leaving the field renames the column on every board. */
  const renameSection = (id: string, name: string) => setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  const commitRename = (id: string, before: string) => {
    const name = (sections.find((s) => s.id === id)?.name || '').trim();
    if (!name || name === before) { if (!name) setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name: before } : s))); return; }
    persist(() => api.projectSections.renameEverywhere(id, name))
      .then((r) => toast(`Renamed on ${r?.renamed ?? 'every'} board${r?.renamed === 1 ? '' : 's'}`))
      .catch((e: Error) => toast('⚠ Column name not saved — ' + (e.message || 'try again')));
  };
  /** Move a column one place left (-1) or right (+1), on every board. */
  const moveSection = (id: string, dir: -1 | 1) => {
    const i = sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next.map((s, k) => ({ ...s, order: k })));
    persist(() => api.projectSections.orderEverywhere(next.map((s) => s.name)))
      .catch((e: Error) => toast('⚠ Column order not saved — ' + (e.message || 'try again')));
  };
  const deleteSection = (id: string) => {
    if (sections.length <= 1) { toast('Keep at least one section'); return; }
    const sec = sections.find((s) => s.id === id);
    const rest = sections.filter((s) => s.id !== id);
    if (!confirm(`Delete the “${sec?.name}” column from every board? Its tasks move to each board’s first column (here: “${rest[0].name}”).`)) return;
    persist(() => api.projectSections.removeEverywhere(id))
      .then(() => { load(); toast('Column removed from every board'); })
      .catch((e: Error) => toast('⚠ Section not deleted — ' + (e.message || 'try again')));
  };
  /** One-off: line every other board up with this one (their extra columns' tasks move to their first column). */
  const matchAllBoards = () => {
    if (!confirm(`Make every board — each project’s and General — use these ${sections.length} columns, in this order?\n\n${sections.map((s) => s.name).join(' · ')}\n\nColumns a board has that aren’t here are removed and their tasks moved to that board’s first column. No task is deleted.`)) return;
    persist(() => api.projectSections.matchAll(projectId === 'all' ? null : projectId ?? null))
      .then((r) => toast(r?.boards ? `${r.boards} board${r.boards === 1 ? '' : 's'} updated` : 'Every board already matches'))
      .catch((e: Error) => toast('⚠ ' + (e.message || 'Boards not updated')));
  };

  // ---- subtasks / attachments / comments (on selected task) ----
  const toggleSub = (sub: ProjectTask) => updateTask(sub.id, { completed: !sub.completed });
  const addSubtask = (s: NewSubtask) => (selected ? addTask(selected.sectionId, s.title, selected.id, s) : undefined);
  // Comments and attachments are written server-side so the author, timestamp
  // and history entry are recorded consistently; the response is the fresh task.
  const replaceTask = (res: any) => { if (res?.id) setTasks((prev) => prev.map((t) => (t.id === res.id ? inBucket(res as ProjectTask) : t))); };

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
  const reorderIn = async (sectionId: string, draggedId: string, index: number) => {
    // All projects, or sorted (the column's order is the sort's): only the column changes.
    if (all || listSort) { moveTask(draggedId, sectionId); return; }
    const current = topLevelBySection(tasks, sectionId).filter((t) => t.id !== draggedId);
    const dragged = tasks.find((t) => t.id === draggedId);
    if (!dragged) return;
    // Dropped into Done: say what was done first (cancel leaves the card where it was).
    const move = dragged.sectionId !== sectionId ? await withCompletionNote(dragged, { sectionId }) : null;
    if (dragged.sectionId !== sectionId && !move) return;
    const next = [...current.slice(0, index), dragged, ...current.slice(index)];
    const ids = next.map((t) => t.id);
    setTasks((prev) => prev.map((t) => {
      const at = ids.indexOf(t.id);
      return at === -1 ? t : { ...t, order: at, sectionId };
    }));
    if (dragged.sectionId !== sectionId) {
      api.projectTasks.update(draggedId, move!)
        .then((res: any) => { if (res?.id) patchLocal(draggedId, { status: res.status, sectionId: res.sectionId, completed: res.completed, startDate: res.startDate, completionNote: res.completionNote }); })
        .catch((e: Error) => { toast('⚠ ' + (e.message || 'Failed to move')); load(); });
    }
    api.projectTasks.reorder(sectionId, ids).catch(() => toast('⚠ Failed to reorder'));
  };

  if (loading) return <Skeleton label="Loading tasks…" />;

  // ---- task card ----
  // Card JSX is inlined (not a nested component) so a re-render during drag
  // reconciles the same DOM node instead of remounting it — which would cancel
  // the native HTML5 drag. Keep this inline.
  const todayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const dueText = (d: string) => {
    const days = Math.round((new Date(d + 'T12:00:00').getTime() - new Date(todayIso + 'T12:00:00').getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return `${-days}d overdue`;
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  /** P / C marker for a task, if it has subtasks or is one. */
  const linkBadge = (t: ProjectTask) => {
    if (t.parentId) {
      const parent = taskById.get(t.parentId);
      return <TaskLinkBadge kind="C" title={parent ? `Subtask of “${parent.title}”` : 'Subtask'} onClick={parent ? () => setSelectedId(parent.id) : undefined} />;
    }
    const subs = subsOf(t.id);
    if (!subs.length) return null;
    const done = subs.filter((s) => s.completed).length;
    return <TaskLinkBadge kind="P" text={`${done}/${subs.length}`} title={`Parent task: ${done} of ${subs.length} subtasks done`} />;
  };
  const renderCard = (t: ProjectTask, index = 0) => {
    const subs = subsOf(t.id);
    const check = checklistProgress(t.checklist);
    if (isNew) {
      const overdue = !t.completed && !!t.dueDate && t.dueDate < todayIso;
      const counts: [string, string, string][] = [
        ...(check.total ? [['check', `${check.done}/${check.total}`, 'Checklist'] as [string, string, string]] : []),
        ...(commentsOf(t) ? [['comment', String(commentsOf(t)), 'Comments'] as [string, string, string]] : []),
        ...(t.attachments?.length ? [['clip', String(t.attachments.length), 'Attachments'] as [string, string, string]] : []),
      ];
      const ICON: Record<string, string> = {
        sub: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
        check: 'M20 6 9 17l-5-5',
        comment: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
        clip: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
      };
      return (
        <div
          key={t.id}
          className={'tb-card' + (t.completed ? ' is-done' : '') + (dragId === t.id ? ' is-dragging' : '') + (canManage ? ' is-draggable' : '')}
          style={{ animationDelay: Math.min(index, 10) * 0.035 + 's' }}
          draggable={canManage}
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); }}
          onDragEnd={() => { setDragId(null); setDragOver(null); setDropIndex(null); }}
          onDragOver={(e) => {
            if (!canManage || !dragId || dragId === t.id) return;
            e.preventDefault();
            const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setDropIndex(index + (e.clientY > box.top + box.height / 2 ? 1 : 0));
            setDragOver(t.sectionId);
          }}
          onClick={() => setSelectedId(t.id)}
        >
          <div className="tb-head2">
            {/* The tile is the done toggle: initials, a tick on hover, a filled tick once done. */}
            <button type="button" className={'tb-initials' + (t.completed ? ' is-on' : '')} disabled={!canManage}
              aria-label={t.completed ? 'Mark not done' : 'Mark done'} title={t.completed ? 'Mark not done' : 'Mark done'}
              onClick={(e) => { e.stopPropagation(); updateTask(t.id, { completed: !t.completed }); }}>
              <span className="tb-ini-text">{initialsOf(t.title)}</span>
            </button>
            <div className="tb-titlebox">
              <div className="tb-title">{t.title}</div>
              {(all || t.serial || t.leadName) && <div className="tb-sub">{[numberOf(t), all && (t.projectId != null ? projectNames[t.projectId] || `Project ${t.projectId}` : t.leadName ? '' : 'General Tasks'), !leadId && leadLabel(t.leadName)].filter(Boolean).join(' · ')}</div>}
              {t.status === 'On hold' && t.holdReason && <div className="tb-sub" style={{ color: 'var(--c-8a6d12)' }}>On hold: {t.holdReason}</div>}
              {subs.length > 0 && <div className="tb-sub">{subs.filter((s) => s.completed).length} of {subs.length} subtask{subs.length === 1 ? '' : 's'}</div>}
              {t.parentId && <div className="tb-sub">Subtask of {tasks.find((x) => x.id === t.parentId)?.title || 'another task'}</div>}
            </div>
            {t.priority && <span className={'tb-prio is-' + t.priority.toLowerCase()}>{t.priority}</span>}
          </div>
          {/* Its subtasks, nested under it in their own tint: who has each, and whether it's done. */}
          {subs.length > 0 && (
            <ul className="tb-subtasks" aria-label="Subtasks">
              {subs.slice(0, 6).map((s) => (
                <li key={s.id} className={isFinished(s) ? 'is-done' : ''} onClick={(e) => { e.stopPropagation(); setSelectedId(s.id); }} title={`Open “${s.title}”`}>
                  <span className="tb-subtasks-dot" aria-hidden />
                  <span className="tb-subtasks-title">{s.title}</span>
                  {s.assignee && <span className="tb-subtasks-who">{s.assignee.split(/\s+/)[0]}</span>}
                </li>
              ))}
              {subs.length > 6 && <li className="tb-subtasks-more" onClick={(e) => { e.stopPropagation(); setSelectedId(t.id); }}>+{subs.length - 6} more</li>}
            </ul>
          )}
          {(t.parentId || subs.length > 0 || (t.labels?.length || 0) > 0 || (t.status && t.status !== 'Not started' && t.status !== 'Done')) && (
            <div className="tb-tags">
              {linkBadge(t)}
              {t.status && t.status !== 'Not started' && t.status !== 'Done' && <span className="tb-status" title={STATUS_HINT[t.status]}>{statusLabel(t.status)}</span>}
              {(t.labels || []).map((l) => <LabelChip key={l} label={l} />)}
            </div>
          )}
          <div className="tb-foot">
            <div className="tb-meta">
            <span className="tb-count" title="Files">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ICON.clip} /></svg>
              {String(t.attachments?.length || 0).padStart(2, '0')} Files
            </span>
            {t.dueDate && <span className="tb-sep" aria-hidden />}
            {t.dueDate && <span className={'tb-due' + (overdue ? ' is-late' : t.dueDate === todayIso && !t.completed ? ' is-today' : '')}>{t.completed ? new Date(t.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : dueText(t.dueDate)}</span>}
            {counts.filter(([k]) => k !== 'clip').map(([k, v, title]) => (
              <span key={k} className="tb-count" title={title}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ICON[k]} /></svg>{v}
              </span>
            ))}
            </div>
            {canManage && sections.length > 1 && (
              <select className="tb-move" value={t.sectionId} aria-label="Move to another column" title="Move to…"
                onClick={(e) => e.stopPropagation()} onChange={(e) => moveTask(t.id, e.target.value)}>
                {sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.id === t.sectionId ? `Move ▾` : `→ ${sec.name}`}</option>)}
                {!t.parentId && <option value={CLOSE_OPT}>✓ Close (archive)</option>}
              </select>
            )}
            <span className="tb-who"><AvatarStack people={taskPeople(t)} size={24} /></span>
          </div>
        </div>
      );
    }
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
        style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.06)', padding: 11, cursor: canManage ? 'grab' : 'pointer', opacity: dragId === t.id ? 0.4 : 1, boxShadow: '0 1px 2px rgba(var(--rgb-shade), 0.04)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input type="checkbox" checked={t.completed} disabled={!canManage} onClick={(e) => e.stopPropagation()} onChange={() => updateTask(t.id, { completed: !t.completed })} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: t.completed ? 'line-through' : 'none', opacity: t.completed ? 0.6 : 1 }}>{t.title}</div>
            {(all || t.serial || t.leadName) && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{[numberOf(t), all && (t.projectId != null ? projectNames[t.projectId] || `Project ${t.projectId}` : t.leadName ? '' : 'General Tasks'), !leadId && leadLabel(t.leadName)].filter(Boolean).join(' · ')}</div>}
            {t.status === 'On hold' && t.holdReason && <div style={{ fontSize: 11, color: 'var(--c-8a6d12)', marginTop: 2 }}>On hold: {t.holdReason}</div>}
            {subs.length > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{subs.filter((s) => s.completed).length} of {subs.length} subtask{subs.length === 1 ? '' : 's'}</div>}
            {(t.labels?.length || 0) > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {t.labels!.map((l) => <LabelChip key={l} label={l} />)}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
              <StatusPill s={t.status} />
              <PriorityPill p={t.priority} />
              {t.dueDate && <span style={{ fontSize: 10, color: 'var(--muted)' }}>📅 {t.dueDate}</span>}
              {linkBadge(t)}
              {check.total > 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>✓ {check.done}/{check.total}</span>}
              {commentsOf(t) > 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>💬 {commentsOf(t)}</span>}
              {(t.attachments?.length || 0) > 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>📎 {t.attachments!.length}</span>}
              {canManage && sections.length > 1 && (
                <select className="tb-move" value={t.sectionId} aria-label="Move to another column" title="Move to…"
                  onClick={(e) => e.stopPropagation()} onChange={(e) => moveTask(t.id, e.target.value)}>
                  {sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.id === t.sectionId ? `Move ▾` : `→ ${sec.name}`}</option>)}
                {!t.parentId && <option value={CLOSE_OPT}>✓ Close (archive)</option>}
                </select>
              )}
              <span style={{ marginLeft: 'auto' }}><AvatarStack people={taskPeople(t)} size={22} /></span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---- board view ----
  // A long column shows its first 25 cards; "Show more" adds 25 at a time (counts stay the whole column).
  const COL_PAGE = 25;
  const limitOf = (secId: string) => colLimit[secId] ?? COL_PAGE;
  const moreButton = (secId: string, total: number, className?: string) => total > limitOf(secId) && (
    <button type="button" className={className} onClick={() => setColLimit((m) => ({ ...m, [secId]: limitOf(secId) + COL_PAGE }))}
      style={className ? undefined : { padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(var(--rgb-shade), 0.18)', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>
      Show {Math.min(COL_PAGE, total - limitOf(secId))} more ({total - limitOf(secId)} hidden)
    </button>
  );
  // Each view is built only when it's the one showing.
  const boardViewNew = () => (
    <div className="tb-board">
      {sections.map((sec, si) => {
        const secTasks = sortRows(topLevelBySection(visibleTasks, sec.id), LIST_BY, listSort);
        return (
          <div key={sec.id} className={'tb-col' + (dragOver === sec.id ? ' is-over' : '')}
            onDragOver={(e) => { if (canManage) { e.preventDefault(); if (dragOver !== sec.id) setDragOver(sec.id); } }}
            onDragLeave={() => { if (dragOver === sec.id) setDragOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) { if (dropIndex != null) reorderIn(sec.id, id, dropIndex); else moveTask(id, sec.id); }
              setDragOver(null); setDragId(null); setDropIndex(null);
            }}>
            <div className="tb-col-head">
              <span className={'tb-col-dot is-' + (si % 4)} />
              <input value={sec.name} disabled={!canShape} onChange={(e) => renameSection(sec.id, e.target.value)} onFocus={(e) => { e.currentTarget.dataset.before = sec.name; }} onBlur={(e) => commitRename(sec.id, e.currentTarget.dataset.before || sec.name)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Section name" />
              <span className="tb-col-count">{secTasks.length}</span>
              {canShape && <button type="button" className="tb-col-x" onClick={() => moveSection(sec.id, -1)} title="Move left" aria-label="Move column left">‹</button>}
              {canShape && <button type="button" className="tb-col-x" onClick={() => moveSection(sec.id, 1)} title="Move right" aria-label="Move column right">›</button>}
              {canShape && <button type="button" className="tb-col-x" onClick={() => deleteSection(sec.id)} title="Delete section" aria-label="Delete section">×</button>}
            </div>
            <div className="tb-col-body">
              {secTasks.slice(0, limitOf(sec.id)).map((t, i) => renderCard(t, i))}
              {moreButton(sec.id, secTasks.length, 'tb-add')}
              {addingIn === sec.id ? (
                <QuickAddTask className="tb-adding" onAdd={(q) => addTask(sec.id, q.title, null, quickTaskFields(q))} onCancel={() => setAddingIn(null)} />
              ) : canAdd && (
                <button type="button" className="tb-add" onClick={() => { setAddingIn(sec.id); }}>+ Add task</button>
              )}
            </div>
          </div>
        );
      })}
      {canShape && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button type="button" className="tb-add-section" onClick={addSection}>+ Add section</button>
          <button type="button" className="tb-add-section" onClick={matchAllBoards} title="Line every other board up with these columns">Make every board match</button>
        </div>
      )}
    </div>
  );
  const boardView = () => isNew ? boardViewNew() : (
    <div className="tb-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8, minWidth: 0 }}>
      {sections.map((sec) => {
        const secTasks = sortRows(topLevelBySection(visibleTasks, sec.id), LIST_BY, listSort);
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
            style={{ width: 270, flexShrink: 0, background: isOver ? 'var(--mist)' : 'var(--panel)', borderRadius: 'var(--r-12)', border: isOver ? '2px dashed var(--muted)' : '1px solid rgba(var(--rgb-shade), 0.05)', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px' }}>
              <input value={sec.name} disabled={!canShape} onChange={(e) => renameSection(sec.id, e.target.value)} onFocus={(e) => { e.currentTarget.dataset.before = sec.name; }} onBlur={(e) => commitRename(sec.id, e.currentTarget.dataset.before || sec.name)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Section name" style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', background: 'var(--sand)', padding: '1px 7px', borderRadius: 999 }}>{secTasks.length}</span>
              {canShape && <span onClick={() => moveSection(sec.id, -1)} title="Move left" aria-label="Move column left" style={{ fontSize: 14, color: 'var(--muted)', cursor: 'pointer' }}>‹</span>}
              {canShape && <span onClick={() => moveSection(sec.id, 1)} title="Move right" aria-label="Move column right" style={{ fontSize: 14, color: 'var(--muted)', cursor: 'pointer' }}>›</span>}
              {canShape && <span onClick={() => deleteSection(sec.id)} title="Delete section" style={{ fontSize: 13, color: '#B99', cursor: 'pointer' }}>×</span>}
            </div>
            <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto' }}>
              {secTasks.slice(0, limitOf(sec.id)).map((t, i) => renderCard(t, i))}
              {moreButton(sec.id, secTasks.length)}
              {addingIn === sec.id ? (
                <QuickAddTask onAdd={(q) => addTask(sec.id, q.title, null, quickTaskFields(q))} onCancel={() => setAddingIn(null)} />
              ) : canAdd && (
                <div onClick={() => { setAddingIn(sec.id); }} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>+ Add task</div>
              )}
            </div>
          </div>
        );
      })}
      {canShape && <div onClick={addSection} style={{ width: 190, flexShrink: 0, padding: '11px 14px', borderRadius: 'var(--r-12)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--forest)', border: '1px dashed rgba(var(--rgb-forest), 0.3)', background: 'var(--surface)' }}>+ Add section</div>}
    </div>
  );

  // ---- list view ----
  /**
   * One row, used for a task and for its subtasks alike. A subtask is the same
   * row indented, so the two cannot drift apart in look or behaviour.
   */
  const listRow = (t: ProjectTask, depth: number) => {
    const kids = depth === 0 ? subsOf(t.id) : [];
    const isOpen = !!openTasks[t.id];
    const doneKids = kids.filter((k) => k.completed).length;
    return (
      <div key={t.id}>
        <div
          onClick={() => setSelectedId(t.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: depth ? '8px 14px 8px 46px' : '10px 14px',
            borderTop: '1px solid rgba(var(--rgb-shade), 0.04)', cursor: 'pointer',
            background: depth ? '#FCFBF9' : 'var(--surface)',
          }}
        >
          <span
            onClick={(e) => { e.stopPropagation(); if (kids.length) setOpenTasks((prev) => ({ ...prev, [t.id]: !isOpen })); }}
            style={{ width: 12, flexShrink: 0, fontSize: 9, color: 'var(--c-9aa39d)', cursor: kids.length ? 'pointer' : 'default', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
          >
            {kids.length ? '\u25B6' : ''}
          </span>

          <input type="checkbox" checked={t.completed} disabled={!canManage} onClick={(e) => e.stopPropagation()} onChange={() => updateTask(t.id, { completed: !t.completed })} />

          {depth === 0 && t.parentId ? linkBadge(t) : null}
          <span style={{ flex: 1, minWidth: 0, fontSize: depth ? 12.5 : 13, fontWeight: depth ? 500 : 600, color: 'var(--ink)', textDecoration: t.completed ? 'line-through' : 'none', opacity: t.completed ? 0.6 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.title}
            {t.status === 'On hold' && t.holdReason && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-8a6d12)', textDecoration: 'none' }}> · On hold: {t.holdReason}</span>}
          </span>

          {kids.length > 0 && (
            <TaskLinkBadge kind="P" text={`${doneKids}/${kids.length}`} title={doneKids + ' of ' + kids.length + ' subtasks done'}
              onClick={() => setOpenTasks((prev) => ({ ...prev, [t.id]: !isOpen }))} />
          )}

          <PriorityPill p={t.priority} />
          <span style={{ width: 76, flexShrink: 0, fontSize: 10.5, color: 'var(--muted)', textAlign: 'right' }}>{t.dueDate || ''}</span>
          <span style={{ width: 58, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <AvatarStack people={taskPeople(t)} size={22} max={2} />
          </span>
        </div>

        {depth === 0 && isOpen && (
          <>
            {kids.map((k) => listRow(k, 1))}
            {canManage && (addingSubIn === t.id ? (
              <div style={{ padding: '8px 14px 10px 46px', borderTop: '1px solid rgba(var(--rgb-shade), 0.04)', background: '#FCFBF9' }}>
                <SubtaskForm compact autoFocus onAdd={(sub) => addTask(t.sectionId, sub.title, t.id, sub)} onCancel={() => setAddingSubIn(null)} />
              </div>
            ) : (
              <div
                onClick={() => setAddingSubIn(t.id)}
                style={{ padding: '7px 14px 7px 46px', borderTop: '1px solid rgba(var(--rgb-shade), 0.04)', background: '#FCFBF9', fontSize: 11.5, color: 'var(--c-9aa39d)', cursor: 'pointer' }}
              >
                + Add subtask
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  const listView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-9aa39d)' }}>
        <span style={{ width: 12, flexShrink: 0 }} />
        <span style={{ width: 13, flexShrink: 0 }} />
        <span style={{ flex: 1 }}><SortHeader k="name" sort={listSort} onSort={toggleListSort}>Name</SortHeader>
          <span style={{ marginLeft: 14 }}><SortHeader k="priority" sort={listSort} onSort={toggleListSort}>Priority</SortHeader></span>
          <span style={{ marginLeft: 14 }}><SortHeader k="status" sort={listSort} onSort={toggleListSort}>Status</SortHeader></span></span>
        <span style={{ width: 76, flexShrink: 0, textAlign: 'right' }}><SortHeader k="due" sort={listSort} onSort={toggleListSort} align="right">Due</SortHeader></span>
        <span style={{ width: 58, flexShrink: 0, textAlign: 'right' }}><SortHeader k="who" sort={listSort} onSort={toggleListSort} align="right">Who</SortHeader></span>
      </div>

      {sections.map((sec) => {
        const secTasks = sortRows(topLevelBySection(visibleTasks, sec.id), LIST_BY, listSort);
        return (
          <div key={sec.id}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--forest)', marginBottom: 8 }}>
              {sec.name} <span style={{ color: 'var(--muted)' }}>{'\u00B7'} {secTasks.length}</span>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-12)', border: '1px solid rgba(var(--rgb-shade), 0.06)', overflow: 'hidden' }}>
              {secTasks.length === 0 && <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--c-9aa39d)', fontStyle: 'italic' }}>No tasks</div>}
              {sortRows(secTasks, LIST_BY, listSort).slice(0, limitOf(sec.id)).map((t) => listRow(t, 0))}
              {secTasks.length > limitOf(sec.id) && <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(var(--rgb-shade), 0.04)' }}>{moreButton(sec.id, secTasks.length)}</div>}
              {canAdd && (addingIn === sec.id ? (
                <QuickAddTask onAdd={(q) => addTask(sec.id, q.title, null, quickTaskFields(q))} onCancel={() => setAddingIn(null)} style={{ padding: '10px 14px', borderTop: '1px solid rgba(var(--rgb-shade), 0.04)' }} />
              ) : (
                <div onClick={() => { setAddingIn(sec.id); }} style={{ padding: '9px 14px', borderTop: '1px solid rgba(var(--rgb-shade), 0.04)', fontSize: 12, color: 'var(--c-9aa39d)', cursor: 'pointer' }}>
                  + Add task
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ---- Timeline (Gantt) view: read-only bars over a date scale, grouped by
  // section. A task needs a Start Date or Due Date to get a bar -- an
  // undated task stays listed (so nothing goes missing) but doesn't get
  // dumped onto "today", which just clutters the chart with a meaningless
  // pileup for a board where most tasks predate the Start Date field. ----
  const timelineView = () => (() => {
    const dayMs = 86400000;
    const dayWidth = 28;
    const parseDate = (s?: string) => (s ? new Date(s + 'T00:00:00') : null);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const rangesBySection = sections.map((sec) => ({
      sec,
      rows: sortRows(topLevelBySection(visibleTasks, sec.id), LIST_BY, listSort).map((t) => {
        const due = parseDate(t.dueDate);
        const start = parseDate(t.startDate);
        if (!due && !start) return { t, start: null as Date | null, end: null as Date | null };
        const s = start || due!;
        const e = due || start!;
        return { t, start: s <= e ? s : e, end: e >= s ? e : s };
      }),
    }));
    const datedRows = rangesBySection.flatMap((g) => g.rows).filter((r): r is { t: ProjectTask; start: Date; end: Date } => !!r.start && !!r.end);
    const undatedCount = rangesBySection.flatMap((g) => g.rows).length - datedRows.length;

    const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; };
    const earliest = datedRows.length ? new Date(Math.min(...datedRows.map((r) => r.start.getTime()))) : new Date(today.getTime() - 7 * dayMs);
    const latest = datedRows.length ? new Date(Math.max(...datedRows.map((r) => r.end.getTime()))) : new Date(today.getTime() + 35 * dayMs);
    const chartStart = startOfWeek(new Date(Math.min(earliest.getTime(), today.getTime() - 7 * dayMs)));
    const chartEnd = new Date(Math.max(latest.getTime(), today.getTime() + 21 * dayMs));
    const totalDays = Math.ceil((chartEnd.getTime() - chartStart.getTime()) / dayMs) + 7;
    const weeks: Date[] = [];
    for (let d = new Date(chartStart); d.getTime() < chartStart.getTime() + totalDays * dayMs; d.setDate(d.getDate() + 7)) weeks.push(new Date(d));
    const xFor = (d: Date) => Math.round((d.getTime() - chartStart.getTime()) / dayMs) * dayWidth;
    const todayX = xFor(today);

    const rowHeight = 34;
    const sectionHeaderHeight = 28;
    const dateHeaderHeight = 36;
    const sidebarWidth = 200;

    return (
      <div>
        {undatedCount > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
            {undatedCount} task{undatedCount === 1 ? '' : 's'} {undatedCount === 1 ? "isn't" : "aren't"} shown on the chart — set a Start or Due date in the task drawer to place {undatedCount === 1 ? 'it' : 'them'}.
          </div>
        )}
      <div style={{ display: 'flex', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-12)', background: 'var(--surface)', overflow: 'hidden' }}>
        {/* Fixed left column: task names stay in view regardless of how far
            the date grid on the right is scrolled -- matches Asana/Monday's
            timeline layout, where the label never lives inside the bar. */}
        <div style={{ width: sidebarWidth, flexShrink: 0, borderRight: '1px solid rgba(var(--rgb-shade), 0.08)' }}>
          <div style={{ height: dateHeaderHeight, borderBottom: '1px solid rgba(var(--rgb-shade), 0.08)' }} />
          {rangesBySection.map(({ sec, rows }) => (
            <div key={sec.id}>
              <div style={{ height: sectionHeaderHeight, padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--forest)', background: 'var(--panel)', borderBottom: '1px solid rgba(var(--rgb-shade), 0.05)' }}>
                {sec.name} <span style={{ color: 'var(--muted)', marginLeft: 4 }}>{'·'} {rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <div style={{ height: rowHeight, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11, color: 'var(--c-9aa39d)', fontStyle: 'italic', borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)' }}>No tasks</div>
              ) : rows.map(({ t }) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  title={t.title}
                  style={{ height: rowHeight, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11.5, color: 'var(--ink)', borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {t.title}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Scrollable date grid + bars. */}
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <div style={{ position: 'relative', width: Math.max(totalDays * dayWidth, 600) }}>
            <div style={{ display: 'flex', height: dateHeaderHeight, borderBottom: '1px solid rgba(var(--rgb-shade), 0.08)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>
              {weeks.map((w) => (
                <div key={w.toISOString()} style={{ width: dayWidth * 7, flexShrink: 0, borderRight: '1px solid rgba(var(--rgb-shade), 0.06)', padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>
                  {w.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: todayX, width: 2, background: '#D2822E', zIndex: 1 }} title="Today" />
            {rangesBySection.map(({ sec, rows }) => (
              <div key={sec.id}>
                <div style={{ height: sectionHeaderHeight, background: 'var(--panel)', borderBottom: '1px solid rgba(var(--rgb-shade), 0.05)' }} />
                {rows.length === 0 ? (
                  <div style={{ height: rowHeight, borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)' }} />
                ) : rows.map(({ t, start, end }) => {
                  if (!start || !end) {
                    // No Start Date or Due Date -- nothing to plot. Leaving
                    // the row blank (rather than piling it onto "today")
                    // keeps the chart meaningful for tasks that do have dates.
                    return <div key={t.id} style={{ height: rowHeight, borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)' }} />;
                  }
                  const left = xFor(start);
                  const width = Math.max(xFor(end) - left + dayWidth, dayWidth);
                  const st = STATUS_STYLE[t.status || 'Not started'];
                  return (
                    <div key={t.id} style={{ position: 'relative', height: rowHeight, borderBottom: '1px solid rgba(var(--rgb-shade), 0.04)' }}>
                      <div
                        onClick={() => setSelectedId(t.id)}
                        title={t.title}
                        style={{ position: 'absolute', left, width, top: 6, height: 22, borderRadius: 6, background: st.bg, border: `1px solid ${st.c}`, cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    );
  })();

  // ---- Dashboard view: a handful of stat tiles + two bar charts, following
  // this app's existing div-based chart technique (no charting library). ----
  const dashboardView = () => (() => {
    const topLevel = visibleTasks.filter((t) => !t.parentId);
    const total = topLevel.length;
    const completed = topLevel.filter((t) => t.completed).length;
    const incomplete = total - completed;
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdue = topLevel.filter((t) => !t.completed && t.dueDate && t.dueDate < todayStr).length;

    const bySection = sections.map((sec) => ({ name: sec.name, count: topLevelBySection(visibleTasks, sec.id).filter((t) => !t.completed).length }));
    const maxSection = Math.max(1, ...bySection.map((s) => s.count));
    const byStatus = TASK_STATUSES.map((st) => ({ status: st, count: topLevel.filter((t) => (t.status || 'Not started') === st).length }));
    const maxStatus = Math.max(1, ...byStatus.map((s) => s.count));

    const tile = (label: string, value: number, color?: string) => (
      <div key={label} style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: '16px 18px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
        <div style={{ fontFamily: BG, fontSize: 26, fontWeight: 700, color: color || 'var(--ink)' }}>{value}</div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {tile('Total tasks', total)}
          {tile('Completed', completed, 'var(--c-1e6b36)')}
          {tile('Incomplete', incomplete, 'var(--c-5c6b65)')}
          {tile('Overdue', overdue, overdue ? '#8E2E0A' : 'var(--ink)')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Incomplete tasks by section</div>
            {bySection.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--c-9aa39d)', fontStyle: 'italic' }}>No sections yet.</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
                {bySection.map((s) => (
                  <div key={s.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--forest)' }}>{s.count}</div>
                    <div style={{ width: '100%', height: Math.max((s.count / maxSection) * 90, 2), background: '#8AAE95', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease' }} />
                    <div style={{ fontSize: 9.5, color: 'var(--muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{s.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.06)', borderRadius: 'var(--r-14)', padding: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Tasks by status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byStatus.map((s) => {
                const st = STATUS_STYLE[s.status];
                return (
                  <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 90, fontSize: 11, color: 'var(--body)', flexShrink: 0 }}>{statusLabel(s.status)}</div>
                    <div style={{ flex: 1, height: 10, background: '#F4F2ED', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${(s.count / maxStatus) * 100}%`, height: '100%', background: st.c, borderRadius: 999, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ width: 22, textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{s.count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div>
      {/* Fixed rows (Oct 27 sync: "keep it stacked") -- views, then filters, then saved views --
          each wrapping on its own, so nothing jumps between rows when the view changes. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: 'var(--c-efede8)', padding: 3, borderRadius: 999, maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(['dashboard', 'board', 'timeline', 'list'] as const).map((v) => (
            <div key={v} onClick={() => setView(v)} style={{ padding: '6px 15px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: view === v ? 'var(--seg-on)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--muted)', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{v === 'board' ? 'Board' : v === 'list' ? 'List' : v === 'timeline' ? 'Timeline' : 'Dashboard'}</div>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--muted)' }}>{visibleTasks.filter((t) => !t.parentId).length} tasks · {visibleTasks.filter((t) => !t.parentId && t.completed).length} done</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <TaskScopeToggle
          scope={scope}
          setScope={setScope}
          restricted={restricted}
          mineCount={mineCount}
          allCount={allCount}
          counts={scopeCounts(inScopeOfBoard.filter((t) => !t.parentId))}
        />
        <PersonFilter person={person} setPerson={setPerson} users={allUsers} scope={scope} visible={!restricted && (scope === 'assigned' || scope === 'from')} />
        <TaskSearch value={query} onChange={setQuery} />
        {/* Always here, so the row doesn't shift between views; the dashboard ignores it. */}
        <TaskSort sort={listSort} onChange={setListSort} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(archivedCount > 0 || showArchived) && (
          <div onClick={() => setShowArchived((v) => !v)} title="Confirmed tasks move to the archive 7 days after they're confirmed"
            style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(var(--rgb-shade), 0.14)', background: showArchived ? 'var(--ink)' : 'var(--surface)', color: showArchived ? '#FDFCF9' : 'var(--muted)' }}>
            {showArchived ? '← Back to the board' : `Archived ${archivedCount}`}
          </div>
        )}
        {phaseTaskCount > 0 && (
          <div
            onClick={() => setShowPhaseTasks((v) => !v)}
            title="Tasks from the project's delivery programme, which has its own Phase Board"
            style={{ padding: '6px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: showPhaseTasks ? 'var(--forest)' : 'var(--c-efede8)', color: showPhaseTasks ? 'white' : 'var(--body)' }}
          >
            {showPhaseTasks ? 'Hide' : 'Show'} phase tasks ({phaseTaskCount})
          </div>
        )}
        {!restricted && (
        <div style={{ flex: '1 1 auto' }}>
          <SavedViews page="tasks.board" value={{ query, scope, person, showArchived, showPhaseTasks, sort: sortToString(listSort), ...(board ? { board: board.value } : {}) }}
            defaults={{ query: '', scope: 'all', person: '', showArchived: false, showPhaseTasks: false, sort: '', ...(board ? { board: 'all' } : {}) }}
            onApply={(v) => { setQuery(String(v.query || '')); setScope(v.scope as TaskScopeKind); setPerson(String(v.person || '')); setShowArchived(!!v.showArchived); setShowPhaseTasks(!!v.showPhaseTasks); setListSort(sortFromString(v.sort)); if (board && v.board != null) board.set(String(v.board)); }} />
        </div>
      )}
      </div>

      {view === 'board' ? boardView() : view === 'list' ? listView() : view === 'timeline' ? timelineView() : dashboardView()}

      {/* Task detail panel */}
      {/* Edits collect in a draft and save 3 seconds after typing stops, or at once
          with Save; closing the panel or opening another task saves too. Comments
          and files still save the moment they're added. */}
      {selected && (
        <DraftScope key={selected.id} record={selected} fields={BOARD_FIELDS} enabled={canManage} label="task"
          // Emails (assigned, added as a collaborator, done) wait for the Save button.
          save={(changes) => api.projectTasks.update(selected.id, { ...changes, deferNotify: true }) as Promise<ProjectTask>} onSaved={replaceTask}>
        {({ draft: d, set: setDraft, auto }) => {
        // A parent stays open while any subtask is open -- say so instead of saving a refusal.
        const set = (patch: Partial<ProjectTask>) => {
          const open = (patch.completed === true || patch.status === 'Done' || patch.status === 'Confirmed') ? subsOf(selected.id).filter((s) => !s.completed).length : 0;
          if (open) { toast(`Finish its ${open} open subtask${open === 1 ? '' : 's'} first`); return; }
          // Finishing it asks what was done; the note saves with the status.
          if (!needsNote(d, patch) && !needsHoldReason(d, patch)) { setDraft(patch); return; }
          void withCompletionNote(d, patch).then((p) => { if (p) setDraft(p); });
        };
        const assigned = !!(d.assigneeId || (d.assignee || '').trim());
        const projectName = selected.projectId != null ? projectNames[selected.projectId] : null;
        // Portalled: a transformed ancestor would otherwise trap the fixed overlay inside the board.
        return createPortal(
        <div onClick={() => setSelectedId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), 0.45)', zIndex: 130, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.18s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: isMobile ? '100%' : 440, maxWidth: '96vw', height: '100%', background: 'var(--surface)', overflowY: 'auto', boxShadow: '-14px 0 46px rgba(var(--rgb-ink), 0.22)' }}>
            {canManage && (
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', padding: '10px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
                <SaveBar auto={auto} onDone={() => { void api.projectTasks.notify(selected.id).catch(() => undefined); setSelectedId(null); }} />
              </div>
            )}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={!!d.completed} disabled={!canManage} onChange={() => set({ completed: !d.completed })} style={{ marginTop: 5 }} />
              <textarea value={d.title || ''} disabled={!canManage} onChange={(e) => set({ title: e.target.value })} rows={1} style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontFamily: BG, fontSize: 18, fontWeight: 700, color: 'var(--ink)', background: 'transparent' }} />
              <CloseButton onClick={() => setSelectedId(null)} />
            </div>
            {/* Who raised it, when, and its number -- at the top (Oct 2026). */}
            <div style={{ padding: '10px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}><OriginatorLine label="Assigner" project={projectName || (selected.projectId == null ? (selected.leadName ? leadLabel(selected.leadName) : 'General Tasks') : `Project ${selected.projectId}`)} source={d.requestedBy} by={selected.createdByName || createdByOf(selected)?.by} at={createdByOf(selected)?.at || selected.createdAt} number={numberOf(selected) || '#' + selected.id} /></div>
                {canManage && !selected.parentId && (selected.archivedAt
                  ? <button type="button" onClick={() => reopenTask(selected.id)} title="Bring it back onto the board" style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Reopen</button>
                  : <button type="button" onClick={() => closeTask(selected.id)} title="Mark it complete and move it to the archive now" style={{ padding: '5px 12px', borderRadius: 999, border: 0, background: 'var(--ink)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Close task</button>)}
              </div>
              {selected.parentId && (
                <div onClick={() => setSelectedId(selected.parentId!)} style={{ fontSize: 12, color: 'var(--forest)', fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                  ← Subtask of {tasks.find((x) => x.id === selected.parentId)?.title || 'its parent'}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Assignee">
                <AssigneePicker
                  valueId={d.assigneeId}
                  valueName={d.assignee}
                  disabled={!canManage}
                  project={projectName}
                  internalOnly={selected.projectId == null}
                  onChange={(u) => set({ assigneeId: u?.id ?? '', assignee: u?.name ?? '' })}
                />
              </Field>
              <Field label="Source (requested by)">
                <AssigneePicker
                  valueId={d.requestedById || undefined}
                  valueName={d.requestedBy || undefined}
                  disabled={!canManage}
                  emptyLabel="— the assigner —"
                  onChange={(u) => set({ requestedById: u?.id ?? '', requestedBy: u?.name ?? '' })}
                />
              </Field>
              {(selected.sourceId || (selected.derivedRefs || []).length > 0) && (
                <div style={{ gridColumn: '1 / -1' }}><ActionTrail sourceType={selected.sourceType} sourceId={selected.sourceId} sourceLabel={selected.sourceLabel} derived={selected.derivedRefs} /></div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Collaborative">
                  <CollaboratorPicker value={d.collaborators} assigneeId={d.assigneeId} disabled={!canManage} onChange={(collaborators) => set({ collaborators })} />
                </Field>
              </div>
              <Field label="Status">
                <select disabled={!canManage} value={d.status || 'Not started'} title={STATUS_HINT[d.status || 'Not started']} onChange={(e) => set({ status: e.target.value as TaskStatus })} style={{ ...inputStyle, width: '100%' }}>
                  {TASK_STATUSES.map((st) => {
                    const originatorId = selected.createdById || createdByOf(selected)?.byId;
                    const canConfirm = !originatorId || originatorId === currentUser?.id || currentUser?.roleKey === 'admin';
                    const noOne = st === 'In progress' && !assigned && d.status !== 'In progress';
                    return <option key={st} value={st} disabled={(st === 'Confirmed' && !canConfirm && d.status !== 'Confirmed') || noOne}>{statusLabel(st)}{st === 'Confirmed' && !canConfirm ? ' — the assigner confirms' : noOne ? ' — assign someone first' : ''}</option>;
                  })}
                </select>
              </Field>
              {isFinished(d) && d.completionNote && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Completion note">
                    <div style={{ padding: '9px 11px', borderRadius: 9, background: 'var(--mint)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.completionNote}</div>
                  </Field>
                </div>
              )}
              {d.status === 'On hold' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Why is it on hold? (required)">
                    <textarea value={d.holdReason || ''} disabled={!canManage} onChange={(e) => set({ holdReason: e.target.value })} rows={2} placeholder="e.g. Waiting on the client’s tile selection" aria-label="Why is it on hold"
                      style={{ ...inputStyle, width: '100%', resize: 'vertical', background: 'var(--amber-light)' }} />
                  </Field>
                </div>
              )}
              <Field label="Lead">
                <LeadSelect value={d.leadId} name={d.leadName} disabled={!canManage} onChange={(v) => set({ leadId: v })} style={{ ...inputStyle, width: '100%' }} />
              </Field>
              <Field label="Start date"><input type="date" disabled={!canManage} value={d.startDate || ''} onChange={(e) => set({ startDate: e.target.value })} style={{ ...inputStyle, width: '100%' }} /></Field>
              <Field label="Priority">
                <select disabled={!canManage} value={d.priority || ''} title={d.priority ? PRIORITY_HINT[d.priority as Priority] : 'Picking a priority fills in the due date'}
                  onChange={(e) => { const r = linkPriorityDue({ priority: d.priority, dueDate: d.dueDate, auto: autoPD.current[selected.id] }, { priority: e.target.value as Priority | '' }); autoPD.current[selected.id] = r.auto; set({ priority: (r.priority || undefined) as Priority, dueDate: r.dueDate }); }}
                  style={{ ...inputStyle, width: '100%' }}>
                  <option value="">None</option>{['Urgent', 'High', 'Medium', 'Low'].map((p) => <option key={p} value={p}>{p} — {PRIORITY_HINT[p as Priority].replace('Due ', '')}</option>)}
                </select>
                {autoPD.current[selected.id] === 'priority' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Set from the due date</div>}
                <PriorityHelp value={d.priority} />
              </Field>
              <Field label="Due date">
                <input type="date" disabled={!canManage} value={d.dueDate || ''}
                  onChange={(e) => { const r = linkPriorityDue({ priority: d.priority, dueDate: d.dueDate, auto: autoPD.current[selected.id] }, { dueDate: e.target.value }); autoPD.current[selected.id] = r.auto; set({ dueDate: r.dueDate, priority: (r.priority || undefined) as Priority }); }}
                  style={{ ...inputStyle, width: '100%' }} />
                {autoPD.current[selected.id] === 'due' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Set from the priority — change it if you need to</div>}
              </Field>
            </div>

            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
              <FieldLabel>Description</FieldLabel>
              <textarea disabled={!canManage} value={d.description || ''} onChange={(e) => set({ description: e.target.value })}
                onPaste={(e) => {
                  // An image pasted into the description becomes an attachment
                  // rather than nothing at all; text pastes are left alone.
                  const files = filesFromClipboard(e).map(nameClipboardFile);
                  if (!files.length || !canManage) return;
                  e.preventDefault();
                  uploadFiles(files).catch((err: Error) => toast('⚠ ' + (err.message || 'Upload failed')));
                }} rows={8} placeholder="Add details…" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
            </div>

            {/* Subtasks */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
              <FieldLabel>Subtasks</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {subsOf(selected.id).map((s) => editingSub === s.id ? (
                  <div key={s.id} style={{ padding: 8, background: 'var(--panel)', borderRadius: 8 }}>
                    <SubtaskForm compact autoFocus submitLabel="Save subtask" initial={{ title: s.title, assigneeId: s.assigneeId, assignee: s.assignee || '', dueDate: s.dueDate || '', description: s.description || '' }}
                      onCancel={() => setEditingSub(null)}
                      onAdd={(v) => api.projectTasks.update(s.id, { title: v.title, assigneeId: v.assigneeId || '', assignee: v.assignee, dueDate: v.dueDate, description: v.description, deferNotify: true })
                        .then((res: any) => { if (res) replaceTask(res as ProjectTask); setEditingSub(null); })
                        .catch((e: Error) => toast('⚠ ' + (e.message || 'Subtask not saved')))} />
                  </div>
                ) : (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--panel)', borderRadius: 8 }}>
                    <input type="checkbox" checked={s.completed} disabled={!canManage} onChange={() => toggleSub(s)} />
                    <span onClick={() => setSelectedId(s.id)} title={s.description || 'Open the subtask'} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer', textDecoration: s.completed ? 'line-through' : 'none', opacity: s.completed ? 0.6 : 1 }}>{s.title}</span>
                    {s.dueDate && <span style={{ fontSize: 11, color: !s.completed && s.dueDate < todayIso ? '#9A4318' : 'var(--muted)', flexShrink: 0 }}>{dueText(s.dueDate)}</span>}
                    {s.assignee && <Avatar user={users.find((u) => u.id === s.assigneeId)} name={s.assignee} size={20} title={s.assignee} />}
                    <span onClick={() => setSelectedId(s.id)} title="Open the subtask in full" aria-label="Open subtask" style={{ fontSize: 12, color: 'var(--forest)', cursor: 'pointer', fontWeight: 700 }}>Open</span>
                    {canManage && <span onClick={() => setEditingSub(s.id)} title="Edit the subtask" aria-label="Edit subtask" style={{ fontSize: 12, color: 'var(--forest)', cursor: 'pointer', fontWeight: 700 }}>Edit</span>}
                    {canManage && <span onClick={() => deleteTask(s.id)} title="Delete the subtask" style={{ fontSize: 12, color: '#8E2E0A', cursor: 'pointer' }}>×</span>}
                  </div>
                ))}
              </div>
              {canManage && (
                <div style={{ marginTop: 8 }}><SubtaskForm onAdd={addSubtask} /></div>
              )}
            </div>

            {/* Checklist */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
              <Checklist
                items={d.checklist ?? []}
                canManage={canManage}
                onChange={(checklist: ChecklistItem[]) => set({ checklist })}
              />
            </div>

            {/* Labels */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
              <LabelPicker
                labels={d.labels ?? []}
                canManage={canManage}
                suggestions={allLabels}
                onChange={(labels) => set({ labels })}
              />
            </div>

            {/* Attachments — paste a screenshot, drop files, or add a link */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
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

            {canManage && (
              <div style={{ padding: '16px 22px 4px' }}>
                <div style={{ marginBottom: 12 }}>
                  <ActionMenu kind="board" id={selected.id} projectId={selected.projectId} onMade={(made) => {
                    // Copies onto this board appear at once; the task's own history now notes them.
                    load();
                    if (made.some((m) => m.kind !== 'board')) toast('Done — open it from the link');
                  }} />
                </div>
                <div onClick={() => deleteTask(selected.id)} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete task</div>
              </div>
            )}

            {/* Activity — comments plus a record of what changed, a page at a time from the server */}
            <div style={{ padding: '16px 22px 24px' }}>
              <ActivityFeed
                source={{ kind: 'board', id: selected.id }}
                version={`${selected.activity?.length ?? 0}:${selected.comments?.length ?? 0}:${selected.commentCount ?? 0}`}
                canManage={canManage}
                onComment={addComment}
              />
            </div>
          </div>
        </div>,
        document.body);
        }}
        </DraftScope>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><FieldLabel>{label}</FieldLabel>{children}</div>;
}
