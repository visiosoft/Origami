import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
export declare class FaqsController {
    private readonly service;
    constructor(service: FaqsService);
    findAll(): Promise<import("../database/entities").FaqEntity[]>;
    create(dto: CreateFaqDto): Promise<import("../database/entities").FaqEntity>;
    update(id: string, dto: Partial<CreateFaqDto>): Promise<import("../database/entities").FaqEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
