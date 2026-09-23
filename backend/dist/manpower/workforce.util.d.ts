import type { EmployeeAssignmentEntity, EmployeeEntity } from '../database/entities';
export declare const todayISO: () => string;
export declare const newId: (prefix: string) => string;
export declare const LEFT_STATUSES: string[];
export declare const lifecycleStatus: (e: Pick<EmployeeEntity, "employmentStatus" | "status">) => string;
export declare const isDeployable: (e: Pick<EmployeeEntity, "employmentStatus" | "status">) => boolean;
export declare const isOpen: (a: Pick<EmployeeAssignmentEntity, "status" | "endDate">, on?: string) => boolean;
