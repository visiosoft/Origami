import { prequalBlock, type PrequalFacts } from '../../data/prequal';
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
  const [subs, setSubs] = useState<({ id: string; companyName: string; email?: string } & PrequalFacts)[]>([]);
  const [making, setMaking] = useState(false);
  const [form, setForm] = useState({ title: '', dueDate: '', notes: '', scopeIds: [] as string[], instructions: '', visitDate: '', visitTime: '', visitPlace: '', visitNote: '' });
  // Nov 19 (Edward): suggested subs (licences cover the package's CSI codes) and answers to their questions.
  const [suggested, setSuggested] = useState<Record<string, string[]>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
          <form className="bp-new" onSubmit={(e) => { e.preventDefault(); const { visitDate, visitTime, visitPlace, visitNote, ...rest } = form; void run(() => api.finance.createBidPackage(projectId, estimateId, { ...rest, siteVisit: visitDate ? { date: visitDate, time: visitTime, place: visitPlace, note: visitNote } : null } as any), () => { setMaking(false); setForm({ title: '', dueDate: '', notes: '', scopeIds: [], instructions: '', visitDate: '', visitTime: '', visitPlace: '', visitNote: '' }); toast('Package made — now invite subs'); }); }}>
            <div className="bp-grid">
              <label>Title<input value={form.title} placeholder="e.g. Tile and stone" onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label>Prices due<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            </div>
            <fieldset><legend>Scopes to send</legend>
              {scopes.map((s) => <label key={s.id} className="bp-check"><input type="checkbox" checked={form.scopeIds.includes(s.id)} onChange={(e) => setForm({ ...form, scopeIds: e.target.checked ? [...form.scopeIds, s.id] : form.scopeIds.filter((x) => x !== s.id) })} />{s.title || 'Scope'}</label>)}
            </fieldset>
            <label>Note to subs<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <label>Bid instructions<textarea rows={4} value={form.instructions} placeholder="How to price, what to include, drawings to use, how to submit, insurance needed…" onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></label>
            <fieldset><legend>Site visit (optional)</legend>
              <div className="bp-grid">
                <label>Date<input type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} /></label>
                <label>Time<input type="time" value={form.visitTime} onChange={(e) => setForm({ ...form, visitTime: e.target.value })} /></label>
                <label>Where<input value={form.visitPlace} placeholder="Site address" onChange={(e) => setForm({ ...form, visitPlace: e.target.value })} /></label>
                <label>Note<input value={form.visitNote} placeholder="e.g. park on the street" onChange={(e) => setForm({ ...form, visitNote: e.target.value })} /></label>
              </div>
            </fieldset>
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
              {canEdit && p.status !== 'closed' && <button type="button" className="eg-btn" style={{ marginLeft: 'auto' }} onClick={() => { setInviting(inviting === p.id ? null : p.id); setPick([]); if (inviting !== p.id) api.finance.suggestBidSubs(projectId, p.id).then((s) => setSuggested((x) => ({ ...x, [p.id]: s.map((y) => y.contractorId) }))).catch(() => undefined); }}>{inviting === p.id ? 'Cancel' : 'Invite subs…'}</button>}
            </div>
            <div className="eg-scope-fig" style={{ margin: '2px 0 6px' }}>{p.content.scopes.map((s: any) => `${s.title} (${s.lines.length})`).join(' · ')}</div>
            {p.siteVisit && <div className="eg-scope-fig">Site visit {p.siteVisit.date}{p.siteVisit.time ? ` ${p.siteVisit.time}` : ''}{p.siteVisit.place ? ` · ${p.siteVisit.place}` : ''} · {p.invites.filter((i: any) => i.attending).length} coming</div>}
            {p.instructions && <details style={{ fontSize: 12.5, margin: '4px 0' }}><summary>Bid instructions</summary><div style={{ whiteSpace: 'pre-wrap', padding: '6px 0' }}>{p.instructions}</div></details>}
            {p.invites.some((i: any) => (i.questions || []).length) && (
              <div className="bp-questions" style={{ display: 'grid', gap: 6, margin: '6px 0' }}>
                <b style={{ fontSize: 12.5 }}>Questions from bidders <span className="eg-scope-fig">(each answer goes only to the sub who asked)</span></b>
                {p.invites.flatMap((i: any) => (i.questions || []).map((q: any) => (
                  <div key={q.id} style={{ fontSize: 12.5, padding: '6px 8px', borderRadius: 8, background: 'var(--panel)' }}>
                    <b>{i.vendorName}</b>: {q.text}
                    {q.answer ? <div style={{ color: 'var(--success-deep)' }}>↳ {q.answer}</div> : canEdit ? (
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <input aria-label={`Answer to ${i.vendorName}`} value={answers[q.id] || ''} placeholder="Your answer" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} style={{ flex: 1 }} />
                        <button type="button" className="eg-btn is-primary" disabled={busy || !(answers[q.id] || '').trim()} onClick={() => void run(() => api.finance.answerBidQuestion(projectId, p.id, i.id, q.id, answers[q.id]), (r) => toast(r.emailed ? `Answered — emailed to ${i.vendorName}` : 'Answered — it shows on their bid page'))}>Answer</button>
                      </div>
                    ) : <div className="eg-scope-fig">Not answered yet</div>}
                  </div>
                )))}
              </div>
            )}
            {inviting === p.id && (
              <div className="bp-invite">
                <input aria-label="Find a sub" placeholder="Find a sub…" value={find} onChange={(e) => setFind(e.target.value)} />
                <div className="bp-subs">
                  {(suggested[p.id] || []).length > 0 && <div className="eg-scope-fig" style={{ fontWeight: 700 }}>Matches the scope ({(suggested[p.id] || []).length}) — their licences cover these CSI codes. Not prequalified yet doesn’t stop an invite.</div>}
                  {[...subs].sort((a, b) => Number((suggested[p.id] || []).includes(b.id)) - Number((suggested[p.id] || []).includes(a.id))).filter((c) => !find || c.companyName?.toLowerCase().includes(find.toLowerCase())).slice(0, 80).map((c) => (
                    <label key={c.id} className="bp-check" title={prequalBlock(c) ? `${prequalBlock(c)} — the invite asks for the prequal form too (Nov 17: prequal with the bid, full qualification before construction)` : undefined} style={c.prequalStatus === 'rejected' ? { opacity: 0.55 } : undefined}><input type="checkbox" disabled={c.prequalStatus === 'rejected'} checked={pick.includes(c.id)} onChange={(e) => setPick(e.target.checked ? [...pick, c.id] : pick.filter((x) => x !== c.id))} />{(suggested[p.id] || []).includes(c.id) && <span title="Licence covers this scope’s CSI codes">★ </span>}{c.companyName}{c.prequalStatus === 'rejected' ? <span className="eg-scope-fig"> · prequal turned down</span> : prequalBlock(c) ? <span className="eg-scope-fig"> · prequal form sent with the invite</span> : !c.email && <span className="eg-scope-fig"> · no email (copy the link)</span>}</label>
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
