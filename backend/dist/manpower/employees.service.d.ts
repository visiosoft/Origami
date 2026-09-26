import { Repository } from 'typeorm';
import { EmployeeAssignmentEntity, EmployeeEntity, SubcontractorTradeEntity } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { StaffDirectorySync } from './staff-directory.sync';
import { nextWorkerId } from './workforce.util';
export { nextWorkerId };
export declare class EmployeesService {
    private readonly repo;
    private readonly trades;
    private readonly attachments;
    private readonly assignments;
    private readonly staff?;
    constructor(repo: Repository<EmployeeEntity>, trades: Repository<SubcontractorTradeEntity>, attachments: AttachmentsService, assignments: Repository<EmployeeAssignmentEntity>, staff?: StaffDirectorySync | undefined);
    private toPeople;
    findAll(): Promise<EmployeeEntity[]>;
    findOne(id: string): Promise<EmployeeEntity>;
    private withTradeName;
    create(dto: any): Promise<EmployeeEntity>;
    update(id: string, dto: any): Promise<EmployeeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    setPhoto(id: string, files: any[], actor: UploadActor): Promise<EmployeeEntity>;
    photo(id: string): Promise<import("../database/task.types").TaskAttachment>;
}
