import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
export declare class EmailTemplatesController {
    private readonly service;
    constructor(service: EmailTemplatesService);
    findAll(): Promise<import("../database/entities").EmailTemplateEntity[]>;
    findOne(id: string): Promise<import("../database/entities").EmailTemplateEntity | null>;
    create(dto: CreateEmailTemplateDto): Promise<import("../database/entities").EmailTemplateEntity>;
    update(id: string, dto: Partial<CreateEmailTemplateDto>): Promise<import("../database/entities").EmailTemplateEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
