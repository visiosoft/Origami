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
}

export { MODULES };
export type { ModuleRef };

export const TIERS: Tier[] = ['internal', 'client', 'consultant'];

export const TIER_STYLE: Record<Tier, { label: string; bg: string; color: string }> = {
  internal: { label: 'Internal', bg: '#DCE7DE', color: '#173326' },
  client: { label: 'Client', bg: '#EAE0F3', color: '#5B2E86' },
  consultant: { label: 'Consultant', bg: '#FBE9CE', color: '#8A5A12' },
};

export const STATUS_STYLE: Record<UserStatus, { label: string; bg: string; color: string }> = {
  active: { label: 'Active', bg: '#D2EAD3', color: '#1E6B36' },
  pending: { label: 'Pending', bg: '#FBE9AE', color: '#8A6D12' },
  suspended: { label: 'Suspended', bg: '#F2DFD4', color: '#8E2E0A' },
};

// Whether a role may view/manage a module. System roles (admin) get everything.
export function can(role: Role | undefined, moduleKey: string, action: Action = 'view'): boolean {
  if (!role) return false;
  if (role.key === 'admin') return true;
  const p = role.permissions?.[moduleKey];
  return !!p && !!p[action];
}
