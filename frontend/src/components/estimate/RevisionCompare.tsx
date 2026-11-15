import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { money, STRATEGY_LABEL, PRICING_LABEL, type CmpOut, type CmpStatus } from '../../data/estimateCalc';

interface Rev { id: string; rev: number; status: string }
type Result = CmpOut & { a: Rev; b: Rev };

const MONEY_FIELDS = new Set(['cost', 'markup', 'price']);
const show = (field: string, v: string | number | null) => {
  if (v == null || v === '') return '—';
  if (MONEY_FIELDS.has(field)) return money(Number(v));
  if (field === 'strategy') return STRATEGY_LABEL[v as keyof typeof STRATEGY_LABEL] || String(v);
  if (field === 'pricing') return PRICING_LABEL[v as keyof typeof PRICING_LABEL]?.replace(/^.*\((\w+&?\w*)\)$/, '$1') || String(v);
  return String(v);
};
/** "↑ $200.00" / "↓ $50.00" for a money change. */
const delta = (a: number | null, b: number | null) => {
  if (a == null || b == null || a === b) return null;
  const d = b - a;
  return <span className={`rc-delta ${d > 0 ? 'is-up' : 'is-down'}`}>{d > 0 ? '↑' : '↓'} {money(Math.abs(d))}</span>;
};
const TAG: Record<CmpStatus, string> = { added: 'Added', removed: 'Removed', changed: 'Changed', same: '' };

/**
 * Rev against Rev of one estimate (Nov 13): every scope and line added,
 * removed or changed, the old and new value of what changed, and the totals.
 */
export function RevisionCompare({ projectId, revs, initialA, initialB, onClose }: { projectId: number; revs: Rev[]; initialA: string; initialB: string; onClose: () => void }) {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [onlyChanges, setOnlyChanges] = useState(true);
  useEffect(() => {
    let live = true;
    setRes(null); setErr('');
    if (a === b) { setErr('Pick two different revisions.'); return; }
    api.finance.compareEstimates(projectId, a, b).then((r) => live && setRes(r)).catch((e) => live && setErr(e?.message || 'Could not compare.'));
    return () => { live = false; };
  }, [projectId, a, b]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const sel = (v: string, set: (v: string) => void, label: string) => (
    <select aria-label={label} className="eg-btn" value={v} onChange={(e) => set(e.target.value)}>
      {revs.map((r) => <option key={r.id} value={r.id}>Rev {r.rev} · {r.status}</option>)}
    </select>
  );
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Compare revisions" className="rc-back eg-portal" onClick={onClose}>
      <div className="eg-card rc" onClick={(e) => e.stopPropagation()}>
        <h3>Compare {sel(a, setA, 'Older revision')} with {sel(b, setB, 'Newer revision')}
          <label className="eg-scope-fig" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} /> Only changes</label>
          <button type="button" className="eg-btn" onClick={onClose}>Close</button>
        </h3>
        {err && <div className="eg-error">{err}</div>}
        {!res && !err && <div style={{ color: 'var(--muted)' }}>Comparing…</div>}
        {res && <>
          <div className="eg-split" style={{ marginTop: 0, marginBottom: 10 }}>
            <span><b>{res.counts.added}</b> added</span><span><b>{res.counts.removed}</b> removed</span><span><b>{res.counts.changed}</b> changed</span><span><b>{res.counts.same}</b> the same</span>
          </div>
          <div className="rc-body">
            <table className="eg-gr rc-table">
              <thead><tr><th>Line</th><th>What changed</th><th style={{ textAlign: 'right' }}>Rev {res.a.rev}</th><th style={{ textAlign: 'right' }}>Rev {res.b.rev}</th><th style={{ textAlign: 'right' }}>Change</th></tr></thead>
              <tbody>
                {res.scopes.filter((s) => !onlyChanges || s.status !== 'same').map((s) => (
                  <ScopeRows key={s.key} s={s} onlyChanges={onlyChanges} />
                ))}
              </tbody>
            </table>
            <h3 style={{ marginTop: 16 }}>Totals</h3>
            <table className="eg-gr rc-table">
              <thead><tr><th>Total</th><th style={{ textAlign: 'right' }}>Rev {res.a.rev}</th><th style={{ textAlign: 'right' }}>Rev {res.b.rev}</th><th style={{ textAlign: 'right' }}>Change</th></tr></thead>
              <tbody>
                {res.totals.filter((t) => !onlyChanges || t.a !== t.b || t.key === 'totalProject').map((t) => (
                  <tr key={t.key} className={t.key === 'totalProject' ? 'rc-big' : ''}><td>{t.label}</td><td className="is-num">{money(t.a)}</td><td className="is-num">{money(t.b)}</td><td className="is-num">{delta(t.a, t.b) || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
      </div>
    </div>,
    document.body,
  );
}

function ScopeRows({ s, onlyChanges }: { s: CmpOut['scopes'][number]; onlyChanges: boolean }) {
  const lines = s.lines.filter((l) => !onlyChanges || l.status !== 'same');
  return <>
    <tr className={`rc-scope is-${s.status}`}>
      <td colSpan={2}><b>{s.title || 'Scope'}</b>{TAG[s.status] && <span className={`rc-tag is-${s.status}`}>{TAG[s.status]}</span>}</td>
      <td className="is-num">{s.totalA == null ? '—' : money(s.totalA)}</td><td className="is-num">{s.totalB == null ? '—' : money(s.totalB)}</td><td className="is-num">{delta(s.totalA ?? 0, s.totalB ?? 0)}</td>
    </tr>
    {lines.map((l) => (
      <tr key={l.key} className={`rc-line is-${l.status}`}>
        <td>{l.kind !== 'item' && <span className="rc-kind">{l.kind}</span>}{l.description || <i style={{ color: 'var(--muted)' }}>(no description)</i>}{TAG[l.status] && <span className={`rc-tag is-${l.status}`}>{TAG[l.status]}</span>}</td>
        <td>{l.fields.filter((f) => f.field !== 'price').map((f) => <div key={f.field} className="rc-field"><span>{f.label}</span> <s>{show(f.field, f.a)}</s> → <b>{show(f.field, f.b)}</b></div>)}</td>
        <td className="is-num">{l.priceA == null ? '—' : money(l.priceA)}</td><td className="is-num">{l.priceB == null ? '—' : money(l.priceB)}</td><td className="is-num">{delta(l.priceA ?? 0, l.priceB ?? 0)}</td>
      </tr>
    ))}
  </>;
}
