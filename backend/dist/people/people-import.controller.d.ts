import { Repository } from 'typeorm';
import { GoogleService } from '../google/google.service';
import { PersonEntity, ProjectEntity } from '../database/entities';
import { PeopleService } from './people.service';
export declare class ImportPeopleDto {
    rows: Record<string, unknown>[];
    dryRun?: boolean;
    update?: boolean;
}
export declare class PeopleImportController {
    private readonly people;
    private readonly google;
    private readonly repo;
    private readonly projects;
    constructor(people: PeopleService, google: GoogleService, repo: Repository<PersonEntity>, projects: Repository<ProjectEntity>);
    columns(): {
        key: string;
        header: string;
        hint: string;
    }[];
    convert(file?: {
        originalname: string;
        mimetype: string;
        buffer: Buffer;
    }): Promise<{
        csv: string;
    }>;
    import(dto: ImportPeopleDto): Promise<{
        dryRun: boolean;
        summary: {
            create: number;
            update: number;
            skip: number;
            error: number;
        };
        rows: {
            row: number;
            action: "create" | "update" | "skip" | "error";
            name: string;
            kind: string;
            email: string;
            matchId?: number;
            issues: string[];
        }[];
        created?: undefined;
        updated?: undefined;
        failed?: undefined;
    } | {
        dryRun: boolean;
        created: number;
        updated: number;
        failed: {
            row: number;
            action: string;
            id?: number;
            error?: string;
        }[];
        summary?: undefined;
        rows?: undefined;
    }>;
}
