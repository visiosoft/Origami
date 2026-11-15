import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';

const FIELDS: { key: 'intro' | 'descriptionOfWork' | 'terms' | 'closing' | 'additionalNotes'; label: string; hint: string; rows: number }[] = [
  { key: 'intro', label: 'Opening', hint: 'The first paragraph of the letter, e.g. “Thank you for the opportunity…”', rows: 4 },
  { key: 'descriptionOfWork', label: 'Description of work', hint: 'What the project is, in a few sentences', rows: 6 },
  { key: 'terms', label: 'Terms', hint: 'How long the price holds, what isn’t included, payment terms', rows: 6 },
  { key: 'additionalNotes', label: 'Notes', hint: 'Anything else the client should know', rows: 3 },
  { key: 'closing', label: 'Closing', hint: 'The last paragraph, above the signatures', rows: 3 },
];

/**
 * The words of the client's letter (K8, Nov 13): opening, description of
 * work, terms, notes and closing. The scopes, statements and totals come
 * from the sheet. Frozen once the revision is sent.
 */
export function LetterPanel({ projectId, estimateId, onPreview }: { projectId: number; estimateId: string; onPreview: () => void }) {
  const { toast } = useApp();
  const [head, setHead] = useState<any>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = (r: any) => {
    setHead(r.estimate);
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, r.estimate?.[f.key] || ''])));
    setCanEdit(!!r.rights?.edit && !r.locked);
  };
  useEffect(() => { api.finance.estimate(projectId, estimateId).then(take).catch((e: any) => toast(e?.message || 'Could not open the estimate.')); }, [projectId, estimateId, toast]);
  if (!head) return <div style={{ color: 'var(--muted)' }}>Loading…</div>;
  const dirty = FIELDS.some((f) => (draft[f.key] || '') !== (head[f.key] || ''));
  const save = async () => {
    setBusy(true);
    try { take(await api.finance.saveEstimate(projectId, estimateId, { version: head.version, ...draft })); toast('Letter saved'); }
    catch (e: any) { toast(e?.message || 'Not saved.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="eg-card" style={{ display: 'grid', gap: 14, maxWidth: 900 }}>
      <h3 style={{ margin: 0 }}>The letter <span className="eg-scope-fig">The scopes, statements and totals come from the sheet; what money shows follows the project’s book type.</span></h3>
      {!canEdit && <div className="eg-locked">This revision is frozen{head.status !== 'draft' ? ` (${head.status})` : ''}; make a new revision to change the letter.</div>}
      {FIELDS.map((f) => (
        <label key={f.key} style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{f.label} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>— {f.hint}</span></span>
          <textarea rows={f.rows} disabled={!canEdit} value={draft[f.key] || ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            style={{ font: 'inherit', fontSize: 14, padding: '9px 11px', borderRadius: 10, border: '1px solid rgba(var(--rgb-shade), 0.15)', background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical' }} />
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canEdit && <button type="button" className="eg-btn is-primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save the letter'}</button>}
        <button type="button" className="eg-btn" disabled={dirty} title={dirty ? 'Save first' : undefined} onClick={onPreview}>Preview the PDF</button>
      </div>
    </div>
  );
}
