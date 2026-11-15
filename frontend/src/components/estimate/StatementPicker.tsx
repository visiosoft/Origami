import { useEffect, useState } from 'react';
import { api } from '../../api';
import { NOTE_LABEL } from '../../data/estimateCalc';

interface Statement { id: string; kind: string; text: string; csiCodeId?: string | null }
interface Suggestion { kind: string; text: string; uses: number }

const libCache = new Map<string, Promise<Statement[]>>();
const libFor = (csi: string | null) => {
  const k = csi || '';
  if (!libCache.has(k)) libCache.set(k, api.finance.estimateStatements(csi).then((r: any) => (r?.rows || []) as Statement[]).catch(() => { libCache.delete(k); return []; }));
  return libCache.get(k)!;
};
export const forgetStatements = () => libCache.clear();

/**
 * Under a note row's edit box: the standard statements for the scope's CSI
 * code (and those for every scope), and wording used on earlier estimates
 * with the same code. Buttons keep the focus in the box (mousedown), so a
 * click picks without closing the editor first. Tick several and "Insert N"
 * adds them together: the first fills this row, the rest go just below.
 */
export function StatementPicker({ csiCodeId, kind, text, canSave, onPick }: {
  csiCodeId: string | null; kind: string; text: string; canSave: boolean;
  onPick: (s: { text: string; statementId: string | null }[]) => void;
}) {
  // Ticked statements, in the order ticked; "Insert N" adds them all at once.
  const [ticked, setTicked] = useState<{ key: string; text: string; statementId: string | null }[]>([]);
  const tick = (key: string, t: string, statementId: string | null) => setTicked((x) => (x.some((y) => y.key === key) ? x.filter((y) => y.key !== key) : [...x, { key, text: t, statementId }]));
  const [lib, setLib] = useState<Statement[] | null>(null);
  const [used, setUsed] = useState<Suggestion[]>([]);
  const [saved, setSaved] = useState('');
  useEffect(() => {
    let live = true;
    void libFor(csiCodeId).then((l) => live && setLib(l.filter((s) => s.kind === kind)));
    if (csiCodeId) api.finance.estimateStatementSuggestions(csiCodeId, kind).then((r: any) => live && setUsed(r.rows || [])).catch(() => undefined);
    return () => { live = false; };
  }, [csiCodeId, kind]);
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const save = async () => {
    if (!text.trim()) return;
    try {
      await api.finance.createEstimateStatement({ kind, text: text.trim(), csiCodeId });
      forgetStatements();
      setSaved(csiCodeId ? 'Saved for this CSI code.' : 'Saved for every scope.');
    } catch (e: any) { setSaved(e?.message || 'Not saved.'); }
  };
  const item = (key: string, t: string, statementId: string | null, extra?: string) => (
    <div key={key} className="eg-stmt-row">
      <input type="checkbox" aria-label={`Tick “${t.slice(0, 40)}”`} checked={ticked.some((y) => y.key === key)} onMouseDown={keep} onChange={() => tick(key, t, statementId)} />
      <button type="button" className="eg-stmt" onMouseDown={keep} onClick={() => onPick([{ text: t, statementId }])} title={t}>
        {t}{extra && <span className="eg-stmt-uses">{extra}</span>}
      </button>
    </div>
  );
  const label = NOTE_LABEL[kind as keyof typeof NOTE_LABEL] || kind;
  return (
    <div className="eg-stmts" onMouseDown={keep}>
      <div className="eg-stmts-head">Standard {label.replace(' (A&C)', '').toLowerCase()}{csiCodeId ? ' for this CSI code' : ''}</div>
      {lib === null ? <div className="eg-stmts-empty">Loading…</div> : !lib.length ? <div className="eg-stmts-empty">None yet{csiCodeId ? '' : ' — give the scope a CSI code to see its own'}.</div>
        : lib.map((s) => item(s.id, s.text, s.id))}
      {used.length > 0 && <>
        <div className="eg-stmts-head">Used before on this CSI code</div>
        {used.map((s, i) => item(`u${i}`, s.text, null, `×${s.uses}`))}
      </>}
      {ticked.length > 0 && (
        <div className="eg-stmts-foot">
          <button type="button" className="eg-btn is-primary" onMouseDown={keep} onClick={() => onPick(ticked.map(({ text: t, statementId }) => ({ text: t, statementId })))}>Insert {ticked.length} statement{ticked.length === 1 ? '' : 's'}</button>
          <button type="button" className="eg-btn" onMouseDown={keep} onClick={() => setTicked([])}>Clear</button>
        </div>
      )}
      {canSave && (
        <div className="eg-stmts-foot">
          <button type="button" className="eg-btn" onMouseDown={keep} disabled={!text.trim()} onClick={() => void save()}>Save this text as a standard statement</button>
          {saved && <span>{saved}</span>}
        </div>
      )}
    </div>
  );
}
