import { useEffect, useRef, useState } from 'react';
import { useTaskNumber } from '../data/taskNumbers';
import { PriorityHelp } from './PriorityHelp';
import { CollaboratorPicker } from './CollaboratorPicker';
import { api } from '../api';
import { SaveBar, keepEdits, mergeSaved, useAutosave } from '../autosave';
import { useApp } from '../AppContext';
import { isMine } from './TaskScope';
import { AssigneePicker } from './AssigneePicker';
import { Attachments, filesFromClipboard, nameClipboardFile } from './Attachments';
import { ActivityFeed } from './ActivityFeed';
import { Checklist } from './Checklist';
import { LabelPicker } from './LabelPicker';
import { TASK_STATUSES, statusLabel, STATUS_HINT, isTaskDone, subtasksOf, createdByOf, type ChecklistItem, type Priority, type TaskStatus } from '../data/projectTasks';
import { linkPriorityDue, PRIORITY_HINT } from '../data/priority';
import { SubtaskForm, type NewSubtask } from './SubtaskForm';
import { OriginatorLine } from './ActionTools';
import { askHoldReason } from './CompletionNote';

const BG = 'var(--font-display)';
const input: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(var(--rgb-shade), 0.13)', background: 'var(--surface)', fontFamily: 'inherit',
  fontSize: 13, color: 'var(--ink)', outline: 'none',
};
const PRIORITIES: Priority[] = ['Urgent', 'High', 'Medium', 'Low'];
/** Fields edited in the panel: they autosave together. Subtasks, files and comments act at once. */
const FIELDS = ['title', 'description', 'assigneeId', 'assignee', 'collaborators', 'status', 'completed', 'dueDate', 'priority', 'team', 'checklist', 'labels', 'holdReason'];

/**
 * A phase task, opened from whichever board you were looking at.
 *
 * A phase card is a real task row, so this edits that row rather than showing
 * a copy of it: the Phase Board, the Design board and the Construction board
 * all open the same panel over the same record, and a change made in one is
 * the change the others read.
 *
 * It owns its own saving: edits collect in a draft and save 3 seconds after
 * typing stops, or at once with Save (or when the panel closes). The host
 * passes the rows it already has and is told what changed, so the board
 * behind the panel updates without refetching.
 */
export function PhaseTaskPanel({
  task, tasks, phaseName, phaseColor, onClose, onSaved, onReload,
}: {
  task: any;
  /** Every task on the project, so subtasks can be found. */
  tasks: any[];
  phaseName: string;
  phaseColor: string;
  onClose: () => void;
  onSaved: (task: any) => void;
  /** Called after a structural change (a subtask added or deleted). */
  onReload?: () => void;
}) {
  const { can, toast, currentUser } = useApp();
  // Project managers edit any task; anyone edits a task that's theirs.
  const canManage = can('projects', 'manage') || isMine(task, currentUser, true);
  const [storageReady, setStorageReady] = useState(false);
  const [teams, setTeams] = useState<string[]>(['Automation']);
  const [draft, setDraft] = useState<any>(task);
  // Which of priority / due date was filled in automatically from the other.
  const autoPD = useRef<'priority' | 'due' | null>(null);
  const numberOf = useTaskNumber();

  // Another task opened in the panel starts fresh; replies for this one merge in.
  useEffect(() => { setDraft(task); autoPD.current = null; }, [task.id]);
  useEffect(() => {
    api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => setStorageReady(false));
    api.roles.list()
      .then((res: any) => {
        if (!Array.isArray(res)) return;
        setTeams([...res.filter((r: any) => r.tier === 'internal').map((r: any) => r.name as string), 'Automation']);
      })
      .catch(() => { /* keep the fallback */ });
  }, []);

  const allLabels = Array.from(new Set(tasks.flatMap((t: any) => t.labels ?? []))).sort() as string[];
  const parentTask = draft.parentId ? tasks.find((t: any) => t.id === draft.parentId) : null;

  const auto = useAutosave<any>({
    draft, saved: task, fields: FIELDS, enabled: canManage, label: 'task',
    // Emails (assigned, added, done) wait for the Save button, as on the Task Board.
    save: (changes) => api.projectTasks.update(draft.id, { ...changes, deferNotify: true }),
    onSaved: (row, sent) => { setDraft((cur: any) => mergeSaved(cur, row, sent)); onSaved(row); },
  });
  /** A reply to an upload or comment: take it, but keep edits the autosave still owes. */
  const applied = (next: any) => { setDraft((cur: any) => keepEdits(cur, next, FIELDS)); onSaved(next); };
  const put = (patch: any) => setDraft((prev: any) => ({ ...prev, ...patch }));
  // Putting it on hold asks why (the reason is required).
  const set = (patch: any) => {
    if (patch.status === 'On hold' && draft.status !== 'On hold' && !(patch.holdReason || '').trim()) {
      void askHoldReason(draft.title).then((reason) => { if (reason) put({ ...patch, holdReason: reason }); });
      return;
    }
    put(patch);
  };
  const [editingSub, setEditingSub] = useState<string | null>(null);
  /** Save pressed: send the emails held on this task and its subtasks, then close. */
  const done = () => { void api.projectTasks.notify(draft.id).catch(() => undefined); onClose(); };

  const addSubtask = async (sub: NewSubtask) => {
    try {
      // The Phase Board's own fetch (PhasesService.board) only returns tasks
      // that have a phaseId -- a subtask created without one would save fine
      // but then vanish from every reload, making "Add" look broken even
      // though it worked.
      await api.projectTasks.create({ projectId: draft.projectId, sectionId: draft.sectionId, phaseId: draft.phaseId, ...sub, parentId: draft.id, deferNotify: true });
      onReload?.();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not add the subtask')); }
  };
  const removeTask = async (id: string) => {
    try { await api.projectTasks.remove(id); onReload?.(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not delete')); }
  };

  const label = (text: string, hint?: string) => (
    <div style={{ marginBottom: 5 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{text}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--c-9aa39d)', marginTop: 2 }}>{hint}</div>}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), 0.45)', zIndex: 160, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 96vw)', height: '100%', background: 'var(--surface)', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(var(--rgb-shade), 0.2)', animation: 'scaleIn 0.2s ease' }}>
        {canManage && (
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', padding: '10px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
            <SaveBar auto={auto} onDone={done} />
          </div>
        )}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: 3, background: phaseColor, marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{phaseName}</div>
            <div style={{ marginBottom: 6 }}><OriginatorLine label="Assigner" by={task.createdByName || createdByOf(task)?.by} at={createdByOf(task)?.at || task.createdAt} number={numberOf(task) || null} /></div>
            {parentTask && (
              <div style={{ fontSize: 11.5, color: 'var(--c-9aa39d)', marginBottom: 4 }}>Subtask of <span style={{ color: 'var(--body)', fontWeight: 600 }}>{parentTask.title}</span></div>
            )}
            <textarea
              value={draft.title || ''}
              disabled={!canManage}
              onChange={(e) => set({ title: e.target.value })}
              rows={1}
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontFamily: BG, fontSize: 18, fontWeight: 700, color: 'var(--ink)', background: 'transparent', lineHeight: 1.3 }}
            />
          </div>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>×</div>
        </div>

        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <div>
            {label('Assignee')}
            <AssigneePicker
              valueId={draft.assigneeId}
              valueName={draft.assignee}
              disabled={!canManage}
              onChange={(u: any) => set({ assigneeId: u?.id ?? '', assignee: u?.name ?? '' })}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Collaborative', 'Follow the task without owning it — they hear about comments and when it’s done.')}
            <CollaboratorPicker value={draft.collaborators} assigneeId={draft.assigneeId} disabled={!canManage} onChange={(collaborators) => set({ collaborators })} />
          </div>
          <div>
            {label('Status')}
            <select disabled={!canManage} value={draft.status || 'Not started'} title={STATUS_HINT[(draft.status || 'Not started') as TaskStatus]} onChange={(e) => set({ status: e.target.value, completed: isTaskDone({ status: e.target.value as TaskStatus }) })} style={input}>
              {TASK_STATUSES.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </select>
          </div>
          {draft.status === 'On hold' && (
            <div style={{ gridColumn: '1 / -1' }}>
              {label('Why is it on hold? (required)')}
              <textarea value={draft.holdReason || ''} disabled={!canManage} onChange={(e) => put({ holdReason: e.target.value })} rows={2} placeholder="e.g. Waiting on the client’s tile selection" aria-label="Why is it on hold"
                style={{ ...input, resize: 'vertical', background: 'var(--amber-light)' }} />
            </div>
          )}
          <div>
            {label('Due date')}
            <input type="date" disabled={!canManage} value={draft.dueDate || ''} onChange={(e) => { const r = linkPriorityDue({ priority: draft.priority, dueDate: draft.dueDate, auto: autoPD.current }, { dueDate: e.target.value }); autoPD.current = r.auto; set({ dueDate: r.dueDate, priority: r.priority }); }} style={input} />
            {autoPD.current === 'due' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Set from the priority — change it if you need to</div>}
          </div>
          <div>
            {label('Priority')}
            <select disabled={!canManage} value={draft.priority || ''} title={draft.priority ? PRIORITY_HINT[draft.priority as Priority] : 'Picking a priority fills in the due date'}
              onChange={(e) => { const r = linkPriorityDue({ priority: draft.priority, dueDate: draft.dueDate, auto: autoPD.current }, { priority: e.target.value as Priority | '' }); autoPD.current = r.auto; set({ priority: r.priority, dueDate: r.dueDate }); }} style={input}>
              <option value="">None</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p} — {PRIORITY_HINT[p].replace('Due ', '')}</option>)}
            </select>
            {autoPD.current === 'priority' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Set from the due date</div>}
            <PriorityHelp value={draft.priority} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Role')}
            <select disabled={!canManage} value={draft.team || ''} onChange={(e) => set({ team: e.target.value })} style={input}>
              <option value="">None</option>
              {/* A role the list no longer offers stays selectable rather than being dropped. */}
              {draft.team && !teams.includes(draft.team) && <option value={draft.team}>{draft.team} (not a current role)</option>}
              {teams.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
            </select>
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          {label('Description')}
          <textarea
            disabled={!canManage}
            value={draft.description || ''}
            onChange={(e) => set({ description: e.target.value })}
            onPaste={(e) => {
              // A pasted screenshot becomes an attachment rather than nothing.
              const files = filesFromClipboard(e).map(nameClipboardFile);
              if (!files.length || !canManage) return;
              e.preventDefault();
              api.projectTasks.uploadAttachments(draft.id, files).then(applied).catch((err: Error) => toast('⚠ ' + (err.message || 'Upload failed')));
            }}
            rows={7}
            placeholder="Add details…"
            style={{ ...input, resize: 'vertical', lineHeight: 1.55 }}
          />
        </div>

        {!parentTask && (
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          {label('Subtasks')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {subtasksOf(tasks as any, draft.id).map((st: any) => editingSub === st.id ? (
              <div key={st.id} style={{ padding: 8, background: 'var(--panel)', borderRadius: 8 }}>
                <SubtaskForm compact autoFocus submitLabel="Save subtask" initial={{ title: st.title, assigneeId: st.assigneeId, assignee: st.assignee || '', dueDate: st.dueDate || '', description: st.description || '' }}
                  onCancel={() => setEditingSub(null)}
                  onAdd={(v) => api.projectTasks.update(st.id, { title: v.title, assigneeId: v.assigneeId || '', assignee: v.assignee, dueDate: v.dueDate, description: v.description, deferNotify: true })
                    .then((res: any) => { if (res) onSaved(res); setEditingSub(null); onReload?.(); })
                    .catch((e: Error) => toast('⚠ ' + (e.message || 'Subtask not saved')))} />
              </div>
            ) : (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--panel)', borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={!!st.completed}
                  disabled={!canManage}
                  onChange={() => api.projectTasks.update(st.id, { completed: !st.completed }).then(onSaved).catch(() => onReload?.())}
                />
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink)', textDecoration: st.completed ? 'line-through' : 'none', opacity: st.completed ? 0.6 : 1 }}>{st.title}</span>
                {canManage && <span onClick={() => setEditingSub(st.id)} title="Edit the subtask" aria-label="Edit subtask" style={{ fontSize: 12, color: 'var(--forest)', cursor: 'pointer', fontWeight: 700 }}>Edit</span>}
                {canManage && <span onClick={() => removeTask(st.id)} title="Delete the subtask" style={{ fontSize: 12, color: '#8E2E0A', cursor: 'pointer' }}>×</span>}
              </div>
            ))}
            {canManage && (
              <div style={{ marginTop: 4 }}><SubtaskForm onAdd={addSubtask} /></div>
            )}
          </div>
        </div>
        )}

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <Checklist items={draft.checklist ?? []} canManage={canManage} onChange={(checklist: ChecklistItem[]) => set({ checklist })} />
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <LabelPicker labels={draft.labels ?? []} canManage={canManage} suggestions={allLabels} onChange={(labels: string[]) => set({ labels })} />
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <Attachments
            scope="project-tasks"
            taskId={draft.id}
            attachments={draft.attachments ?? []}
            canManage={canManage}
            storageReady={storageReady}
            onUpload={async (files: File[] | FileList) => { applied(await api.projectTasks.uploadAttachments(draft.id, files)); }}
            onRemove={async (att: any) => { applied(await api.projectTasks.removeAttachment(draft.id, att.id)); }}
            onAddLink={async (name: string, url: string) => { applied(await api.projectTasks.addLink(draft.id, name, url)); }}
          />
        </div>

        <div style={{ padding: '16px 22px 26px' }}>
          <ActivityFeed
            comments={draft.comments ?? []}
            activity={draft.activity ?? []}
            canManage={canManage}
            onComment={async (text: string) => { applied(await api.projectTasks.addComment(draft.id, text)); }}
          />
        </div>
      </div>
    </div>
  );
}
