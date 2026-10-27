import { useState } from 'react';
import { usePriorityDefs } from '../data/priorityDefs';

const TONE: Record<string, string> = { Urgent: '#B42318', High: '#B45309', Medium: 'var(--body)', Low: 'var(--muted)' };

/**
 * "What do priorities mean?" under a priority picker: the four definitions
 * (the office's wording, Settings -> Task priorities) and their due windows.
 */
export function PriorityHelp({ value }: { value?: string | null }) {
  const defs = usePriorityDefs();
  const [open, setOpen] = useState(false);
  const chosen = defs.find((d) => d.priority === value);
  return (
    <div className="priority-help" style={{ marginTop: 4 }}>
      {chosen && !open && <div style={{ fontSize: 11.5, color: 'var(--body)', lineHeight: 1.45 }}>{chosen.meaning}</div>}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ border: 0, background: 'transparent', padding: 0, marginTop: 2, font: 'inherit', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}>
        {open ? 'Hide' : 'What do priorities mean?'}
      </button>
      {open && (
        <dl style={{ margin: '6px 0 0', padding: '10px 12px', borderRadius: 10, background: 'var(--panel)', display: 'grid', gap: 8 }}>
          {defs.map((d) => (
            <div key={d.priority}>
              <dt style={{ fontSize: 12, fontWeight: 700, color: TONE[d.priority] }}>{d.priority} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {d.window}</span></dt>
              <dd style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--body)', lineHeight: 1.45 }}>{d.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
