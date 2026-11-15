import { useEffect, useState } from 'react';
import { api, type ChecklistTemplate } from '../api';
import { useApp } from '../AppContext';
import { loadChecklistTemplates } from '../components/Checklist';
import { Skeleton } from '../components/Skeleton';

const BG = 'var(--font-display)';
const input: React.CSSProperties = { boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.14)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)', width: '100%' };
const RECORD_TYPES = ['Observation', 'FYI', 'Decision'];

/** "Auto: All tasks · Observations · label Safety" for a template card. */
function autoForLabel(autoFor: string[] | undefined, taskName: (id: string) => string = (id) => id): string {
  return (autoFor || []).map((a) => a.startsWith('programme:') ? `“${taskName(a.slice(10))}”` : a === 'task' ? 'All tasks' : a === 'record' ? 'All FOR RECORD' : a.startsWith('record:') ? a.slice(7) + 's' : a.startsWith('label:') ? `tasks labelled “${a.slice(6)}”` : a).join(' · ');
}

const btn = (dark?: boolean): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: dark ? 0 : '1px solid rgba(var(--rgb-shade), 0.14)', background: dark ? 'var(--forest)' : 'var(--surface)', color: dark ? '#fff' : 'var(--body)' });

/**
 * Settings -> Checklist templates: checklists made in advance ("Pre-pour
 * inspection") that anyone can add to a task with "Add from template". One item
 * per line. Whoever made a template, or an admin, can change it.
 */
export function ChecklistTemplateSettings({ kind = 'general' }: { kind?: 'general' | 'qaqc' } = {}) {
  const { toast, currentUser, currentRole } = useApp();
  const qaqc = kind === 'qaqc';
  // QA/QC (Nov 13): checklists tied to programme tasks (e.g. Final Inspection) -- the programme's tasks to pick from.
  const [programme, setProgramme] = useState<{ id: string; label: string }[]>([]);
  const [findTask, setFindTask] = useState('');
  useEffect(() => {
    if (!qaqc) return;
    (api.programmeTemplate.list() as Promise<any[]>).then((lib) => {
      const seen = new Map<string, string>();
      for (const t of Array.isArray(lib) ? lib : []) for (const ph of (t.phases || []) as any[]) for (const task of (ph.tasks || []) as any[]) if (task?.id && !seen.has(task.id)) seen.set(String(task.id), `${ph.name || ph.key} · ${task.title}`);
      setProgramme([...seen].map(([id, label]) => ({ id, label })));
    }).catch(() => undefined);
  }, [qaqc]);
  const taskName = (id: string) => programme.find((p) => p.id === id)?.label || id;
  const isAdmin = currentRole?.key === 'admin';
  const [rows, setRows] = useState<ChecklistTemplate[] | null>(null);
  const [edit, setEdit] = useState<{ id?: string; name: string; text: string; autoFor: string[]; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => loadChecklistTemplates(true).then((r) => setRows((r || []).filter((t) => (t.kind === 'qaqc') === qaqc)));
  useEffect(() => { void load(); }, []);
  const mine = (t: ChecklistTemplate) => isAdmin || !t.createdById || t.createdById === currentUser?.id;

  const save = async () => {
    if (!edit) return;
    const items = edit.text.split('\n').map((x) => x.trim()).filter(Boolean);
    const autoFor = [...edit.autoFor.filter((a) => !a.startsWith('label:')), ...edit.label.split(',').map((x) => x.trim()).filter(Boolean).map((x) => 'label:' + x)];
    setBusy(true);
    try {
      const r = edit.id ? await api.checklistTemplates.update(edit.id, { name: edit.name, items, autoFor, kind }) : await api.checklistTemplates.save(edit.name, items, autoFor, kind);
      toast(r?.applied ? `Checklist saved — added to ${r.applied} open task${r.applied === 1 ? '' : 's'}` : 'Checklist saved'); setEdit(null); await load();
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not saved')); }
    finally { setBusy(false); }
  };
  const remove = async (t: ChecklistTemplate) => {
    if (!window.confirm(`Delete the checklist “${t.name}”? Tasks that already have its items keep them.`)) return;
    try { await api.checklistTemplates.remove(t.id); await load(); } catch (e) { toast('⚠ ' + ((e as Error).message || 'Not deleted')); }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ fontFamily: BG, fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>{qaqc ? 'QA/QC checklists' : 'Checklist templates'}</div>
      {qaqc ? <div style={{ fontSize: 12.5, color: 'var(--c-5c6b65)', marginTop: 4, marginBottom: 16, lineHeight: 1.6 }}>
        Inspections and quality checks for a stage of the work. Tie one to a programme task (e.g. Final Inspection) or a label, and every project’s task gets it as the programme is set up — open tasks that already exist get it too.
      </div> : <div style={{ fontSize: 12.5, color: 'var(--c-5c6b65)', marginTop: 4, marginBottom: 16, lineHeight: 1.6 }}>
        Checklists made in advance. On any task, <b>Add from template</b> adds the items, unticked; <b>Save as template</b> turns a task’s checklist into one. Mark a checklist <b>Add automatically to</b> and new tasks or FOR RECORD entries of that kind start with it — people can still remove items or add more.
      </div>}
      {!rows ? <Skeleton label="Loading…" /> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {!rows.length && !edit && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No checklist templates yet.</div>}
          {rows.map((t) => (
            <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid rgba(var(--rgb-shade), 0.08)', borderRadius: 'var(--r-12)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{t.name} <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 12 }}>· {t.items.length} items{t.createdByName ? ` · by ${t.createdByName}` : ''}</span></div>
                <div style={{ fontSize: 12, color: 'var(--body)', marginTop: 4, lineHeight: 1.5 }}>{t.items.map((x) => x.item).join(' · ')}</div>
                {(t.autoFor || []).length > 0 && <div style={{ fontSize: 11.5, color: 'var(--forest)', fontWeight: 600, marginTop: 4 }}>Added automatically to: {autoForLabel(t.autoFor, taskName)}</div>}
              </div>
              {mine(t) && <>
                <button type="button" style={btn()} onClick={() => setEdit({ id: t.id, name: t.name, text: t.items.map((x) => x.item).join('\n'), autoFor: t.autoFor || [], label: (t.autoFor || []).filter((a) => a.startsWith('label:')).map((a) => a.slice(6)).join(', ') })}>Edit</button>
                <button type="button" style={{ ...btn(), color: '#8E2E0A' }} onClick={() => remove(t)}>Delete</button>
              </>}
            </div>
          ))}
          {edit ? (
            <div style={{ background: 'var(--panel)', borderRadius: 'var(--r-12)', padding: 14, display: 'grid', gap: 8 }}>
              <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Name, e.g. Pre-pour inspection" style={input} />
              <textarea value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} rows={8} placeholder={'One item per line\nRebar tied and chaired\nForms braced\nInspector signed off'} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                <legend style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: 6 }}>Add automatically to</legend>
                {qaqc ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <input value={findTask} onChange={(e) => setFindTask(e.target.value)} placeholder="Find a programme task, e.g. inspection" aria-label="Find a programme task" style={input} />
                    <div style={{ maxHeight: 200, overflow: 'auto', display: 'grid', gap: 2, fontSize: 12.5 }}>
                      {programme.filter((p) => !findTask.trim() || p.label.toLowerCase().includes(findTask.trim().toLowerCase()) || edit.autoFor.includes('programme:' + p.id)).slice(0, 80).map((p) => {
                        const k = 'programme:' + p.id;
                        return <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={edit.autoFor.includes(k)} onChange={(e) => setEdit({ ...edit, autoFor: e.target.checked ? [...edit.autoFor, k] : edit.autoFor.filter((x) => x !== k) })} />{p.label}</label>;
                      })}
                    </div>
                  </div>
                ) : (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--body)' }}>
                  {([['task', 'All new tasks'], ['record', 'All FOR RECORD'], ...RECORD_TYPES.map((r) => ['record:' + r, r + 's'])] as [string, string][]).map(([k, label]) => (
                    <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={edit.autoFor.includes(k)} onChange={(e) => setEdit({ ...edit, autoFor: e.target.checked ? [...edit.autoFor, k] : edit.autoFor.filter((x) => x !== k) })} />{label}
                    </label>
                  ))}
                </div>
                )}
                <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="…or tasks with these labels, e.g. Safety, Concrete" aria-label="Tasks with labels" style={input} />
              </fieldset>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" style={btn()} onClick={() => setEdit(null)}>Cancel</button>
                <button type="button" style={btn(true)} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save checklist'}</button>
              </div>
            </div>
          ) : <div><button type="button" style={btn()} onClick={() => setEdit({ name: '', text: '', autoFor: [], label: '' })}>{qaqc ? '+ New QA/QC checklist' : '+ New checklist'}</button></div>}
        </div>
      )}
    </div>
  );
}
