import type { CSSProperties } from 'react';
import { PRIORITY_HINT } from '../data/priority';
import type { Priority } from '../data/projectTasks';

/** The one priority scale for every special action: None, Urgent, High, Medium, Low -- each with its due-date window. */
export const PRIORITY_LEVELS: Priority[] = ['Urgent', 'High', 'Medium', 'Low'];

export function PrioritySelect({ value, onChange, disabled, style }: {
  value?: string | null; onChange: (p: Priority | '') => void; disabled?: boolean; style?: CSSProperties;
}) {
  const v = PRIORITY_LEVELS.includes(value as Priority) ? (value as Priority) : '';
  return (
    <select disabled={disabled} value={v} aria-label="Priority" title={v ? PRIORITY_HINT[v] : 'Picking a priority fills in the due date'}
      onChange={(e) => onChange(e.target.value as Priority | '')} style={style}>
      <option value="">None</option>
      {PRIORITY_LEVELS.map((p) => <option key={p} value={p}>{p} — {PRIORITY_HINT[p].replace('Due ', '')}</option>)}
    </select>
  );
}
