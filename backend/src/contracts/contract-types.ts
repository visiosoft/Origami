/**
 * Contracts signed inside ODIN (Oct 27 backlog: "Contracts for Services"):
 * the six kinds, their parties, their default templates, the merge fields and
 * the initials boxes. Pure, so it's easy to test.
 *
 * The default wording is a starting point the office edits in Settings ->
 * Contract templates; it is not legal advice and should be reviewed by counsel.
 */
export const CONTRACT_TYPES = [
  { key: 'gc', label: 'GC contract', counterparty: 'owner', counterpartyLabel: 'Owner' },
  { key: 'owner', label: 'Owner contract', counterparty: 'owner', counterpartyLabel: 'Owner' },
  { key: 'sub', label: 'Subcontract', counterparty: 'sub', counterpartyLabel: 'Subcontractor' },
  { key: 'consultant', label: 'Consultant agreement', counterparty: 'consultant', counterpartyLabel: 'Consultant' },
  { key: 'co_owner', label: 'Change order — owner', counterparty: 'owner', counterpartyLabel: 'Owner' },
  { key: 'co_sub', label: 'Change order — subcontractor', counterparty: 'sub', counterpartyLabel: 'Subcontractor' },
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number]['key'];
export const isContractType = (v: unknown): v is ContractType => CONTRACT_TYPES.some((t) => t.key === v);
export const typeOf = (k: string) => CONTRACT_TYPES.find((t) => t.key === k)!;

export const CONTRACT_STATUSES = ['draft', 'sent', 'countersign', 'signed', 'void'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** Someone who signs (or a copy holder). `internal` = Origami's own signer, who signs last, inside the app. */
export interface ContractParty {
  key: string;
  role: string;
  label: string;
  name: string;
  email: string;
  personId?: number | null;
  internal?: boolean;
  sentAt?: string | null;
  viewedAt?: string | null;
  signedAt?: string | null;
  signedName?: string | null;
  initials?: string | null;
  signatureImage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ContractAttachment { fileId: string; name: string; kind: 'estimate' | 'drawings' | 'specs' | 'other' }

// ------------------------------------------------------------------ merge fields

export const MERGE_FIELDS: [string, string][] = [
  ['contract.number', 'Contract number'], ['contract.amount', 'Contract amount'], ['contract.date', 'Today’s date'],
  ['project.name', 'Project name'], ['project.address', 'Project address'], ['project.scope', 'Project scope'],
  ['owner.name', 'Owner / client name'], ['owner.email', 'Owner email'],
  ['party.name', 'Other party (sub, consultant or owner)'], ['party.company', 'Other party’s company'], ['party.email', 'Other party’s email'],
  ['company.name', 'Our company name'], ['company.address', 'Our address'], ['company.license', 'Our licence number'],
  ['changeOrder.number', 'Change order number'], ['changeOrder.title', 'Change order title'], ['changeOrder.description', 'Change order description'], ['changeOrder.amount', 'Change order amount'],
  ['subcontract.number', 'Subcontract / PO number'], ['subcontract.title', 'Subcontract title'], ['subcontract.amount', 'Subcontract amount'],
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Fill {{project.name}}-style fields. Unknown fields stay visible so a gap is
 * obvious, except {{initials}}, which is the signers' to fill.
 */
export function mergeContract(html: string, data: Record<string, string | null | undefined>): string {
  return String(html || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => {
    if (key === 'initials') return m;
    const v = data[key];
    return v == null || v === '' ? m : esc(String(v));
  });
}

/** The {{fields}} still unfilled (initials aside) -- shown before sending. */
export function unfilledFields(html: string): string[] {
  const out = new Set<string>();
  for (const m of String(html || '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) if (m[1] !== 'initials') out.add(m[1]);
  return [...out];
}

// ------------------------------------------------------------------ initials

/** How many initial boxes each signer must fill. */
export const countInitials = (html: string) => (String(html || '').match(/\{\{\s*initials\s*\}\}/g) || []).length;

/**
 * The document with signatures in place: each initials box shows every
 * signer's initials (blank lines for those who haven't), and the signature
 * page lists each party with their signature, name and date.
 */
export function renderSigned(html: string, parties: ContractParty[], opts: { title?: string } = {}): string {
  const signers = parties.filter((p) => p.role !== 'copy');
  const box = signers.map((p) => `<span style="display:inline-block;min-width:44px;padding:1px 6px;margin-right:6px;border-bottom:1px solid #444;font:600 11px Helvetica,Arial,sans-serif;text-align:center;" title="${esc(p.label)}">${p.signedAt && p.initials ? esc(p.initials) : '&nbsp;'}</span>`).join('');
  const withInitials = String(html || '').replace(/\{\{\s*initials\s*\}\}/g, `<span style="display:inline-block;margin:4px 0;font:11px Helvetica,Arial,sans-serif;color:#555;">Initials: ${box}</span>`);
  const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '____________________');
  const blocks = signers.map((p) => `
    <td style="width:50%;vertical-align:bottom;padding:18px 18px 0 0;">
      ${p.signatureImage ? `<img src="${p.signatureImage}" alt="Signature of ${esc(p.signedName || p.name)}" style="max-width:220px;max-height:70px;display:block;margin-bottom:4px;" />` : '<div style="height:60px;"></div>'}
      <div style="border-top:1px solid #333;padding-top:4px;font:12px Helvetica,Arial,sans-serif;"><strong>${esc(p.signedName || p.name || p.label)}</strong><br/>${esc(p.label)}<br/>Date: ${day(p.signedAt)}</div>
    </td>`);
  const rows: string[] = [];
  for (let i = 0; i < blocks.length; i += 2) rows.push(`<tr>${blocks[i]}${blocks[i + 1] || '<td></td>'}</tr>`);
  const page = `<div style="page-break-inside:avoid;margin-top:28px;"><h3 style="font:700 14px Helvetica,Arial,sans-serif;margin:0 0 4px;">Signatures${opts.title ? ` — ${esc(opts.title)}` : ''}</h3><table style="width:100%;border-collapse:collapse;">${rows.join('')}</table></div>`;
  return withInitials + page;
}

/** Initials from a name: "Kai Lono" -> "KL". */
export const initialsOf = (name: string) => String(name || '').split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 4);

/** Where a contract stands from its parties: still out with someone, waiting on Origami, or done. */
export function statusFromParties(parties: ContractParty[]): ContractStatus {
  const signers = parties.filter((p) => p.role !== 'copy');
  const external = signers.filter((p) => !p.internal);
  if (signers.length && signers.every((p) => p.signedAt)) return 'signed';
  if (external.length && external.every((p) => p.signedAt)) return 'countersign';
  return 'sent';
}

// ------------------------------------------------------------------ default templates

const SECTION = (n: number, title: string, body: string) => `<h3>${n}. ${title}</h3>\n<p>${body}</p>\n<p>{{initials}}</p>`;
const HEAD = (title: string, between: string) => `<h2>${title}</h2>\n<p><strong>Contract no.</strong> {{contract.number}} &nbsp;·&nbsp; <strong>Date:</strong> {{contract.date}}</p>\n<p>This agreement is made between <strong>{{company.name}}</strong> (licence {{company.license}}), {{company.address}}, and ${between}, for the project <strong>{{project.name}}</strong> at {{project.address}}.</p>`;

export const DEFAULT_TEMPLATES: Record<ContractType, { name: string; html: string }> = {
  gc: {
    name: 'GC contract (standard)',
    html: [
      HEAD('General Construction Contract', '<strong>{{owner.name}}</strong> ("Owner")'),
      SECTION(1, 'Scope of work', 'Contractor will furnish the labour, materials and supervision to complete the work described in the attached estimate, drawings and specifications: {{project.scope}}'),
      SECTION(2, 'Contract price', 'Owner will pay Contractor <strong>{{contract.amount}}</strong>, subject to additions and deductions by approved change orders.'),
      SECTION(3, 'Payments', 'Progress payments are due within 15 days of each invoice, less any agreed retention. Final payment is due on completion and acceptance of the work.'),
      SECTION(4, 'Changes', 'No change to the scope, price or schedule is binding unless set out in a change order signed by both parties.'),
      SECTION(5, 'Schedule', 'Work will begin on the agreed start date and proceed with reasonable diligence, allowing for weather, permit and owner-caused delays.'),
      SECTION(6, 'Insurance and warranty', 'Contractor will carry general liability and workers’ compensation insurance and warrants its workmanship for one year from completion.'),
      SECTION(7, 'Disputes', 'The parties will first try to resolve any dispute in good faith before mediation, arbitration or court.'),
    ].join('\n'),
  },
  owner: {
    name: 'Owner contract (design + build)',
    html: [
      HEAD('Owner Agreement', '<strong>{{owner.name}}</strong> ("Owner")'),
      SECTION(1, 'Services', 'Origami will provide the design and construction services described in the attached proposal and estimate for {{project.scope}}.'),
      SECTION(2, 'Price and payment', 'The contract price is <strong>{{contract.amount}}</strong>, invoiced as set out in the payment schedule. Invoices are due within 15 days.'),
      SECTION(3, 'Owner responsibilities', 'Owner will provide site access, timely decisions and selections, and any information about the property Origami reasonably requests.'),
      SECTION(4, 'Changes', 'Changes to scope, selections or schedule are made by written change order, priced before the work is done.'),
      SECTION(5, 'Permits and inspections', 'Origami will obtain the permits and inspections the work requires unless agreed otherwise in writing.'),
      SECTION(6, 'Warranty', 'Origami warrants its workmanship for one year from substantial completion; manufacturer warranties pass to Owner.'),
    ].join('\n'),
  },
  sub: {
    name: 'Subcontract (standard)',
    html: [
      HEAD('Subcontract Agreement', '<strong>{{party.company}}</strong> ("Subcontractor")'),
      SECTION(1, 'Scope', 'Subcontractor will perform the work in subcontract {{subcontract.number}} — {{subcontract.title}} — per the attached drawings, specifications and estimate.'),
      SECTION(2, 'Price', 'The subcontract price is <strong>{{contract.amount}}</strong>, including all labour, materials, equipment, taxes and fees for the scope.'),
      SECTION(3, 'Payment', 'Payment is made within 10 days after Origami is paid for the work, less 10% retention released at final completion and lien releases.'),
      SECTION(4, 'Schedule and coordination', 'Subcontractor will follow Origami’s schedule, attend coordination meetings and keep the site clean and safe.'),
      SECTION(5, 'Insurance and licence', 'Subcontractor will keep its licence current and carry general liability, auto and workers’ compensation insurance naming Origami as additional insured.'),
      SECTION(6, 'Changes', 'Extra work is paid only under a subcontract change order signed before the work is done.'),
      SECTION(7, 'Warranty and indemnity', 'Subcontractor warrants its work for one year and indemnifies Origami against claims arising from its work.'),
    ].join('\n'),
  },
  consultant: {
    name: 'Consultant agreement (standard)',
    html: [
      HEAD('Consultant Services Agreement', '<strong>{{party.company}}</strong> ("Consultant")'),
      SECTION(1, 'Services', 'Consultant will provide the professional services described in its attached proposal for the project.'),
      SECTION(2, 'Fee', 'The fee is <strong>{{contract.amount}}</strong>, invoiced monthly for services performed. Reimbursable expenses are billed at cost when approved in advance.'),
      SECTION(3, 'Deliverables and schedule', 'Consultant will deliver drawings, calculations and reports on the agreed schedule and respond to RFIs within five business days.'),
      SECTION(4, 'Standard of care', 'Consultant will perform its services with the care and skill ordinarily used by members of its profession.'),
      SECTION(5, 'Insurance', 'Consultant will carry professional liability and general liability insurance for the duration of the project.'),
      SECTION(6, 'Ownership of documents', 'Origami and the owner may use Consultant’s documents for this project.'),
    ].join('\n'),
  },
  co_owner: {
    name: 'Change order — owner',
    html: [
      `<h2>Change Order {{changeOrder.number}}</h2>\n<p><strong>Project:</strong> {{project.name}} &nbsp;·&nbsp; <strong>Contract:</strong> {{contract.number}} &nbsp;·&nbsp; <strong>Date:</strong> {{contract.date}}</p>\n<p><strong>Owner:</strong> {{owner.name}}</p>`,
      SECTION(1, 'Change', '{{changeOrder.title}} — {{changeOrder.description}}'),
      SECTION(2, 'Price', 'This change order adds <strong>{{changeOrder.amount}}</strong> to the contract price. All other terms of the contract stay the same.'),
      SECTION(3, 'Schedule', 'Any change to the completion date is as stated in the attached estimate; otherwise the schedule is unchanged.'),
    ].join('\n'),
  },
  co_sub: {
    name: 'Change order — subcontractor',
    html: [
      `<h2>Subcontract Change Order</h2>\n<p><strong>Project:</strong> {{project.name}} &nbsp;·&nbsp; <strong>Subcontract:</strong> {{subcontract.number}} &nbsp;·&nbsp; <strong>Date:</strong> {{contract.date}}</p>\n<p><strong>Subcontractor:</strong> {{party.company}}</p>`,
      SECTION(1, 'Change', '{{changeOrder.title}} — {{changeOrder.description}}'),
      SECTION(2, 'Price', 'This change order adjusts the subcontract price by <strong>{{contract.amount}}</strong>. All other subcontract terms stay the same.'),
    ].join('\n'),
  },
};
