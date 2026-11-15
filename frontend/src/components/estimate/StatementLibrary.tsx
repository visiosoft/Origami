import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { useCsiCodes } from '../CsiSelect';
import { NOTE_KINDS, NOTE_LABEL } from '../../data/estimateCalc';
import { forgetStatements } from './StatementPicker';

interface Statement { id: string; kind: string; text: string; csiCodeId?: string | null; updatedBy?: string | null; createdBy?: string | null }

/**
 * The standard statements library (Estimating page): Details, Inclusions,
 * Exclusions and A&C per CSI code, or for every scope. Estimators pick them
 * into a scope's note rows; "Save this text…" on a note row adds here too.
 */
export function StatementLibrary() {
  const { toast } = useApp();
  const csi = useCsiCodes();
  const [rows, setRows] = useState<Statement[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [draft, setDraft] = useState<{ kind: string; csiCodeId: string; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(() => {
    api.finance.estimateStatements().then((r: any) => { setRows(r?.rows || []); setCanEdit(!!r?.rights?.edit); }).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);
  const codeOf = (id?: string | null) => { const c = csi.find((x) => x.id === id); return c ? `${c.code} — ${c.division}` : 'Every scope'; };
  const shown = useMemo(() => (rows || []).filter((s) => filter === 'all' || (filter === 'general' ? !s.csiCodeId : s.csiCodeId === filter)), [rows, filter]);
  const usedCodes = useMemo(() => [...new Set((rows || []).map((s) => s.csiCodeId).filter(Boolean))] as string[], [rows]);
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); forgetStatements(); load(); if (ok) toast(ok); } catch (e: any) { toast(e?.message || 'That didn’t work.'); }
  };
  const field = { padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.15)', font: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--ink)' } as const;

  return (
    <div className="eg-card" style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0 }}>Standard statements <span className="eg-scope-fig">Details, Inclusions, Exclusions, A&amp;C — picked into a scope’s note rows</span>
        {canEdit && <button type="button" className="eg-btn" style={{ marginLeft: 'auto' }} onClick={() => setDraft({ kind: 'inclusion', csiCodeId: filter !== 'all' && filter !== 'general' ? filter : '', text: '' })}>+ Add statement</button>}
      </h3>
      <select aria-label="Show statements for" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...field, maxWidth: 360 }}>
        <option value="all">All CSI codes</option>
        <option value="general">Every scope (no CSI code)</option>
        {usedCodes.map((id) => <option key={id} value={id}>{codeOf(id)}</option>)}
      </select>
      {draft && (
        <div style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 10, background: 'rgba(var(--rgb-success), 0.06)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select aria-label="Kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} style={field}>
              {NOTE_KINDS.map((k) => <option key={k} value={k}>{NOTE_LABEL[k]}</option>)}
            </select>
            <select aria-label="CSI code" value={draft.csiCodeId} onChange={(e) => setDraft({ ...draft, csiCodeId: e.target.value })} style={{ ...field, flex: '1 1 220px' }}>
              <option value="">Every scope (no CSI code)</option>
              {csi.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.division}</option>)}
            </select>
          </div>
          <textarea aria-label="Statement" autoFocus rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} style={{ ...field, fontSize: 16, resize: 'vertical' }} placeholder="e.g. Excludes shower doors — custom doors are contracted by others." />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="eg-btn" onClick={() => setDraft(null)}>Cancel</button>
            <button type="button" className="eg-btn is-primary" disabled={!draft.text.trim()} onClick={() => void act(() => api.finance.createEstimateStatement({ kind: draft.kind, text: draft.text, csiCodeId: draft.csiCodeId || null }), 'Statement added.').then(() => setDraft(null))}>Add</button>
          </div>
        </div>
      )}
      {rows === null ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div> : !shown.length ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No statements here yet. While editing a Details, Inclusions, Exclusions or A&amp;C row, “Save this text as a standard statement” adds it.</div>
      ) : NOTE_KINDS.map((k) => {
        const list = shown.filter((s) => s.kind === k);
        if (!list.length) return null;
        return (
          <div key={k} style={{ display: 'grid', gap: 4 }}>
            <div className="eg-stmts-head" style={{ padding: '4px 0' }}>{NOTE_LABEL[k]}</div>
            {list.map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.08)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editing?.id === s.id ? (
                    <textarea aria-label="Statement" autoFocus rows={3} value={editing.text} onChange={(e) => setEditing({ id: s.id, text: e.target.value })} style={{ ...field, width: '100%', boxSizing: 'border-box', fontSize: 16 }} />
                  ) : <div style={{ fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{s.text}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{codeOf(s.csiCodeId)}{s.updatedBy || s.createdBy ? ` · ${s.updatedBy || s.createdBy}` : ''}</div>
                </div>
                {canEdit && (editing?.id === s.id ? <>
                  <button type="button" className="eg-btn is-primary" disabled={!editing.text.trim()} onClick={() => void act(() => api.finance.saveEstimateStatement(s.id, { text: editing.text })).then(() => setEditing(null))}>Save</button>
                  <button type="button" className="eg-btn" onClick={() => setEditing(null)}>Cancel</button>
                </> : <>
                  <button type="button" className="eg-btn" onClick={() => setEditing({ id: s.id, text: s.text })}>Edit</button>
                  <button type="button" className="eg-btn is-danger" aria-label="Delete statement" onClick={() => window.confirm('Delete this standard statement? Estimates that used it keep their text.') && void act(() => api.finance.deleteEstimateStatement(s.id))}>×</button>
                </>)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
