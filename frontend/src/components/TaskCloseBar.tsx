import { useEffect, useRef, type ReactNode } from 'react';
import { SaveBar, type Autosave } from '../autosave';

const pill = (dark: boolean) => ({
  padding: '7px 12px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), 0.14)', background: dark ? 'var(--ink)' : 'var(--surface)',
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: dark ? '#fff' : 'var(--forest)', cursor: 'pointer', whiteSpace: 'nowrap' as const,
});

/**
 * Nov 17/18: the one set of buttons at the top of every task panel (board,
 * Special Actions Log, Phase Board): finish it, close without saving, or save
 * and close. A main task's finish button is "✓ Complete task" (complete and
 * archive); a subtask's is "✓ Mark done". Archived: "Reopen".
 */
export function TaskCloseBar({ auto, archived, done, subtask, onFinish, onReopen, onDiscard, onSaveClose, extra }: {
  auto: Autosave; archived?: boolean; done?: boolean; subtask?: boolean;
  onFinish: () => void; onReopen?: () => void; onDiscard: () => void; onSaveClose: () => void; extra?: ReactNode;
}) {
  // Esc saves and closes, like the ✕ that used to be here -- unless a prompt or dialog is open on top.
  const latest = useRef({ auto, onSaveClose });
  latest.current = { auto, onSaveClose };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"], [role="menu"]')) return;
      void latest.current.auto.saveNow().then((ok) => { if (ok) latest.current.onSaveClose(); });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const first = archived && onReopen
    ? <button type="button" onClick={onReopen} title="Bring it back" style={pill(false)}>Reopen</button>
    : subtask
      ? (done ? null : <button type="button" onClick={onFinish} title="Mark this subtask complete" style={pill(true)}>✓ Mark done</button>)
      : <button type="button" onClick={onFinish} title="Mark it complete and move it to the archive now" style={pill(true)}>✓ Complete<span className="task-close-long"> task</span></button>;
  // Nov 22: one tidy row -- Complete and More on the left; saved dot, Save & close and ✕ (close without saving) on the right.
  const st = auto.state;
  const dot = st === 'error' ? '#8E2E0A' : st === 'dirty' || st === 'saving' ? '#C08A00' : '#2F6B3A';
  const status = st === 'saving' ? 'Saving…' : st === 'error' ? 'Couldn’t save' : st === 'dirty' ? 'Unsaved — saves in a moment' : 'All changes saved';
  const discard = () => {
    if (auto.dirty && !window.confirm('Close without saving? The changes not saved yet will be lost.')) return;
    auto.discard(); onDiscard();
  };
  return (
    <div className="task-close-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
      {first}
      {extra}
      <span style={{ flex: 1 }} />
      <span role="status" title={status} aria-label={status} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flexShrink: 0 }} />
        <span className="task-close-status">{st === 'saving' ? 'Saving…' : st === 'dirty' ? 'Unsaved' : st === 'error' ? 'Not saved' : 'Saved'}</span>
      </span>
      <SaveBar auto={auto} compact onDone={onSaveClose} />
      <button type="button" onClick={discard} aria-label="Close without saving" title={auto.dirty ? 'Close without saving — drops the changes not saved yet' : 'Close'}
        style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 999, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', color: 'var(--body)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
      <style>{'@media (max-width: 420px) { .task-close-status, .task-close-long, .task-close-bar .more-word { display: none; } .task-close-bar .more-dots { display: inline !important; } }'}</style>
    </div>
  );
}
