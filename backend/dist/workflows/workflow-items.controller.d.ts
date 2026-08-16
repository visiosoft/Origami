import { WorkflowItemsService } from './workflow-items.service';
import { CreateWorkflowItemDto } from './dto/create-workflow-item.dto';
export declare class WorkflowItemsController {
    private readonly service;
    constructor(service: WorkflowItemsService);
    findAll(workflowId?: string): Promise<import("../database/entities").WorkflowItemEntity[]>;
    create(dto: CreateWorkflowItemDto): Promise<import("../database/entities").WorkflowItemEntity>;
    update(id: string, dto: Partial<CreateWorkflowItemDto>): Promise<import("../database/entities").WorkflowItemEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
