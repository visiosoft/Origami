// The people involved in a lead.
//
// A lead outgrows a single primary/second contact pair as soon as owners,
// consultants and stakeholders appear, and one person routinely holds several
// roles at once — a lead is often both the primary contact and the decision
// maker, while an owner's rep may be the primary contact but not a decision
// maker. So roles are a list per contact, not a type of contact.

export interface LeadContact {
  id: string;
  firstName: string;
  lastName: string;
  goByName: string;
  pronouns: string;
  company: string;
  title: string;
  phone: string;
  email: string;
  preferredContactMethod: string;
  clientPersonality: string;
  /** Role codes held by this person, e.g. ['PC', 'AD']. */
  roles: string[];
  notes: string;
}

export interface ContactRole {
  code: string;
  label: string;
  /** Only one person may hold it — assigning it moves it. */
  single: boolean;
  /** The lead is incomplete until somebody holds it. */
  required: boolean;
  hint?: string;
}

export const CONTACT_ROLES: ContactRole[] = [
  { code: 'PC', label: 'Primary Contact', single: true, required: true },
  { code: 'SC', label: 'Secondary Contact', single: true, required: false },
  { code: 'OR', label: "Owner's Rep", single: true, required: false },
  { code: 'OC', label: "Owner's Consultant", single: false, required: false },
  { code: 'ON', label: 'Owner', single: false, required: true },
  { code: 'SH', label: 'Stakeholder', single: false, required: false, hint: 'Led by the Approver & Lead Decision Maker.' },
  { code: 'FY', label: 'FYI', single: false, required: false, hint: 'Kept informed, not consulted.' },
  { code: 'CA', label: 'Contract Authority', single: true, required: true },
  { code: 'C2', label: 'Contract Authority #2', single: true, required: false },
  { code: 'AD', label: 'Approver & Lead Decision Maker', single: true, required: true },
];

export const roleByCode = (code: string) => CONTACT_ROLES.find((r) => r.code === code);
export const roleLabel = (code: string) => roleByCode(code)?.label || code;

export const REQUIRED_ROLES = CONTACT_ROLES.filter((r) => r.required);

export const blankContact = (): LeadContact => ({
  id: 'C-' + Math.random().toString(36).slice(2, 9),
  firstName: '', lastName: '', goByName: '', pronouns: '',
  company: '', title: '', phone: '', email: '',
  preferredContactMethod: '', clientPersonality: '', roles: [], notes: '',
});

export const contactName = (c: LeadContact) => {
  const full = [c.firstName, c.lastName].map((p) => (p || '').trim()).filter(Boolean).join(' ');
  return full || (c.goByName || '').trim() || 'Unnamed contact';
};

/** How to address them: the go-by name when they gave one. */
export const contactPreferredName = (c: LeadContact) =>
  (c.goByName || '').trim() || (c.firstName || '').trim() || contactName(c);

/**
 * Apply a role to one contact, honouring single-holder roles.
 *
 * A single-holder role can only sit with one person, so granting it removes it
 * from whoever held it before rather than silently allowing two.
 */
export function toggleRole(contacts: LeadContact[], contactId: string, code: string): LeadContact[] {
  const role = roleByCode(code);
  const target = contacts.find((c) => c.id === contactId);
  if (!target) return contacts;
  const adding = !target.roles.includes(code);

  return contacts.map((c) => {
    if (c.id === contactId) {
      return { ...c, roles: adding ? [...c.roles, code] : c.roles.filter((r) => r !== code) };
    }
    // Taking a single-holder role away from the previous holder.
    if (adding && role?.single && c.roles.includes(code)) {
      return { ...c, roles: c.roles.filter((r) => r !== code) };
    }
    return c;
  });
}

/** Everyone holding a given role. */
export const holdersOf = (contacts: LeadContact[], code: string) =>
  contacts.filter((c) => c.roles.includes(code));

/** Required roles nobody holds yet. */
export const missingRoles = (contacts: LeadContact[]) =>
  REQUIRED_ROLES.filter((r) => !contacts.some((c) => c.roles.includes(r.code)));

/**
 * Build the directory from the primary/second contact fields captured on the
 * intake form, so a lead recorded before the directory existed opens populated
 * rather than blank.
 */
export function seedContactsFromLead(lead: Record<string, any>): LeadContact[] {
  const out: LeadContact[] = [];

  const primaryNamed = (lead.firstName || lead.lastName || lead.leadName || '').trim();
  if (primaryNamed) {
    out.push({
      ...blankContact(),
      id: 'C-primary',
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      goByName: lead.goByName || '',
      pronouns: lead.pronouns || '',
      phone: lead.phone || '',
      email: lead.email || '',
      preferredContactMethod: lead.preferredContactMethod || '',
      clientPersonality: lead.clientPersonality || '',
      // The person who called is the primary contact; whether they can also
      // sign or decide is for someone to confirm, so no other role is assumed.
      roles: ['PC'],
      notes: '',
    });
    // Fall back to splitting the single name for leads predating the split.
    if (!lead.firstName && !lead.lastName && lead.leadName) {
      const parts = String(lead.leadName).trim().split(/\s+/);
      out[0].firstName = parts[0] || '';
      out[0].lastName = parts.slice(1).join(' ');
    }
  }

  const secondName = (lead.nameOfSecondContact || '').trim();
  if (secondName) {
    const parts = secondName.split(/\s+/);
    out.push({
      ...blankContact(),
      id: 'C-second',
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
      pronouns: lead.pronounsOfSecondContact || '',
      phone: lead.phoneOfSecondContact || '',
      email: lead.emailOfSecondContact || '',
      preferredContactMethod: lead.preferredContactMethodOfSecondContact || '',
      title: lead.relationshipOfSecondContact || '',
      roles: ['SC'],
      notes: '',
    });
  }

  return out;
}
