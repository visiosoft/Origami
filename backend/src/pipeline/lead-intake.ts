/**
 * The New Lead intake's fields (Oct 27 backlog, "Fix on New Lead Stage"):
 * every one needs an answer or "N/A" before the lead moves past New Lead.
 * Mirrored by frontend/src/data/leadIntake.ts.
 */
export const NOT_APPLICABLE = 'N/A';

const referral = (l: Record<string, any>) => /referral/i.test(String(l.leadSource || ''));
const event = (l: Record<string, any>) => /event|networking/i.test(String(l.leadSource || ''));

export const INTAKE_FIELDS: { key: string; label: string; when?: (lead: Record<string, any>) => boolean }[] = [
  { key: 'firstName', label: 'First Name' }, { key: 'lastName', label: 'Last Name' }, { key: 'goByName', label: 'Go-By Name' },
  { key: 'pronouns', label: 'Pronouns' }, { key: 'namePronunciation', label: 'Name Pronunciation' }, { key: 'phone', label: 'Phone Number' },
  { key: 'email', label: 'Email' }, { key: 'primaryPointOfContact', label: 'Primary Point of Contact' }, { key: 'secondPointOfContact', label: 'Secondary contact' },
  { key: 'leadSource', label: 'Lead Source' },
  { key: 'leadSourceReferrerName', label: 'Referred By', when: referral },
  { key: 'leadSourceReferrerPhone', label: 'Referrer Phone', when: referral },
  { key: 'leadSourceEventDetail', label: 'Where It Was', when: event },
  { key: 'projectStreetAddress', label: 'Project Street Address' }, { key: 'projectStreetName', label: 'Project Street Name' }, { key: 'projectAddress2', label: 'Address 2' },
  { key: 'projectCity', label: 'Project City' }, { key: 'projectZipCode', label: 'Project ZIP Code' }, { key: 'hasHOA', label: 'Property has an HOA' },
  { key: 'countyLocation', label: 'County' }, { key: 'occupancyStatus', label: 'Owner or Tenant' },
  { key: 'propertyType', label: 'Property Type' }, { key: 'potentialProjectType', label: 'Potential Project Type' }, { key: 'contractType', label: 'Contract Type' },
  { key: 'website', label: 'Website' }, { key: 'projectVision', label: 'Project Vision / Scope' },
  { key: 'reasonForProject', label: 'Reason for Project' }, { key: 'budgetPosition', label: 'Budget Position' }, { key: 'fundingStatus', label: 'Funding Status' },
  { key: 'desiredStart', label: 'Desired Start' }, { key: 'expectedDuration', label: 'Expected Duration' }, { key: 'expectedLengthOfOwnership', label: 'Expected Length of Ownership' },
  { key: 'decisionMakers', label: 'Decision Makers' }, { key: 'clientPersonality', label: 'Client Personality' },
];

export const isAnswered = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '');

/** The intake fields still without an answer or N/A. */
export const missingIntake = (lead: Record<string, any> | null | undefined) =>
  INTAKE_FIELDS.filter((f) => (!f.when || f.when(lead || {})) && !isAnswered((lead || {})[f.key]));

/** Stages a lead can't reach from New Lead until the intake is complete: the active funnel (holds and closing it are fine). */
export const NEEDS_INTAKE = ['contact_attempted', 'initial_questions', 'virtual_ff', 'project_fit', 'site_visit', 'zoning', 'proposal', 'client_approval'];
