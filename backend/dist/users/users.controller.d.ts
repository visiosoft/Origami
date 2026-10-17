import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AccessImportService } from './access-import.service';
export declare class UsersController {
    private readonly usersService;
    private readonly access;
    constructor(usersService: UsersService, access: AccessImportService);
    findAll(): Promise<any[]>;
    directory(): Promise<{
        id: string;
        name: string;
        email: string;
        tier: string;
        roleKey: string;
        status: string;
        avatarUrl: string;
        createdAt: string;
    }[]>;
    create(dto: CreateUserDto): Promise<any>;
    resendInvite(id: string): Promise<any>;
    getAccess(id: string): Promise<{
        userId: string;
        roleKey: string;
        roleName: string;
        rolePermissions: Record<string, {
            view: boolean;
            manage: boolean;
        }>;
        overrides: Record<string, {
            level?: string;
            extent?: string;
        }>;
    }>;
    setAccess(id: string, dto: any): Promise<{
        userId: string;
        roleKey: string;
        roleName: string;
        rolePermissions: Record<string, {
            view: boolean;
            manage: boolean;
        }>;
        overrides: Record<string, {
            level?: string;
            extent?: string;
        }>;
    }>;
    update(id: string, dto: Partial<CreateUserDto>): Promise<any>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
