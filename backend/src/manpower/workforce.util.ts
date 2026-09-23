import type { EmployeeAssignmentEntity, EmployeeEntity } from '../database/entities';

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const newId = (prefix: string) =>
  prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

/** Statuses meaning the person has left: kept on record, never deployed. */
export const LEFT_STATUSES = ['resigned', 'terminated', 'contract_expired', 'demobilized'];

export const lifecycleStatus = (e: Pick<EmployeeEntity, 'employmentStatus' | 'status'>) =>
  e.employmentStatus || (e.status === 'inactive' ? 'resigned' : 'active');

/** Only someone actively employed can be put on a project. */
export const isDeployable = (e: Pick<EmployeeEntity, 'employmentStatus' | 'status'>) => lifecycleStatus(e) === 'active';

/**
 * Still holding the worker: not ended, and not past its own end date. A
 * future-dated start still counts -- the worker is already committed.
 */
export const isOpen = (a: Pick<EmployeeAssignmentEntity, 'status' | 'endDate'>, on = todayISO()) =>
  a.status === 'active' && (!a.endDate || a.endDate >= on);
