/**
 * Duplicate roles (Nov 3 sync): the original defaults and the access-matrix
 * import made two of several roles. The matrix set is kept (the user's
 * answer, Nov 4); each old default maps to its matrix role.
 */
export const ROLE_MERGE: Record<string, string> = {
  project_manager: 'r_internal_project_manager',
  site_super: 'r_internal_super',
  consultant: 'r_consultant',
  subcontractor: 'r_subcontractor',
  authority: 'r_authority',
};
/** Roles that run a site (for the field daily report). */
export const SUPER_ROLES = ['site_super', 'r_internal_super'];
