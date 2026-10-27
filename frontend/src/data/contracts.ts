/** Contracts signed inside ODIN (Oct 27 backlog). Mirrors backend/src/contracts/contract-types.ts. */
export type ContractType = 'gc' | 'owner' | 'sub' | 'consultant' | 'co_owner' | 'co_sub';
export type ContractStatus = 'draft' | 'sent' | 'countersign' | 'signed' | 'void';
export interface ContractTypeInfo { key: ContractType; label: string; counterparty: string; counterpartyLabel: string }
export interface ContractParty {
  key: string; role: string; label: string; name: string; email: string; personId?: number | null; internal?: boolean;
  sentAt?: string | null; viewedAt?: string | null; signedAt?: string | null; signedName?: string | null; initials?: string | null; signatureImage?: string | null;
}
export interface ContractAttachment { fileId: string; name: string; kind: 'estimate' | 'drawings' | 'specs' | 'other' }
export interface Contract {
  id: string; number: string; projectId: number | null; projectName?: string | null; type: ContractType; title: string; html?: string; amount: string | null;
  status: ContractStatus; parties: ContractParty[]; attachments: ContractAttachment[] | null; changeOrderId?: string | null; commitmentId?: string | null;
  sentAt?: string | null; signedAt?: string | null; signedFileId?: string | null; voidedAt?: string | null; voidReason?: string | null;
  createdByName?: string | null; createdAt: string; updatedAt?: string | null; initialsNeeded?: number; unfilled?: string[];
}
export interface ContractTemplate { id: string; type: ContractType; name: string; html: string; isDefault?: boolean | null; updatedAt?: string | null; updatedBy?: string | null }
export interface ContractSigningView {
  number: string; title: string; amount: string | null; status: ContractStatus; html: string; initialsNeeded: number;
  attachments: { fileId: string; name: string; kind: string }[];
  you: { key: string; label: string; name: string; email: string; signedAt: string | null; suggestedInitials: string };
  parties: { label: string; name: string; signedAt: string | null }[];
}

export const CONTRACT_TYPES: ContractTypeInfo[] = [
  { key: 'gc', label: 'GC contract', counterparty: 'owner', counterpartyLabel: 'Owner' },
  { key: 'owner', label: 'Owner contract', counterparty: 'owner', counterpartyLabel: 'Owner' },
  { key: 'sub', label: 'Subcontract', counterparty: 'sub', counterpartyLabel: 'Subcontractor' },
  { key: 'consultant', label: 'Consultant agreement', counterparty: 'consultant', counterpartyLabel: 'Consultant' },
  { key: 'co_owner', label: 'Change order — owner', counterparty: 'owner', counterpartyLabel: 'Owner' },
  { key: 'co_sub', label: 'Change order — subcontractor', counterparty: 'sub', counterpartyLabel: 'Subcontractor' },
];
export const typeLabel = (k: string) => CONTRACT_TYPES.find((t) => t.key === k)?.label || k;

export const STATUS_LABEL: Record<ContractStatus, string> = { draft: 'Draft', sent: 'Out for signature', countersign: 'Ready for Origami to sign', signed: 'Signed', void: 'Void' };
export const STATUS_TONE: Record<ContractStatus, { bg: string; c: string }> = {
  draft: { bg: 'var(--c-efede8)', c: 'var(--body)' }, sent: { bg: '#FBEFC9', c: '#7A5A0B' }, countersign: { bg: '#E3ECFB', c: '#1D4ED8' },
  signed: { bg: 'var(--c-d2ead3)', c: 'var(--success-deep)' }, void: { bg: '#F2DFD4', c: '#8E2E0A' },
};
export const ATTACH_KINDS: [ContractAttachment['kind'], string][] = [['estimate', 'Estimate'], ['drawings', 'Drawings'], ['specs', 'Specs'], ['other', 'Other']];

/** Who's still to sign, for the list: "Waiting on Kai Lono", "Waiting on Origami". */
export function waitingOn(c: Pick<Contract, 'status' | 'parties'>): string {
  if (c.status === 'signed' || c.status === 'void' || c.status === 'draft') return '';
  const open = c.parties.filter((p) => p.role !== 'copy' && !p.signedAt);
  return open.length ? `Waiting on ${open.map((p) => (p.internal ? 'Origami' : p.name || p.label)).join(', ')}` : '';
}

/** The document split at each {{initials}} box: n+1 pieces around n boxes. */
export const splitAtInitials = (html: string) => String(html || '').split(/\{\{\s*initials\s*\}\}/);

/**
 * Contract HTML made safe to show: no scripts, frames, styles from outside, or
 * event handlers (the wording comes from staff templates, but the page is public).
 */
export function sanitizeHtml(html: string): string {
  return String(html || '')
    // Whole elements that never belong in a contract.
    .replace(/<(script|style|iframe|object|embed|form|textarea|select|button)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|input|base|form|button)\b[^>]*>/gi, '')
    // Event handlers: onclick="…", onload='…', onerror=x
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Links and sources that run code or load non-image data.
    .replace(/\s+(href|src)\s*=\s*("|')\s*(javascript:|vbscript:|data:(?!image\/))[^"']*\2/gi, '')
    .replace(/\s+(href|src)\s*=\s*(javascript:|vbscript:)[^\s>]*/gi, '');
}
