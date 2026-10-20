import { useEffect, useRef, useState } from 'react';
import { createdByText } from '../data/projectTasks';
import { LOG_STATUS_HINT, useLogStatuses } from '../data/logStatuses';
import { ActionMenu, ActionTrail, OriginatorLine } from './ActionTools';
import { LeadSelect } from './LeadSelect';
import { leadLabel, useLinkTargets } from '../data/linkTargets';
import { PrioritySelect } from './PrioritySelect';
import { linkPriorityDue } from '../data/priority';
import type { Priority } from '../data/projectTasks';
import { CollaboratorPicker } from './CollaboratorPicker';
import { useApp } from '../AppContext';
import { isMine, raisedBy } from './TaskScope';
import { api } from '../api';
import { SaveBar, keepEdits, mergeSaved, useAutosave } from '../autosave';
import { AssigneePicker } from './AssigneePicker';
import { askCompletionNote } from './CompletionNote';
import { Attachments } from './Attachments';
import { ActivityFeed } from './ActivityFeed';
import { Checklist } from './Checklist';
import { LabelPicker } from './LabelPicker';
import type { Attachment as TaskAttachment, ChecklistItem } from '../data/projectTasks';
import { ST_COLORS, TT_COLORS, MT_COLORS, getLeadTime, logTaskTitle, taskHeadline, type Task } from '../data/tasks';

/** A badge colour, with a neutral fallback for a value the map doesn't know (e.g. imported tasks). */
const tone = (map: Record<string, { bg: string; c: string }>, key?: string) => map[key || ''] || { bg: 'var(--c-efede8)', c: 'var(--c-5c6b65)' };
/** The fields edited in the drawer -- they autosave together; comments, files and delete act at once. */
const FIELDS = ['assignedToId', 'assignedTo', 'collaborators', 'status', 'startDate', 'dueDate', 'priority', 'subject', 'description', 'resolution', 'checklist', 'labels', 'project', 'leadId', 'holdReason', 'completionNote', 'originator'] as const;
const BG = 'var(--font-display)';
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--surface)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none' };

/**
 * A Request Log task, opened over whatever page you're on -- the Tasks page,
 * or a lead's Tasks tab in the CRM -- so opening a task never takes you away
 * from where you were. It owns its saving and tells the host what changed.
 */
export function RequestLogTaskDrawer({ task, allLabels = [], onClose, onChanged, onDeleted, zIndex = 100 }: {
  task: Task;
  /** Labels already in use elsewhere, offered as suggestions. */
  allLabels?: string[];
  onClose: () => void;
  onChanged?: (task: Task) => void;
  onDeleted?: (id: string) => void;
  /** Raise it when opening over another panel (the CRM lead panel sits at 120). */
  zIndex?: number;
}) {
  const { toast, can, currentUser } = useApp();
  // Deleting is for task managers; updating is also open to the task's own people
  // (assignee, collaborators, whoever raised it) -- e.g. a superintendent's requests.
  const canDelete = can('tasks', 'manage');
  const canManage = canDelete || isMine(task, currentUser, true) || raisedBy(task, currentUser?.id);
  const statuses = useLogStatuses();
  const [t, setT] = useState<Task>(task);
  // Which of priority / due date was filled in from the other.
  const autoPD = useRef<'priority' | 'due' | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  // Another task opened in the same drawer starts fresh; a reply for this one merges in (below).
  useEffect(() => { setT(task); autoPD.current = null; }, [task.id]);
  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => setStorageReady(false)); }, []);

  /** Edits stay in the draft until Save, or 3 seconds after typing stops; only changed fields are sent. */
  const auto = useAutosave<Task>({
    draft: t, saved: task, fields: [...FIELDS], enabled: canManage, label: 'task',
    // Emails (assigned, added as a collaborator, done) wait for the Save button.
    save: (changes) => api.tasks.update(t.id, { ...changes, deferNotify: true } as Partial<Task>) as Promise<Task>,
    onSaved: (row, sent) => { setT((cur) => mergeSaved(cur, row, sent)); onChanged?.(row); },
  });
  const put = (patch: Partial<Task>) => setT((prev) => ({ ...prev, ...patch }));
  // Marking it complete (or confirmed straight away) asks what was done; the note saves with the status.
  const closedNames = new Set(statuses.filter((s) => s.closed).map((s) => s.name));
  const set = (patch: Partial<Task>) => {
    if (!patch.status || !closedNames.has(patch.status) || closedNames.has(t.status)) { put(patch); return; }
    void askCompletionNote(logTaskTitle(t)).then((note) => { if (note) put({ ...patch, completionNote: note }); });
  };
  const targets = useLinkTargets();
  /** "Close task": complete and into the archive at once (Reopen from Archived). */
  const closeTask = async () => {
    if (!window.confirm('Close this task and move it to the archive? You can reopen it from Archived.')) return;
    try {
      if (auto.dirty) await auto.saveNow();
      const res = await api.tasks.update(t.id, { close: true } as Partial<Task>) as Task;
      onChanged?.(res); toast('Task closed and archived'); onClose();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not closed')); }
  };
  const reopen = async () => {
    try { const res = await api.tasks.update(t.id, { status: 'In Progress' }) as Task; onChanged?.(res); setT((cur) => ({ ...cur, ...res })); toast('Task reopened'); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Not reopened')); }
  };
  const apply = (res: any) => { if (res?.id) { setT((cur) => keepEdits(cur, res as Task, FIELDS)); onChanged?.(res as Task); } };
  const addComment = async (text: string) => {
    try { apply(await api.tasks.addComment(t.id, text)); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Failed to comment')); }
  };
  const uploadFiles = async (files: File[]) => {
    apply(await api.tasks.uploadAttachments(t.id, files));
    toast(files.length === 1 ? 'File attached' : `${files.length} files attached`);
  };
  const addLink = async (name: string, url: string) => { apply(await api.tasks.addLink(t.id, name, url)); };
  const removeAttachment = async (att: TaskAttachment) => {
    try { apply(await api.tasks.removeAttachment(t.id, att.id)); }
    catch (e) { toast('⚠ ' + ((e as Error).message || 'Failed to remove')); }
  };
  const deleteTask = () => {
    if (!confirm('Delete this task?')) return;
    onClose();
    onDeleted?.(t.id);
    api.tasks.remove(t.id).catch(() => toast('⚠ Failed to delete'));
  };
  const lt = getLeadTime(t);

  // After a duplicate or conversion: its history and links now say so.
  const refreshTrail = () => {
    api.tasks.get(t.id).then((row: any) => {
      if (!row?.id) return;
      setT((cur) => ({ ...cur, activity: row.activity, derivedRefs: row.derivedRefs, linkedTaskIds: row.linkedTaskIds, changeOrderIds: row.changeOrderIds }));
      onChanged?.(row);
    }).catch(() => { });
  };
  return (
    <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), 0.5)', zIndex, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', width: 760, maxWidth: '95vw', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(var(--rgb-shade), 0.15)', animation: 'scaleIn 0.2s ease' }}>
        {canManage && (
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', padding: '10px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
            <SaveBar auto={auto} onDone={() => { void api.tasks.notify(t.id).catch(() => undefined); onClose(); }} />
          </div>
        )}
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', background: 'var(--panel)', padding: '3px 10px', borderRadius: 6 }}>{task.serial || t.id}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone(ST_COLORS, t.status).bg, color: tone(ST_COLORS, t.status).c }}>{t.status}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone(TT_COLORS, t.topicType).bg, color: tone(TT_COLORS, t.topicType).c }}>{t.topicType}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone(MT_COLORS, t.meetingType).bg, color: tone(MT_COLORS, t.meetingType).c }}>{t.meetingType}</span>
            </div>
            {/* The subject is the task's name; older tasks without one show their first description line until one is typed. */}
            <input value={t.subject || ''} disabled={!canManage} onChange={(e) => set({ subject: e.target.value })} placeholder={taskHeadline(t.description).title || 'Subject'} aria-label="Subject"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid transparent', background: 'transparent', padding: '4px 6px', marginLeft: -6, borderRadius: 8, fontFamily: BG, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.4, color: 'var(--ink)', outline: 'none' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(var(--rgb-shade), 0.15)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }} />
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}><OriginatorLine label="Assigner" project={t.project || (t.leadName ? leadLabel(t.leadName) : 'General (no project)')} source={t.originator} by={(Array.isArray(task.activity) ? task.activity.find((e) => e.type === 'created')?.by : '') || t.originator} at={(Array.isArray(task.activity) ? task.activity.find((e) => e.type === 'created')?.at : '') || t.meetingDate} number={task.serial || '#' + t.id} /></div>
              {canManage && (task.archivedAt
                ? <button type="button" onClick={reopen} title="Bring it back into the Request Log" style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Reopen</button>
                : <button type="button" onClick={closeTask} title="Mark it complete and move it to the archive now" style={{ padding: '5px 12px', borderRadius: 999, border: 0, background: 'var(--ink)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Close task</button>)}
            </div>
            <div style={{ marginTop: 8 }}><ActionTrail sourceType={t.sourceType} sourceId={t.sourceId} sourceLabel={t.sourceLabel} derived={t.derivedRefs} /></div>
          </div>
          <div onClick={() => onClose()} style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px solid rgba(var(--rgb-shade), 0.08)', marginLeft: 16, flexShrink: 0 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
          </div>
        </div>

        {/* Meta */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Assigned To</div>
              <AssigneePicker
                valueId={t.assignedToId}
                valueName={t.assignedTo}
                disabled={!canManage}
                project={t.project || null}
                internalOnly={!t.project}
                onChange={(u) => set({ assignedToId: u?.id ?? '', assignedTo: u?.name ?? '' })}
              />
              {createdByText(task) && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{createdByText(task)}</div>}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Collaborative</div>
              <CollaboratorPicker value={t.collaborators} assigneeId={t.assignedToId} disabled={!canManage} onChange={(collaborators) => set({ collaborators })} />
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Status</div>
              <select
                disabled={!canManage}
                value={t.status}
                onChange={(e) => set({ status: e.target.value as Task['status'] })}
                title={LOG_STATUS_HINT[t.status]}
                style={{ ...inputStyle, padding: '7px 9px' }}
              >
                {[...statuses.map((s) => s.name), ...(statuses.some((s) => s.name === t.status) || !t.status ? [] : [t.status])].map((st) => {
                  // Only the assigner -- whoever entered it -- (or an admin) confirms it.
                  const creatorId = (task.activity || []).find((e) => e.type === 'created')?.byId;
                  const locked = st === 'Confirmed' && t.status !== 'Confirmed' && !(raisedBy(t, currentUser?.id) || currentUser?.roleKey === 'admin' || (!creatorId && !!t.originator && t.originator === currentUser?.name));
                  const noOne = /^in[\s-]*progress$/i.test(st) && !/^in[\s-]*progress$/i.test(t.status) && !(t.assignedToId || (t.assignedTo || '').trim());
                  return <option key={st} value={st} disabled={locked || noOne} title={LOG_STATUS_HINT[st]}>{st}{locked ? ' — the assigner confirms' : noOne ? ' — assign someone first' : ''}</option>;
                })}
              </select>
            </div>
            {closedNames.has(t.status) && t.completionNote && (
              <div style={{ padding: '12px 14px', background: 'var(--mint)', borderRadius: 10, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Completion note</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{t.completionNote}</div>
              </div>
            )}
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Source (requested by)</div>
              <AssigneePicker valueName={t.originator || undefined} disabled={!canManage} emptyLabel="— the assigner —" onChange={(u) => set({ originator: u?.name ?? '' })} />
            </div>
            {t.status === 'On hold' && (
              <div style={{ padding: '12px 14px', background: 'var(--amber-light)', borderRadius: 10, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-8a6d12)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Why is it on hold?</div>
                <textarea value={t.holdReason || ''} disabled={!canManage} onChange={(e) => set({ holdReason: e.target.value })} rows={2} placeholder="e.g. Waiting on the client’s tile selection" aria-label="Why is it on hold"
                  style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Meeting Date</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.meetingDate}</div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Project</div>
              {canManage ? (
                <select value={t.project || ''} onChange={(e) => set({ project: e.target.value })} aria-label="Project" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--forest)', fontFamily: 'inherit', padding: 0 }}>
                  <option value="">General (no project)</option>
                  {t.project && !targets.projects.some((p) => p.name === t.project) && <option value={t.project}>{t.project}</option>}
                  {targets.projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              ) : <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>{t.project || 'General (no project)'}</div>}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Lead</div>
              {canManage
                ? <LeadSelect value={t.leadId} name={t.leadName} onChange={(leadId) => set({ leadId, leadName: targets.leads.find((l) => l.id === leadId)?.name || null })} style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--forest)', fontFamily: 'inherit', padding: 0 }} />
                : <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>{t.leadName || '—'}</div>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Start Date</div>
              <input type="date" disabled={!canManage} value={t.startDate || ''} onChange={(e) => set({ startDate: e.target.value })} style={{ ...inputStyle, padding: '7px 9px' }} />
              {!t.startDate && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Fills in when it goes In Progress</div>}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Due Date</div>
              <input
                type="date"
                disabled={!canManage}
                value={t.dueDate || ''}
                onChange={(e) => { const r = linkPriorityDue({ priority: t.priority as Priority, dueDate: t.dueDate, auto: autoPD.current }, { dueDate: e.target.value }); autoPD.current = r.auto; set({ dueDate: r.dueDate, priority: r.priority }); }}
                style={{ ...inputStyle, padding: '7px 9px' }}
              />
              {autoPD.current === 'due' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Set from the priority</div>}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Priority</div>
              <PrioritySelect disabled={!canManage} value={t.priority} style={{ ...inputStyle, padding: '7px 9px' }}
                onChange={(p) => { const r = linkPriorityDue({ priority: t.priority as Priority, dueDate: t.dueDate, auto: autoPD.current }, { priority: p }); autoPD.current = r.auto; set({ priority: r.priority, dueDate: r.dueDate }); }} />
              {autoPD.current === 'priority' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Set from the due date</div>}
            </div>
            {([['Date Closed', t.dateClosed || '—'], ['Days Open', t.daysOpen > 0 ? t.daysOpen + ' days' : '—']] as [string, string][]).map((r) => (
              <div key={r[0]} style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r[0]}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r[1]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>Description</div>
          <div style={{ padding: '14px 16px', background: 'var(--panel)', borderRadius: 10 }}>
            <textarea
              disabled={!canManage}
              value={t.description || ''}
              onChange={(e) => set({ description: e.target.value })}
              rows={3}
              style={{ ...inputStyle, background: 'var(--surface)', resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(var(--rgb-shade), 0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--success)', marginBottom: 6 }}>Resolution</div>
              <textarea
                disabled={!canManage}
                value={t.resolution || ''}
                onChange={(e) => set({ resolution: e.target.value })}
                rows={2}
                placeholder="How was this resolved?"
                style={{ ...inputStyle, background: 'var(--surface)', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginTop: 18 }}>
            <Checklist
              items={t.checklist ?? []}
              canManage={canManage}
              onChange={(checklist: ChecklistItem[]) => set({ checklist })}
            />
            <LabelPicker
              labels={t.labels ?? []}
              canManage={canManage}
              suggestions={allLabels}
              onChange={(labels) => set({ labels })}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <Attachments
              scope="tasks"
              taskId={t.id}
              attachments={t.attachments ?? []}
              canManage={canManage}
              storageReady={storageReady}
              onUpload={(files) => uploadFiles(files)}
              onRemove={(att) => removeAttachment(att)}
              onAddLink={(name, url) => addLink(name, url)}
            />
          </div>
        </div>

        {/* Due date & lead time */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Due Date & Lead Time</div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 999, background: lt.bg, color: lt.color, whiteSpace: 'nowrap' }}>{lt.label}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {([['Lead Time', lt.leadTime + ' days'], ['Open Days', lt.openDays + ' days'], ['Variance', lt.variance === 0 ? 'On target' : lt.variance > 0 ? '+' + lt.variance + ' days' : lt.variance + ' days']] as [string, string][]).map((r, i) => (
              <div key={r[0]} style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r[0]}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: i === 2 ? lt.color : 'var(--ink)' }}>{r[1]}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Date Change Audit Trail</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {lt.audit.map((au, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--panel)', borderRadius: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 999, background: au.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{au.what}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{au.by} · {au.when}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: au.chipBg, color: au.chipC, flexShrink: 0 }}>{au.chip}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 10, padding: '11px 13px', background: 'var(--mist)', borderRadius: 10, fontSize: 10.5, color: 'var(--body)', lineHeight: 1.55 }}>Lead time is inherited from the task template ({lt.source}). Moving a due date needs approval from the task owner, and every change is logged above.</div>
        </div>

        {/* Activity — real comments and a record of what changed */}
        <div style={{ padding: '20px 28px' }}>
          <ActivityFeed
            comments={t.comments ?? []}
            activity={t.activity ?? []}
            canManage={canManage}
            onComment={(text) => addComment(text)}
          />
        </div>

        {canManage && (
          <div style={{ padding: '0 28px 14px' }}>
            <ActionMenu kind="log" id={t.id} topicType={t.topicType} projectName={t.project} onMade={refreshTrail} />
          </div>
        )}
        {canDelete && (
          <div style={{ padding: '0 28px 26px' }}>
            <div onClick={() => deleteTask()} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete task</div>
          </div>
        )}
      </div>
    </div>
  );
}
