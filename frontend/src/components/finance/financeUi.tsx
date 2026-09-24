import { Badge } from '../manpowerUi';

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
}
export interface Group { category: 'design' | 'construction' | 'other' | 'unphased'; label: string; rows: Row[]; totals: Figures }
export interface Summary {
  originalContract: number; approvedChanges: number; revisedContract: number; allocated: number; unallocated: number; allocation: 'under' | 'full' | 'over';
  ev: number; contractWorkInvoiced: number; invoiceTotals: number; paid: number; arOutstanding: number; unbilledEarned: number; overBilled: number;
  remainingContract: number; retentionHeld: number; billableNow: number; overdue: number; overdueCount: number; lumpSum: boolean;
}
export interface Settings {
  projectId: number; exists: boolean; version: number; currency: string; originalContractValue: number; originalBudget: number | null;
  retentionPct: number; taxPct: number; paymentTermsDays: number; requireProgressApproval: boolean; billToName?: string; billToEmail?: string;
  billToAddress?: string; contractNumber?: string; poNumber?: string; notes?: string; contractLockedAt?: string; reportedProgress: number; approvedProgress: number;
}
export interface Rights { view: boolean; manage: boolean; reportProgress: boolean; approveProgress: boolean }
export interface Overview {
  project: { id: number; name: string; contractAmt: string; stage: string };
  settings: Settings; billToDefaults: { name: string; email: string; address: string } | null; suggestedContract: number;
  sov: { summary: Summary; groups: Group[]; lump: Row | null }; drafts: number; rights: Rights;
  looseTasks?: { id: string; title: string }[];
}
export interface InvoiceLine {
  id: string; kind: 'progress' | 'manual' | 'adjustment'; targetType?: string | null; phaseId?: string | null; taskId?: string | null; lineOrder: number;
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
  paymentStatus: 'draft' | 'void' | 'paid' | 'overdue' | 'partially_paid' | 'unpaid'; overdue: boolean;
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
