import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useApp } from '../../AppContext';

const usd = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const STATUS: Record<string, string> = { invited: 'Invited', viewed: 'Opened', submitted: 'Price in', declined: 'Declined', awarded: 'Awarded', not_awarded: 'Not awarded' };

/**
 * K10 (Nov 13): sub bid packages for an estimate. Pick scopes to send out
 * (the subs see the scope text and inclusions / exclusions, never our
 * amounts), invite subs, compare their prices line by line, and "Use this
 * bid" to put the chosen price into the current draft revision.
 */
export function BidPackages({ projectId, estimateId, canEdit, onClose, onUsed }: {
  projectId: number; estimateId: string; canEdit: boolean; onClose: () => void; onUsed: () => void;
}) {
  const [scopes, setScopes] = useState<{ id: string; title?: string | null }[]>([]);
  useEffect(() => { api.finance.estimate(projectId, estimateId).then((r: any) => setScopes(r?.scopes || [])).catch(() => undefined); }, [projectId, estimateId]);
  const { toast } = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  const [subs, setSubs] = useState<{ id: string; companyName: string; email?: string }[]>([]);
  const [making, setMaking] = useState(false);
  const [form, setForm] = useState({ title: '', dueDate: '', notes: '', scopeIds: [] as string[] });
  const [inviting, setInviting] = useState<string | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [find, setFind] = useState('');
  const [busy, setBusy] = useState(false);
  // Private links from the last invite, to copy for a sub without email (they're only shown once, here).
  const [links, setLinks] = useState<Record<string, string>>({});
  const load = useCallback(() => { api.finance.bidPackages(projectId, estimateId).then(setRows).catch((e: any) => { setRows([]); toast(e?.message || 'Could not load bid packages.'); }); }, [projectId, estimateId, toast]);
  useEffect(load, [load]);
  useEffect(() => { (api.contractors.list() as Promise<any>).then((l) => setSubs(Array.isArray(l) ? l : [])).catch(() => undefined); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const run = async (fn: () => Promise<any>, ok: (r: any) => void) => { setBusy(true); try { ok(await fn()); load(); } catch (e: any) { toast(e?.message || 'That didn’t work.'); } finally { setBusy(false); } };
  const copy = (link: string) => { void navigator.clipboard?.writeText(link).then(() => toast('Link copied')).catch(() => window.prompt('Copy the link:', link)); };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Bid packages" className="rc-back eg-portal" onClick={onClose}>
      <div className="eg-card rc" onClick={(e) => e.stopPropagation()}>
        <h3>Bid packages <span className="eg-scope-fig">Subs see the scope and inclusions / exclusions — never our amounts.</span>
          {canEdit && !making && <button type="button" className="eg-btn is-primary" onClick={() => setMaking(true)}>+ New package</button>}
          <button type="button" className="eg-btn" onClick={onClose}>Close</button>
        </h3>
        {making && (
          <form className="bp-new" onSubmit={(e) => { e.preventDefault(); void run(() => api.finance.createBidPackage(projectId, estimateId, form), () => { setMaking(false); setForm({ title: '', dueDate: '', notes: '', scopeIds: [] }); toast('Package made — now invite subs'); }); }}>
            <div className="bp-grid">
              <label>Title<input value={form.title} placeholder="e.g. Tile and stone" onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label>Prices due<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            </div>
            <fieldset><legend>Scopes to send</legend>
              {scopes.map((s) => <label key={s.id} className="bp-check"><input type="checkbox" checked={form.scopeIds.includes(s.id)} onChange={(e) => setForm({ ...form, scopeIds: e.target.checked ? [...form.scopeIds, s.id] : form.scopeIds.filter((x) => x !== s.id) })} />{s.title || 'Scope'}</label>)}
            </fieldset>
            <label>Note to subs<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="eg-btn" onClick={() => setMaking(false)}>Cancel</button>
              <button type="submit" className="eg-btn is-primary" disabled={busy || !form.scopeIds.length}>Make the package</button>
            </div>
          </form>
        )}
        {rows === null ? <div style={{ color: 'var(--muted)' }}>Loading…</div> : !rows.length && !making ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No bid packages yet. Make one from the scopes you want subs to price.</div>
        ) : rows.map((p) => (
          <section key={p.id} className="bp">
            <div className="bp-head"><b>{p.number} · {p.title}</b><span className={`eg-chip is-${p.status === 'closed' ? 'accepted' : p.status === 'out' ? 'sent' : 'draft'}`}>{p.status === 'out' ? 'Out for pricing' : p.status === 'closed' ? 'Closed' : 'Draft'}</span>
              {p.dueDate && <span className="eg-scope-fig">Due {p.dueDate}</span>}
              {canEdit && p.status !== 'closed' && <button type="button" className="eg-btn" style={{ marginLeft: 'auto' }} onClick={() => { setInviting(inviting === p.id ? null : p.id); setPick([]); }}>{inviting === p.id ? 'Cancel' : 'Invite subs…'}</button>}
            </div>
            <div className="eg-scope-fig" style={{ margin: '2px 0 6px' }}>{p.content.scopes.map((s: any) => `${s.title} (${s.lines.length})`).join(' · ')}</div>
            {inviting === p.id && (
              <div className="bp-invite">
                <input aria-label="Find a sub" placeholder="Find a sub…" value={find} onChange={(e) => setFind(e.target.value)} />
                <div className="bp-subs">
                  {subs.filter((c) => !find || c.companyName?.toLowerCase().includes(find.toLowerCase())).slice(0, 80).map((c) => (
                    <label key={c.id} className="bp-check"><input type="checkbox" checked={pick.includes(c.id)} onChange={(e) => setPick(e.target.checked ? [...pick, c.id] : pick.filter((x) => x !== c.id))} />{c.companyName}{!c.email && <span className="eg-scope-fig"> · no email (copy the link)</span>}</label>
                  ))}
                </div>
                <button type="button" className="eg-btn is-primary" disabled={busy || !pick.length} onClick={() => void run(() => api.finance.inviteBid(projectId, p.id, pick), (r) => { setInviting(null); setLinks((x) => ({ ...x, ...Object.fromEntries(r.invited.map((v: any) => [`${p.id}:${v.contractorId}`, v.link])) })); const n = r.invited.filter((x: any) => x.emailed).length; toast(`${r.invited.length} invited${n < r.invited.length ? ` — ${r.invited.length - n} without email: copy their link` : ''}`); })}>Invite {pick.length || ''}</button>
              </div>
            )}
            {p.invites.length > 0 && (
              <div className="rc-body">
                <table className="eg-gr bp-level">
                  <thead><tr><th>Line</th>{p.invites.map((i: any) => <th key={i.id} style={{ textAlign: 'right' }}>{i.vendorName}<div className="bp-st">{STATUS[i.status] || i.status}</div>{links[`${p.id}:${i.contractorId}`] && <button type="button" className="eg-btn bp-copy" onClick={() => copy(links[`${p.id}:${i.contractorId}`])}>Copy link</button>}</th>)}</tr></thead>
                  <tbody>
                    {p.leveling.rows.map((r: any) => <tr key={r.key}><td><span className="eg-scope-fig">{r.scope} · </span>{r.description}</td>{p.invites.map((i: any) => <td key={i.id} className="is-num">{r.prices[i.id] != null ? usd(r.prices[i.id]) : ''}</td>)}</tr>)}
                    <tr className="rc-big"><td>Total</td>{p.invites.map((i: any) => { const t = p.leveling.subs.find((s: any) => s.inviteId === i.id); return <td key={i.id} className={`is-num${t?.lowest ? ' bp-low' : ''}`}>{t ? usd(t.total) : ''}</td>; })}</tr>
                    <tr><td />{p.invites.map((i: any) => (
                      <td key={i.id} style={{ textAlign: 'right' }}>
                        {canEdit && i.status === 'submitted' && p.status !== 'closed' && <button type="button" className="eg-btn is-primary" disabled={busy} onClick={() => window.confirm(`Use ${i.vendorName}’s price? It goes into the draft revision as sub cost on these lines, and they’re marked awarded.`) && void run(() => api.finance.useBid(projectId, p.id, i.id), (r) => { toast(`${r.vendorName}’s price is in Rev ${r.rev} (${r.changed} line${r.changed === 1 ? '' : 's'})`); onUsed(); })}>Use this bid</button>}
                        {i.notes && <div className="eg-scope-fig" title={i.notes} style={{ maxWidth: 180, marginLeft: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{i.notes}”</div>}
                      </td>
                    ))}</tr>
                  </tbody>
                </table>
              </div>
            )}
            {canEdit && p.status !== 'closed' && p.invites.length > 0 && <div className="eg-scope-fig" style={{ marginTop: 4 }}>Resend or copy a sub’s link: “Invite subs…” again and tick them.</div>}
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
