import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useApp } from '../../AppContext';

type Step = 'contract' | 'budget' | 'subcontracts' | 'milestones';
const usd = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/**
 * K9 (Nov 13): "Set up the job" from an accepted estimate. Shows what each
 * step would make; nothing happens until "Set up" is pressed, and a step
 * that's done is never run again.
 */
export function JobSetup({ projectId, estimateId, label, onClose }: { projectId: number; estimateId: string; label: string; onClose: () => void }) {
  const { toast } = useApp();
  const [plan, setPlan] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticked, setTicked] = useState<Step[]>(['contract', 'budget', 'subcontracts', 'milestones']);
  useEffect(() => { api.finance.estimateSetup(projectId, estimateId).then(setPlan).catch((e: any) => setErr(e?.message || 'Could not prepare the set-up.')); }, [projectId, estimateId]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const done = (s: Step) => !!plan?.done?.[s];
  const run = async () => {
    setBusy(true); setErr('');
    try { setPlan(await api.finance.runEstimateSetup(projectId, estimateId, ticked.filter((s) => !done(s)))); toast('Job set up'); }
    catch (e: any) { setErr(e?.message || 'Not done.'); api.finance.estimateSetup(projectId, estimateId).then(setPlan).catch(() => undefined); }
    finally { setBusy(false); }
  };
  const section = (s: Step, title: string, body: React.ReactNode, disabled = false) => (
    <section className="js-step">
      <label className="js-head">
        {done(s) ? <span className="js-done" aria-label="Done">✓</span> : <input type="checkbox" disabled={disabled} checked={ticked.includes(s) && !disabled} onChange={(e) => setTicked((t) => (e.target.checked ? [...t, s] : t.filter((x) => x !== s)))} />}
        <b>{title}</b>{done(s) && <span className="eg-scope-fig">Done</span>}
      </label>
      <div className="js-body">{body}</div>
    </section>
  );
  const pending = (['contract', 'budget', 'subcontracts', 'milestones'] as Step[]).filter((s) => ticked.includes(s) && !done(s) && !(s === 'contract' && plan?.contract?.locked));
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Set up the job" className="rc-back eg-portal" onClick={onClose}>
      <div className="eg-card rc js" onClick={(e) => e.stopPropagation()}>
        <h3>Set up the job from {label}<button type="button" className="eg-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button></h3>
        {err && <div className="eg-error" role="alert" style={{ marginBottom: 10 }}>{err}</div>}
        {!plan && !err && <div style={{ color: 'var(--muted)' }}>Working it out…</div>}
        {plan && <>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>Here is what will be made. Untick anything you’ll do by hand. Subcontracts are drafts — approve them in Job cost when they’re agreed.</div>
          {section('contract', 'Contract value', plan.contract.locked
            ? <span>Locked by issued invoices — changes go through change orders.</span>
            : <span>{plan.contract.current != null && plan.contract.current !== plan.contract.proposed ? <>Now {usd(plan.contract.current)} → </> : null}<b>{usd(plan.contract.proposed)}</b> (the accepted total)</span>, plan.contract.locked)}
          {section('budget', `Cost budget — ${plan.budget.length} line${plan.budget.length === 1 ? '' : 's'} by CSI code`,
            <table className="eg-gr"><tbody>{plan.budget.map((b: any) => <tr key={b.csiCodeId || 'none'}><td>{b.label}</td><td className="is-num">{usd(b.amount)}</td></tr>)}</tbody></table>)}
          {section('subcontracts', `Draft subcontracts — ${plan.subcontracts.length}`, plan.subcontracts.length
            ? <table className="eg-gr"><tbody>{plan.subcontracts.map((s: any) => <tr key={s.key}><td><b>{s.vendorName || 'Sub'}</b> <span style={{ color: 'var(--muted)' }}>{s.title} · {s.lines.length} line{s.lines.length === 1 ? '' : 's'}</span></td><td className="is-num">{usd(s.total)}</td></tr>)}</tbody></table>
            : <span style={{ color: 'var(--muted)' }}>No “Subcontract used” lines with a sub named.</span>)}
          {section('milestones', `Billing — ${plan.milestones.length} milestone${plan.milestones.length === 1 ? '' : 's'}`,
            <table className="eg-gr"><tbody>{plan.milestones.map((m: any, i: number) => <tr key={i}><td>{m.name}</td><td className="is-num">{usd(m.amount)}</td></tr>)}</tbody></table>)}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            {plan.setupAt ? <span className="eg-scope-fig">Set up by {plan.setupBy} on {new Date(plan.setupAt).toLocaleDateString()}</span> : null}
            <button type="button" className="eg-btn is-primary" disabled={busy || !pending.length} onClick={() => void run()}>{busy ? 'Setting up…' : pending.length ? `Set up ${pending.length} item${pending.length === 1 ? '' : 's'}` : 'All done'}</button>
          </div>
        </>}
      </div>
    </div>,
    document.body,
  );
}
