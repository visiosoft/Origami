import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmailTemplateEntity } from '../database/entities';
export declare class EmailTemplatesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<EmailTemplateEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<EmailTemplateEntity[]>;
    findOne(id: string): Promise<EmailTemplateEntity | null>;
    create(dto: any): Promise<EmailTemplateEntity>;
    update(id: string, dto: any): Promise<EmailTemplateEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
