import { AuthService } from '../auth/auth.service';
import { ProjectHoldService, type HoldInput } from './project-hold.service';
export declare class ProjectHoldController {
    private readonly holds;
    private readonly auth;
    constructor(holds: ProjectHoldService, auth: AuthService);
    hold(id: string, body: HoldInput, auth?: string): Promise<import("../database/entities").ProjectEntity>;
    resume(id: string, auth?: string): Promise<import("../database/entities").ProjectEntity>;
}
