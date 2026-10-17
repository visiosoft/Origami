import type { RolePermissions } from './users';

/**
 * Granular access (the client's PEOPLE ACCESS matrix): an access LEVEL and an
 * EXTENT for each role and data type (backend users/access-levels.ts).
 */
export const LEVELS = ['block', 'block_permit', 'view', 'input', 'user', 'dashboard', 'modify', 'full'] as const;
export type Level = (typeof LEVELS)[number];
export type Extent = 'assigned' | 'portfolio';
export const OVERALL_KEY = '__overall';

export const LEVEL_LABEL: Record<Level, string> = {
  block: 'Block access', block_permit: 'Block, as permit', view: 'View only', input: 'Input', user: 'User',
  dashboard: 'Dashboard', modify: 'Modify', full: 'Full edit',
};
export const LEVEL_SHORT: Record<Level, string> = {
  block: 'Block', block_permit: 'Permit', view: 'View', input: 'Input', user: 'User', dashboard: 'Dash', modify: 'Modify', full: 'Full',
};
export const LEVEL_HINT: Record<Level, string> = {
  block: 'Can’t see or change anything. Only the Executive (full edit) can lift it.',
  block_permit: 'Starts blocked; an Executive or Administrator can grant it.',
  view: 'Sees the data, can’t add or change it.',
  input: 'Adds their own entries and sees / changes only those.',
  user: 'Their own entries and those of people they supervise, on assigned projects.',
  dashboard: 'Sees everyone’s data, with limited input (e.g. assigning from their own items).',
  modify: 'Changes most people’s data.',
  full: 'Adds, changes, reassigns and deletes everything.',
};
export const EXTENT_LABEL: Record<Extent, string> = { assigned: 'Assigned projects', portfolio: 'Portfolio' };

/** View: above the blocks; manage (add / change): Input and up. */
export function flagsFor(level: Level) {
  const i = LEVELS.indexOf(level);
  return { view: i >= LEVELS.indexOf('view'), manage: i >= LEVELS.indexOf('input') };
}
export const permFor = (level: Level, extent?: Extent, note?: string) => ({ ...flagsFor(level), level, ...(extent ? { extent } : {}), ...(note ? { note } : {}) });

/** Does this role use levels (it came from the access matrix, or was set up with them)? */
export const usesLevels = (p?: RolePermissions | null) => !!p && Object.values(p).some((x) => !!x?.level);

/** A data type's setting for a role: its own, else the role's overall access. */
export function levelOf(p: RolePermissions | null | undefined, key: string): { level?: Level; extent?: Extent; own: boolean } {
  const own = p?.[key];
  if (own?.level) return { level: own.level as Level, extent: (own.extent as Extent) || (p?.[OVERALL_KEY]?.extent as Extent), own: true };
  const o = p?.[OVERALL_KEY];
  return { level: o?.level as Level | undefined, extent: o?.extent as Extent | undefined, own: false };
}

/** A readable name for a data type key (menu items use their menu label). */
export function dataTypeLabel(key: string, modules: { key: string; label: string }[]): string {
  if (key === OVERALL_KEY) return 'Overall access';
  const m = modules.find((x) => x.key === key);
  if (m) return m.label;
  const s = key.replace(/^fin:/, '').replace(/^gr_(\d+\.\d+)_/, '$1 ').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
