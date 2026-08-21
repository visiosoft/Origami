import { useState } from 'react';
import { labelStyle } from '../data/projectTasks';

/** Small coloured tag. Colour is derived from the label text, so it's stable. */
export function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const s = labelStyle(label);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: s.bg, color: s.c }}>
      {label}
      {onRemove && (
        <span onClick={onRemove} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 12, lineHeight: 1 }}>×</span>
      )}
    </span>
  );
}

/** Free-form tags on a task — type to create, click × to remove. */
export function LabelPicker({
  labels,
  canManage,
  suggestions = [],
  onChange,
}: {
  labels: string[];
  canManage: boolean;
  suggestions?: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = (value: string) => {
    const tag = value.trim();
    if (!tag || labels.some((l) => l.toLowerCase() === tag.toLowerCase())) { setDraft(''); return; }
    onChange([...labels, tag]);
    setDraft('');
  };

  const unused = suggestions.filter((s) => !labels.some((l) => l.toLowerCase() === s.toLowerCase())).slice(0, 6);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#7E9B93', marginBottom: 7 }}>Labels</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: canManage ? 8 : 0 }}>
        {labels.map((l) => (
          <LabelChip key={l} label={l} onRemove={canManage ? () => onChange(labels.filter((x) => x !== l)) : undefined} />
        ))}
        {labels.length === 0 && !canManage && <span style={{ fontSize: 12, color: '#9AA39D' }}>None</span>}
      </div>

      {canManage && (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
            placeholder="Add a label and press Enter"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(20,8,31,0.12)', background: '#FBF8F2', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          {unused.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {unused.map((s) => (
                <span key={s} onClick={() => add(s)} style={{ cursor: 'pointer', opacity: 0.75 }}>
                  <LabelChip label={s} />
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
