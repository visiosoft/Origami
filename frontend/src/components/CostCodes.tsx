import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { ACCENT, BG, DANGER, INK, LINE, MUTED, card, headRow, input } from './manpowerUi';

export interface CostCode { id: string; code: string; division: string; description?: string; active: boolean; order: number }

/** Two-digit (or placeholder) codes are divisions; dotted codes sit under them. */
const isDivision = (code: string) => !code.includes('.');

/**
 * The company's cost codes (CSI-based): one shared list that daily logs,
 * timesheets and estimates pick from. Shown in Settings and in Manpower › Setup.
 */
export function CostCodesSettings({ canManage, onChanged }: { canManage: boolean; onChanged?: () => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<CostCode[] | null>(null);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [draft, setDraft] = useState({ code: '', division: '', description: '' });
  const load = () => api.csiCodes.list().then((r: any) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); if (msg) toast(msg); } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    await load();
    onChanged?.();
  };
  const upd = (c: CostCode, patch: Partial<CostCode>) => run(() => api.csiCodes.update(c.id, patch));

  const q = query.trim().toLowerCase();
  const all = rows || [];
  const shown = all.filter((c) => (showInactive || c.active) && (!q || `${c.code} ${c.division} ${c.description || ''}`.toLowerCase().includes(q)));
  const divisions = all.filter((c) => isDivision(c.code)).length;
  const cols = '150px minmax(220px, 1.2fr) minmax(220px, 1.4fr) 60px 26px';

  return (
    <div>
      <div style={{ fontFamily: BG, fontSize: 18, fontWeight: 700, color: INK }}>Cost codes (CSI)</div>
      <div style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 14px', lineHeight: 1.6, maxWidth: 760 }}>
        The company's cost codes — divisions and the codes under them. Supervisors log crew hours against them, staff pick them on timesheets,
        and they're the breakdown for project labor cost. Turn a code off rather than deleting it once it has been used.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, name or scope…" style={{ ...input, width: 260 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: INK }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Show codes that are off
        </label>
        <span style={{ fontSize: 12, color: MUTED }}>{all.length} codes · {divisions} divisions</span>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={headRow(cols)}><span>Code</span><span>Name</span><span>Standard verbiage / scope</span><span>Active</span><span /></div>
            {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((c) => {
              const div = isDivision(c.code);
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '6px 14px', borderTop: '1px solid ' + (div ? LINE : 'rgba(20,8,31,.04)'), background: div ? '#FBF9F4' : 'white', opacity: c.active ? 1 : 0.5 }}>
                  <input disabled={!canManage} defaultValue={c.code} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.code && upd(c, { code: e.target.value.trim() })}
                    style={{ ...input, padding: '5px 8px', fontSize: 12.5, fontWeight: div ? 700 : 500, marginLeft: div ? 0 : 14, width: div ? '100%' : 'calc(100% - 14px)' }} />
                  <input disabled={!canManage} defaultValue={c.division} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.division && upd(c, { division: e.target.value.trim() })}
                    style={{ ...input, padding: '5px 8px', fontSize: 12.5, fontWeight: div ? 700 : 500 }} />
                  <input disabled={!canManage} defaultValue={c.description || ''} placeholder={canManage ? 'Add what this code covers' : ''} onBlur={(e) => e.target.value !== (c.description || '') && upd(c, { description: e.target.value })}
                    style={{ ...input, padding: '5px 8px', fontSize: 12 }} />
                  <input type="checkbox" disabled={!canManage} checked={c.active} onChange={(e) => upd(c, { active: e.target.checked })} />
                  {canManage ? <span onClick={() => { if (confirm(`Delete ${c.code} ${c.division}? If it's been used on logs or timesheets, turn it off instead.`)) run(() => api.csiCodes.remove(c.id), 'Deleted'); }} title="Delete" style={{ cursor: 'pointer', color: DANGER }}>×</span> : <span />}
                </div>
              );
            })}
            {rows && !shown.length && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>{all.length ? 'Nothing matches.' : 'No cost codes yet.'}</div>}
          </div>
        </div>
        {canManage && (
          <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(220px, 1.2fr) minmax(220px, 1.4fr) auto', gap: 10, padding: '10px 14px', borderTop: '1px solid ' + LINE }}>
            <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. 01.42" style={input} />
            <input value={draft.division} onChange={(e) => setDraft({ ...draft, division: e.target.value })} placeholder="e.g. Impact Fees" style={input} />
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Scope (optional)" style={input} />
            <div onClick={() => {
              if (!draft.code.trim() || !draft.division.trim()) { toast('⚠ Give the code and its name'); return; }
              // New codes go right after the last code of their division, so the list stays in order.
              const div = draft.code.trim().slice(0, 2);
              const after = all.filter((c) => c.code.startsWith(div)).reduce((m, c) => Math.max(m, c.order), -1);
              run(async () => {
                await api.csiCodes.create({ code: draft.code.trim(), division: draft.division.trim(), description: draft.description.trim() || undefined, order: after >= 0 ? after + 1 : all.length });
                setDraft({ code: '', division: '', description: '' });
              }, 'Cost code added');
            }} style={{ padding: '8px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white', whiteSpace: 'nowrap', alignSelf: 'center' }}>+ Add code</div>
          </div>
        )}
      </div>
    </div>
  );
}
