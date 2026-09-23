import { Repository } from 'typeorm';
import { EmployeeAssignmentEntity, EmployeeEntity, SubcontractorTradeEntity } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
export declare function nextWorkerId(existing: (string | null | undefined)[]): string;
export declare class EmployeesService {
    private readonly repo;
    private readonly trades;
    private readonly attachments;
    private readonly assignments;
    constructor(repo: Repository<EmployeeEntity>, trades: Repository<SubcontractorTradeEntity>, attachments: AttachmentsService, assignments: Repository<EmployeeAssignmentEntity>);
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
