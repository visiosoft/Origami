import { useState } from 'react';

/**
 * How to get on site -- lockbox and gate codes, where the key is, who to call.
 * Shown on the project so crews and subs don't have to ask.
 */
export function SiteAccess({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  if (!canEdit && !value) return null;
  return (
    <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(var(--rgb-shade), 0.06)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Site access</div>
      {canEdit ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== value) onSave(text.trim()); }} rows={2} maxLength={1000}
          placeholder="Lockbox code, gate code, where the key is, who to call on arrival…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.12)', background: 'var(--panel)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', resize: 'vertical' }} />
      ) : (
        <div style={{ padding: '12px 14px', background: 'var(--panel)', borderRadius: 10, fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{value}</div>
      )}
    </div>
  );
}
