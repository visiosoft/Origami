import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AccessImportService } from './access-import.service';
export declare class RolesController {
    private readonly rolesService;
    private readonly accessImport;
    constructor(rolesService: RolesService, accessImport: AccessImportService);
    findAll(): Promise<import("../database/entities").RoleEntity[]>;
    importMatrix(dto: any): Promise<{
        applied: boolean;
        roles: {
            sheetKey: string;
            name: string;
            tier: "internal" | "client" | "consultant";
            rank: string;
            classification: string;
            emails: string[];
            overall: import("./access-levels").Perm | null;
            extent: import("./access-levels").Extent | null;
            dataTypes: number;
            target: string;
            targetName: string;
            action: string;
        }[];
        users: {
            email: string;
            roleSheetKey: string;
            roleName: string;
            action: "create" | "update" | "keep" | "skip";
            current?: string;
            alsoIn: string[];
            note?: string;
        }[];
        unmatched: string[];
        dataTypes: {
            key: string;
            label: string;
            kind: string;
        }[];
    } | {
        applied: boolean;
        results: {
            email: string;
            result: string;
        }[];
        roles: {
            sheetKey: string;
            name: string;
            tier: "internal" | "client" | "consultant";
            rank: string;
            classification: string;
            emails: string[];
            overall: import("./access-levels").Perm | null;
            extent: import("./access-levels").Extent | null;
            dataTypes: number;
            target: string;
            targetName: string;
            action: string;
        }[];
        users: {
            email: string;
            roleSheetKey: string;
            roleName: string;
            action: "create" | "update" | "keep" | "skip";
            current?: string;
            alsoIn: string[];
            note?: string;
        }[];
        unmatched: string[];
        dataTypes: {
            key: string;
            label: string;
            kind: string;
        }[];
    }>;
    create(dto: CreateRoleDto): Promise<import("../database/entities").RoleEntity>;
    update(key: string, dto: Partial<CreateRoleDto>): Promise<import("../database/entities").RoleEntity>;
    remove(key: string): Promise<{
        key: string;
        deleted: boolean;
    }>;
}
