import { WorkflowsService } from './workflows.service';
import { WorkflowItemsService } from './workflow-items.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
export declare class WorkflowsController {
    private readonly service;
    private readonly items;
    constructor(service: WorkflowsService, items: WorkflowItemsService);
    findAll(): Promise<import("../database/entities").WorkflowEntity[]>;
    create(dto: CreateWorkflowDto): Promise<import("../database/entities").WorkflowEntity>;
    update(id: string, dto: Partial<CreateWorkflowDto>): Promise<import("../database/entities").WorkflowEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
