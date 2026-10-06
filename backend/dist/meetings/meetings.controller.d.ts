import { AuthService } from '../auth/auth.service';
import { MeetingsService } from './meetings.service';
import { MeetingActionDto, MeetingDto } from './dto';
export declare class MeetingsController {
    private readonly service;
    private readonly auth;
    constructor(service: MeetingsService, auth: AuthService);
    list(): Promise<import("../database/entities").MeetingEntity[]>;
    get(id: string): Promise<import("../database/entities").MeetingEntity>;
    create(dto: MeetingDto, a?: string): Promise<import("../database/entities").MeetingEntity>;
    update(id: string, dto: MeetingDto): Promise<import("../database/entities").MeetingEntity>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    addAction(id: string, dto: MeetingActionDto, a?: string): Promise<import("../database/entities").TaskEntity>;
}
