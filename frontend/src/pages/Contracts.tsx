import { OpenedBadge } from '../components/OpenedBadge';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../AppContext';
import { RichTextEditor } from '../components/RichTextEditor';
import { ContractSigner } from '../components/ContractSigner';
import {
  ATTACH_KINDS, CONTRACT_TYPES, STATUS_LABEL, STATUS_TONE, sanitizeHtml, typeLabel, waitingOn,
  type Contract, type ContractAttachment, type ContractParty, type ContractTemplate, type ContractType,
} from '../data/contracts';

const BG = 'var(--font-display)';
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(var(--rgb-shade), 0.14)', background: 'var(--surface)', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 };
const btn = (primary = false, danger = false): React.CSSProperties => ({ padding: '8px 15px', borderRadius: 999, border: primary ? 0 : `1px solid ${danger ? 'rgba(142,46,10,0.3)' : 'rgba(var(--rgb-shade), 0.14)'}`, background: primary ? 'var(--forest)' : 'var(--surface)', color: primary ? '#fff' : danger ? '#8E2E0A' : 'var(--ink)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' });
const day = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const Badge = ({ s }: { s: Contract['status'] }) => <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: STATUS_TONE[s].bg, color: STATUS_TONE[s].c, whiteSpace: 'nowrap' }}>{STATUS_LABEL[s]}</span>;
const openBlob = (b: Blob, name: string, download = false) => {
  const url = URL.createObjectURL(b);
  if (download) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); } else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * Contracts (Oct 27 backlog: "Contracts for Services"): GC, owner, sub and
 * consultant contracts and change orders, drafted from templates, signed in
 * ODIN (initials and signature), counter-signed by Origami, filed as a PDF.
 */
export function Contracts() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Contract[] | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [f, setF] = useState({ projectId: params.get('project') || '', type: '', status: '' });
  const [creating, setCreating] = useState(false);
  const openId = params.get('contract');
  const reload = () => {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) if (v) q[k] = v;
    api.contracts.list(q).then(setRows).catch((e: Error) => { setRows([]); toast('⚠ ' + e.message); });
  };
  useEffect(reload, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.projects.list().then((r: any) => setProjects((Array.isArray(r) ? r : []).map((p: any) => ({ id: p.id, name: p.name })))).catch(() => undefined); }, []);
  const open = (id: string | null) => { const next = new URLSearchParams(params); if (id) next.set('contract', id); else next.delete('contract'); setParams(next, { replace: true }); };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <h1 style={{ fontFamily: BG, fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Contracts</h1>
          <div style={{ fontSize: 13, color: 'var(--body)', marginTop: 4 }}>Drafted from templates, initialled and signed in ODIN, counter-signed by Origami, filed in the project’s File Room.</div>
        </div>
        <button type="button" style={btn(true)} onClick={() => setCreating(true)}>+ New contract</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="Project" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} style={{ ...input, width: 220 }}><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select aria-label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} style={{ ...input, width: 220 }}><option value="">Every type</option>{CONTRACT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
        <select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={{ ...input, width: 200 }}><option value="">Any status</option>{(Object.keys(STATUS_LABEL) as Contract['status'][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {rows === null && <div style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
        {rows && !rows.length && <div style={{ padding: 18, fontSize: 13, color: 'var(--muted)' }}>No contracts yet. Start one with “New contract”.</div>}
        {(rows || []).map((c) => (
          <button type="button" key={c.id} onClick={() => open(c.id)} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', width: '100%', padding: '12px 16px', border: 0, borderTop: '1px solid var(--border)', background: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }}>
            <span style={{ width: 110, fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{c.number}</span>
            <span style={{ flex: '1 1 240px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{c.title}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{[typeLabel(c.type), c.projectName, c.amount].filter(Boolean).join(' · ')}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--body)' }}>{c.status === 'signed' ? `Signed ${day(c.signedAt)}` : waitingOn(c)}</span>
            <Badge s={c.status} />
          </button>
        ))}
      </div>
      {creating && <NewContract projects={projects} defaultProject={f.projectId} onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); reload(); open(c.id); }} />}
      {openId && <ContractDrawer id={openId} onClose={() => open(null)} onChanged={reload} />}
    </div>
  );
}

function Drawer({ title, onClose, children, width = 760 }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; width?: number }) {
  // Portalled: a transformed ancestor would otherwise trap the fixed overlay inside the page.
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--rgb-shade), 0.45)', zIndex: 140, display: 'flex', justifyContent: 'flex-end' }}>
      <div role="dialog" onClick={(e) => e.stopPropagation()} style={{ width, maxWidth: '100vw', height: '100%', background: 'var(--surface)', overflowY: 'auto', boxShadow: '-18px 0 48px rgba(var(--rgb-shade), 0.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{title}</div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'grid', gap: 18 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ new

function NewContract({ projects, defaultProject, onClose, onCreated }: { projects: { id: number; name: string }[]; defaultProject: string; onClose: () => void; onCreated: (c: Contract) => void }) {
  const { toast, users, authUser } = useApp();
  const [type, setType] = useState<ContractType>('owner');
  const [projectId, setProjectId] = useState(defaultProject);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [people, setPeople] = useState<{ id: number; name: string; email: string; company: string; kind: string; contact?: string }[]>([]);
  const [party, setParty] = useState({ personId: '', name: '', email: '' });
  const [signer, setSigner] = useState({ name: authUser?.name || '', email: authUser?.email || '' });
  const [amount, setAmount] = useState('');
  const [links, setLinks] = useState<{ changeOrders: { id: string; number: string; title: string; amount: number | null }[]; commitments: { id: string; number: string; title: string; vendorName: string }[] }>({ changeOrders: [], commitments: [] });
  const [changeOrderId, setChangeOrderId] = useState('');
  const [commitmentId, setCommitmentId] = useState('');
  const [busy, setBusy] = useState(false);
  const info = CONTRACT_TYPES.find((t) => t.key === type)!;
  useEffect(() => { api.contracts.templates().then(setTemplates).catch(() => undefined); api.people.list().then((r: any) => setPeople(Array.isArray(r) ? r : [])).catch(() => undefined); }, []);
  useEffect(() => { if (projectId) api.contracts.links(Number(projectId)).then(setLinks).catch(() => setLinks({ changeOrders: [], commitments: [] })); else setLinks({ changeOrders: [], commitments: [] }); }, [projectId]);
  const forType = templates.filter((t) => t.type === type);
  useEffect(() => { setTemplateId((forType.find((t) => t.isDefault) || forType[0])?.id || ''); }, [type, templates]); // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = info.counterparty === 'owner' ? ['Client'] : info.counterparty === 'sub' ? ['Sub', 'Vendor'] : ['Consultant'];
  const choices = people.filter((p) => kinds.includes(p.kind));
  const needsCo = type === 'co_owner' || type === 'co_sub';
  const needsSc = type === 'sub' || type === 'co_sub';
  const create = async () => {
    if (!party.name.trim()) { toast(`⚠ Who signs as the ${info.counterpartyLabel.toLowerCase()}?`); return; }
    setBusy(true);
    try {
      const c = await api.contracts.create({
        type, projectId: projectId ? Number(projectId) : null, templateId: templateId || undefined, amount, changeOrderId: changeOrderId || null, commitmentId: commitmentId || null,
        parties: [
          { role: info.counterparty, label: info.counterpartyLabel, name: party.name, email: party.email, personId: party.personId ? Number(party.personId) : null },
          { role: 'origami', label: 'Origami Design + Build', name: signer.name, email: signer.email, internal: true },
        ],
      });
      onCreated(c);
    } catch (e) { toast('⚠ ' + (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Drawer title={<div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700 }}>New contract</div>} onClose={onClose} width={620}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label><span style={lbl}>Type</span><select value={type} onChange={(e) => setType(e.target.value as ContractType)} style={input}>{CONTRACT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
        <label><span style={lbl}>Template</span><select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={input}>{forType.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label><span style={lbl}>Project</span><select value={projectId} onChange={(e) => { setProjectId(e.target.value); setChangeOrderId(''); setCommitmentId(''); }} style={input}><option value="">— None —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label><span style={lbl}>Amount</span><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={needsCo ? 'From the change order if blank' : 'e.g. $812,000'} style={input} /></label>
        {needsCo && <label><span style={lbl}>Change order</span><select value={changeOrderId} onChange={(e) => setChangeOrderId(e.target.value)} style={input} disabled={!projectId}><option value="">{projectId ? 'Pick one…' : 'Pick a project first'}</option>{links.changeOrders.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.title}</option>)}</select></label>}
        {needsSc && <label><span style={lbl}>Subcontract / PO</span><select value={commitmentId} onChange={(e) => setCommitmentId(e.target.value)} style={input} disabled={!projectId}><option value="">{projectId ? 'Pick one (optional)…' : 'Pick a project first'}</option>{links.commitments.map((c) => <option key={c.id} value={c.id}>{c.number} — {c.vendorName} · {c.title}</option>)}</select></label>}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Signs for the {info.counterpartyLabel.toLowerCase()}</div>
        <select aria-label={`${info.counterpartyLabel} from People`} value={party.personId} onChange={(e) => { const p = choices.find((x) => String(x.id) === e.target.value); setParty(p ? { personId: String(p.id), name: info.counterparty === 'owner' ? p.name : p.contact || p.name, email: p.email === '—' ? '' : p.email } : { personId: '', name: party.name, email: party.email }); }} style={input}>
          <option value="">Pick from People, or type below…</option>
          {choices.map((p) => <option key={p.id} value={p.id}>{p.name}{p.company && p.company !== p.name ? ` · ${p.company}` : ''}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <input aria-label="Signer name" placeholder="Name of the person signing" value={party.name} onChange={(e) => setParty({ ...party, name: e.target.value })} style={input} />
          <input aria-label="Signer email" type="email" placeholder="Their email (the signing link goes here)" value={party.email} onChange={(e) => setParty({ ...party, email: e.target.value })} style={input} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 6 }}>Signs for Origami (last, in ODIN)</div>
        <select aria-label="Origami signer" value={users.find((u) => u.name === signer.name)?.id || ''} onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (u) setSigner({ name: u.name, email: u.email }); }} style={input}>
          <option value="">{signer.name || 'Pick someone…'}</option>
          {users.filter((u) => u.tier === 'internal').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" style={btn(true)} disabled={busy} onClick={() => void create()}>{busy ? 'Drafting…' : 'Create draft'}</button>
        <button type="button" style={btn()} onClick={onClose}>Cancel</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>The draft is filled in from the template, the project, the people and the change order. You can edit the wording, add more signers and attach the estimate, drawings and specs before sending.</div>
    </Drawer>
  );
}

// ------------------------------------------------------------------ one contract

function ContractDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { toast } = useApp();
  const [c, setC] = useState<Contract | null>(null);
  const [draft, setDraft] = useState<{ title: string; amount: string; html: string; parties: ContractParty[]; attachments: ContractAttachment[] } | null>(null);
  const [files, setFiles] = useState<{ id: string; name: string; folderPath: string[] }[]>([]);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = () => api.contracts.get(id).then((r) => { setC(r); setDraft({ title: r.title, amount: r.amount || '', html: r.html || '', parties: r.parties, attachments: r.attachments || [] }); }).catch((e: Error) => toast('⚠ ' + e.message));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (c?.projectId) api.contracts.files(c.projectId).then(setFiles).catch(() => setFiles([])); }, [c?.projectId]);
  const isDraft = c?.status === 'draft';
  const dirty = useMemo(() => !!c && !!draft && (draft.title !== c.title || draft.amount !== (c.amount || '') || draft.html !== (c.html || '') || JSON.stringify(draft.parties) !== JSON.stringify(c.parties) || JSON.stringify(draft.attachments) !== JSON.stringify(c.attachments || [])), [c, draft]);
  if (!c || !draft) return <Drawer title="Contract" onClose={onClose}><div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div></Drawer>;

  const run = async (label: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(label);
    try { await fn(); toast(ok); await load(); onChanged(); } catch (e) { toast('⚠ ' + (e as Error).message); } finally { setBusy(''); }
  };
  const save = (remerge = false) => run('save', () => api.contracts.update(c.id, { ...draft, remerge }), remerge ? 'Fields filled in again' : 'Draft saved');
  const send = () => run('send', async () => { if (dirty) await api.contracts.update(c.id, draft); const r = await api.contracts.send(c.id, {}); if (!r.sent.length) throw new Error('Nobody left to send it to.'); }, 'Sent for signature');
  const resend = (key: string) => run('send', () => api.contracts.send(c.id, { resendKeys: [key] }), 'Link sent again');
  const pdf = (download: boolean) => run('pdf', async () => openBlob(await api.contracts.pdf(c.id), `${c.number} ${c.title}.pdf`, download), download ? 'Downloaded' : 'Opened');
  const voidIt = () => { const r = window.prompt('Why is this contract being voided?'); if (r?.trim()) void run('void', () => api.contracts.void(c.id, r.trim()), 'Voided'); };
  const del = () => { if (confirm('Delete this draft?')) void run('del', () => api.contracts.remove(c.id), 'Draft deleted').then(onClose); };
  const setParty = (i: number, p: Partial<ContractParty>) => setDraft({ ...draft, parties: draft.parties.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const unattached = files.filter((fl) => !draft.attachments.some((a) => a.fileId === fl.id));

  return (
    <Drawer onClose={onClose} title={
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.number} · {typeLabel(c.type)}{c.projectName ? ` · ${c.projectName}` : ''}</div>
        {isDraft ? <input aria-label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...input, fontFamily: BG, fontSize: 18, fontWeight: 700 }} /> : <div style={{ fontFamily: BG, fontSize: 20, fontWeight: 700 }}>{c.title}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Badge s={c.status} /><span style={{ fontSize: 12, color: 'var(--body)' }}>{c.status === 'signed' ? `Signed ${day(c.signedAt)}` : c.status === 'void' ? `Voided — ${c.voidReason}` : waitingOn(c)}</span></div>
      </div>
    }>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isDraft && <button type="button" style={btn(true)} disabled={!!busy} onClick={() => void send()}>{busy === 'send' ? 'Sending…' : 'Send for signature'}</button>}
        {isDraft && dirty && <button type="button" style={btn()} disabled={!!busy} onClick={() => void save()}>Save draft</button>}
        {c.status === 'countersign' && <button type="button" style={btn(true)} onClick={() => setSigning(true)}>Sign for Origami</button>}
        <button type="button" style={btn()} disabled={!!busy} onClick={() => void pdf(false)}>{c.status === 'signed' ? 'View signed PDF' : 'Preview PDF'}</button>
        {c.status === 'signed' && <button type="button" style={btn()} disabled={!!busy} onClick={() => void pdf(true)}>Download</button>}
        {c.status !== 'signed' && c.status !== 'void' && !isDraft && <button type="button" style={btn(false, true)} onClick={voidIt}>Void</button>}
        {isDraft && <button type="button" style={btn(false, true)} onClick={del}>Delete draft</button>}
      </div>
      {c.status === 'signed' && <div style={{ fontSize: 12.5, color: 'var(--success-deep)' }}>{c.signedFileId ? 'The signed PDF is in the project’s File Room, in Contracts.' : c.projectId ? 'The signed PDF couldn’t be filed (is Google connected?) — download it above.' : 'Download the signed PDF above.'}{c.type === 'co_owner' && c.changeOrderId ? ' The change order is marked approved by the owner.' : ''}</div>}

      {/* Parties */}
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Signers</div>
        {draft.parties.map((p, i) => (
          <div key={p.key} style={{ display: 'grid', gridTemplateColumns: isDraft ? 'minmax(110px, 0.8fr) 1fr 1.2fr auto' : '1fr auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: 'var(--panel)' }}>
            {isDraft ? <>
              <input aria-label="Signs as" value={p.label} onChange={(e) => setParty(i, { label: e.target.value })} style={input} />
              <input aria-label="Name" value={p.name} onChange={(e) => setParty(i, { name: e.target.value })} style={input} />
              {p.internal ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Signs last, in ODIN</span> : <input aria-label="Email" type="email" value={p.email} onChange={(e) => setParty(i, { email: e.target.value })} style={input} />}
              {!p.internal && draft.parties.filter((x) => !x.internal).length > 1 ? <button type="button" aria-label={`Remove ${p.label}`} onClick={() => setDraft({ ...draft, parties: draft.parties.filter((_, j) => j !== i) })} style={{ border: 0, background: 'transparent', color: '#8E2E0A', cursor: 'pointer' }}>×</button> : <span />}
            </> : <>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}><b>{p.label}</b> · {p.signedName || p.name}{!p.internal && p.email ? <span style={{ color: 'var(--muted)' }}> · {p.email}</span> : null}</span>
              <span style={{ fontSize: 12, color: p.signedAt ? 'var(--success-deep)' : 'var(--body)', display: 'flex', gap: 10, alignItems: 'center' }}>
                {p.signedAt ? `Signed ${day(p.signedAt)}` : p.internal ? 'Signs last' : p.sentAt ? <>{`Sent ${day(p.sentAt)}`} <OpenedBadge compact opened={{ firstOpenedAt: p.viewedAt, lastOpenedAt: p.lastViewedAt, opens: p.views ?? (p.viewedAt ? 1 : 0) }} /></> : 'Not sent'}
                {!p.internal && !p.signedAt && c.status !== 'void' && <button type="button" onClick={() => void resend(p.key)} style={{ border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>Resend</button>}
              </span>
            </>}
          </div>
        ))}
        {isDraft && <button type="button" style={{ ...btn(), justifySelf: 'start' }} onClick={() => setDraft({ ...draft, parties: [...draft.parties.filter((p) => !p.internal), { key: `p${Date.now()}`, role: 'other', label: 'Second owner', name: '', email: '' }, ...draft.parties.filter((p) => p.internal)] })}>+ Add a signer</button>}
      </section>

      {/* Attachments */}
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Attached — estimate, drawings, specs</div>
        {draft.attachments.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{c.projectId ? 'Nothing attached.' : 'Pick a project to attach its files.'}</div>}
        {draft.attachments.map((a) => (
          <div key={a.fileId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '6px 10px', borderRadius: 8, background: 'var(--panel)' }}>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{a.name}</span>
            {isDraft ? <select aria-label={`Kind of ${a.name}`} value={a.kind} onChange={(e) => setDraft({ ...draft, attachments: draft.attachments.map((x) => (x.fileId === a.fileId ? { ...x, kind: e.target.value as ContractAttachment['kind'] } : x)) })} style={{ ...input, width: 120, padding: '5px 8px' }}>{ATTACH_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select> : <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ATTACH_KINDS.find(([k]) => k === a.kind)?.[1]}</span>}
            {isDraft && <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setDraft({ ...draft, attachments: draft.attachments.filter((x) => x.fileId !== a.fileId) })} style={{ border: 0, background: 'transparent', color: '#8E2E0A', cursor: 'pointer' }}>×</button>}
          </div>
        ))}
        {isDraft && c.projectId && unattached.length > 0 && (
          <select aria-label="Attach a File Room file" value="" onChange={(e) => { const fl = files.find((x) => x.id === e.target.value); if (fl) setDraft({ ...draft, attachments: [...draft.attachments, { fileId: fl.id, name: fl.name, kind: /estimate|quote|bid/i.test(fl.name) ? 'estimate' : /spec/i.test(fl.name) ? 'specs' : /\.(pdf|dwg)$/i.test(fl.name) ? 'drawings' : 'other' }] }); }} style={{ ...input, maxWidth: 420 }}>
            <option value="">+ Attach a file from the File Room…</option>
            {unattached.map((fl) => <option key={fl.id} value={fl.id}>{[...fl.folderPath, fl.name].join(' / ')}</option>)}
          </select>
        )}
      </section>

      {/* Document */}
      <section style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>The contract</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.initialsNeeded ?? 0} initial box{c.initialsNeeded === 1 ? '' : 'es'}{isDraft ? ' · type {{initials}} where each signer must initial' : ''}</span>
          {isDraft && <label style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--body)', display: 'flex', gap: 6, alignItems: 'center' }}>Amount <input value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} style={{ ...input, width: 140, padding: '5px 8px' }} /></label>}
        </div>
        {isDraft && (c.unfilled || []).length > 0 && (
          <div role="alert" style={{ padding: '9px 12px', borderRadius: 9, background: '#FFF6E5', border: '1px solid #F1D29A', fontSize: 12.5, color: '#7A4A0B', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}>Still to fill in: {(c.unfilled || []).map((x) => `{{${x}}}`).join(', ')} — type the text in, or fix the project / people and</span>
            <button type="button" style={btn()} onClick={() => void save(true)}>fill fields again</button>
          </div>
        )}
        {isDraft
          ? <RichTextEditor value={draft.html} onChange={(html) => setDraft((d) => (d ? { ...d, html } : d))} minHeight={420} />
          : <div style={{ background: '#fff', color: '#1d1d1b', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', fontSize: 13.5, lineHeight: 1.6, maxHeight: 520, overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.html || '').replace(/\{\{\s*initials\s*\}\}/g, '<span style="display:inline-block;padding:2px 8px;border:1px dashed #B45309;border-radius:6px;font-size:11px;color:#7A4A0B;">Initials</span>') }} />}
      </section>

      {signing && c.status === 'countersign' && createPortal(
        <div onClick={() => setSigning(false)} style={{ position: 'fixed', inset: 0, zIndex: 160, background: 'rgba(var(--rgb-shade), 0.5)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div role="dialog" aria-label="Sign for Origami" onClick={(e) => e.stopPropagation()} style={{ width: 'min(820px, 100%)', maxHeight: '94vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 16, padding: 22, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ flex: 1, fontFamily: BG, fontSize: 19, fontWeight: 700 }}>Sign for Origami — {c.number}</div><button type="button" aria-label="Close" onClick={() => setSigning(false)} style={{ border: 0, background: 'transparent', fontSize: 20, color: 'var(--muted)', cursor: 'pointer' }}>×</button></div>
            {(() => { const me = c.parties.find((p) => p.internal && !p.signedAt); return (
              <ContractSigner html={c.html || ''} defaultName={me?.name || ''} defaultInitials={(me?.name || '').split(/\s+/).map((w) => w[0] || '').join('').toUpperCase()} busy={busy === 'sign'} error={err} submitLabel="Sign and complete"
                onSubmit={(d) => { setBusy('sign'); setErr(''); api.contracts.countersign(c.id, d).then(() => { setSigning(false); toast('Signed — the contract is complete'); void load(); onChanged(); }).catch((e: Error) => setErr(e.message)).finally(() => setBusy('')); }} />
            ); })()}
          </div>
        </div>,
        document.body,
      )}
    </Drawer>
  );
}
