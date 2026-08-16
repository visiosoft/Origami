import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { useWindowWidth } from '../useWindowWidth';
import {
  PRIORITIES, PRIORITY_STYLE, topLevelBySection, subtasksOf,
  type ProjectSection, type ProjectTask, type Priority,
} from '../data/projectTasks';

const BG = "'Bricolage Grotesque', serif";
const inputStyle: React.CSSProperties = {
  boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.14)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: '#0B1A12', outline: 'none',
};
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
// Only allow http/https attachment links (blocks javascript:/data: XSS).
const safeHref = (u: string): string | undefined => (/^https?:\/\//i.test((u || '').trim()) ? u.trim() : undefined);

function PriorityPill({ p }: { p?: Priority }) {
  if (!p) return null;
  const s = PRIORITY_STYLE[p];
  return <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.c }}>{p}</span>;
}

export function TaskBoard({ projectId }: { projectId: number }) {
  const { can, toast, currentUser } = useApp();
  const canManage = can('tasks', 'manage');
  const isMobile = useWindowWidth() <= 720;

  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [people, setPeople] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [attName, setAttName] = useState('');
  const [attUrl, setAttUrl] = useState('');
  const loadedProject = useRef<number | null>(null);

  const load = () => {
    api.projectTasks.board(projectId)
      .then((res: any) => { if (res) { setSections(res.sections || []); setTasks(res.tasks || []); } })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => { setLoading(true); loadedProject.current = projectId; load(); /* eslint-disable-next-line */ }, [projectId]);
  useEffect(() => { api.people.list().then((r: any) => { if (Array.isArray(r)) setPeople(r.map((p) => p.name)); }).catch(() => { }); }, []);

  const selected = tasks.find((t) => t.id === selectedId) || null;

  // ---- task mutations (optimistic + persist) ----
  const patchLocal = (id: string, patch: Partial<ProjectTask>) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const updateTask = (id: string, patch: Partial<ProjectTask>) => {
    patchLocal(id, patch);
    api.projectTasks.update(id, patch).catch(() => toast('⚠ Failed to save'));
  };
  const addTask = (sectionId: string, title: string, parentId: string | null = null) => {
    const t = title.trim(); if (!t) return;
    const order = tasks.filter((x) => x.sectionId === sectionId && !x.parentId).length;
    api.projectTasks.create({ projectId, sectionId, title: t, order, parentId }).then((res: any) => {
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
  const addComment = () => {
    if (!selected || !commentDraft.trim()) return;
    const comment = { id: 'c' + Date.now(), author: currentUser?.name || 'You', text: commentDraft.trim(), date: 'Today' };
    const comments = [...(selected.comments || []), comment];
    updateTask(selected.id, { comments });
    setCommentDraft('');
  };
  const deleteComment = (cid: string) => { if (!selected) return; updateTask(selected.id, { comments: (selected.comments || []).filter((c) => c.id !== cid) }); };
  const addAttachment = () => {
    if (!selected || !attName.trim() || !attUrl.trim()) return;
    const attachments = [...(selected.attachments || []), { name: attName.trim(), url: attUrl.trim() }];
    updateTask(selected.id, { attachments });
    setAttName(''); setAttUrl('');
  };
  const removeAttachment = (i: number) => { if (!selected) return; updateTask(selected.id, { attachments: (selected.attachments || []).filter((_, idx) => idx !== i) }); };

  if (loading) return <div style={{ fontSize: 13, color: '#7E9B93', padding: 20 }}>Loading tasks…</div>;

  // ---- task card ----
  // Card JSX is inlined (not a nested component) so a re-render during drag
  // reconciles the same DOM node instead of remounting it — which would cancel
  // the native HTML5 drag. Keep this inline.
  const renderCard = (t: ProjectTask) => {
    const subs = subtasksOf(tasks, t.id);
    const doneSubs = subs.filter((s) => s.completed).length;
    return (
      <div
        key={t.id}
        draggable={canManage}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); }}
        onDragEnd={() => { setDragId(null); setDragOver(null); }}
        onClick={() => setSelectedId(t.id)}
        style={{ background: 'white', borderRadius: 10, border: '1px solid rgba(20,8,31,0.06)', padding: 11, cursor: canManage ? 'grab' : 'pointer', opacity: dragId === t.id ? 0.4 : 1, boxShadow: '0 1px 2px rgba(20,8,31,0.04)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <input type="checkbox" checked={t.completed} disabled={!canManage} onClick={(e) => e.stopPropagation()} onChange={() => updateTask(t.id, { completed: !t.completed })} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0B1A12', textDecoration: t.completed ? 'line-through' : 'none', opacity: t.completed ? 0.6 : 1 }}>{t.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
              <PriorityPill p={t.priority} />
              {t.dueDate && <span style={{ fontSize: 10, color: '#7E9B93' }}>📅 {t.dueDate}</span>}
              {subs.length > 0 && <span style={{ fontSize: 10, color: '#7E9B93' }}>☑ {doneSubs}/{subs.length}</span>}
              {(t.comments?.length || 0) > 0 && <span style={{ fontSize: 10, color: '#7E9B93' }}>💬 {t.comments!.length}</span>}
              {(t.attachments?.length || 0) > 0 && <span style={{ fontSize: 10, color: '#7E9B93' }}>🔗 {t.attachments!.length}</span>}
              {t.assignee && <span style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 999, background: '#173326', color: 'white', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700 }} title={t.assignee}>{initials(t.assignee)}</span>}
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
        const secTasks = topLevelBySection(tasks, sec.id);
        const isOver = dragOver === sec.id;
        return (
          <div key={sec.id}
            onDragOver={(e) => { if (canManage) { e.preventDefault(); if (dragOver !== sec.id) setDragOver(sec.id); } }}
            onDragLeave={() => { if (dragOver === sec.id) setDragOver(null); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) moveTask(id, sec.id); setDragOver(null); setDragId(null); }}
            style={{ width: 270, flexShrink: 0, background: isOver ? '#EEF3EE' : '#FBF8F2', borderRadius: 12, border: isOver ? '2px dashed #7E9B93' : '1px solid rgba(20,8,31,0.05)', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px' }}>
              <input value={sec.name} disabled={!canManage} onChange={(e) => renameSection(sec.id, e.target.value)} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 700, color: '#0B1A12', outline: 'none', fontFamily: 'inherit' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#7E9B93', background: '#EDE3D0', padding: '1px 7px', borderRadius: 999 }}>{secTasks.length}</span>
              {canManage && <span onClick={() => deleteSection(sec.id)} title="Delete section" style={{ fontSize: 13, color: '#B99', cursor: 'pointer' }}>×</span>}
            </div>
            <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto' }}>
              {secTasks.map((t) => renderCard(t))}
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
        const secTasks = topLevelBySection(tasks, sec.id);
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
                  {t.assignee && <span style={{ width: 22, height: 22, borderRadius: 999, background: '#173326', color: 'white', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700 }} title={t.assignee}>{initials(t.assignee)}</span>}
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
        <span style={{ fontSize: 11.5, color: '#7E9B93' }}>{tasks.filter((t) => !t.parentId).length} tasks · {tasks.filter((t) => !t.parentId && t.completed).length} done</span>
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
                <select disabled={!canManage} value={selected.assignee || ''} onChange={(e) => updateTask(selected.id, { assignee: e.target.value })} style={{ ...inputStyle, width: '100%' }}><option value="">Unassigned</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}{selected.assignee && !people.includes(selected.assignee) && <option value={selected.assignee}>{selected.assignee}</option>}</select>
              </Field>
              <Field label="Due date"><input type="date" disabled={!canManage} value={selected.dueDate || ''} onChange={(e) => updateTask(selected.id, { dueDate: e.target.value })} style={{ ...inputStyle, width: '100%' }} /></Field>
              <Field label="Priority"><select disabled={!canManage} value={selected.priority || ''} onChange={(e) => updateTask(selected.id, { priority: e.target.value as Priority })} style={{ ...inputStyle, width: '100%' }}><option value="">None</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
              <Field label="Section"><select disabled={!canManage} value={selected.sectionId} onChange={(e) => updateTask(selected.id, { sectionId: e.target.value })} style={{ ...inputStyle, width: '100%' }}>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            </div>

            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <FieldLabel>Description</FieldLabel>
              <textarea disabled={!canManage} value={selected.description || ''} onChange={(e) => patchLocal(selected.id, { description: e.target.value })} onBlur={(e) => updateTask(selected.id, { description: e.target.value })} rows={3} placeholder="Add details…" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
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

            {/* Attachments */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)' }}>
              <FieldLabel>Attachments <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#A8B5AF' }}>(links)</span></FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(selected.attachments || []).map((a, i) => {
                  const href = safeHref(a.url);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#FBF8F2', borderRadius: 8 }}>
                      {href
                        ? <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ flex: 1, fontSize: 12.5, color: '#173326', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 {a.name}</a>
                        : <span title={a.url} style={{ flex: 1, fontSize: 12.5, color: '#7E9B93', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 {a.name} <span style={{ fontSize: 10 }}>(invalid link)</span></span>}
                      {canManage && <span onClick={() => removeAttachment(i)} style={{ fontSize: 12, color: '#8E2E0A', cursor: 'pointer' }}>×</span>}
                    </div>
                  );
                })}
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <input value={attName} onChange={(e) => setAttName(e.target.value)} placeholder="Label" style={{ ...inputStyle, flex: '1 1 100px' }} />
                  <input value={attUrl} onChange={(e) => setAttUrl(e.target.value)} placeholder="https://…" style={{ ...inputStyle, flex: '2 1 140px' }} />
                  <div onClick={addAttachment} style={{ padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#173326', color: 'white' }}>Add</div>
                </div>
              )}
            </div>

            {/* Comments */}
            <div style={{ padding: '16px 22px' }}>
              <FieldLabel>Comments</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(selected.comments || []).map((c) => (
                  <div key={c.id} style={{ background: '#FBF8F2', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#173326' }}>{c.author}</span>
                      <span style={{ fontSize: 10, color: '#7E9B93' }}>{c.date}</span>
                      {canManage && <span onClick={() => deleteComment(c.id)} style={{ marginLeft: 'auto', fontSize: 11, color: '#8E2E0A', cursor: 'pointer' }}>Delete</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#43514D', lineHeight: 1.5 }}>{c.text}</div>
                  </div>
                ))}
                {(selected.comments || []).length === 0 && <div style={{ fontSize: 12, color: '#9AA39D', fontStyle: 'italic' }}>No comments yet.</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Write a comment…" style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }} />
                <div onClick={addComment} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: commentDraft.trim() ? 'pointer' : 'not-allowed', background: commentDraft.trim() ? '#173326' : '#D6DED8', color: commentDraft.trim() ? 'white' : '#9AA39D' }}>Send</div>
              </div>
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
