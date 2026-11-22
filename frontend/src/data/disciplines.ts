/**
 * Nov 19 (Edward's People categories, "Consultant list" sheet): the disciplines a
 * consultant or authority is picked from -- one list, A-Z, no duplicates.
 * Subcontractor and vendor trades come from Settings (CSI).
 */
export const CONSULTANT_DISCIPLINES = [
  'Acoustical Consultant', 'Arborist', 'Architect', 'Attorney', 'BRE (Building Research Establishment)', 'Building Department', 'Civil Engineer',
  'Drafting', 'Electrical Engineer', 'Energy / Title 24', 'Environmental / Hazmat / Asbestos', 'Fire Department', 'Fire Suppression',
  'Furniture Layout', 'Geotechnical Engineer', 'Green Building', 'Historian', 'Interior Designer', 'Joint Trench (Utility)', 'Kitchen / BOH Designer',
  'Landscape Architect', 'Lighting Designer', 'Mechanical Engineer', 'MEP Engineer', 'Permit Expediter', 'PG&E', 'Photometrics', 'Photovoltaic (Solar)',
  'Planning Department', 'Plumbing Engineer', 'Structural Engineer', 'Surveyor', 'Title Insurance', 'Traffic Engineer', 'Utility', 'Waterproofing Consultant', 'Well Driller',
] as const;

/**
 * Internal roles, one name each (Nov 3: two "project managers", two "site
 * superintendents" -- the same role typed two ways). Picked, not typed.
 * From the PEOPLE ACCESS sheet, top to bottom.
 */
export const INTERNAL_ROLES = [
  'Executive', 'Administrator', 'Project Manager', 'Architect', 'Construction Manager', 'Estimator', 'Project Coordinator', 'Designer', 'Accounting',
  'Superintendent', 'Foreman', 'Laborer',
] as const;

/** The one name for an internal role typed another way ("PM", "Site Super"), else the text as typed. */
export function canonicalRole(role: string): string {
  const r = role.trim().toLowerCase().replace(/\s+/g, ' ');
  const alias: Record<string, string> = {
    pm: 'Project Manager', 'project mgr': 'Project Manager', 'internal project manager': 'Project Manager',
    super: 'Superintendent', 'site super': 'Superintendent', 'site superintendent': 'Superintendent', 'internal super': 'Superintendent',
    pc: 'Project Coordinator', coordinator: 'Project Coordinator', cm: 'Construction Manager', 'foreman lead': 'Foreman', labor: 'Laborer', labour: 'Laborer', labourer: 'Laborer',
    admin: 'Administrator',
  };
  return alias[r] || INTERNAL_ROLES.find((x) => x.toLowerCase() === r) || role.trim();
}
