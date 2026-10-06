// Types, style maps and the access helper for user management & roles.
import { MODULES, type ModuleRef } from './nav';

export type Tier = 'internal' | 'client' | 'consultant';
export type Action = 'view' | 'manage';
export type UserStatus = 'pending' | 'active' | 'suspended';

export type RolePermissions = Record<string, { view: boolean; manage: boolean }>;

export interface Role {
  key: string;
  name: string;
  description?: string;
  tier: Tier;
  order: number;
  isSystem: boolean;
  permissions: RolePermissions;
}

export interface User {
  id: string;
  name: string;
  email: string;
  tier: Tier;
  roleKey: string;
  status: UserStatus;
  lastLogin?: string;
  createdAt: string;
  avatarUrl?: string;
  /** True once the user has chosen a password (set by the server). */
  hasPassword?: boolean;
  /** True while an unused invitation / reset link is outstanding. */
  invitePending?: boolean;
  /** Runs a site: Site Superintendent role, or an employee record whose designation says superintendent. From who-am-I. */
  isSuperintendent?: boolean;
  /** The account's own role permissions, returned by who-am-I. */
  rolePermissions?: RolePermissions;
  /** The role's display name, from who-am-I. */
  roleName?: string;
}

export { MODULES };
export type { ModuleRef };

export const TIERS: Tier[] = ['internal', 'client', 'consultant'];

export const TIER_STYLE: Record<Tier, { label: string; bg: string; color: string }> = {
  internal: { label: 'Internal', bg: 'var(--mint)', color: 'var(--forest)' },
  client: { label: 'Client', bg: '#EAE0F3', color: '#5B2E86' },
  consultant: { label: 'Consultant', bg: '#FBE9CE', color: '#8A5A12' },
};

export const STATUS_STYLE: Record<UserStatus, { label: string; bg: string; color: string }> = {
  active: { label: 'Active', bg: 'var(--c-d2ead3)', color: 'var(--c-1e6b36)' },
  pending: { label: 'Pending', bg: 'var(--amber-light)', color: 'var(--c-8a6d12)' },
  suspended: { label: 'Suspended', bg: '#F2DFD4', color: '#8E2E0A' },
};

// Whether a role may view/manage a module. System roles (admin) get everything.
export function can(role: Role | undefined, moduleKey: string, action: Action = 'view'): boolean {
  if (!role) return false;
  if (role.key === 'admin') return true;
  const p = role.permissions?.[moduleKey];
  return !!p && !!p[action];
}

/** Granular finance permissions; stored in the role's permission map like modules (manage = allowed). */
export const FIN_ACTIONS: [string, string, string][] = [
  ['finx_prepare_invoice', 'Prepare invoices', 'draft, edit and send for approval'],
  ['finx_issue_invoice', 'Issue invoices', 'issue, void, credit notes and write-offs'],
  ['finx_record_payment', 'Record payments', 'record and void client payments'],
  ['finx_approve_progress', 'Approve progress', 'approve reported progress for billing'],
  ['finx_approve_co', 'Approve change orders', 'internal approval and client sign-off'],
  ['finx_approve_reimb', 'Approve reimbursables', 'approve or reject expenses'],
  ['finx_release_retention', 'Release retention', 'approve retention releases'],
  ['finx_manage_costs', 'Record job costs', 'cost budget, subcontracts / POs and bills'],
  ['finx_approve_costs', 'Approve job costs', 'approve, close and pay subcontracts, POs and bills'],
  ['finx_view_profitability', 'See profitability', 'job cost, margins, WIP and cost reports'],
];

