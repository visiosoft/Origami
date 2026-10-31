import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../AppContext';
import { Badge, DANGER, Drawer, INK, Label, MUTED, btn, card, fmtDate, headRow, input } from '../manpowerUi';
import { CO_DRIVERS, CO_PARTIES, CO_REASONS, ReasonBox, failed, label, usd, type Rights } from './financeUi';
import { ChangeOrderList } from './ChangeOrders';
import { Skeleton } from '../Skeleton';

/**
 * Change orders as the Oct 26 review notes lay them out:
 *   change event (CE) -> pricing asked of the subs (PCO) -> their CORs
 *   (validated / hold / rejected) -> owner change order (PCCO) -> one sub
 *   change order (CCO) per sub when the owner approves it.
 * A CCD / DCD directive on the event lets the work start before pricing.
 */
export function ChangeOrderWorkspace({ projectId, rights, onChanged, openId }: { projectId?: number; rights: Rights; onChanged?: () => void; openId?: string | null }) {
  const [view, setView] = useState<'events' | 'pccos' | 'ccos'>(openId ? 'pccos' : 'events');
  const [openCo, setOpenCo] = useState<string | null>(openId || null);
  const seg = (k: typeof view, l: string, hint: string) => (
    <button key={k} type="button" role="tab" aria-selected={view === k} title={hint} onClick={() => setView(k)}
      style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid ' + (view === k ? 'var(--forest)' : 'rgba(var(--rgb-shade), 0.12)'), background: view === k ? 'var(--forest)' : 'var(--surface)', color: view === k ? '#fff' : 'var(--body)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
  );
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div role="tablist" aria-label="Change orders" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {seg('events', 'Change events', 'Field issues and requests: pricing from the subs (PCO), their CORs, directives')}
        {seg('pccos', 'Owner change orders (PCCO)', 'Change orders to the owner, made from validated CORs or by hand')}
        {seg('ccos', 'Sub change orders (CCO)', 'One per sub, made when the owner approves a PCCO; signing changes their subcontract')}
      </div>
      {view === 'events' && <ChangeEventList projectId={projectId} rights={rights} onPcco={(id) => { setOpenCo(id); setView('pccos'); onChanged?.(); }} />}
      {view === 'pccos' && <ChangeOrderList key={openCo || 'list'} projectId={projectId} rights={rights} onChanged={onChanged} openId={openCo} />}
      {view === 'ccos' && <CcoList projectId={projectId} rights={rights} />}
    </div>
  );
}

const CE_STATUS: Record<string, [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  open: ['Open', 'grey'], pricing: ['Waiting for prices', 'amber'], priced: ['Priced', 'blue'], closed: ['Closed', 'green'], void: ['Void', 'red'],
};
const COR_STATUS: Record<string, [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  requested: ['Requested', 'grey'], submitted: ['Price in', 'amber'], validated: ['Validated', 'green'], hold: ['On hold', 'blue'], rejected: ['Rejected', 'red'],
};
const CCO_STATUS: Record<string, [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  draft: ['Draft', 'grey'], sent: ['Sent to sub', 'amber'], signed: ['Signed', 'green'], void: ['Void', 'red'],
};
const tag = (map: typeof CE_STATUS, s: string) => <Badge tone={(map[s] || ['', 'grey'])[1]}>{(map[s] || [s])[0]}</Badge>;

function ChangeEventList({ projectId, rights, onPcco }: { projectId?: number; rights: Rights; onPcco: (coId: string) => void }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { api.finance.changeEvents(projectId).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [projectId, tick]);
  useEffect(() => { if (!projectId) api.projects.list().then((r: any) => setProjects(Array.isArray(r) ? r.map((p: any) => ({ id: p.id, name: p.name })) : [])).catch(() => { }); }, [projectId]);
  const canEdit = !!rights.editChangeOrders;
  const cols = projectId ? '80px minmax(200px,2fr) 150px 140px 110px 120px' : '80px minmax(140px,1fr) minmax(200px,2fr) 150px 140px 110px 120px';
  const create = async (v: Record<string, string>) => {
    const pid = projectId || Number(v.projectId);
    if (!pid) { toast('⚠ Choose the project'); return; }
    try { const e = await api.finance.createChangeEvent(pid, { title: v.title, description: v.description, reason: v.reason || 'client_request', originatorType: v.originatorType || undefined }); setAdding(false); setTick((n) => n + 1); setOpen(e.id); }
    catch (e) { failed(toast, e); }
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: MUTED, flex: 1 }}>A field issue or request starts here. Ask the subs it touches to price it, check their CORs, then roll the validated ones into an owner change order.</span>
        {canEdit && <div onClick={() => setAdding(true)} style={btn(true)}>+ Change event</div>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={headRow(cols)}><span>#</span>{!projectId && <span>Project</span>}<span>What changed</span><span>Driver</span><span>Status</span><span>CORs</span><span>Directive</span></div>
            {rows === null && <div style={{ padding: 14 }}><Skeleton rows={3} label="Loading change events…" /></div>}
            {rows && !rows.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>No change events yet.</div>}
            {(rows || []).map((e) => (
              <div key={e.id} onClick={() => setOpen(e.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(var(--rgb-shade), .05)', fontSize: 12.5, cursor: 'pointer' }}>
                <b>{e.number}</b>{!projectId && <span style={{ color: MUTED }}>{e.projectName}</span>}
                <span style={{ color: INK }}>{e.title}</span>
                <span style={{ color: MUTED }}>{label(CO_REASONS, e.reason)}</span>
                <span>{tag(CE_STATUS, e.status)}</span>
                <span style={{ color: MUTED }}>{e.totals.validated}/{e.totals.requested} validated</span>
                <span>{e.directiveType ? <Badge tone="amber">{String(e.directiveType).toUpperCase()}</Badge> : <span style={{ color: MUTED }}>—</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {adding && (
        <ReasonBox title="New change event" confirm="Create" onCancel={() => setAdding(false)} onSubmit={create}
          fields={[
            ...(projectId ? [] : [{ key: 'projectId', label: 'Project', required: true, options: projects.map((p) => [String(p.id), p.name] as [string, string]) }]),
            { key: 'title', label: 'What changed', required: true, placeholder: 'e.g. Bathroom layout change found on the owner walk' },
            { key: 'description', label: 'Details', type: 'textarea' },
            { key: 'reason', label: 'Drives the change', options: CO_DRIVERS },
            { key: 'originatorType', label: 'Originator', options: CO_PARTIES },
          ]} />
      )}
      {open && <ChangeEventDrawer id={open} rights={rights} onClose={() => { setOpen(null); setTick((n) => n + 1); }} onPcco={onPcco} />}
    </div>
  );
}

function ChangeEventDrawer({ id, rights, onClose, onPcco }: { id: string; rights: Rights; onClose: () => void; onPcco: (coId: string) => void }) {
  const { toast } = useApp();
  const [e, setE] = useState<any | null>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [prime, setPrime] = useState(false);
  const [extra, setExtra] = useState({ name: '', email: '' });
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [emailIt, setEmailIt] = useState(true);
  const [step, setStep] = useState<null | 'directive' | { cor: any; mode: 'price' | 'hold' | 'reject' }>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [markup, setMarkup] = useState('');
  const [busy, setBusy] = useState(false);
  const canEdit = !!rights.editChangeOrders;
  const reload = () => api.finance.changeEvent(id).then(setE).catch((err: Error) => toast('⚠ ' + err.message));
  useEffect(() => { void reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (e?.projectId) api.finance.projectSubcontractors(e.projectId).then((r: any) => setSubs(Array.isArray(r?.rows) ? r.rows : [])).catch(() => setSubs([])); }, [e?.projectId]);
  useEffect(() => { if (e && !note) setNote(e.description || e.title || ''); }, [e?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return <Drawer title="Change event" width={1000} onClose={onClose}><Skeleton rows={6} /></Drawer>;

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true);
    try { const r = await fn(); if (r?.id && r?.cors) setE(r); else await reload(); if (ok) toast(ok); return r; }
    catch (err) { failed(toast, err); }
    finally { setBusy(false); }
  };
  const sendPco = async () => {
    const parties = [
      ...subs.filter((s) => pick[s.key]).map((s) => ({ name: s.company, email: s.email, contractorId: s.contractorId, commitmentId: s.subcontracts?.[0]?.id })),
      ...(extra.name.trim() ? [{ name: extra.name.trim(), email: extra.email.trim() || undefined }] : []),
      ...(prime ? [{ name: 'Origami (our own price)', partyType: 'prime' }] : []),
    ];
    const r = await run(() => api.finance.sendPco(id, { parties, note, due: due || undefined, email: emailIt }));
    if (r) { setPick({}); setExtra({ name: '', email: '' }); setPrime(false); toast(r.emailed?.length ? `Pricing asked — emailed ${r.emailed.join(', ')}` : 'Pricing asked'); }
  };
  const validated = e.cors.filter((c: any) => c.status === 'validated' && !c.changeOrderId);
  const picked = validated.filter((c: any) => chosen[c.id]);
  const makePcco = async () => {
    const r = await run(() => api.finance.makePcco({ corIds: picked.map((c: any) => c.id), markupPct: markup ? Number(markup) : 0 }));
    if (r?.changeOrderId) { toast(`${r.number} drafted — check it, then send it to the owner`); onPcco(r.changeOrderId); }
  };
  const section = (title: string, children: React.ReactNode, hint?: string) => (
    <section style={{ ...card, padding: 14, display: 'grid', gap: 10 }}>
      <div><div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{title}</div>{hint && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{hint}</div>}</div>
      {children}
    </section>
  );

  return (
    <Drawer title={`${e.number} · ${e.title}`} subtitle={`${label(CO_REASONS, e.reason)}${e.originatorType ? ` · raised by ${label(CO_PARTIES, e.originatorType)}` : ''} · ${(CE_STATUS[e.status] || [e.status])[0]}`} width={1000} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        {e.description && <div style={{ fontSize: 13, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{e.description}</div>}

        {section('Directive (CCD / DCD)', e.directiveType ? (
          <div style={{ fontSize: 12.5, color: INK, padding: '8px 10px', borderRadius: 8, background: '#FBECC4' }}>
            <b>{e.directiveType === 'ccd' ? 'Construction' : 'Design'} change directive</b> — {e.directiveMethod}{e.directiveSigner ? `, signed by ${e.directiveSigner}` : ''} on {fmtDate(e.directiveDate)}. The work may proceed; pricing carries on alongside it.
            {e.directiveNote && <div style={{ marginTop: 4, color: 'var(--body)' }}>{e.directiveNote}</div>}
          </div>
        ) : canEdit ? <div><div onClick={() => setStep('directive')} style={btn()}>Record a directive…</div></div> : <span style={{ fontSize: 12.5, color: MUTED }}>None.</span>,
        'Lets the work start before the price is agreed. It can be a signed directive, or verbal / by email and noted here.')}

        {section('Ask for pricing (PCO)', canEdit ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
              {subs.map((s) => (
                <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.1)' }}>
                  <input type="checkbox" checked={!!pick[s.key]} onChange={(ev) => setPick((p) => ({ ...p, [s.key]: ev.target.checked }))} />
                  <span style={{ flex: 1, minWidth: 0 }}>{s.company}<span style={{ display: 'block', fontSize: 11, color: MUTED }}>{[s.subcontracts?.[0]?.number, s.email].filter(Boolean).join(' · ') || 'no email on file'}</span></span>
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.1)' }}>
                <input type="checkbox" checked={prime} onChange={(ev) => setPrime(ev.target.checked)} /> Our own price (prime)
              </label>
            </div>
            {!subs.length && <span style={{ fontSize: 12, color: MUTED }}>No subs on this project yet — add one below, or give them a subcontract first.</span>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><Label text="Another party" /><input value={extra.name} onChange={(ev) => setExtra({ ...extra, name: ev.target.value })} placeholder="Company" style={input} /></div>
              <div><Label text="Their email" /><input value={extra.email} onChange={(ev) => setExtra({ ...extra, email: ev.target.value })} placeholder="name@company.com" style={input} /></div>
            </div>
            <div><Label text="What to price" /><textarea rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} style={{ ...input, resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div><Label text="Price needed by" /><input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} style={input} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={emailIt} onChange={(ev) => setEmailIt(ev.target.checked)} /> Email the request to those with an address</label>
              <div style={{ flex: 1 }} />
              <div onClick={() => !busy && void sendPco()} style={btn(true, busy)}>Ask for pricing</div>
            </div>
          </div>
        ) : null, e.pcoSentAt ? `Asked ${fmtDate(e.pcoSentAt)}${e.pcoDue ? ` · due ${fmtDate(e.pcoDue)}` : ''}.` : 'Goes out like an RFP to the subs this change touches; each gets a COR waiting for their price.')}

        {section(`Change order requests (CORs) · ${e.cors.length}`, (
          <div style={{ display: 'grid', gap: 6 }}>
            {!e.cors.length && <span style={{ fontSize: 12.5, color: MUTED }}>None yet — ask for pricing above.</span>}
            {e.cors.map((c: any) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '24px 80px minmax(140px,1fr) 110px 90px 120px auto', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '7px 8px', borderRadius: 8, border: '1px solid rgba(var(--rgb-shade), 0.08)' }}>
                <input type="checkbox" aria-label={`Include ${c.number}`} disabled={c.status !== 'validated' || !!c.changeOrderId} checked={!!chosen[c.id]} onChange={(ev) => setChosen((p) => ({ ...p, [c.id]: ev.target.checked }))} />
                <b>{c.number}</b>
                <span style={{ minWidth: 0 }}>{c.partyName}{c.partyType === 'prime' && <span style={{ color: MUTED }}> (prime)</span>}<span style={{ display: 'block', fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.scope}</span></span>
                <span>{c.amount == null ? <span style={{ color: MUTED }}>no price yet</span> : usd(c.amount)}</span>
                <span style={{ color: MUTED }}>{c.scheduleImpactDays ? `+${c.scheduleImpactDays} d` : '—'}</span>
                <span>{c.changeOrderId ? <Badge tone="green">In PCCO</Badge> : tag(COR_STATUS, c.status)}</span>
                {canEdit && !c.changeOrderId ? (
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span onClick={() => setStep({ cor: c, mode: 'price' })} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>{c.amount == null ? 'Enter price' : 'Edit price'}</span>
                    {c.amount != null && c.status !== 'validated' && <span onClick={() => void run(() => api.finance.decideCor(c.id, 'validate'), `${c.number} validated`)} style={{ ...btn(true), padding: '4px 10px', fontSize: 11.5 }}>Validate</span>}
                    {c.status !== 'hold' && <span onClick={() => setStep({ cor: c, mode: 'hold' })} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>Hold</span>}
                    {c.status !== 'rejected' && <span onClick={() => setStep({ cor: c, mode: 'reject' })} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5, color: DANGER }}>Reject</span>}
                  </span>
                ) : <span />}
              </div>
            ))}
            {canEdit && validated.length > 0 && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: 6 }}>
                <span style={{ fontSize: 12.5, color: MUTED, flex: 1 }}>Tick the validated CORs to roll into one owner change order (PCCO). Each becomes a line at its cost plus your markup.</span>
                <div><Label text="Markup %" /><input type="number" min={0} value={markup} onChange={(ev) => setMarkup(ev.target.value)} placeholder="0" style={{ ...input, width: 90 }} /></div>
                <div onClick={() => picked.length && !busy && void makePcco()} style={btn(true, !picked.length || busy)}>Create PCCO from {picked.length || 'the ticked'} COR{picked.length === 1 ? '' : 's'}</div>
              </div>
            )}
          </div>
        ), 'Validated CORs go into the owner change order; held ones wait; rejected ones are out. Everyone sees the PCCO’s scope and time, not the subs’ costs.')}

        {(e.pccos?.length > 0 || e.ccos?.length > 0) && section('What came of it', (
          <div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
            {(e.pccos || []).map((p: any) => <div key={p.id}><b>{p.number}</b> {p.title} · {label([['draft', 'Draft'], ['internal_review', 'Internal review'], ['submitted', 'With the owner'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']], p.status)}{p.amount != null ? ` · ${usd(p.amount)}` : ''}</div>)}
            {(e.ccos || []).map((c: any) => <div key={c.id}><b>{c.number}</b> to {c.partyName} · {usd(c.amount)} · {(CCO_STATUS[c.status] || [c.status])[0]}</div>)}
          </div>
        ))}

        {canEdit && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {e.status !== 'closed' && <div onClick={() => void run(() => api.finance.updateChangeEvent(id, { status: 'closed', version: e.version }), 'Change event closed')} style={btn()}>Close event</div>}
            {e.status === 'closed' && <div onClick={() => void run(() => api.finance.updateChangeEvent(id, { status: 'open', version: e.version }), 'Reopened')} style={btn()}>Reopen</div>}
          </div>
        )}
      </div>

      {step === 'directive' && (
        <ReasonBox title="Record a change directive" confirm="Record" onCancel={() => setStep(null)}
          onSubmit={(v) => { setStep(null); void run(() => api.finance.directive(id, v), 'Directive recorded'); }}
          fields={[
            { key: 'type', label: 'Kind', required: true, initial: 'ccd', options: [['ccd', 'Construction change directive (CCD)'], ['dcd', 'Design change directive (DCD)']] },
            { key: 'method', label: 'Given', required: true, initial: 'signature', options: [['signature', 'Signed'], ['verbal', 'Verbally'], ['email', 'By email / text']] },
            { key: 'signer', label: 'Signed by (if signed)' },
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'note', label: 'Notes (who said what, a link to the email)', type: 'textarea' },
          ]} />
      )}
      {step && typeof step === 'object' && step.mode === 'price' && (
        <ReasonBox title={`${step.cor.number} · ${step.cor.partyName}: their price`} confirm="Save price" onCancel={() => setStep(null)}
          onSubmit={(v) => { const cor = step.cor; setStep(null); void run(() => api.finance.priceCor(cor.id, { amount: Number(v.amount), scheduleImpactDays: Number(v.days || 0), scope: v.scope }), 'Price saved'); }}
          fields={[
            { key: 'amount', label: 'Price (our cost; negative for a credit)', required: true, initial: step.cor.amount != null ? String(step.cor.amount) : '' },
            { key: 'days', label: 'Schedule impact (days)', initial: String(step.cor.scheduleImpactDays || 0) },
            { key: 'scope', label: 'Scope as they priced it', type: 'textarea', initial: step.cor.scope || '' },
          ]} />
      )}
      {step && typeof step === 'object' && step.mode !== 'price' && (
        <ReasonBox title={`${step.mode === 'hold' ? 'Hold' : 'Reject'} ${step.cor.number}`} confirm={step.mode === 'hold' ? 'Hold' : 'Reject'} tone={step.mode === 'reject' ? 'danger' : undefined} onCancel={() => setStep(null)}
          onSubmit={(v) => { const { cor, mode } = step; setStep(null); void run(() => api.finance.decideCor(cor.id, mode as 'hold' | 'reject', v.note)); }}
          fields={[{ key: 'note', label: 'Why', type: 'textarea', required: true }]} />
      )}
    </Drawer>
  );
}

function CcoList({ projectId, rights }: { projectId?: number; rights: Rights }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  const [step, setStep] = useState<null | { row: any; mode: 'sign' | 'void' }>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { api.finance.ccos(projectId).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, [projectId, tick]);
  const canEdit = !!rights.editChangeOrders;
  const act = async (id: string, action: 'send' | 'sign' | 'void', d: unknown = {}) => {
    try { await api.finance.actCco(id, action, d); setTick((n) => n + 1); toast(action === 'sign' ? 'Signed — added to their subcontract' : action === 'send' ? 'Marked sent' : 'Voided'); }
    catch (e) { failed(toast, e); }
  };
  const cols = projectId ? '90px minmax(160px,1.2fr) minmax(200px,2fr) 110px 120px 90px auto' : '90px minmax(120px,1fr) minmax(160px,1.2fr) minmax(200px,2fr) 110px 120px 90px auto';
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <span style={{ fontSize: 12.5, color: MUTED }}>Made when the owner approves a PCCO: one per sub in it. Each sub sees only its own. Signing adds the change to their subcontract.</span>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            <div style={headRow(cols)}><span>#</span>{!projectId && <span>Project</span>}<span>Sub</span><span>Scope</span><span>Amount</span><span>Status</span><span>From</span><span /></div>
            {rows === null && <div style={{ padding: 14 }}><Skeleton rows={3} label="Loading sub change orders…" /></div>}
            {rows && !rows.length && <div style={{ padding: 14, fontSize: 12.5, color: MUTED }}>None yet — they appear when an owner change order with sub CORs is approved.</div>}
            {(rows || []).map((c) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(var(--rgb-shade), .05)', fontSize: 12.5 }}>
                <b>{c.number}</b>{!projectId && <span style={{ color: MUTED }}>{c.projectName}</span>}
                <span>{c.partyName}</span>
                <span style={{ color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.scope}</span>
                <span>{usd(c.amount)}</span>
                <span>{tag(CCO_STATUS, c.status)}</span>
                <span style={{ color: MUTED }}>{c.pcco}</span>
                <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <span onClick={() => printCco(c)} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>Print</span>
                  {canEdit && c.status === 'draft' && <span onClick={() => void act(c.id, 'send')} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5 }}>Mark sent</span>}
                  {canEdit && (c.status === 'draft' || c.status === 'sent') && <span onClick={() => setStep({ row: c, mode: 'sign' })} style={{ ...btn(true), padding: '4px 10px', fontSize: 11.5 }}>Record signature</span>}
                  {canEdit && (c.status === 'draft' || c.status === 'sent') && <span onClick={() => setStep({ row: c, mode: 'void' })} style={{ ...btn(), padding: '4px 10px', fontSize: 11.5, color: DANGER }}>Void</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {step?.mode === 'sign' && (
        <ReasonBox title={`${step.row.number} · signed by ${step.row.partyName}`} confirm="Record signature" onCancel={() => setStep(null)}
          onSubmit={(v) => { const id = step.row.id; setStep(null); void act(id, 'sign', v); }}
          fields={[{ key: 'signer', label: 'Signed by', required: true }, { key: 'date', label: 'Date signed', type: 'date' }, { key: 'reference', label: 'Reference (e.g. their CO number)' }]} />
      )}
      {step?.mode === 'void' && (
        <ReasonBox title={`Void ${step.row.number}`} tone="danger" confirm="Void" onCancel={() => setStep(null)}
          onSubmit={(v) => { const id = step.row.id; setStep(null); void act(id, 'void', v); }} fields={[{ key: 'reason', label: 'Why', type: 'textarea', required: true }]} />
      )}
    </div>
  );
}

/** A printable sub change order: only this sub's scope, cost and time. */
function printCco(c: any) {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><title>${esc(c.number)}</title><body style="font:14px/1.5 Helvetica,Arial,sans-serif;max-width:720px;margin:40px auto;color:#111">
<h1 style="font-size:20px;margin:0 0 4px">Subcontract change order ${esc(c.number)}</h1>
<div style="color:#555">${esc(c.projectName || '')} · to ${esc(c.partyName)}</div>
<h3 style="margin:24px 0 6px">Scope</h3><div style="white-space:pre-wrap">${esc(c.scope || '')}</div>
<table style="margin-top:20px;border-collapse:collapse"><tr><td style="padding:4px 16px 4px 0;color:#555">Amount</td><td><b>${esc(usd(c.amount))}</b></td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#555">Schedule impact</td><td>${c.scheduleImpactDays ? esc(c.scheduleImpactDays) + ' days' : 'None'}</td></tr></table>
<div style="margin-top:48px;display:flex;gap:48px"><div style="flex:1;border-top:1px solid #999;padding-top:6px">Subcontractor signature &amp; date</div><div style="flex:1;border-top:1px solid #999;padding-top:6px">Origami signature &amp; date</div></div>
<script>window.print()</script></body>`);
  w.document.close();
}
