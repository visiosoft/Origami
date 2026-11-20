import { useEffect, useRef, type ReactNode } from 'react';
import { SaveBar, type Autosave } from '../autosave';

const pill = (dark: boolean) => ({
  padding: '7px 14px', borderRadius: 999, border: dark ? 0 : '1px solid rgba(var(--rgb-shade), 0.14)', background: dark ? 'var(--ink)' : 'var(--surface)',
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
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"]')) return;
      void latest.current.auto.saveNow().then((ok) => { if (ok) latest.current.onSaveClose(); });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const first = archived && onReopen
    ? <button type="button" onClick={onReopen} title="Bring it back" style={pill(false)}>Reopen</button>
    : subtask
      ? (done ? null : <button type="button" onClick={onFinish} title="Mark this subtask complete" style={pill(true)}>✓ Mark done</button>)
      : <button type="button" onClick={onFinish} title="Mark it complete and move it to the archive now" style={pill(true)}>✓ Complete task</button>;
  return (
    <div className="task-close-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
      {first}
      {extra}
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <SaveBar auto={auto} onDiscard={onDiscard} onDone={onSaveClose} />
      </div>
    </div>
  );
}
