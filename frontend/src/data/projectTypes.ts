// The work-type catalogue. Every project type carries the estimating code the
// office files it under, which also determines the property type and the
// standard scope proposed on the intake form.

export interface ProjectTypeSpec {
  /** Estimating code, e.g. SF-KITCHN-NS. */
  code: string;
  label: string;
  /** Heading it sits under in the picker. */
  group: string;
  /** Derived from the code prefix — see PREFIX_PROPERTY_TYPE. */
  propertyType: string;
  /** True when the work touches structure (-WS codes). */
  structural: boolean;
  /** Starting scope text, offered on the intake form and then edited. */
  scope: string;
}

/** The code prefix says what kind of property the work is on. */
export const PREFIX_PROPERTY_TYPE: Record<string, string> = {
  SF: 'Single Family Residence',
  MF: 'Multi-Family Residence',
  CP: 'Commercial',
  MX: 'Mixed Use',
  CD: 'Campus Development',
};

const G_RENO = 'Renovation & Remodel';
const G_ADD = 'Additions';
const G_GROUND = 'Ground Up';
const G_COMM = 'Commercial, Multi-Family & Mixed Use';

/** Built from the code so an entry can never disagree with its own prefix. */
const spec = (code: string, label: string, group: string, scope: string): ProjectTypeSpec => ({
  code,
  label,
  group,
  propertyType: PREFIX_PROPERTY_TYPE[code.slice(0, 2)] || 'Other',
  structural: code.endsWith('-WS'),
  scope,
});

export const PROJECT_TYPES: ProjectTypeSpec[] = [
  spec('SF-OTHERS-NS', 'Other', G_RENO,
    'Scope to be defined with the client.'),
  spec('SF-EXRNOV-NS', 'Residential Exterior Renovation Only w/o structural', G_RENO,
    'Exterior renovation with no structural modification. Includes siding, stucco, trim, exterior paint, windows and doors replaced in existing openings, roofing and exterior lighting as selected.'),
  spec('SF-EXREMO-WS', 'Residential Exterior Remodel Only w/ structural', G_RENO,
    'Exterior remodel including structural modification. Includes changes to openings, headers and framing, plus siding, windows, doors, roofing and exterior finishes. Structural engineering and permitting required.'),
  spec('SF-KITCHN-NS', 'Residential Interior Resurfacing - Kitchen Only w/o Structural', G_RENO,
    'Kitchen resurfacing within the existing footprint. Includes cabinetry, countertops, backsplash, flooring, finishes, fixtures and appliance replacement. No walls moved and no structural work.'),
  spec('SF-BATHRM-NS', 'Residential Interior Resurfacing - Bathroom Only w/o Structural', G_RENO,
    'Bathroom resurfacing within the existing footprint. Includes tile, vanity, countertops, fixtures, lighting and finishes. Plumbing fixtures replaced in place; no walls moved and no structural work.'),
  spec('SF-KITBAT-NS', 'Residential Interior Resurfacing - Kitchen and Bathroom Only w/o Structural', G_RENO,
    'Kitchen and bathroom resurfacing within existing footprints. Includes cabinetry, countertops, tile, fixtures, lighting and finishes throughout both areas. No walls moved and no structural work.'),
  spec('SF-WHRENO-NS', 'Residential Interior Renovation (Facelift) - Whole House w/o Structural', G_RENO,
    'Whole-house interior facelift within the existing footprint. Includes finishes, flooring, paint, millwork, lighting and fixture replacement throughout. No walls moved and no structural work.'),
  spec('SF-REMODL-WS', 'Residential Interior Remodel - w/structural', G_RENO,
    'Interior remodel including structural modification. Walls relocated or removed, new headers and framing as required, with associated mechanical, electrical and plumbing revisions. Structural engineering and permitting required.'),
  spec('MF-HOAKIT-NS', 'Multi-Family (Condo/Apt) Kitchen only w/o structural', G_RENO,
    'Condominium or apartment kitchen resurfacing within the existing footprint. Includes cabinetry, countertops, finishes and fixtures. Subject to HOA approval and building rules; no structural work.'),
  spec('MF-HOABAT-NS', 'Multi-Family (Condo/Apt) Bathroom only w/o structural', G_RENO,
    'Condominium or apartment bathroom resurfacing within the existing footprint. Includes tile, vanity, fixtures and finishes. Subject to HOA approval and building rules; no structural work.'),
  spec('MF-HOKTBT-NS', 'Multi-Family Single Unit (Condo/Apt) Kitchen and Bathroom only w/o structural', G_RENO,
    'Single-unit kitchen and bathroom resurfacing within existing footprints. Subject to HOA approval and building rules; no structural work.'),
  spec('MF-HOAREM-NS', 'Multi-Family Single Unit (Condo/Apt) Remodel only w/o structural', G_RENO,
    'Full single-unit remodel within the existing footprint. Includes finishes, cabinetry, fixtures and non-structural partition changes. Subject to HOA approval and building rules.'),
  spec('MF-HOAREM-WS', 'Multi-Family Single Unit (Condo/Apt) Remodel only w/ structural', G_RENO,
    'Full single-unit remodel including structural modification. Requires HOA and building approval, structural engineering and permitting.'),

  spec('SF-ADDTON-WS', 'Addition', G_ADD,
    'New conditioned square footage added to the existing residence. Includes foundation, framing, envelope, mechanical, electrical and plumbing, and interior finishes. Structural engineering and permitting required.'),
  spec('SF-ADDREN-WS', 'Addition and Renovation', G_ADD,
    'New addition combined with renovation of the existing residence. Includes foundation and framing for the addition, structural modification where the two meet, and finish work throughout. Structural engineering and permitting required.'),
  spec('SF-ARAADU-WS', 'Addition and Renovation w/Attached ADU', G_ADD,
    'Addition and renovation including an attached accessory dwelling unit. The ADU carries its own kitchen, bathroom and entry, with utilities per jurisdiction. Structural engineering and permitting required.'),
  spec('SF-ARDADU-WS', 'Addition and Renovation w/detached ADU', G_ADD,
    'Addition and renovation including a detached accessory dwelling unit. The ADU is a separate structure with its own foundation, envelope and utility connections. Structural engineering and permitting required.'),
  spec('SF-ADAADU-WS', 'Addition ADU attached only', G_ADD,
    'Attached accessory dwelling unit only. New conditioned space sharing a wall with the existing residence, with its own kitchen, bathroom and entry. Structural engineering and permitting required.'),
  spec('SF-ADDADU-WS', 'Addition ADU detached only', G_ADD,
    'Detached accessory dwelling unit only. Separate structure with its own foundation, envelope, utilities and site work. Structural engineering and permitting required.'),

  spec('SF-GSRAWL-WS', 'Ground Up Single Family Residence Raw Land', G_GROUND,
    'New single family residence on raw land. Includes site work, utilities, foundation, framing, envelope, full mechanical, electrical and plumbing, and interior and exterior finishes. Full design, engineering and entitlement required.'),
  spec('SF-GSADRL-WS', 'Ground Up Single Family Residence and ADU Raw Land', G_GROUND,
    'New single family residence with an accessory dwelling unit on raw land. Includes site work, utilities and full construction of both structures. Full design, engineering and entitlement required.'),
  spec('SF-GSFEXS-WS', 'Ground Up Single Family Residence w/Existing Structures', G_GROUND,
    'New single family residence on a site carrying existing structures. Includes demolition or retention as determined, site work, utilities and full construction. Full design, engineering and entitlement required.'),
  spec('SF-GADUEX-WS', 'Ground Up ADU Single Family Residence w/Existing Structures', G_GROUND,
    'New accessory dwelling unit on a site with an existing residence. Includes site work, utility connections and full construction of the ADU. Full design, engineering and entitlement required.'),

  spec('CP-COMMTI-NS', 'Commercial TI w/No Structure', G_COMM,
    'Commercial tenant improvement with no structural modification. Includes partitions, finishes, lighting, and mechanical, electrical and plumbing revisions within the existing shell.'),
  spec('CP-COMMTI-WS', 'Commercial TI w/Structure', G_COMM,
    'Commercial tenant improvement including structural modification. Includes openings, framing and structural revisions within the existing shell. Structural engineering and permitting required.'),
  spec('CP-COMMGU-WS', 'Commercial Ground Up', G_COMM,
    'New commercial building. Includes site work, utilities, foundation, structure, envelope, core systems and shell completion. Full design, engineering and entitlement required.'),
  spec('MF-RENOVA-NS', 'Multi-Family - Renovation w/no structure', G_COMM,
    'Multi-family property renovation with no structural modification. Includes unit and common-area finishes, fixtures and systems replacement in place.'),
  spec('MF-RENOVA-WS', 'Multi-Family - Renovation w/Structure', G_COMM,
    'Multi-family property renovation including structural modification. Includes framing changes across units or common areas. Structural engineering and permitting required.'),
  spec('MF-GRNDUP-WS', 'Multi-Family Ground Up', G_COMM,
    'New multi-family building. Includes site work, utilities, foundation, structure, envelope, unit build-out and common areas. Full design, engineering and entitlement required.'),
  spec('MX-MXDUSE-WS', 'Mixed Use', G_COMM,
    'Mixed use development combining commercial and residential occupancies. Includes site work, structure, envelope, and separated systems and egress per occupancy. Full design, engineering and entitlement required.'),
  spec('CD-CAMPDV-WS', 'Campus Development', G_COMM,
    'Multi-building campus development. Includes master planning, site infrastructure, utilities and phased construction across buildings. Full design, engineering and entitlement required.'),
];

/** Picker order — the groups as they appear on the intake form. */
export const PROJECT_TYPE_GROUPS = [G_RENO, G_ADD, G_GROUND, G_COMM];

/** The stored value carries the code, so a lead records which one was picked. */
export const projectTypeLabel = (t: ProjectTypeSpec) => `${t.label} (${t.code})`;

/** Match a stored value back to its spec — by labelled code, code, or label. */
export const findProjectType = (value?: string): ProjectTypeSpec | undefined => {
  if (!value) return undefined;
  const v = value.trim();
  return (
    PROJECT_TYPES.find((t) => projectTypeLabel(t) === v || t.code === v || t.label === v)
    // Tolerate values captured before the codes existed.
    || PROJECT_TYPES.find((t) => t.label.toLowerCase() === v.toLowerCase())
  );
};

export const PROJECT_TYPE_OPTIONS = PROJECT_TYPES.map(projectTypeLabel);

/**
 * Selecting a project type settles the property type and offers the standard
 * scope. The scope is only filled in when the field is still empty, so it can
 * never overwrite something already written by hand.
 */
export function projectTypePatch(value: string, currentVision: string) {
  const type = findProjectType(value);
  if (!type) return { potentialProjectType: value };
  return {
    potentialProjectType: value,
    propertyType: type.propertyType,
    ...(currentVision.trim() ? {} : { projectVision: type.scope }),
  };
}

/** Add the standard scope without discarding anything already written. */
export function appendScope(current: string, scope: string) {
  const text = (current || '').trim();
  if (!text) return scope;
  if (text.includes(scope.trim())) return current;
  return `${text}

${scope}`;
}
