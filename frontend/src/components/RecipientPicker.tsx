import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';

type Contact = { name: string; email: string; detail: string };

let cache: Contact[] | null = null;

/**
 * Who to send to: anyone's email typed in, or picked from People and the
 * team as you type. Several recipients are fine. `value` is "a@x.com, b@y.com".
 */
export function RecipientPicker({ value, onChange, style, dropUp }: { value: string; onChange: (v: string) => void; style?: CSSProperties; dropUp?: boolean }) {
  const { users } = useApp();
  const [people, setPeople] = useState<Contact[]>(cache || []);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (cache) return;
    api.people.list().then((r: any) => {
      cache = (Array.isArray(r) ? r : []).filter((p: any) => /@/.test(p.email || '')).map((p: any) => ({ name: p.name, email: p.email.trim(), detail: [p.role, p.company].filter(Boolean).join(' · ') }));
      setPeople(cache);
    }).catch(() => { });
  }, []);
  const chips = value.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...people, ...users.filter((u: any) => /@/.test(u.email || '')).map((u: any) => ({ name: u.name, email: u.email, detail: u.roleName || 'Team' }))]
      .filter((c) => { const k = c.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [people, users]);
  const q = draft.trim().toLowerCase();
  const matches = q ? all.filter((c) => !chips.includes(c.email) && (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.detail.toLowerCase().includes(q))).slice(0, 6) : [];
  const add = (email: string) => {
    const e = email.trim().replace(/[,;]+$/, '');
    if (!e) return;
    if (!chips.some((c) => c.toLowerCase() === e.toLowerCase())) onChange([...chips, e].join(', '));
    setDraft('');
  };
  const remove = (email: string) => onChange(chips.filter((c) => c !== email).join(', '));
  const valid = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ ...style, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', minHeight: 38, boxSizing: 'border-box', height: 'auto' }}>
        {chips.map((c) => (
          <span key={c} title={valid(c) ? c : 'Not a valid email address'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 4px 3px 9px', borderRadius: 999, fontSize: 12, background: valid(c) ? 'rgba(29,29,27,0.07)' : '#F7E4DB', color: valid(c) ? 'var(--ink)' : '#8E2E0A' }}>
            {all.find((x) => x.email.toLowerCase() === c.toLowerCase())?.name || c}
            <button type="button" onClick={() => remove(c)} aria-label={`Remove ${c}`} style={{ width: 18, height: 18, border: 0, borderRadius: 999, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input value={draft} placeholder={chips.length ? 'Add another…' : 'Name or email address'}
          onChange={(e) => { const v = e.target.value; if (/[,;]\s*$/.test(v)) add(v); else { setDraft(v); setOpen(true); } }}
          onFocus={() => setOpen(true)} onBlur={() => { setTimeout(() => setOpen(false), 150); if (valid(draft.trim())) add(draft); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (matches[0] && !valid(draft.trim())) add(matches[0].email); else add(draft); }
            if (e.key === 'Backspace' && !draft && chips.length) remove(chips[chips.length - 1]);
          }}
          style={{ flex: 1, minWidth: 140, border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 13, color: 'var(--ink)', padding: '4px 2px', boxShadow: 'none' }} />
      </div>
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, ...(dropUp ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }), zIndex: 5, background: 'var(--surface)', borderRadius: 12, boxShadow: '0 12px 30px rgba(var(--rgb-ink), 0.18)', border: '1px solid rgba(var(--rgb-shade), 0.1)', overflow: 'hidden' }}>
          {matches.map((c) => (
            <div key={c.email} onMouseDown={(e) => { e.preventDefault(); add(c.email); }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'grid', gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{c.name} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{c.email}</span></span>
              {c.detail && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{c.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
