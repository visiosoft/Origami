import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Marking a task complete says what was done (Oct 20 sync): "Sent to the
 * client on the 20th", "Ordered, arriving Friday". The assigner reads it before
 * confirming. Resolves with the note, or null if they cancel.
 */
export function askCompletionNote(title?: string): Promise<string | null> {
  return ask(title, COMPLETION);
}

/** Putting a task On hold says why (Oct 27 backlog: "On Hold = blocked, reason required"). Resolves with the reason, or null. */
export function askHoldReason(title?: string): Promise<string | null> {
  return ask(title, HOLD);
}

interface Copy { label: string; heading: string; why: string; placeholder: string; button: string }
const COMPLETION: Copy = {
  label: 'Completion note', heading: 'What was done?', why: 'A short note is needed to mark a task complete. The assigner reads it before confirming.',
  placeholder: 'e.g. Sent to the client on Oct 20; they have the revised drawings', button: 'Mark complete',
};
const HOLD: Copy = {
  label: 'Why is it on hold', heading: 'Why is it on hold?', why: 'A reason is needed to put a task on hold, so everyone on it knows what it is waiting for.',
  placeholder: 'e.g. Waiting on the client’s tile selection', button: 'Put on hold',
};

function ask(title: string | undefined, copy: Copy): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: string | null) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<CompletionNoteDialog title={title} copy={copy} onDone={done} />);
  });
}

function CompletionNoteDialog({ title, copy, onDone }: { title?: string; copy: Copy; onDone: (note: string | null) => void }) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onDone]);
  const ok = text.trim().length > 0;
  const submit = () => { if (ok) onDone(text.trim()); };
  return (
    <div onClick={() => onDone(null)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(var(--rgb-shade), 0.45)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-label={copy.label} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(440px, 100%)', boxSizing: 'border-box', background: 'var(--surface)', borderRadius: 'var(--r-12)', padding: 20, boxShadow: '0 18px 50px rgba(var(--rgb-ink), 0.25)', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{copy.heading}</div>
        {title && <div style={{ fontSize: 12.5, color: 'var(--muted)', overflowWrap: 'anywhere' }}>{title}</div>}
        <div style={{ fontSize: 12.5, color: 'var(--body)', lineHeight: 1.5 }}>{copy.why}</div>
        <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={copy.placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          style={{ boxSizing: 'border-box', width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--panel)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', resize: 'vertical', lineHeight: 1.5 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => onDone(null)} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--body)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={submit} disabled={!ok} style={{ padding: '8px 16px', borderRadius: 999, border: 0, background: ok ? 'var(--forest)' : 'var(--c-c9d4cc)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#fff', cursor: ok ? 'pointer' : 'default' }}>{copy.button}</button>
        </div>
      </div>
    </div>
  );
}
