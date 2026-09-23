import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmployeeEntity, ShiftAssignmentEntity, ShiftTemplateEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
export declare class ShiftsService implements OnApplicationBootstrap {
    private readonly templates;
    private readonly assignments;
    private readonly employees;
    private readonly access;
    private readonly log;
    constructor(templates: Repository<ShiftTemplateEntity>, assignments: Repository<ShiftAssignmentEntity>, employees: Repository<EmployeeEntity>, access: ManpowerAccess);
    onApplicationBootstrap(): Promise<void>;
    listTemplates(): Promise<ShiftTemplateEntity[]>;
    private check;
    createTemplate(dto: Partial<ShiftTemplateEntity>, actor: Actor): Promise<ShiftTemplateEntity>;
    updateTemplate(id: string, dto: Partial<ShiftTemplateEntity>, actor: Actor): Promise<ShiftTemplateEntity>;
    removeTemplate(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    findAssignments(opts: {
        employeeId?: string;
        from?: string;
        to?: string;
    }): Promise<ShiftAssignmentEntity[]>;
    assign(dto: {
        employeeIds: string[];
        templateIds: string[];
        rotateEveryDays?: number;
        startDate: string;
        endDate?: string;
        notes?: string;
    }, actor: Actor): Promise<ShiftAssignmentEntity[]>;
    end(id: string, endDate: string | undefined, actor: Actor): Promise<ShiftAssignmentEntity>;
    remove(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
