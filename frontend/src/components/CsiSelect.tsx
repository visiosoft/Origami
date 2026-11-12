import { useEffect, useState } from 'react';
import { api } from '../api';

export interface CsiCode { id: string; code: string; division: string; active?: boolean }
let cache: Promise<CsiCode[]> | null = null;
const CHANGED = 'csi-codes-changed';
/**
 * A code was added, changed or removed (Settings → Cost codes): every open
 * picker and the estimating screens load the list again (Nov 10: new codes only
 * appeared after a full reload).
 */
export function invalidateCsiCodes() {
  cache = null;
  window.dispatchEvent(new Event(CHANGED));
}
/** The CSI code list (Settings → Cost codes), loaded once and shared until it changes. */
export function loadCsiCodes(): Promise<CsiCode[]> {
  if (!cache) cache = (api.csiCodes.list() as Promise<any>).then((r) => (Array.isArray(r) ? r : []).filter((c: CsiCode) => c.active !== false)).catch(() => { cache = null; return []; });
  return cache;
}
export function useCsiCodes(): CsiCode[] {
  const [list, setList] = useState<CsiCode[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => void loadCsiCodes().then((l) => { if (live) setList(l); });
    load();
    window.addEventListener(CHANGED, load);
    return () => { live = false; window.removeEventListener(CHANGED, load); };
  }, []);
  return list;
}
export const csiLabel = (c?: CsiCode | null) => (c ? `${c.code} — ${c.division}` : '');

/**
 * Pick a CSI code (Nov 3 sync: a code on a markup, RFI or task follows the
 * issue to its change order and the contract). `filter` shows "Any CSI code".
 */
export function CsiSelect({ value, onChange, disabled, filter, style, className }: {
  value?: string | null; onChange: (id: string) => void; disabled?: boolean; filter?: boolean; style?: React.CSSProperties; className?: string;
}) {
  const codes = useCsiCodes();
  return (
    <select aria-label={filter ? 'CSI code filter' : 'CSI code'} className={className} disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} style={style}>
      <option value="">{filter ? 'Any CSI code' : 'CSI code…'}</option>
      {codes.map((c) => <option key={c.id} value={c.id}>{csiLabel(c)}</option>)}
    </select>
  );
}
