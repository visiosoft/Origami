import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
    findAll(): Promise<import("../database/entities").RoleEntity[]>;
    create(dto: CreateRoleDto): any;
    update(key: string, dto: Partial<CreateRoleDto>): Promise<import("../database/entities").RoleEntity | undefined>;
    remove(key: string): Promise<{
        key: string;
        deleted: boolean;
    }>;
}
