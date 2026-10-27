/**
 * The New Lead intake's fields (Oct 27 backlog, "Fix on New Lead Stage"): each
 * needs an answer or N/A before the lead moves past New Lead. Mirrors
 * backend/src/pipeline/lead-intake.ts (the server enforces the same list).
 */
export const NOT_APPLICABLE = 'N/A';
const referral = (l: Record<string, any>) => /referral/i.test(String(l.leadSource || ''));
const event = (l: Record<string, any>) => /event|networking/i.test(String(l.leadSource || ''));

export const INTAKE_FIELDS: { key: string; label: string; tab: number; when?: (lead: Record<string, any>) => boolean }[] = [
  { key: 'firstName', label: 'First Name', tab: 1 }, { key: 'lastName', label: 'Last Name', tab: 1 }, { key: 'goByName', label: 'Go-By Name', tab: 1 },
  { key: 'pronouns', label: 'Pronouns', tab: 1 }, { key: 'namePronunciation', label: 'Name Pronunciation', tab: 1 }, { key: 'phone', label: 'Phone Number', tab: 1 },
  { key: 'email', label: 'Email', tab: 1 }, { key: 'primaryPointOfContact', label: 'Primary Point of Contact', tab: 1 }, { key: 'secondPointOfContact', label: 'Secondary contact', tab: 1 },
  { key: 'leadSource', label: 'Lead Source', tab: 2 },
  { key: 'leadSourceReferrerName', label: 'Referred By', tab: 2, when: referral },
  { key: 'leadSourceReferrerPhone', label: 'Referrer Phone', tab: 2, when: referral },
  { key: 'leadSourceEventDetail', label: 'Where It Was', tab: 2, when: event },
  { key: 'projectStreetAddress', label: 'Project Street Address', tab: 3 }, { key: 'projectStreetName', label: 'Project Street Name', tab: 3 }, { key: 'projectAddress2', label: 'Address 2', tab: 3 },
  { key: 'projectCity', label: 'Project City', tab: 3 }, { key: 'projectZipCode', label: 'Project ZIP Code', tab: 3 }, { key: 'hasHOA', label: 'Property has an HOA', tab: 3 },
  { key: 'countyLocation', label: 'County', tab: 3 }, { key: 'occupancyStatus', label: 'Owner or Tenant', tab: 3 },
  { key: 'propertyType', label: 'Property Type', tab: 4 }, { key: 'potentialProjectType', label: 'Potential Project Type', tab: 4 }, { key: 'contractType', label: 'Contract Type', tab: 4 },
  { key: 'website', label: 'Website', tab: 4 }, { key: 'projectVision', label: 'Project Vision / Scope', tab: 4 },
  { key: 'reasonForProject', label: 'Reason for Project', tab: 5 }, { key: 'budgetPosition', label: 'Budget Position', tab: 5 }, { key: 'fundingStatus', label: 'Funding Status', tab: 5 },
  { key: 'desiredStart', label: 'Desired Start', tab: 5 }, { key: 'expectedDuration', label: 'Expected Duration', tab: 5 }, { key: 'expectedLengthOfOwnership', label: 'Expected Length of Ownership', tab: 5 },
  { key: 'decisionMakers', label: 'Decision Makers', tab: 6 }, { key: 'clientPersonality', label: 'Client Personality', tab: 6 },
];

export const isAnswered = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '');
export const isNA = (v: unknown) => (Array.isArray(v) ? v[0] === NOT_APPLICABLE : v === NOT_APPLICABLE);

/** The intake fields still without an answer or N/A. */
export const missingIntake = (lead: Record<string, any>) =>
  INTAKE_FIELDS.filter((f) => (!f.when || f.when(lead)) && !isAnswered(lead[f.key]));
