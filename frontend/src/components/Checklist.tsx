import { useEffect, useState } from 'react';
import { checklistProgress, type ChecklistItem } from '../data/projectTasks';
import { api, type ChecklistTemplate } from '../api';
import { useApp } from '../AppContext';

/** Templates are shared by every checklist on the page; fetched once per visit. */
let templateCache: Promise<ChecklistTemplate[]> | null = null;
export const loadChecklistTemplates = (fresh = false) => {
  if (fresh || !templateCache) templateCache = api.checklistTemplates.list().then((r) => (Array.isArray(r) ? r : [])).catch(() => { templateCache = null; return []; });
  return templateCache;
};

/** Items from a template, added unticked with fresh ids. Items already on the list aren't added twice. */
export function itemsFromTemplate(current: ChecklistItem[], tpl: Pick<ChecklistTemplate, 'items'>, stamp = Date.now().toString(36)): ChecklistItem[] {
  const have = new Set(current.map((c) => c.item.trim().toLowerCase()));
  const add = (tpl.items || []).map((x) => x.item.trim()).filter((x) => x && !have.has(x.toLowerCase()));
  return [...current, ...add.map((item, i) => ({ id: `ci-${stamp}-${i}`, item, done: false }))];
}

/**
 * A task's checklist with a progress bar — the "Checklist {done}/{total}" block
 * from the Origami v4 design reference.
 */
export function Checklist({
  items,
  canManage,
  onChange,
}: {
  items: ChecklistItem[];
  canManage: boolean;
  onChange: (next: ChecklistItem[]) => void;
}) {
  const { toast } = useApp();
  const [draft, setDraft] = useState('');
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  useEffect(() => { if (canManage) loadChecklistTemplates().then(setTemplates); }, [canManage]);
  const { done, total } = checklistProgress(items);
  const fromTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const next = itemsFromTemplate(items, tpl);
    if (next.length === items.length) { toast('Everything on that checklist is already here'); return; }
    onChange(next);
  };
  const saveAsTemplate = async () => {
    const name = (window.prompt('Name this checklist so it can be added to other tasks:') || '').trim();
    if (!name) return;
    try {
      await api.checklistTemplates.save(name, items.map((c) => c.item));
      setTemplates(await loadChecklistTemplates(true));
      toast(`Saved “${name}” — add it to any task from “Add from template”`);
    } catch (e) { toast('⚠ ' + ((e as Error).message || 'Could not save the template')); }
  };
  const pct = total ? Math.round((done / total) * 100) : 0;

  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, { id: 'ci-' + Date.now().toString(36), item: draft.trim(), done: false }]);
    setDraft('');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)' }}>
          Checklist {total > 0 && <span style={{ color: 'var(--muted)' }}>{done}/{total}</span>}
        </span>
        {total > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? 'var(--c-1e6b36)' : 'var(--muted)' }}>{pct}%</span>}
      </div>

      {total > 0 && (
        <div style={{ height: 5, borderRadius: 999, background: '#EDEAE4', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : '#8FB79A', transition: 'width 0.2s' }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {items.map((ci, i) => (
          <div key={ci.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <span
              onClick={() => canManage && onChange(items.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)))}
              style={{
                width: 15, height: 15, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center',
                cursor: canManage ? 'pointer' : 'default',
                background: ci.done ? 'var(--success)' : 'var(--surface)',
                border: '1px solid ' + (ci.done ? 'var(--success)' : 'rgba(var(--rgb-shade), 0.2)'),
              }}
            >
              <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: ci.done ? 1 : 0 }}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: ci.done ? 'var(--c-9aa39d)' : 'var(--body)', textDecoration: ci.done ? 'line-through' : 'none' }}>
              {ci.item}
            </span>
            {canManage && (
              <span
                onClick={() => onChange(items.filter((_, xi) => xi !== i))}
                style={{ fontSize: 14, color: 'var(--c-c9d4cc)', cursor: 'pointer', padding: '0 4px' }}
                title="Remove"
              >
                ×
              </span>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Add an item…"
            style={{ flex: 1, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--panel)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <div onClick={add} style={{ padding: '7px 14px', borderRadius: 999, background: 'var(--mist)', color: 'var(--forest)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</div>
        </div>
      )}
      {canManage && (templates.length > 0 || items.length > 0) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {templates.length > 0 && (
            <select aria-label="Add from template" value="" onChange={(e) => fromTemplate(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', color: 'var(--body)', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value="">Add from template ▾</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items.length})</option>)}
            </select>
          )}
          {items.length > 0 && <button type="button" onClick={saveAsTemplate} style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Save as template</button>}
        </div>
      )}
    </div>
  );
}
