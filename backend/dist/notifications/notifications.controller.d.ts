import { NotificationsService } from './notifications.service';
import type { SessionClaims } from '../auth/crypto.util';
export declare class NotificationsController {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    test(claims: SessionClaims | null): Promise<{
        sent: boolean;
        reason?: string;
    }>;
}
