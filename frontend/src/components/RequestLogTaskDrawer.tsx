import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../api';
import { SaveBar, keepEdits, mergeSaved, useAutosave } from '../autosave';
import { AssigneePicker } from './AssigneePicker';
import { Attachments } from './Attachments';
import { ActivityFeed } from './ActivityFeed';
import { Checklist } from './Checklist';
import { LabelPicker } from './LabelPicker';
import type { Attachment as TaskAttachment, ChecklistItem } from '../data/projectTasks';
import { ST_COLORS, TT_COLORS, MT_COLORS, getLeadTime, type Task } from '../data/tasks';

/** A badge colour, with a neutral fallback for a value the map doesn't know (e.g. imported tasks). */
const tone = (map: Record<string, { bg: string; c: string }>, key?: string) => map[key || ''] || { bg: '#EFEDE8', c: '#5C6B65' };
/** The fields edited in the drawer -- they autosave together; comments, files and delete act at once. */
const FIELDS = ['assignedToId', 'assignedTo', 'status', 'dueDate', 'description', 'resolution', 'checklist', 'labels'] as const;
const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid rgba(20,8,31,0.12)', background: 'white', fontSize: 13, fontFamily: 'inherit', color: '#0B1A12', outline: 'none' };

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
  const { toast, can } = useApp();
  const canManage = can('tasks', 'manage');
  const [t, setT] = useState<Task>(task);
  const [storageReady, setStorageReady] = useState(false);
  // Another task opened in the same drawer starts fresh; a reply for this one merges in (below).
  useEffect(() => { setT(task); }, [task.id]);
  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => setStorageReady(false)); }, []);

  /** Edits stay in the draft until Save, or 3 seconds after typing stops; only changed fields are sent. */
  const auto = useAutosave<Task>({
    draft: t, saved: task, fields: [...FIELDS], enabled: canManage, label: 'task',
    save: (changes) => api.tasks.update(t.id, changes) as Promise<Task>,
    onSaved: (row, sent) => { setT((cur) => mergeSaved(cur, row, sent)); onChanged?.(row); },
  });
  const set = (patch: Partial<Task>) => setT((prev) => ({ ...prev, ...patch }));
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

  return (
    <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.5)', zIndex, display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.15s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: 760, maxWidth: '95vw', height: '100%', overflowY: 'auto', boxShadow: '-24px 0 60px rgba(20,8,31,0.15)', animation: 'scaleIn 0.2s ease' }}>
        {canManage && (
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'white', padding: '10px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
            <SaveBar auto={auto} />
          </div>
        )}
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7E9B93', fontVariantNumeric: 'tabular-nums', background: '#FBF8F2', padding: '3px 10px', borderRadius: 6 }}>{t.id}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone(ST_COLORS, t.status).bg, color: tone(ST_COLORS, t.status).c }}>{t.status}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone(TT_COLORS, t.topicType).bg, color: tone(TT_COLORS, t.topicType).c }}>{t.topicType}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone(MT_COLORS, t.meetingType).bg, color: tone(MT_COLORS, t.meetingType).c }}>{t.meetingType}</span>
            </div>
            <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.4 }}>{t.description}</div>
          </div>
          <div onClick={() => onClose()} style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px solid rgba(20,8,31,0.08)', marginLeft: 16, flexShrink: 0 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7E9B93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
          </div>
        </div>

        {/* Meta */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Assigned To</div>
              <AssigneePicker
                valueId={t.assignedToId}
                valueName={t.assignedTo}
                disabled={!canManage}
                onChange={(u) => set({ assignedToId: u?.id ?? '', assignedTo: u?.name ?? '' })}
              />
            </div>
            <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Status</div>
              <select
                disabled={!canManage}
                value={t.status}
                onChange={(e) => set({ status: e.target.value as Task['status'] })}
                style={{ ...inputStyle, padding: '7px 9px' }}
              >
                {(['Open', 'In Progress', 'Closed'] as const).map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Meeting Date</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.meetingDate}</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Project</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#173326' }}>{t.project || 'General (no project)'}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
            <div style={{ padding: '12px 14px', background: '#FBF8F2', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Due Date</div>
              <input
                type="date"
                disabled={!canManage}
                value={t.dueDate || ''}
                onChange={(e) => set({ dueDate: e.target.value })}
                style={{ ...inputStyle, padding: '7px 9px' }}
              />
            </div>
            {([['Date Closed', t.dateClosed || '—'], ['Days Open', t.daysOpen > 0 ? t.daysOpen + ' days' : '—'], ['Originator', t.originator || '—']] as [string, string][]).map((r) => (
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
              value={t.description || ''}
              onChange={(e) => set({ description: e.target.value })}
              rows={3}
              style={{ ...inputStyle, background: 'white', resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(20,8,31,0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2F7D4A', marginBottom: 6 }}>Resolution</div>
              <textarea
                disabled={!canManage}
                value={t.resolution || ''}
                onChange={(e) => set({ resolution: e.target.value })}
                rows={2}
                placeholder="How was this resolved?"
                style={{ ...inputStyle, background: 'white', resize: 'vertical', lineHeight: 1.6 }}
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
            comments={t.comments ?? []}
            activity={t.activity ?? []}
            canManage={canManage}
            onComment={(text) => addComment(text)}
          />
        </div>

        {canManage && (
          <div style={{ padding: '0 28px 26px' }}>
            <div onClick={() => deleteTask()} style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(142,46,10,0.25)', color: '#8E2E0A' }}>Delete task</div>
          </div>
        )}
      </div>
    </div>
  );
}
