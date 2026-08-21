import { useState } from 'react';
import { checklistProgress, type ChecklistItem } from '../data/projectTasks';

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
  const [draft, setDraft] = useState('');
  const { done, total } = checklistProgress(items);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, { id: 'ci-' + Date.now().toString(36), item: draft.trim(), done: false }]);
    setDraft('');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93' }}>
          Checklist {total > 0 && <span style={{ color: '#7E9B93' }}>{done}/{total}</span>}
        </span>
        {total > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#1E6B36' : '#7E9B93' }}>{pct}%</span>}
      </div>

      {total > 0 && (
        <div style={{ height: 5, borderRadius: 999, background: '#EDEAE4', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#2F7D4A' : '#8FB79A', transition: 'width 0.2s' }} />
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
                background: ci.done ? '#2F7D4A' : 'white',
                border: '1px solid ' + (ci.done ? '#2F7D4A' : 'rgba(20,8,31,0.2)'),
              }}
            >
              <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: ci.done ? 1 : 0 }}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: ci.done ? '#9AA39D' : '#43514D', textDecoration: ci.done ? 'line-through' : 'none' }}>
              {ci.item}
            </span>
            {canManage && (
              <span
                onClick={() => onChange(items.filter((_, xi) => xi !== i))}
                style={{ fontSize: 14, color: '#C9D4CC', cursor: 'pointer', padding: '0 4px' }}
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
            style={{ flex: 1, padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <div onClick={add} style={{ padding: '7px 14px', borderRadius: 999, background: '#EEF3EE', color: '#173326', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</div>
        </div>
      )}
    </div>
  );
}
