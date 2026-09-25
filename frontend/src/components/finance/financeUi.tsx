import { useState } from 'react';
import { Badge, input as INPUT } from '../manpowerUi';

export interface Figures {
  value: number | null; ev: number; invoiced: number; retention: number; paid: number; billable: number; overBilled: number;
  remaining: number; outstanding: number; reportedProgress: number; approvedProgress: number; billableProgress: number; physicalProgress: number;
  progressStatus: 'not_started' | 'in_progress' | 'complete';
  billingStatus: 'not_billable' | 'not_invoiced' | 'ready_to_invoice' | 'partially_invoiced' | 'fully_invoiced' | 'over_billed';
  paymentStatus: 'none' | 'unpaid' | 'partially_paid' | 'paid';
}
export interface ItemFin {
  contractValue: number | null; budgetedCost?: number | null; estimatedCost?: number | null; billingMethod?: string;
  retentionPctOverride?: number | null; taxPctOverride?: number | null; csiCodeId?: string; subcontractorTradeId?: string;
  deliverables?: string; requiredFromUs?: string; requiredFromClient?: string; requiredFromContractor?: string;
  acceptanceCriteria?: string; billingCondition?: string; notes?: string; reportedProgress: number; approvedProgress: number;
  progressApprovedBy?: string; progressApprovedAt?: string; version?: number;
}
export interface Row extends Figures {
  kind: 'project' | 'phase' | 'task'; id: string; name: string; phaseId?: string | null; category?: string;
  ownValue: number | null; valueFromTasks?: boolean; billedAsWhole?: boolean; deleted?: boolean; fin: ItemFin | null; children?: Row[];
  changeOrders?: number; retentionReleased?: number;
}
export interface Group { category: 'design' | 'construction' | 'other' | 'unphased'; label: string; rows: Row[]; totals: Figures }
export interface Summary {
  originalContract: number; approvedChanges: number; revisedContract: number; allocated: number; unallocated: number; allocation: 'under' | 'full' | 'over';
  ev: number; contractWorkInvoiced: number; invoiceTotals: number; paid: number; arOutstanding: number; unbilledEarned: number; overBilled: number;
  remainingContract: number; retentionHeld: number; billableNow: number; overdue: number; overdueCount: number; lumpSum: boolean;
  pendingChanges: number; retentionAccrued: number; retentionReleased: number; reimbursablesBilled: number; credits: number;
}
export interface Settings {
  projectId: number; exists: boolean; version: number; currency: string; originalContractValue: number; originalBudget: number | null;
  retentionPct: number; taxPct: number; paymentTermsDays: number; requireProgressApproval: boolean; billToName?: string; billToEmail?: string;
  billToAddress?: string; contractNumber?: string; poNumber?: string; notes?: string; contractLockedAt?: string; reportedProgress: number; approvedProgress: number;
  reimbursableMarkupPct?: number; laborBurdenPct?: number;
}
export interface Rights {
  view: boolean; manage: boolean; reportProgress: boolean; approveProgress: boolean;
  prepareInvoice: boolean; issueInvoice: boolean; recordPayment: boolean; approveChangeOrders: boolean; approveReimbursables: boolean; releaseRetention: boolean;
  viewChangeOrders: boolean; editChangeOrders: boolean; viewReimbursables: boolean; submitReimbursables: boolean;
  manageCosts: boolean; approveCosts: boolean; viewProfitability: boolean;
}
export interface Overview {
  project: { id: number; name: string; contractAmt: string; stage: string };
  settings: Settings; billToDefaults: { name: string; email: string; address: string } | null; suggestedContract: number;
  sov: { summary: Summary; groups: Group[]; lump: Row | null }; drafts: number; rights: Rights;
  looseTasks?: { id: string; title: string }[];
}
export interface InvoiceLine {
  id: string; kind: 'progress' | 'manual' | 'adjustment' | 'reimbursable' | 'retention_release'; reimbursableId?: string | null; retentionReleaseId?: string | null; creditsLineId?: string | null; targetType?: string | null; phaseId?: string | null; taskId?: string | null; lineOrder: number;
  description: string; billingMethod?: string; contractValue: number | null; prevProgressPct: number | null; currentProgressPct: number | null;
  prevBilled: number | null; amount: number; quantity: number | null; unit?: string | null; rate: number | null; retentionApplies: boolean;
  retentionPct: number; retentionAmount: number; taxable: boolean; taxPct: number; taxAmount: number;
}
export interface Payment {
  id: string; invoiceId: string; date: string; amount: number; method: string; bankRef?: string; txnRef?: string; notes?: string;
  voidedAt?: string; voidedByName?: string; voidReason?: string; createdBy?: string; version: number; invoiceNumber?: string;
}
export interface Invoice {
  id: string; issuedNumber?: string; projectId: number; kind: string; status: 'draft' | 'issued' | 'void'; invoiceDate: string; dueDate?: string;
  periodStart?: string; periodEnd?: string; currency: string; reference?: string; poNumber?: string; description?: string;
  billToName?: string; billToEmail?: string; billToAddress?: string; retentionPct: number; taxPct: number; notes?: string; attachments: any[];
  contractWork: number; retention: number; adjustment: number; tax: number; total: number; paid: number; outstanding: number;
  reimbursable?: number; retentionRelease?: number; credited?: number;
  paymentStatus: 'draft' | 'void' | 'paid' | 'overdue' | 'partially_paid' | 'unpaid' | 'credit' | 'credit_balance'; overdue: boolean;
  creditForInvoiceId?: string; creditType?: 'credit' | 'write_off'; creditReason?: string; creditFor?: { id: string; issuedNumber: string } | null;
  credits?: { id: string; issuedNumber?: string; status: string; creditType?: string; total: number; invoiceDate: string }[];
  approvalRequestedAt?: string; approvalRequestedBy?: string; approvals?: Approval[];
  issuedAt?: string; issuedByName?: string; voidedAt?: string; voidedByName?: string; voidReason?: string; version: number;
  lines?: InvoiceLine[]; payments?: Payment[]; createdBy?: string;
}

export const usd = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const pct = (n: number | null | undefined) => `${Math.round((Number(n) || 0) * 100) / 100}%`;

const BILLING: Record<Figures['billingStatus'], [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  not_billable: ['No value', 'grey'], not_invoiced: ['Not invoiced', 'grey'], ready_to_invoice: ['Ready to invoice', 'amber'],
  partially_invoiced: ['Partially invoiced', 'blue'], fully_invoiced: ['Fully invoiced', 'green'], over_billed: ['Over-billed', 'red'],
};
const PAYMENT: Record<Figures['paymentStatus'], [string, 'grey' | 'amber' | 'blue' | 'green' | 'red'] | null> = {
  none: null, unpaid: ['Unpaid', 'grey'], partially_paid: ['Partly paid', 'blue'], paid: ['Paid', 'green'],
};
export const BillingBadge = ({ s }: { s: Figures['billingStatus'] }) => <Badge tone={BILLING[s][1]}>{BILLING[s][0]}</Badge>;
export const PaymentBadge = ({ s }: { s: Figures['paymentStatus'] }) => (PAYMENT[s] ? <Badge tone={PAYMENT[s]![1]}>{PAYMENT[s]![0]}</Badge> : null);

const INVOICE: Record<Invoice['paymentStatus'], [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  draft: ['Draft', 'grey'], void: ['Void', 'grey'], paid: ['Paid', 'green'], overdue: ['Overdue', 'red'], partially_paid: ['Partly paid', 'blue'], unpaid: ['Unpaid', 'amber'],
  credit: ['Credit note', 'blue'], credit_balance: ['Credit due to client', 'amber'],
};
export const InvoiceBadge = ({ s }: { s: Invoice['paymentStatus'] }) => <Badge tone={INVOICE[s][1]}>{INVOICE[s][0]}</Badge>;

export const BILLING_METHODS: [string, string][] = [
  ['percent_complete', 'Percent complete'], ['fixed', 'Fixed amount'], ['milestone', 'Milestone'], ['quantity', 'Quantity based'],
  ['t_and_m', 'Time & materials'], ['reimbursable', 'Reimbursable'], ['manual', 'Manual'],
];
export const PAYMENT_METHODS: [string, string][] = [['ach', 'ACH / direct deposit'], ['check', 'Check'], ['wire', 'Wire'], ['card', 'Card'], ['cash', 'Cash'], ['other', 'Other']];

/** A thin progress bar: billable progress solid, reported (if ahead) as a lighter band. */
export function ProgressBar({ reported, billable }: { reported: number; billable: number }) {
  return (
    <div style={{ height: 6, borderRadius: 99, background: '#EFEDE8', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, reported)}%`, background: '#CFE3D2' }} />
      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, billable)}%`, background: '#2F7D4A' }} />
    </div>
  );
}

/** Raised when the server says a record changed since it was read (409); the financials screen reloads. */
export const STALE_EVENT = 'finance-stale';
export function failed(toast: (m: string) => void, e: any) {
  const msg = e?.message || 'Something went wrong';
  toast('⚠ ' + msg);
  if (/since you opened it|changed by/i.test(msg)) window.dispatchEvent(new Event(STALE_EVENT));
}

// ------------------------------------------------------------------ phase 2

export interface Approval { id: string; entityType: string; decision: string; comment?: string; signer?: string; amount?: number | null; byName?: string; at: string }

export interface ChangeOrderItem {
  id?: string; description: string; targetType: 'phase' | 'task' | 'new_phase' | 'new_task' | 'none'; phaseId?: string | null; taskId?: string | null;
  newName?: string; amount: number | string; cost?: number | string | null; quantity?: number | string | null; unit?: string; rate?: number | string | null; csiCodeId?: string;
}
export interface ChangeOrder {
  id: string; projectId: number; projectName?: string; number: string; title: string; description?: string; reason: string; requestedBy?: string;
  status: 'draft' | 'internal_review' | 'submitted' | 'approved' | 'rejected' | 'cancelled'; scheduleImpactDays: number; amount: number | null;
  dateRequested?: string; notes?: string; attachments: any[]; items: ChangeOrderItem[]; total: number; cost: number; margin: number;
  submittedAt?: string; submittedBy?: string; internalApprovedAt?: string; internalApprovedBy?: string; clientSigner?: string; clientApprovedDate?: string;
  clientReference?: string; approvedAt?: string; approvedBy?: string; rejectedAt?: string; rejectedBy?: string; cancelledAt?: string; cancelledBy?: string;
  closedReason?: string; approvals?: Approval[]; version: number; createdAt: string; createdBy?: string;
}
export interface Reimbursable {
  id: string; projectId: number; projectName?: string; number: string; date: string; description: string; category: string; vendor?: string;
  cost: number; markupPct: number; markup: number; billAmount: number; billable: boolean; taxable: boolean; phaseId?: string; csiCodeId?: string;
  status: 'submitted' | 'approved' | 'rejected' | 'billed'; submittedBy?: string; approvedAt?: string; approvedBy?: string; rejectedAt?: string; rejectedBy?: string;
  rejectedReason?: string; invoiceId?: string; notes?: string; attachments: any[]; approvals?: Approval[]; version: number;
}
export interface RetentionRelease {
  id: string; number: string; scope: 'project' | 'phase' | 'task'; targetId?: string; amount: number; reason: string; notes?: string;
  status: 'requested' | 'approved' | 'rejected' | 'billed' | 'cancelled'; requestedBy?: string; approvedBy?: string; approvedAt?: string;
  rejectedBy?: string; closedReason?: string; invoiceId?: string; version: number; createdAt: string;
}

export const CO_REASONS: [string, string][] = [
  ['client_request', 'Client request'], ['design_change', 'Design change'], ['unforeseen', 'Unforeseen condition'], ['scope_addition', 'Added scope'],
  ['scope_reduction', 'Reduced scope'], ['allowance', 'Allowance adjustment'], ['code_requirement', 'Code / permit requirement'], ['other', 'Other'],
];
export const REIMB_CATEGORIES: [string, string][] = [
  ['travel', 'Travel & mileage'], ['printing', 'Printing & reproduction'], ['permits_fees', 'Permits & fees'], ['materials', 'Materials & samples'],
  ['consultants', 'Consultants'], ['shipping', 'Shipping & delivery'], ['equipment', 'Equipment rental'], ['other', 'Other'],
];
export const RELEASE_REASONS: [string, string][] = [
  ['substantial_completion', 'Substantial completion'], ['final_completion', 'Final completion'], ['milestone_accepted', 'Milestone accepted'], ['partial', 'Partial release'], ['other', 'Other'],
];
export const label = (list: [string, string][], k?: string) => list.find(([x]) => x === k)?.[1] || k || '—';

const CO_STATUS: Record<ChangeOrder['status'], [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  // Edward's three phases: Pending (costing it internally), Under client review, Approved / Rejected.
  draft: ['Pending', 'grey'], internal_review: ['Pending · internal review', 'amber'], submitted: ['Under client review', 'blue'], approved: ['Approved', 'green'], rejected: ['Rejected', 'red'], cancelled: ['Cancelled', 'grey'],
};
export const CoBadge = ({ s }: { s: ChangeOrder['status'] }) => <Badge tone={CO_STATUS[s][1]}>{CO_STATUS[s][0]}</Badge>;
const RE_STATUS: Record<Reimbursable['status'], [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  submitted: ['Awaiting approval', 'amber'], approved: ['Approved · to bill', 'blue'], rejected: ['Rejected', 'red'], billed: ['Billed', 'green'],
};
export const ReimbBadge = ({ s }: { s: Reimbursable['status'] }) => <Badge tone={RE_STATUS[s][1]}>{RE_STATUS[s][0]}</Badge>;
const RR_STATUS: Record<RetentionRelease['status'], [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  requested: ['Requested', 'amber'], approved: ['Approved · to bill', 'blue'], rejected: ['Rejected', 'red'], billed: ['Billed', 'green'], cancelled: ['Cancelled', 'grey'],
};
export const ReleaseBadge = ({ s }: { s: RetentionRelease['status'] }) => <Badge tone={RR_STATUS[s][1]}>{RR_STATUS[s][0]}</Badge>;

const DECISION: Record<string, string> = {
  submitted: 'Submitted for internal review', internal_approved: 'Approved internally · now under client review', sent_to_client: 'Emailed to the client for signature', client_approved: 'Approved by the client', approved: 'Approved', rejected: 'Rejected',
  cancelled: 'Cancelled', returned: 'Returned for changes', issued: 'Issued', requested: 'Requested', reopened: 'Reopened',
};

/** Who decided what, and when -- shown on every record that goes through approval. */
export function ApprovalTrail({ items }: { items?: Approval[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Approval trail</div>
      <div style={{ borderLeft: '2px solid #DCE7DE', paddingLeft: 12, display: 'grid', gap: 8 }}>
        {items.map((a) => (
          <div key={a.id} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            <b>{DECISION[a.decision] || a.decision}</b>{a.signer ? ` — signed by ${a.signer}` : ''}{a.amount != null ? ` · ${usd(a.amount)}` : ''}
            <div style={{ color: '#7E9B93', fontSize: 11.5 }}>{a.byName} · {new Date(a.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            {a.comment && <div style={{ color: '#0B1A12' }}>“{a.comment}”</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A reason, signature or amount asked for inline -- instead of the browser's prompt(). */
export function ReasonBox({ title, fields, confirm, tone, onCancel, onSubmit }: {
  title: string; fields: { key: string; label: string; type?: string; required?: boolean; initial?: string; placeholder?: string; options?: [string, string][] }[];
  confirm: string; tone?: 'danger'; onCancel: () => void; onSubmit: (v: Record<string, string>) => void;
}) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.initial || ''])));
  const ok = fields.every((f) => !f.required || v[f.key]?.trim());
  return (
    <div style={{ background: 'white', border: '1px solid ' + (tone === 'danger' ? '#E3C2B3' : '#173326'), borderRadius: 14, padding: '12px 14px', display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: tone === 'danger' ? '#8E2E0A' : '#0B1A12' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {fields.map((f) => (
          <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : undefined }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7E9B93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{f.label}{f.required ? ' *' : ''}</div>
            {f.options
              ? <select value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} style={INPUT}><option value="">Choose…</option>{f.options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              : f.type === 'textarea'
              ? <textarea rows={2} value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} style={{ ...INPUT, resize: 'vertical' }} />
              : <input type={f.type || 'text'} value={v[f.key]} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} style={INPUT} />}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={ok ? () => onSubmit(v) : undefined} style={{ padding: '8px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: ok ? 'pointer' : 'default', background: ok ? (tone === 'danger' ? '#8E2E0A' : '#173326') : '#C9D3CE', color: 'white' }}>{confirm}</div>
        <div onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(20,8,31,.12)' }}>Cancel</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ phase 3

/** A table as a CSV download -- every report can be taken to a spreadsheet. */
export function downloadCsv(filename: string, columns: [string, string][], rows: Record<string, any>[]) {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(([, l]) => cell(l)).join(','), ...rows.map((r) => columns.map(([k]) => cell(r[k])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const COMMITMENT_TYPES: [string, string][] = [['subcontract', 'Subcontract'], ['purchase_order', 'Purchase order'], ['service', 'Service agreement']];
export const COST_TYPES: [string, string][] = [
  ['vendor_bill', 'Vendor bill'], ['subcontract_invoice', 'Subcontractor pay app'], ['material', 'Material'], ['equipment', 'Equipment'], ['other', 'Other'],
];
const CM_STATUS: Record<string, [string, 'grey' | 'amber' | 'blue' | 'green' | 'red']> = {
  draft: ['Draft', 'grey'], approved: ['Approved', 'green'], closed: ['Closed', 'blue'], void: ['Void', 'grey'],
  recorded: ['Recorded', 'amber'], paid: ['Paid', 'green'],
};
export const CostBadge = ({ s }: { s: string }) => <Badge tone={(CM_STATUS[s] || [s, 'grey'])[1]}>{(CM_STATUS[s] || [s])[0]}</Badge>;
