import type { CSSProperties } from 'react';
import { useLinkTargets } from '../data/linkTargets';

/**
 * Pick the lead a task is for -- work often starts before a contract is
 * signed. Shows the current lead even if it has since been converted or
 * archived (and so is no longer offered).
 */
export function LeadSelect({ value, name, onChange, disabled, style }: {
  value?: string | null; name?: string | null; onChange: (leadId: string) => void; disabled?: boolean; style?: CSSProperties;
}) {
  const { leads } = useLinkTargets();
  const missing = value && !leads.some((l) => l.id === value);
  return (
    <select value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={style} aria-label="Lead">
      <option value="">No lead</option>
      {missing && <option value={value!}>{name || value}</option>}
      {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );
}
