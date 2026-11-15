import { useState } from 'react';
import { labelStyle } from '../data/projectTasks';
import { loadTagBank, tagSuggestions, useTagBank } from '../data/tagBank';

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

/**
 * Custom tags on a task — type to create, click × to remove. Every tag anyone
 * has used is in the shared bank (Oct 30 sync), offered as you type; a new one
 * joins the bank when the task is saved.
 */
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

  const bank = useTagBank();
  const add = (value: string) => {
    const tag = value.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
    if (!tag || labels.some((l) => l.toLowerCase() === tag.toLowerCase())) { setDraft(''); return; }
    // A tag already in the bank keeps its spelling ("kitchen" -> "Kitchen").
    const known = bank.find((b) => !b.standard && b.name.toLowerCase() === tag.toLowerCase());
    onChange([...labels, known ? known.name : tag]);
    setDraft('');
    if (!known) setTimeout(() => { void loadTagBank(true); }, 1500);
  };

  const unused = tagSuggestions([...bank.filter((b) => !b.standard).map((b) => b.name), ...suggestions], labels, draft);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--muted)', marginBottom: 7 }}>Tags</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: canManage ? 8 : 0 }}>
        {labels.map((l) => (
          <LabelChip key={l} label={l} onRemove={canManage ? () => onChange(labels.filter((x) => x !== l)) : undefined} />
        ))}
        {labels.length === 0 && !canManage && <span style={{ fontSize: 12, color: 'var(--c-9aa39d)' }}>None</span>}
      </div>

      {canManage && (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
            placeholder="Add a tag and press Enter" aria-label="Add a tag"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--panel)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
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
