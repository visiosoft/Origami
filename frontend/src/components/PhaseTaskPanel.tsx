import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { AssigneePicker } from './AssigneePicker';
import { Attachments, filesFromClipboard, nameClipboardFile } from './Attachments';
import { ActivityFeed } from './ActivityFeed';
import { Checklist } from './Checklist';
import { LabelPicker } from './LabelPicker';
import { TASK_STATUSES, subtasksOf, type ChecklistItem } from '../data/projectTasks';

const BG = "'Bricolage Grotesque', serif";
const input: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.13)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};
const PRIORITIES = ['High', 'Medium', 'Low'];

/**
 * A phase task, opened from whichever board you were looking at.
 *
 * A phase card is a real task row, so this edits that row rather than showing
 * a copy of it: the Phase Board, the Design board and the Construction board
 * all open the same panel over the same record, and a change made in one is
 * the change the others read.
 *
 * It owns its own saving. The host passes the rows it already has and is told
 * what changed, so the board behind the panel updates without refetching.
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
  const { can, toast } = useApp();
  const canManage = can('projects', 'manage');
  const [storageReady, setStorageReady] = useState(false);
  const [teams, setTeams] = useState<string[]>(['Automation']);
  const [subDraft, setSubDraft] = useState('');
  const [draft, setDraft] = useState<any>(task);

  useEffect(() => { setDraft(task); }, [task]);
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

  const applied = (next: any) => { setDraft(next); onSaved(next); };
  /** Type-ahead shows at once; the save follows on blur. */
  const patchLocal = (patch: any) => setDraft((prev: any) => ({ ...prev, ...patch }));
  const save = async (patch: any) => {
    try { applied(await api.projectTasks.update(draft.id, patch)); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
  };

  const addSubtask = async () => {
    const title = subDraft.trim();
    if (!title) return;
    setSubDraft('');
    try {
      await api.projectTasks.create({ projectId: draft.projectId, sectionId: draft.sectionId, title, parentId: draft.id });
      onReload?.();
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not add the subtask')); }
  };
  const removeTask = async (id: string) => {
    try { await api.projectTasks.remove(id); onReload?.(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not delete')); }
  };

  const label = (text: string, hint?: string) => (
    <div style={{ marginBottom: 5 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{text}</div>
      {hint && <div style={{ fontSize: 10.5, color: '#9AA39D', marginTop: 2 }}>{hint}</div>}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 160, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 96vw)', height: '100%', background: 'white', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,8,31,0.2)', animation: 'scaleIn 0.2s ease' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: 3, background: phaseColor, marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{phaseName}</div>
            <textarea
              value={draft.title || ''}
              disabled={!canManage}
              onChange={(e) => patchLocal({ title: e.target.value })}
              onBlur={(e) => save({ title: e.target.value })}
              rows={1}
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontFamily: BG, fontSize: 18, fontWeight: 700, color: '#0B1A12', background: 'transparent', lineHeight: 1.3 }}
            />
          </div>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#7E9B93', flexShrink: 0 }}>×</div>
        </div>

        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
          <div>
            {label('Assignee')}
            <AssigneePicker
              valueId={draft.assigneeId}
              valueName={draft.assignee}
              disabled={!canManage}
              onChange={(u: any) => save({ assigneeId: u?.id ?? '', assignee: u?.name ?? '' })}
            />
          </div>
          <div>
            {label('Status')}
            <select disabled={!canManage} value={draft.status || 'Not started'} onChange={(e) => save({ status: e.target.value, completed: e.target.value === 'Done' })} style={input}>
              {TASK_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div>
            {label('Due date')}
            <input type="date" disabled={!canManage} value={draft.dueDate || ''} onChange={(e) => save({ dueDate: e.target.value })} style={input} />
          </div>
          <div>
            {label('Priority')}
            <select disabled={!canManage} value={draft.priority || ''} onChange={(e) => save({ priority: e.target.value })} style={input}>
              <option value="">None</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Role')}
            <select disabled={!canManage} value={draft.team || ''} onChange={(e) => save({ team: e.target.value })} style={input}>
              <option value="">None</option>
              {/* A role the list no longer offers stays selectable rather than being dropped. */}
              {draft.team && !teams.includes(draft.team) && <option value={draft.team}>{draft.team} (not a current role)</option>}
              {teams.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
            </select>
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
          {label('Description')}
          <textarea
            disabled={!canManage}
            value={draft.description || ''}
            onChange={(e) => patchLocal({ description: e.target.value })}
            onPaste={(e) => {
              // A pasted screenshot becomes an attachment rather than nothing.
              const files = filesFromClipboard(e).map(nameClipboardFile);
              if (!files.length || !canManage) return;
              e.preventDefault();
              api.projectTasks.uploadAttachments(draft.id, files).then(applied).catch((err: Error) => toast('⚠ ' + (err.message || 'Upload failed')));
            }}
            onBlur={(e) => save({ description: e.target.value })}
            rows={7}
            placeholder="Add details…"
            style={{ ...input, resize: 'vertical', lineHeight: 1.55 }}
          />
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
          {label('Subtasks')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {subtasksOf(tasks as any, draft.id).map((st: any) => (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#FBF8F2', borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={!!st.completed}
                  disabled={!canManage}
                  onChange={() => api.projectTasks.update(st.id, { completed: !st.completed, status: st.completed ? 'Not started' : 'Done' }).then(onSaved).catch(() => onReload?.())}
                />
                <span style={{ flex: 1, fontSize: 12.5, color: '#0B1A12', textDecoration: st.completed ? 'line-through' : 'none', opacity: st.completed ? 0.6 : 1 }}>{st.title}</span>
                {canManage && <span onClick={() => removeTask(st.id)} style={{ fontSize: 12, color: '#8E2E0A', cursor: 'pointer' }}>×</span>}
              </div>
            ))}
            {canManage && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input value={subDraft} onChange={(e) => setSubDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }} placeholder="Add a subtask…" style={{ ...input, flex: 1 }} />
                <div onClick={addSubtask} style={{ padding: '9px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white', whiteSpace: 'nowrap' }}>Add</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
          <Checklist items={draft.checklist ?? []} canManage={canManage} onChange={(checklist: ChecklistItem[]) => save({ checklist })} />
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
          <LabelPicker labels={draft.labels ?? []} canManage={canManage} suggestions={allLabels} onChange={(labels: string[]) => save({ labels })} />
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
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
