import { useState } from 'react';

/**
 * A dropdown from a Setup picklist that never loses what's already saved: a
 * value no longer on the list still shows, and "Other…" lets you type one
 * the list doesn't have yet.
 */
export function PickOne({ value, options, onChange, disabled, style }: {
  value?: string | null; options: string[]; onChange: (v: string) => void; disabled?: boolean; style: React.CSSProperties;
}) {
  const v = value || '';
  const [typing, setTyping] = useState(false);
  if (typing) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <input autoFocus disabled={disabled} value={v} onChange={(e) => onChange(e.target.value)} placeholder="Type it" style={{ ...style, flex: 1 }} />
        <span onClick={() => setTyping(false)} style={{ alignSelf: 'center', fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer', whiteSpace: 'nowrap' }}>List</span>
      </div>
    );
  }
  const all = v && !options.includes(v) ? [v, ...options] : options;
  return (
    <select disabled={disabled} value={v} onChange={(e) => { if (e.target.value === '__other') setTyping(true); else onChange(e.target.value); }} style={style}>
      <option value="">—</option>
      {all.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__other">Other…</option>
    </select>
  );
}

/** Several from a picklist, as removable chips -- a worker's skills and trades. */
export function PickMany({ value, options, onChange, disabled, style, placeholder }: {
  value?: string[] | null; options: string[]; onChange: (v: string[]) => void; disabled?: boolean; style: React.CSSProperties; placeholder?: string;
}) {
  const chosen = value || [];
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const add = (s: string) => { const t = s.trim(); if (t && !chosen.some((c) => c.toLowerCase() === t.toLowerCase())) onChange([...chosen, t]); };
  return (
    <div>
      {chosen.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
          {chosen.map((c) => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: '#EEF3EE', fontSize: 12, fontWeight: 600, color: '#173326' }}>
              {c}{!disabled && <span onClick={() => onChange(chosen.filter((x) => x !== c))} style={{ cursor: 'pointer', color: '#7E9B93' }}>×</span>}
            </span>
          ))}
        </div>
      )}
      {!disabled && (typing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder || 'Type one'} style={{ ...style, flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') { add(draft); setDraft(''); } if (e.key === 'Escape') setTyping(false); }} />
          <span onClick={() => { add(draft); setDraft(''); setTyping(false); }} style={{ alignSelf: 'center', fontSize: 11.5, fontWeight: 700, color: '#173326', cursor: 'pointer' }}>Add</span>
        </div>
      ) : (
        <select value="" onChange={(e) => { if (e.target.value === '__other') setTyping(true); else if (e.target.value) add(e.target.value); }} style={style}>
          <option value="">{chosen.length ? 'Add another…' : 'Pick…'}</option>
          {options.filter((o) => !chosen.includes(o)).map((o) => <option key={o} value={o}>{o}</option>)}
          <option value="__other">Other…</option>
        </select>
      ))}
    </div>
  );
}
