import { useEffect, useMemo, useRef, useState } from 'react';
import { usePicklists } from '../data/picklists';
import { PickMany, PickOne } from './PicklistInputs';
import { api } from '../api';
import { SaveBar, useAutosave } from '../autosave';
import { DirectoryAccessCard, LoginCard } from './StaffAccessCards';
import { useApp } from '../AppContext';
import { Attachments } from './Attachments';
import type { Attachment } from '../data/projectTasks';
import { EmployeeDeploymentPanel } from './Deployment';
import { todayISO, US_STATES, type Assignment, type Contractor, type PayrollSettings, type Project } from './manpowerUi';
import { EmployeePayPanel } from './Payroll';
import { OvertimePanel } from './Overtime';
import { AdvancesPanel } from './Advances';
import { EmployeeLeavePanel } from './Leave';
import { EmployeeShiftPanel } from './Shifts';
import { EmployeeAssetsPanel } from './Assets';
import { EmployeeHousingCard } from './Accommodation';
import { EmployeeTransportCard } from './Transport';

const BG = "'Bricolage Grotesque', serif";
const INK = '#0B1A12';
const MUTED = '#7E9B93';
const ACCENT = '#173326';
const ACCENT_BG = '#DCE7DE';
const LINE = 'rgba(20,8,31,.09)';

const input: React.CSSProperties = {
  boxSizing: 'border-box', width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid rgba(20,8,31,0.13)', background: 'white', fontFamily: 'inherit',
  fontSize: 13, color: INK, outline: 'none',
};
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 999,
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  background: primary ? ACCENT : '#fff', color: primary ? '#fff' : ACCENT,
  border: '1px solid ' + (primary ? ACCENT : 'rgba(20,8,31,.14)'),
});

export interface Employee {
  id: string; name: string; workerId?: string; fatherOrSpouseName?: string; nationalId?: string;
  dob?: string; gender?: string; phone?: string; email?: string;
  emergencyContactName?: string; emergencyContactPhone?: string; emergencyContactRelation?: string;
  permanentAddress?: string; currentAddress?: string; photo?: Attachment | null;
  employmentType?: string; hireDate?: string; department?: string; designation?: string; jobTitle?: string;
  grade?: string; employmentStatus?: string; status: string; supervisorId?: string; hrOfficerId?: string;
  userId?: string; payType?: string; payRate?: number; bankName?: string; bankAccount?: string; taxNumber?: string;
  bankRoutingNumber?: string; filingStatus?: string; taxState?: string; flsaStatus?: string; workersCompClass?: string;
  tradeId?: string; trade?: string; skillLevel?: string; yearsExperience?: number;
  expertise?: string[]; equipmentCapabilities?: string[]; createdAt?: string; updatedAt?: string;
  contractorId?: string | null; siteAccessStatus?: string;
  payComponents?: { componentId: string; value: number }[]; overtimeRate?: number | null;
}
export interface Trade { id: string; name: string; active: boolean; order: number }

type Opt = [string, string];
export const EMPLOYMENT_TYPES: Opt[] = [
  ['permanent', 'Full-time'], ['part_time', 'Part-time'], ['daily_wage', 'Hourly craft'], ['contract', 'Contract'],
  ['temporary', 'Temporary / seasonal'], ['intern', 'Apprentice / intern'], ['contractor_worker', 'Contractor worker'],
];
export const EMPLOYMENT_STATUSES: Opt[] = [
  ['active', 'Active'], ['on_leave', 'On Leave'], ['suspended', 'Suspended'], ['resigned', 'Resigned'],
  ['terminated', 'Terminated'], ['contract_expired', 'Contract Expired'], ['demobilized', 'Demobilized'],
];
const STATUS_COLOR: Record<string, { bg: string; c: string }> = {
  active: { bg: '#D2EAD3', c: '#1E6B36' },
  on_leave: { bg: '#D8E2F0', c: '#3C5C8A' },
  suspended: { bg: '#FBE9AE', c: '#8A6D12' },
  resigned: { bg: '#EFEDE8', c: '#5C6B65' },
  terminated: { bg: '#F2DFD4', c: '#8E2E0A' },
  contract_expired: { bg: '#EFEDE8', c: '#5C6B65' },
  demobilized: { bg: '#EFEDE8', c: '#5C6B65' },
};
const SKILL_LEVELS: Opt[] = [['helper', 'Helper'], ['semi_skilled', 'Semi-skilled'], ['skilled', 'Skilled'], ['expert', 'Expert']];
const GENDERS: Opt[] = [['male', 'Male'], ['female', 'Female'], ['other', 'Other']];
const PAY_TYPES: Opt[] = [['hourly', 'Hourly'], ['monthly', 'Salary (monthly)'], ['daily', 'Day rate']];
const FILING_STATUSES: Opt[] = [['single', 'Single or married filing separately'], ['married_jointly', 'Married filing jointly'], ['head_of_household', 'Head of household']];
const FLSA: Opt[] = [['non_exempt', 'Non-exempt (overtime applies)'], ['exempt', 'Exempt (salaried)']];
const labelOf = (opts: Opt[], v?: string) => opts.find(([k]) => k === v)?.[1] || v || '—';
const statusOf = (e: Employee) => e.employmentStatus || (e.status === 'inactive' ? 'resigned' : 'active');

export const StatusPill = ({ status }: { status: string }) => {
  const s = STATUS_COLOR[status] || STATUS_COLOR.active;
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 21, padding: '0 9px', borderRadius: 999, background: s.bg, color: s.c, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{labelOf(EMPLOYMENT_STATUSES, status)}</span>;
};

const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function Photo({ emp, size }: { emp: Employee; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [emp.photo?.id]);
  if (emp.photo && !failed) {
    return <img src={api.employees.photoUrl(emp.id, emp.photo.id)} onError={() => setFailed(true)} alt="" style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', flexShrink: 0, background: ACCENT_BG }} />;
  }
  return <span style={{ width: size, height: size, borderRadius: 999, background: ACCENT_BG, color: ACCENT, fontSize: size * 0.36, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{initials(emp.name || '?')}</span>;
}

// ------------------------------------------------------------------ fields

type FieldKind = 'text' | 'date' | 'number' | 'textarea' | 'select' | 'employee' | 'trade' | 'list' | 'contractor' | 'department' | 'designation' | 'skills';
interface FieldDef { key: keyof Employee; label: string; kind?: FieldKind; options?: Opt[]; wide?: boolean; placeholder?: string; showIf?: (d: Partial<Employee>) => boolean }
const isContractorWorker = (d: Partial<Employee>) => d.employmentType === 'contractor_worker' || !!d.contractorId;
interface SectionDef { title: string; fields: FieldDef[] }

const SECTIONS: Record<string, SectionDef> = {
  identity: {
    title: 'Identity',
    fields: [
      { key: 'name', label: 'Full name *' },
      { key: 'workerId', label: 'Worker ID', placeholder: `Assigned automatically (W-${new Date().getFullYear()}-…) if blank` },
      { key: 'nationalId', label: 'SSN / ITIN', placeholder: '123-45-6789' },
      { key: 'dob', label: 'Date of birth', kind: 'date' },
      { key: 'gender', label: 'Gender', kind: 'select', options: GENDERS },
    ],
  },
  contact: {
    title: 'Contact',
    fields: [
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'currentAddress', label: 'Current address', kind: 'textarea', wide: true },
      { key: 'permanentAddress', label: 'Permanent address', kind: 'textarea', wide: true },
    ],
  },
  emergency: {
    title: 'Emergency contact',
    fields: [
      { key: 'emergencyContactName', label: 'Name' },
      { key: 'emergencyContactRelation', label: 'Relation' },
      { key: 'emergencyContactPhone', label: 'Phone' },
    ],
  },
  employment: {
    title: 'Employment',
    fields: [
      { key: 'employmentType', label: 'Employment type', kind: 'select', options: EMPLOYMENT_TYPES },
      { key: 'employmentStatus', label: 'Status', kind: 'select', options: EMPLOYMENT_STATUSES },
      { key: 'hireDate', label: 'Joining date', kind: 'date' },
      { key: 'department', label: 'Department', kind: 'department' },
      { key: 'designation', label: 'Designation', kind: 'designation' },
      { key: 'grade', label: 'Grade / pay scale' },
      { key: 'supervisorId', label: 'Reporting manager', kind: 'employee' },
      { key: 'hrOfficerId', label: 'HR officer', kind: 'employee' },
      { key: 'contractorId', label: 'Supplied by (contractor)', kind: 'contractor', showIf: isContractorWorker },
      { key: 'siteAccessStatus', label: 'Site access', kind: 'select', options: [['pending', 'Pending'], ['granted', 'Granted'], ['revoked', 'Revoked']], showIf: isContractorWorker },
    ],
  },
  skills: {
    title: 'Trade & skills',
    fields: [
      { key: 'tradeId', label: 'Trade', kind: 'trade' },
      { key: 'skillLevel', label: 'Skill level', kind: 'select', options: SKILL_LEVELS },
      { key: 'yearsExperience', label: 'Years of experience', kind: 'number' },
      { key: 'expertise', label: 'Skills & trades', kind: 'skills', wide: true, placeholder: 'e.g. Tile setting' },
      { key: 'equipmentCapabilities', label: 'Equipment they can operate', kind: 'list', wide: true, placeholder: 'e.g. Excavator, Forklift' },
    ],
  },
  payroll: {
    title: 'Pay & direct deposit',
    fields: [
      { key: 'payType', label: 'Pay basis', kind: 'select', options: PAY_TYPES },
      { key: 'payRate', label: 'Rate ($/hr, $/day or $/month)', kind: 'number' },
      { key: 'flsaStatus', label: 'FLSA status', kind: 'select', options: FLSA },
      { key: 'workersCompClass', label: "Workers' comp class code", placeholder: 'e.g. 5403' },
      { key: 'bankName', label: 'Bank' },
      { key: 'bankRoutingNumber', label: 'Routing number (ABA)' },
      { key: 'bankAccount', label: 'Account number' },
    ],
  },
  tax: {
    title: 'Tax withholding',
    fields: [
      { key: 'filingStatus', label: 'Federal filing status (W-4)', kind: 'select', options: FILING_STATUSES },
      { key: 'taxState', label: 'Work state (withholding)', kind: 'select', options: US_STATES.map((s) => [s, s] as Opt) },
    ],
  },
};

function Label({ text }: { text: string }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{text}</div>;
}

function FieldInput({ def, value, onChange, disabled, employees, trades, contractors, selfId }: {
  def: FieldDef; value: any; onChange: (v: any) => void; disabled: boolean;
  employees: Employee[]; trades: Trade[]; contractors: Contractor[]; selfId?: string;
}) {
  const kind = def.kind || 'text';
  const lists = usePicklists();
  if (kind === 'department') return <PickOne value={value} options={lists.departments} onChange={onChange} disabled={disabled} style={input} />;
  if (kind === 'designation') return <PickOne value={value} options={lists.designations} onChange={onChange} disabled={disabled} style={input} />;
  if (kind === 'skills') return <PickMany value={value} options={lists.skills} onChange={onChange} disabled={disabled} style={input} placeholder={def.placeholder} />;
  if (kind === 'contractor') {
    return (
      <select disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={input}>
        <option value="">—</option>
        {contractors.filter((c) => c.status !== 'ended' || c.id === value).map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
      </select>
    );
  }
  if (kind === 'textarea') return <textarea disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} />;
  if (kind === 'select') {
    return (
      <select disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={input}>
        <option value="">—</option>
        {def.options!.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    );
  }
  if (kind === 'employee') {
    return (
      <select disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={input}>
        <option value="">—</option>
        {employees.filter((e) => e.id !== selfId).map((e) => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` · ${e.designation}` : ''}</option>)}
      </select>
    );
  }
  if (kind === 'trade') {
    return (
      <select disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value || null)} style={input}>
        <option value="">—</option>
        {trades.filter((t) => t.active || t.id === value).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    );
  }
  if (kind === 'list') {
    return <input disabled={disabled} value={(value || []).join(', ')} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} style={input} />;
  }
  if (kind === 'number') {
    return <input disabled={disabled} type="number" min={0} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} style={input} />;
  }
  return <input disabled={disabled} type={kind === 'date' ? 'date' : 'text'} value={value || ''} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} style={input} />;
}

function SectionForm({ section, draft, patch, disabled, employees, trades, contractors }: {
  section: SectionDef; draft: Partial<Employee>; patch: (p: Partial<Employee>) => void; disabled: boolean;
  employees: Employee[]; trades: Trade[]; contractors: Contractor[];
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 10 }}>{section.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {section.fields.filter((f) => !f.showIf || f.showIf(draft)).map((f) => (
          <div key={f.key} style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
            <Label text={f.label} />
            <FieldInput def={f} value={draft[f.key]} onChange={(v) => patch({ [f.key]: v } as Partial<Employee>)} disabled={disabled} employees={employees} trades={trades} contractors={contractors} selfId={draft.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ directory

interface DirectoryProps {
  employees: Employee[]; trades: Trade[]; projects: Project[]; assignments: Assignment[]; contractors: Contractor[];
  reload: () => Promise<unknown> | void; reloadAssignments: () => Promise<unknown> | void; canManage: boolean;
  canFinance: boolean; payrollSettings: PayrollSettings;
  /** Controlled so other screens (deployment, requests, contractors) can open a profile here. */
  openId: string | null; onOpen: (id: string | null) => void;
  /** Open the Add employee form straight away (People -> Add staff lands here). */
  startAdding?: boolean;
}

export function EmployeeDirectory(props: DirectoryProps) {
  const { employees, trades, projects, assignments, contractors, reload, canManage, openId, onOpen, startAdding } = props;
  const [adding, setAdding] = useState(!!startAdding && canManage);
  useEffect(() => { if (startAdding && canManage) setAdding(true); }, [startAdding, canManage]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [workforce, setWorkforce] = useState<'' | 'staff' | 'contractor'>('');
  const [availability, setAvailability] = useState<'' | 'deployed' | 'available'>('');

  const tradeName = (e: Employee) => trades.find((t) => t.id === e.tradeId)?.name || e.trade || '—';
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
  const deployment = useMemo(() => {
    const m = new Map<string, Assignment>();
    for (const a of assignments) if (a.current && (a.assignmentType === 'regular' || !m.has(a.employeeId))) m.set(a.employeeId, a);
    return m;
  }, [assignments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) =>
      (!q || [e.name, e.workerId, e.nationalId, e.phone, e.designation].some((v) => (v || '').toLowerCase().includes(q)))
      && (!statusFilter || statusOf(e) === statusFilter)
      && (!typeFilter || e.employmentType === typeFilter)
      && (!tradeFilter || e.tradeId === tradeFilter)
      && (!workforce || (workforce === 'contractor') === !!e.contractorId)
      && (!availability || (availability === 'deployed' ? deployment.has(e.id) : statusOf(e) === 'active' && !deployment.has(e.id))));
  }, [employees, query, statusFilter, typeFilter, tradeFilter, workforce, availability, deployment]);

  const open = employees.find((e) => e.id === openId);
  if (open) {
    return <EmployeeProfile {...props} employee={open} onBack={() => onOpen(null)} onChanged={reload} />;
  }

  const activeCount = employees.filter((e) => statusOf(e) === 'active').length;
  const cols = '44px 90px minmax(180px,2fr) 1fr 1fr minmax(150px,1.3fr) 120px';
  const sel: React.CSSProperties = { ...input, width: 'auto' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, worker ID, SSN, phone…" style={{ ...input, width: 260 }} />
        <select value={workforce} onChange={(e) => setWorkforce(e.target.value as any)} style={sel}>
          <option value="">Staff + contractor workers</option>
          <option value="staff">Own staff only</option>
          <option value="contractor">Contractor workers only</option>
        </select>
        <select value={availability} onChange={(e) => setAvailability(e.target.value as any)} style={sel}>
          <option value="">Deployed or not</option>
          <option value="deployed">Deployed</option>
          <option value="available">Available</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All statuses</option>
          {EMPLOYMENT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={sel}>
          <option value="">All types</option>
          {EMPLOYMENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} style={sel}>
          <option value="">All trades</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: MUTED }}>{employees.length} people · {activeCount} active · {deployment.size} deployed</span>
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={() => setAdding(true)} style={btn(true)}>+ Add employee</div>}
      </div>

      <div style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 880 }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 14px', background: '#F7F3EA', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c96a4' }}>
              <span /><span>Worker ID</span><span>Name</span><span>Trade</span><span>Type</span><span>Deployed on</span><span>Status</span>
            </div>
            {filtered.map((e) => {
              const a = deployment.get(e.id);
              const contractor = e.contractorId ? contractors.find((c) => c.id === e.contractorId) : undefined;
              return (
                <div key={e.id} onClick={() => onOpen(e.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(20,8,31,.05)', cursor: 'pointer' }}>
                  <Photo emp={e} size={30} />
                  <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{e.workerId || '—'}</span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {contractor ? `via ${contractor.companyName}` : (e.designation || e.jobTitle || 'No designation')}{!contractor && e.department ? ` · ${e.department}` : ''}
                    </div>
                  </span>
                  <span style={{ fontSize: 12.5, color: INK }}>{tradeName(e)}</span>
                  <span style={{ fontSize: 12.5, color: INK }}>{labelOf(EMPLOYMENT_TYPES, e.employmentType)}</span>
                  <span style={{ fontSize: 12.5, color: a ? INK : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a ? `${projectName(a.projectId)}${a.workArea ? ` · ${a.workArea}` : ''}${a.assignmentType === 'temporary' ? ' (temp)' : ''}` : statusOf(e) === 'active' ? 'Available' : '—'}
                  </span>
                  <span><StatusPill status={statusOf(e)} /></span>
                </div>
              );
            })}
            {!filtered.length && (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
                {employees.length ? 'No employees match these filters.' : 'No employees yet — add the first one to start building the roster.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {adding && (
        <AddEmployeeDrawer
          employees={employees} trades={trades} contractors={contractors}
          onClose={() => setAdding(false)}
          onCreated={async (emp) => { setAdding(false); await reload(); onOpen(emp.id); }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ add drawer

export function AddEmployeeDrawer({ employees, trades, contractors, defaults, title, onClose, onCreated }: {
  employees: Employee[]; trades: Trade[]; contractors: Contractor[]; defaults?: Partial<Employee>; title?: string;
  onClose: () => void; onCreated: (e: Employee) => void;
}) {
  const { toast } = useApp();
  const [draft, setDraft] = useState<Partial<Employee>>({ employmentStatus: 'active', employmentType: 'permanent', hireDate: todayISO(), ...defaults });
  const [saving, setSaving] = useState(false);
  const patch = (p: Partial<Employee>) => setDraft((d) => ({ ...d, ...p }));

  const create = async () => {
    if (!draft.name?.trim()) { toast('⚠ Full name is required'); return; }
    if (draft.employmentType === 'contractor_worker' && !draft.contractorId) { toast('⚠ Pick which contractor supplies this worker'); return; }
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '' && v != null));
      const created = await api.employees.create(clean) as Employee;
      toast(`${created.name} added as ${created.workerId}`);
      onCreated(created);
    } catch (e: any) { toast('⚠ ' + (e.message || 'Could not add the employee')); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,8,31,0.45)', zIndex: 160, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100vw)', height: '100%', background: 'white', display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 60px rgba(20,8,31,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(20,8,31,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: BG, fontSize: 18, fontWeight: 700, color: INK }}>{title || 'Add employee'}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Only the name is required — everything else can be filled in later from the profile.</div>
          </div>
          <div onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', color: MUTED, fontSize: 18 }}>×</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {(['identity', 'contact', 'emergency', 'employment', 'skills', 'payroll'] as const).map((k) => (
            <SectionForm key={k} section={SECTIONS[k]} draft={draft} patch={patch} disabled={false} employees={employees} trades={trades} contractors={contractors} />
          ))}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(20,8,31,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <div onClick={onClose} style={btn()}>Cancel</div>
          <div onClick={saving ? undefined : create} style={{ ...btn(true), opacity: saving ? 0.6 : 1 }}>{saving ? 'Adding…' : 'Add employee'}</div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ profile

type RecordKind = 'document' | 'certification' | 'contract';
interface EmpRecord {
  id: string; employeeId: string; kind: RecordKind; type?: string; title?: string; number?: string; issuer?: string;
  issueDate?: string; expiryDate?: string; rate?: number; terms?: string; verification?: string; status?: string;
  notes?: string; attachments: Attachment[]; expiryStatus: 'none' | 'valid' | 'expiring' | 'expired';
}

const PROFILE_TABS = [
  ['overview', 'Overview'], ['personal', 'Personal Information'], ['employment', 'Employment'], ['deployment', 'Deployment'],
  ['pay', 'Salary & Payroll'], ['overtime', 'Overtime'], ['advances', 'Advances & Loans'], ['leave', 'Leave'],
  ['assets', 'Assets'], ['housing', 'Housing & Transport'],
  ['document', 'Documents'], ['certification', 'Certifications'], ['contract', 'Contracts'],
] as const;
type ProfileTab = typeof PROFILE_TABS[number][0];

function EmployeeProfile(props: DirectoryProps & { employee: Employee; onBack: () => void; onChanged: () => Promise<unknown> | void }) {
  const { employee, employees, trades, projects, assignments, contractors, canManage, canFinance, payrollSettings, onBack, onChanged, reloadAssignments } = props;
  const { toast } = useApp();
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [records, setRecords] = useState<EmpRecord[]>([]);
  const photoInput = useRef<HTMLInputElement | null>(null);

  const reloadRecords = () => api.employeeRecords.list(employee.id).then((r: any) => setRecords(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { reloadRecords(); setTab('overview'); }, [employee.id]);

  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    try { await api.employees.uploadPhoto(employee.id, file); await onChanged(); toast('Photo updated'); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not upload the photo')); }
    finally { if (photoInput.current) photoInput.current.value = ''; }
  };

  const remove = async () => {
    if (!confirm(`Delete ${employee.name}'s record entirely? To keep history, change their status to Resigned / Terminated / Demobilized instead.`)) return;
    try { await api.employees.remove(employee.id); await onChanged(); onBack(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not delete')); }
  };

  const nameOf = (id?: string) => employees.find((e) => e.id === id)?.name;
  const tradeName = trades.find((t) => t.id === employee.tradeId)?.name || employee.trade;
  const contractor = employee.contractorId ? contractors.find((c) => c.id === employee.contractorId) : undefined;
  const current = assignments.filter((a) => a.current && a.employeeId === employee.id);
  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `Project ${id}`;
  const byKind = (k: RecordKind) => records.filter((r) => r.kind === k);
  const alerts = records.filter((r) => r.expiryStatus === 'expired' || r.expiryStatus === 'expiring');
  const glance: [string, string | undefined][] = [
    ['Worker ID', employee.workerId],
    ['Trade', tradeName ? `${tradeName}${employee.skillLevel ? ` (${labelOf(SKILL_LEVELS, employee.skillLevel)})` : ''}` : undefined],
    ['Experience', employee.yearsExperience != null ? `${employee.yearsExperience} years` : undefined],
    ['Deployed on', current.length ? current.map((a) => `${projectName(a.projectId)}${a.workArea ? ` · ${a.workArea}` : ''}`).join(', ') : (statusOf(employee) === 'active' ? 'Available' : undefined)],
    ...(contractor ? [['Contractor', contractor.companyName] as [string, string]] : []),
    ['Joined', employee.hireDate],
    ['Reports to', nameOf(employee.supervisorId)],
    ['HR officer', nameOf(employee.hrOfficerId)],
  ];

  return (
    <div>
      <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: ACCENT, fontWeight: 700, fontSize: 13, marginBottom: 14 }}>← All employees</div>

      <div style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 16, padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div onClick={canManage ? () => photoInput.current?.click() : undefined} title={canManage ? 'Change photo' : undefined} style={{ cursor: canManage ? 'pointer' : 'default', position: 'relative' }}>
          <Photo emp={employee} size={64} />
          {canManage && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 999, background: ACCENT, color: 'white', display: 'grid', placeItems: 'center', fontSize: 12, border: '2px solid white' }}>✎</span>}
        </div>
        <input ref={photoInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadPhoto(e.target.files?.[0])} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: BG, fontSize: 22, fontWeight: 700, color: INK }}>{employee.name}</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
            {[employee.workerId, employee.designation || employee.jobTitle, employee.department, contractor && `via ${contractor.companyName}`].filter(Boolean).join(' · ') || 'No designation yet'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <StatusPill status={statusOf(employee)} />
            {employee.employmentType && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#EFEDE8', color: '#43514D' }}>{labelOf(EMPLOYMENT_TYPES, employee.employmentType)}</span>}
            {tradeName && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: ACCENT_BG, color: ACCENT }}>{tradeName}{employee.skillLevel ? ` · ${labelOf(SKILL_LEVELS, employee.skillLevel)}` : ''}</span>}
            {current.map((a) => (
              <span key={a.id} onClick={() => setTab('deployment')} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#D8E2F0', color: '#3C5C8A', cursor: 'pointer' }}>
                On {projectName(a.projectId)}{a.workArea ? ` · ${a.workArea}` : ''}{a.assignmentType === 'temporary' ? ' (temp)' : ''}
              </span>
            ))}
          </div>
        </div>
        {canManage && <div onClick={remove} style={{ ...btn(), color: '#8E2E0A' }}>Delete</div>}
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + LINE, marginBottom: 16, overflowX: 'auto' }}>
        {PROFILE_TABS.map(([key, label]) => {
          const count = key === 'document' || key === 'certification' || key === 'contract' ? byKind(key).length : 0;
          return (
            <div key={key} onClick={() => setTab(key)} style={{ padding: '9px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', color: tab === key ? ACCENT : MUTED, borderBottom: '2px solid ' + (tab === key ? ACCENT : 'transparent'), marginBottom: -1 }}>
              {label}{count ? <span style={{ marginLeft: 6, fontSize: 10.5, color: MUTED }}>{count}</span> : null}
            </div>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <Card title="At a glance"><Facts rows={glance} /></Card>
          <DirectoryAccessCard employee={employee} canManage={canManage} />
          <LoginCard employee={employee} onChanged={onChanged} />
          <Card title="Contact">
            <Facts rows={[
              ['Phone', employee.phone],
              ['Email', employee.email],
              ['Emergency', employee.emergencyContactName ? `${employee.emergencyContactName}${employee.emergencyContactRelation ? ` (${employee.emergencyContactRelation})` : ''} ${employee.emergencyContactPhone || ''}` : undefined],
              ['Current address', employee.currentAddress],
            ]} />
          </Card>
          <Card title="Needs attention">
            {!alerts.length ? (
              <div style={{ fontSize: 12.5, color: MUTED }}>No expired or expiring documents, certifications or contracts.</div>
            ) : alerts.map((r) => (
              <div key={r.id} onClick={() => setTab(r.kind)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 12.5 }}>
                <ExpiryBadge status={r.expiryStatus} />
                <span style={{ flex: 1, color: INK }}>{r.type || r.title || r.kind}</span>
                <span style={{ color: MUTED, fontSize: 11.5 }}>{r.expiryDate}</span>
              </div>
            ))}
          </Card>
          <Card title="Skills & equipment">
            <Chips items={employee.expertise} empty="No skills recorded." />
            <div style={{ height: 8 }} />
            <Chips items={employee.equipmentCapabilities} empty="No equipment recorded." />
          </Card>
        </div>
      )}

      {tab === 'personal' && (
        <EditableSections sectionKeys={['identity', 'contact', 'emergency']} employee={employee} employees={employees} trades={trades} contractors={contractors} canManage={canManage} onSaved={onChanged} />
      )}
      {tab === 'employment' && (
        <EditableSections sectionKeys={['employment', 'skills', 'payroll', 'tax']} employee={employee} employees={employees} trades={trades} contractors={contractors} canManage={canManage} onSaved={onChanged} />
      )}
      {tab === 'deployment' && (
        <EmployeeDeploymentPanel employee={employee} employees={employees} trades={trades} projects={projects} assignments={assignments} canManage={canManage}
          onChanged={async () => { await reloadAssignments(); await onChanged(); }} />
      )}
      {tab === 'deployment' && <div style={{ marginTop: 16 }}><EmployeeShiftPanel employee={employee} employees={employees} canManage={canManage} currency={payrollSettings.currency} /></div>}
      {tab === 'pay' && <EmployeePayPanel employee={employee} settings={payrollSettings} canManage={canManage} canFinance={canFinance} onChanged={onChanged} />}
      {tab === 'overtime' && <OvertimePanel employees={employees} projects={projects} settings={payrollSettings} canManage={canManage} employeeId={employee.id} />}
      {tab === 'advances' && <AdvancesPanel employees={employees} settings={payrollSettings} canManage={canManage} canFinance={canFinance} employeeId={employee.id} />}
      {tab === 'leave' && (employee.contractorId
        ? <div style={{ fontSize: 12.5, color: MUTED }}>{employee.name} is supplied by a contractor — their leave is managed by the contractor.</div>
        : <EmployeeLeavePanel employee={employee} employees={employees} canManage={canManage} currency={payrollSettings.currency} />)}
      {tab === 'assets' && <EmployeeAssetsPanel employee={employee} employees={employees} canManage={canManage} currency={payrollSettings.currency} />}
      {tab === 'housing' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, alignItems: 'start' }}>
          <EmployeeHousingCard employee={employee} employees={employees} canManage={canManage} />
          <EmployeeTransportCard employee={employee} canManage={canManage} />
        </div>
      )}
      {(tab === 'document' || tab === 'certification' || tab === 'contract') && (
        <RecordsPanel kind={tab} employeeId={employee.id} records={byKind(tab)} canManage={canManage} onChanged={reloadRecords} />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontFamily: BG, fontSize: 14, fontWeight: 700, color: INK, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Facts({ rows }: { rows: [string, string | undefined][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 7, columnGap: 10, fontSize: 12.5 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <span style={{ color: MUTED }}>{k}</span>
          <span style={{ color: v ? INK : '#C3C9C5' }}>{v || '—'}</span>
        </div>
      ))}
    </div>
  );
}

function Chips({ items, empty }: { items?: string[]; empty: string }) {
  if (!items?.length) return <div style={{ fontSize: 12, color: MUTED }}>{empty}</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((s) => <span key={s} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#F3EFE6', color: '#43514D' }}>{s}</span>)}
    </div>
  );
}

function EditableSections({ sectionKeys, employee, employees, trades, contractors, canManage, onSaved }: {
  sectionKeys: string[]; employee: Employee; employees: Employee[]; trades: Trade[]; contractors: Contractor[]; canManage: boolean;
  onSaved: () => Promise<unknown> | void;
}) {
  const [draft, setDraft] = useState<Partial<Employee>>(employee);
  // Another employee starts fresh; a reload of this one (after a save) leaves the draft alone.
  useEffect(() => setDraft(employee), [employee.id]);

  const fieldKeys = sectionKeys.flatMap((k) => SECTIONS[k].fields.map((f) => f.key));
  const nameMissing = fieldKeys.includes('name') && !draft.name?.trim();
  // Saves 3 seconds after typing stops (only the changed fields), or at once with Save.
  const auto = useAutosave<Partial<Employee>>({
    draft, saved: employee, fields: fieldKeys, enabled: canManage && !nameMissing, label: 'employee',
    save: async (changes) => {
      await api.employees.update(employee.id, changes);
      await onSaved();
      return { ...employee, ...changes };
    },
  });

  return (
    <div style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 14, padding: '18px 20px' }}>
      {sectionKeys.map((k) => (
        <SectionForm key={k} section={SECTIONS[k]} draft={draft} patch={(p) => setDraft((d) => ({ ...d, ...p }))} disabled={!canManage} employees={employees} trades={trades} contractors={contractors} />
      ))}
      {canManage && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          {auto.state === 'dirty' && <div onClick={() => setDraft(employee)} style={btn()}>Discard</div>}
          <SaveBar auto={auto} blocked={nameMissing ? 'Full name is required' : undefined} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ records (documents / certifications / contracts)

const RECORD_TYPES: Record<RecordKind, string[]> = {
  document: ["Driver's license", 'Social Security card', 'Passport', 'Permanent resident card', 'Employment authorization (EAD)', 'Form I-9', 'Form W-4', 'State withholding form (DE 4)', 'Direct deposit authorization', 'Offer letter', 'Handbook acknowledgment', 'Other'],
  certification: ['OSHA 10', 'OSHA 30', "Commercial driver's license", 'DOT medical card', 'Crane operator (NCCCO)', 'Forklift operator', 'Aerial / scissor lift', 'Welding certification', 'Electrical certification', 'First aid / CPR', 'Confined space', 'Fall protection', 'Professional license', 'Other'],
  contract: ['Offer letter (at-will)', 'Fixed-term', 'Project agreement', 'Union / collective agreement', 'Temporary / seasonal', 'Apprenticeship agreement'],
};
const KIND_LABEL: Record<RecordKind, { one: string; many: string; issue: string; expiry: string }> = {
  document: { one: 'document', many: 'documents', issue: 'Issue date', expiry: 'Expiry date' },
  certification: { one: 'certification', many: 'certifications & licenses', issue: 'Issue date', expiry: 'Expiry date' },
  contract: { one: 'contract', many: 'contracts', issue: 'Start date', expiry: 'End date' },
};
const EXPIRY_STYLE: Record<string, { bg: string; c: string; label: string }> = {
  expired: { bg: '#F2DFD4', c: '#8E2E0A', label: 'Expired' },
  expiring: { bg: '#FBE9AE', c: '#8A6D12', label: 'Expiring soon' },
  valid: { bg: '#D2EAD3', c: '#1E6B36', label: 'Valid' },
  none: { bg: '#EFEDE8', c: '#5C6B65', label: 'No expiry' },
};
function ExpiryBadge({ status }: { status: string }) {
  const s = EXPIRY_STYLE[status] || EXPIRY_STYLE.none;
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, background: s.bg, color: s.c, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

function RecordsPanel({ kind, employeeId, records, canManage, onChanged }: {
  kind: RecordKind; employeeId: string; records: EmpRecord[]; canManage: boolean; onChanged: () => Promise<unknown> | void;
}) {
  const { toast } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [expiryFilter, setExpiryFilter] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const L = KIND_LABEL[kind];

  useEffect(() => { api.google.status().then((g: any) => setStorageReady(!!g?.connected)).catch(() => setStorageReady(false)); }, []);

  const add = async () => {
    try {
      const created: any = await api.employeeRecords.create({ employeeId, kind, type: RECORD_TYPES[kind][0], ...(kind === 'contract' ? { status: 'active' } : kind === 'document' ? { verification: 'pending' } : {}) });
      await onChanged();
      setOpenId(created.id);
    } catch (e: any) { toast('⚠ ' + (e.message || `Could not add the ${L.one}`)); }
  };

  const shown = records.filter((r) => !expiryFilter || r.expiryStatus === expiryFilter);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">All</option>
          <option value="expired">Expired</option>
          <option value="expiring">Expiring within 30 days</option>
          <option value="valid">Valid</option>
          <option value="none">No expiry date</option>
        </select>
        <span style={{ fontSize: 12, color: MUTED }}>{records.length} {L.many}</span>
        <div style={{ flex: 1 }} />
        {canManage && <div onClick={add} style={btn(true)}>+ Add {L.one}</div>}
      </div>

      <div style={{ background: 'white', border: '1px solid ' + LINE, borderRadius: 14, overflow: 'hidden' }}>
        {shown.map((r) => (
          <div key={r.id} style={{ borderTop: '1px solid rgba(20,8,31,.05)' }}>
            <div onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{r.type || 'Untitled'}{r.title ? ` — ${r.title}` : ''}</div>
                <div style={{ fontSize: 11.5, color: MUTED }}>
                  {[r.number && `No. ${r.number}`, r.issuer, r.issueDate && `${L.issue}: ${r.issueDate}`, r.expiryDate && `${L.expiry}: ${r.expiryDate}`].filter(Boolean).join(' · ') || 'No details yet'}
                </div>
              </div>
              {r.attachments.length > 0 && <span style={{ fontSize: 11, color: MUTED }}>📎 {r.attachments.length}</span>}
              {kind === 'document' && r.verification && <span style={{ fontSize: 10.5, fontWeight: 700, color: r.verification === 'verified' ? '#1E6B36' : r.verification === 'rejected' ? '#8E2E0A' : '#8A6D12', textTransform: 'capitalize' }}>{r.verification}</span>}
              {kind === 'contract' && r.status && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#43514D', textTransform: 'capitalize' }}>{r.status}</span>}
              <ExpiryBadge status={r.expiryStatus} />
            </div>
            {openId === r.id && (
              <RecordEditor record={r} kind={kind} canManage={canManage} storageReady={storageReady} onChanged={onChanged} onDeleted={() => setOpenId(null)} />
            )}
          </div>
        ))}
        {!shown.length && (
          <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: MUTED }}>
            {records.length ? 'Nothing matches this filter.' : `No ${L.many} on file yet.`}
          </div>
        )}
      </div>
    </div>
  );
}

/** The fields a document / certification / contract editor changes; they autosave together. */
const RECORD_FIELDS: (keyof EmpRecord)[] = ['type', 'title', 'number', 'issuer', 'issueDate', 'expiryDate', 'rate', 'status', 'verification', 'terms', 'notes'] as (keyof EmpRecord)[];

function RecordEditor({ record, kind, canManage, storageReady, onChanged, onDeleted }: {
  record: EmpRecord; kind: RecordKind; canManage: boolean; storageReady: boolean;
  onChanged: () => Promise<unknown> | void; onDeleted: () => void;
}) {
  const { toast } = useApp();
  const [draft, setDraft] = useState<EmpRecord>(record);
  useEffect(() => setDraft(record), [record.id]);
  const L = KIND_LABEL[kind];

  // Saves 3 seconds after typing stops (only the changed fields), or at once with Save.
  const auto = useAutosave<EmpRecord>({
    draft, saved: record, fields: RECORD_FIELDS, enabled: canManage, label: L.one,
    save: async (changes) => {
      // A cleared number is sent as null, so the server clears it too.
      const patch = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v === undefined ? null : v]));
      await api.employeeRecords.update(record.id, patch);
      await onChanged();
      return { ...record, ...changes };
    },
  });
  const field = (key: keyof EmpRecord, label: string, type: 'text' | 'date' | 'number' = 'text') => (
    <div>
      <Label text={label} />
      <input
        disabled={!canManage} type={type} value={(draft[key] as any) ?? ''}
        onChange={(e) => setDraft({ ...draft, [key]: type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value })}
        style={input}
      />
    </div>
  );
  const select = (key: keyof EmpRecord, label: string, options: string[] | Opt[]) => (
    <div>
      <Label text={label} />
      <select disabled={!canManage} value={(draft[key] as any) ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} style={input}>
        {(options as any[]).map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const remove = async () => {
    if (!confirm(`Delete this ${L.one} and its files?`)) return;
    try { await api.employeeRecords.remove(record.id); onDeleted(); await onChanged(); }
    catch (e: any) { toast('⚠ ' + (e.message || 'Could not delete')); }
  };

  return (
    <div style={{ padding: '4px 16px 16px', background: '#FBFAF6' }}>
      {canManage && <div style={{ paddingTop: 10 }}><SaveBar auto={auto} /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, paddingTop: 12 }}>
        {select('type', 'Type', RECORD_TYPES[kind])}
        {kind === 'document' && field('title', 'Name / description')}
        {field('number', kind === 'contract' ? 'Contract number' : kind === 'certification' ? 'License / certificate no.' : 'Document number')}
        {kind === 'certification' && field('issuer', 'Issuing authority')}
        {field('issueDate', L.issue, 'date')}
        {field('expiryDate', L.expiry, 'date')}
        {kind === 'contract' && field('rate', 'Salary / rate', 'number')}
        {kind === 'contract' && select('status', 'Status', [['draft', 'Draft'], ['active', 'Active'], ['renewed', 'Renewed'], ['ended', 'Ended']])}
        {kind === 'document' && select('verification', 'Verification', [['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected']])}
      </div>
      {kind === 'contract' && (
        <div style={{ marginTop: 12 }}>
          <Label text="Terms" />
          <textarea disabled={!canManage} value={draft.terms || ''} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} />
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Label text="Notes" />
        <textarea disabled={!canManage} value={draft.notes || ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Attachments
          scope="employee-records"
          taskId={record.id}
          attachments={record.attachments}
          canManage={canManage}
          storageReady={storageReady}
          onUpload={async (files) => { await api.employeeRecords.uploadAttachments(record.id, files); await onChanged(); }}
          onRemove={async (att) => { await api.employeeRecords.removeAttachment(record.id, att.id); await onChanged(); }}
          onAddLink={async (name, url) => { await api.employeeRecords.addLink(record.id, name, url); await onChanged(); }}
        />
      </div>
      {canManage && (
        <div style={{ marginTop: 12 }}>
          <span onClick={remove} style={{ fontSize: 12, fontWeight: 700, color: '#8E2E0A', cursor: 'pointer' }}>Delete {L.one}</span>
        </div>
      )}
    </div>
  );
}
