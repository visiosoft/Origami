import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/employee.dto';
export declare class EmployeesController {
    private readonly service;
    private readonly auth;
    private readonly attachments;
    constructor(service: EmployeesService, auth: AuthService, attachments: AttachmentsService);
    findAll(): Promise<import("../database/entities").EmployeeEntity[]>;
    findOne(id: string): Promise<import("../database/entities").EmployeeEntity>;
    create(dto: CreateEmployeeDto): Promise<import("../database/entities").EmployeeEntity>;
    update(id: string, dto: Partial<CreateEmployeeDto>): Promise<import("../database/entities").EmployeeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    uploadPhoto(id: string, files: any[], auth?: string): Promise<import("../database/entities").EmployeeEntity>;
    photo(id: string, res: Response): Promise<void>;
}
