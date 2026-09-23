import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppContext';
import { Attachments } from './Attachments';
import { AddEmployeeDrawer, StatusPill, type Employee, type Trade } from './EmployeeDirectory';
import {
  ACCENT, BG, DANGER, INK, MUTED, Badge, Drawer, Label, bodyRow, btn, card, expiryLabel, expiryTone, fmtDate, headRow, input,
  type Assignment, type Contractor, type Project, type SubcontractorTrade,
} from './manpowerUi';
import { TradeChips, TradePicker, useSubcontractorTrades } from './SubcontractorTrades';

const STATUSES: [string, string, 'green' | 'amber' | 'grey'][] = [['active', 'Active', 'green'], ['suspended', 'Suspended', 'amber'], ['ended', 'Ended', 'grey']];
const statusBadge = (s: string) => { const m = STATUSES.find(([k]) => k === s) || STATUSES[0]; return <Badge tone={m[2]}>{m[1]}</Badge>; };
const ACCESS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  granted: { label: 'Site access granted', tone: 'green' }, pending: { label: 'Access pending', tone: 'amber' }, revoked: { label: 'Access revoked', tone: 'red' },
};

type FieldDef = [keyof Contractor, string, ('text' | 'date' | 'textarea')?];
const DETAIL_FIELDS: { title: string; fields: FieldDef[] }[] = [
  { title: 'Company', fields: [['companyName', 'Company name *'], ['contactPerson', 'Contact person'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address', 'textarea']] },
  { title: 'Contract', fields: [['contractNumber', 'Contract number'], ['contractStart', 'Contract start', 'date'], ['contractEnd', 'Contract end', 'date'], ['scopeOfWork', 'Scope of work', 'textarea'], ['agreedRates', 'Agreed rates', 'textarea']] },
  { title: 'Insurance', fields: [['insuranceProvider', 'Insurer'], ['insurancePolicyNumber', 'Policy number'], ['insuranceExpiry', 'Policy expiry', 'date']] },
  { title: 'Licence', fields: [['licenseNumber', 'Licence number'], ['licenseExpiry', 'Licence expiry', 'date']] },
];

function ContractorForm({ draft, patch, disabled, subTrades }: { draft: Partial<Contractor>; patch: (p: Partial<Contractor>) => void; disabled: boolean; subTrades: SubcontractorTrade[] }) {
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4 }}>Trades (licence classifications)</div>
        <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>What this company is licensed to do, e.g. C-10 Electrical.</div>
        <TradePicker trades={subTrades} value={draft.tradeIds || []} onChange={(tradeIds) => patch({ tradeIds })} disabled={disabled} />
      </div>
      {DETAIL_FIELDS.map((sec) => (
        <div key={sec.title} style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 10 }}>{sec.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {sec.fields.map(([k, label, kind]) => (
              <div key={k} style={kind === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                <Label text={label} />
                {kind === 'textarea'
                  ? <textarea disabled={disabled} value={(draft[k] as string) || ''} onChange={(e) => patch({ [k]: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} />
                  : <input disabled={disabled} type={kind === 'date' ? 'date' : 'text'} value={(draft[k] as string) || ''} onChange={(e) => patch({ [k]: e.target.value })} style={input} />}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div>
          <Label text="Status" />
          <select disabled={disabled} value={draft.status || 'active'} onChange={(e) => patch({ status: e.target.value })} style={input}>
            {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label text="Notes" />
          <textarea disabled={disabled} value={draft.notes || ''} onChange={(e) => patch({ notes: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} />
        </div>
      </div>
    </>
  );
}

export function Contractors({ employees, trades, projects, assignments, canManage, reloadEmployees, onOpenEmployee }: {
  employees: Employee[]; trades: Trade[]; projects: Project[]; assignments: Assignment[]; canManage: boolean;
  reloadEmployees: () => Promise<unknown> | void; onOpenEmployee: (id: string) => void;
}) {
  const [contractors, setContractors] = useState<Contractor[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [tradeFilter, setTradeFilter] = useState('');
  const { trades: subTrades } = useSubcontractorTrades();

  const load = () => api.contractors.list().then((r: any) => setContractors(Array.isArray(r) ? r : [])).catch(() => setContractors([]));
  useEffect(() => { load(); }, []);

  const all = contractors || [];
  const open = all.find((c) => c.id === openId);
  if (open) {
    return (
      <ContractorDetail contractor={open} subTrades={subTrades} employees={employees} trades={trades} projects={projects} assignments={assignments} canManage={canManage}
        onBack={() => setOpenId(null)} onChanged={load} reloadEmployees={reloadEmployees} onOpenEmployee={onOpenEmployee} />
    );
  }

  const q = query.trim().toLowerCase();
  const tradeText = (c: Contractor) => (c.tradeIds || []).map((id) => { const t = subTrades.find((x) => x.id === id); return t ? `${t.code} ${t.name}` : ''; }).join(' ');
  const shown = all.filter((c) => (!statusFilter || c.status === statusFilter) && (!tradeFilter || (c.tradeIds || []).includes(tradeFilter))
    && (!q || [c.companyName, c.contactPerson, c.contractNumber, c.licenseNumber, tradeText(c)].some((v) => (v || '').toLowerCase().includes(q))));
  const usedTrades = subTrades.filter((t) => all.some((c) => (c.tradeIds || []).includes(t.id)));
  const cols = 'minmax(190px,1.5fr) minmax(200px,1.5fr) 1fr 150px 140px 70px 90px';

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, contact, trade, licence…" style={{ ...input, width: 280 }} />
        <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} style={{ ...input, width: 'auto', maxWidth: 260 }}>
          <option value="">All trades</option>
          {usedTrades.map((t) => <option key={t.id} value={t.id}>{t.code} {t.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All statuses</option>
          {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span style={{ fontSize: 12, color: MUTED }}>{all.length} contractors · {employees.filter((e) => e.contractorId).length} contractor workers</span>
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={() => setAdding(true)} style={btn(true)}>+ Add contractor</div>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 1020 }}>
            <div style={headRow(cols)}><span>Company</span><span>Trades</span><span>Contact</span><span>Contract ends</span><span>Insurance</span><span>Workers</span><span>Status</span></div>
            {contractors === null && <div style={{ padding: 16, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {shown.map((c) => (
              <div key={c.id} onClick={() => setOpenId(c.id)} style={{ ...bodyRow(cols), cursor: 'pointer' }}>
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{c.companyName}</div>
                  {c.contractNumber && <div style={{ fontSize: 11, color: MUTED }}>Contract {c.contractNumber}</div>}
                </span>
                <TradeChips trades={subTrades} ids={c.tradeIds} />
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>{c.contactPerson || '—'}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>{c.phone || c.email || ''}</div>
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12 }}>{fmtDate(c.contractEnd)}</span>
                  {c.contractStatus === 'expired' || c.contractStatus === 'expiring' ? <Badge tone={expiryTone(c.contractStatus)}>{expiryLabel(c.contractStatus)}</Badge> : null}
                </span>
                <span><Badge tone={expiryTone(c.insuranceStatus)}>{c.insuranceStatus === 'none' ? 'Not on file' : expiryLabel(c.insuranceStatus)}</Badge></span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{c.workerCount}</span>
                <span>{statusBadge(c.status)}</span>
              </div>
            ))}
            {contractors && !shown.length && (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
                {all.length ? 'No contractors match these filters.' : 'No contractors yet — add the subcontractors and labour suppliers who send workers to your sites.'}
              </div>
            )}
          </div>
        </div>
      </div>
      {adding && <AddContractorDrawer subTrades={subTrades} onClose={() => setAdding(false)} onCreated={async (c) => { setAdding(false); await load(); setOpenId(c.id); }} />}
    </div>
  );
}

function AddContractorDrawer({ subTrades, onClose, onCreated }: { subTrades: SubcontractorTrade[]; onClose: () => void; onCreated: (c: Contractor) => void }) {
  const { toast } = useApp();
  const [draft, setDraft] = useState<Partial<Contractor>>({ status: 'active', tradeIds: [] });
  const [subs, setSubs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.people.list().then((r: any) => setSubs(Array.isArray(r) ? r.filter((p: any) => p.kind === 'Sub') : [])).catch(() => {});
  }, []);

  const fromPerson = (id: string) => {
    const p = subs.find((x) => String(x.id) === id);
    if (!p) { setDraft((d) => ({ ...d, personId: undefined })); return; }
    setDraft((d) => ({ ...d, personId: p.id, companyName: p.company || p.name, contactPerson: p.contact || p.name, phone: p.phone, email: p.email }));
  };

  const create = async () => {
    if (!draft.companyName?.trim()) { toast('⚠ Company name is required'); return; }
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '' && v != null));
      const c = await api.contractors.create(clean) as Contractor;
      toast(`${c.companyName} added`);
      onCreated(c);
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not add the contractor')); }
    finally { setSaving(false); }
  };

  return (
    <Drawer title="Add contractor" subtitle="A subcontractor or labour supplier. Its workers get the same profiles, documents and deployment as your own staff."
      onClose={onClose}
      footer={<><div onClick={onClose} style={btn()}>Cancel</div><div onClick={saving ? undefined : create} style={btn(true, saving)}>{saving ? 'Adding…' : 'Add contractor'}</div></>}
    >
      {subs.length > 0 && (
        <div style={{ marginBottom: 18, padding: 12, borderRadius: 10, background: '#F7F3EA' }}>
          <Label text="Start from the People directory (optional)" />
          <select value={draft.personId ?? ''} onChange={(e) => fromPerson(e.target.value)} style={input}>
            <option value="">— New company —</option>
            {subs.map((p) => <option key={p.id} value={p.id}>{p.company || p.name}{p.company && p.name ? ` · ${p.name}` : ''}</option>)}
          </select>
        </div>
      )}
      <ContractorForm draft={draft} patch={(p) => setDraft((d) => ({ ...d, ...p }))} disabled={false} subTrades={subTrades} />
    </Drawer>
  );
}

function ContractorDetail({ contractor, subTrades, employees, trades, projects, assignments, canManage, onBack, onChanged, reloadEmployees, onOpenEmployee }: {
  contractor: Contractor; subTrades: SubcontractorTrade[]; employees: Employee[]; trades: Trade[]; projects: Project[]; assignments: Assignment[]; canManage: boolean;
  onBack: () => void; onChanged: () => Promise<unknown>; reloadEmployees: () => Promise<unknown> | void; onOpenEmployee: (id: string) => void;
}) {
  const { toast } = useApp();
  const [draft, setDraft] = useState<Partial<Contractor>>(contractor);
  const [saving, setSaving] = useState(false);
  const [addingWorker, setAddingWorker] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => setDraft(contractor), [contractor]);
  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => {}); }, []);

  const keys = DETAIL_FIELDS.flatMap((s) => s.fields.map((f) => f[0])).concat(['status', 'notes'] as (keyof Contractor)[]);
  const sameTrades = JSON.stringify(draft.tradeIds || []) === JSON.stringify(contractor.tradeIds || []);
  const dirty = !sameTrades || keys.some((k) => (draft[k] ?? '') !== (contractor[k] ?? ''));
  const workers = employees.filter((e) => e.contractorId === contractor.id);
  const currentOf = (id: string) => assignments.find((a) => a.current && a.employeeId === id && a.assignmentType === 'regular');
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
  const tradeName = (e: Employee) => trades.find((t) => t.id === e.tradeId)?.name || e.trade || '—';

  const save = async () => {
    if (!draft.companyName?.trim()) { toast('⚠ Company name is required'); return; }
    setSaving(true);
    try {
      await api.contractors.update(contractor.id, { ...Object.fromEntries(keys.map((k) => [k, draft[k] ?? ''])), tradeIds: draft.tradeIds || [] });
      await onChanged();
      toast('Saved');
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not save')); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!confirm(`Delete ${contractor.companyName}?`)) return;
    try { await api.contractors.remove(contractor.id); await onChanged(); onBack(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not delete')); }
  };
  const setAccess = async (e: Employee, siteAccessStatus: string) => {
    try { await api.employees.update(e.id, { siteAccessStatus }); await reloadEmployees(); }
    catch (err: any) { toast('⚠ ' + (err.message || 'Could not update access')); }
  };

  const cols = 'minmax(170px,1.4fr) 1fr 1.2fr 110px 170px';

  return (
    <div>
      <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: ACCENT, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>← All contractors</div>
      <div style={{ ...card, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: BG, fontSize: 22, fontWeight: 700, color: INK }}>{contractor.companyName}</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{[contractor.contactPerson, contractor.phone, contractor.contractNumber && `Contract ${contractor.contractNumber}`].filter(Boolean).join(' · ') || 'No contact details yet'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {statusBadge(contractor.status)}
            {contractor.contractEnd && <Badge tone={expiryTone(contractor.contractStatus)}>Contract {contractor.contractStatus === 'expired' ? 'expired' : `to ${fmtDate(contractor.contractEnd)}`}</Badge>}
            <Badge tone={expiryTone(contractor.insuranceStatus)}>Insurance: {contractor.insuranceStatus === 'none' ? 'not on file' : expiryLabel(contractor.insuranceStatus).toLowerCase()}</Badge>
            <Badge tone={expiryTone(contractor.licenseStatus)}>Licence: {contractor.licenseStatus === 'none' ? 'not on file' : expiryLabel(contractor.licenseStatus).toLowerCase()}</Badge>
          </div>
          {(contractor.tradeIds || []).length > 0 && <div style={{ marginTop: 8 }}><TradeChips trades={subTrades} ids={contractor.tradeIds} max={8} /></div>}
        </div>
        {canManage && <div onClick={remove} style={{ ...btn(), color: DANGER }}>Delete</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 10px' }}>
        <div style={{ fontFamily: BG, fontSize: 15, fontWeight: 700, color: INK, flex: 1 }}>Workers <span style={{ fontSize: 12, color: MUTED, fontFamily: 'inherit' }}>{workers.length}</span></div>
        {canManage && <div onClick={() => setAddingWorker(true)} style={btn(true)}>+ Add worker</div>}
      </div>
      <div style={{ ...card, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={headRow(cols)}><span>Worker</span><span>Trade</span><span>Current project</span><span>Status</span><span>Site access</span></div>
            {workers.map((e) => {
              const a = currentOf(e.id);
              return (
                <div key={e.id} style={bodyRow(cols)}>
                  <span onClick={() => onOpenEmployee(e.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{e.workerId}{e.payRate != null ? ` · rate ${e.payRate}` : ''}</div>
                  </span>
                  <span style={{ fontSize: 12.5 }}>{tradeName(e)}</span>
                  <span style={{ fontSize: 12.5 }}>{a ? `${projectName(a.projectId)}${a.workArea ? ` · ${a.workArea}` : ''}` : <span style={{ color: MUTED }}>Not deployed</span>}</span>
                  <span><StatusPill status={e.employmentStatus || 'active'} /></span>
                  <span>
                    {canManage ? (
                      <select value={e.siteAccessStatus || 'pending'} onChange={(ev) => setAccess(e, ev.target.value)} style={{ ...input, padding: '5px 8px', fontSize: 12 }}>
                        <option value="pending">Access pending</option><option value="granted">Access granted</option><option value="revoked">Access revoked</option>
                      </select>
                    ) : <Badge tone={(ACCESS[e.siteAccessStatus || 'pending'] || ACCESS.pending).tone}>{(ACCESS[e.siteAccessStatus || 'pending'] || ACCESS.pending).label}</Badge>}
                  </span>
                </div>
              );
            })}
            {!workers.length && <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>No workers from this contractor yet.</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, alignItems: 'start' }}>
        <div style={{ ...card, padding: '18px 20px' }}>
          <ContractorForm draft={draft} patch={(p) => setDraft((d) => ({ ...d, ...p }))} disabled={!canManage} subTrades={subTrades} />
          {canManage && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={saving || !dirty ? undefined : save} style={btn(dirty, saving || !dirty)}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</div>
              {dirty && <div onClick={() => setDraft(contractor)} style={btn()}>Discard</div>}
            </div>
          )}
        </div>
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 }}>Documents</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Contract, insurance certificate, trade licence…</div>
          <Attachments
            scope="contractors" taskId={contractor.id} attachments={contractor.attachments} canManage={canManage} storageReady={storageReady}
            onUpload={async (files) => { await api.contractors.uploadAttachments(contractor.id, files); await onChanged(); }}
            onRemove={async (att) => { await api.contractors.removeAttachment(contractor.id, att.id); await onChanged(); }}
            onAddLink={async (name, url) => { await api.contractors.addLink(contractor.id, name, url); await onChanged(); }}
          />
        </div>
      </div>

      {addingWorker && (
        <AddEmployeeDrawer
          employees={employees} trades={trades} contractors={[contractor]}
          title={`Add worker — ${contractor.companyName}`}
          defaults={{ employmentType: 'contractor_worker', contractorId: contractor.id, siteAccessStatus: 'pending', payType: 'daily' }}
          onClose={() => setAddingWorker(false)}
          onCreated={async (emp) => { setAddingWorker(false); await reloadEmployees(); await onChanged(); onOpenEmployee(emp.id); }}
        />
      )}
    </div>
  );
}
