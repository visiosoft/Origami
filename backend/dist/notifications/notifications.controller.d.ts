import { NotificationsService } from './notifications.service';
import { NotifyHub } from './notify-hub.service';
import type { SessionClaims } from '../auth/crypto.util';
export declare class NotificationsController {
    private readonly notifications;
    private readonly hub;
    constructor(notifications: NotificationsService, hub: NotifyHub);
    prefs(claims: SessionClaims | null): Promise<{
        events: {
            key: string;
            label: string;
            group: "CRM" | "Projects" | "Tasks";
            hint: string;
        }[];
        matrix: {
            [k: string]: ("text_now" | "email_now" | "text_daily" | "email_daily" | "text_weekly" | "email_weekly")[];
        };
        custom: boolean;
        phone: string;
        phoneFromPeople: string;
        warnings: string[];
    } | null>;
    setPrefs(claims: SessionClaims | null, body: {
        matrix?: unknown;
        phone?: unknown;
    }): Promise<{
        events: {
            key: string;
            label: string;
            group: "CRM" | "Projects" | "Tasks";
            hint: string;
        }[];
        matrix: {
            [k: string]: ("text_now" | "email_now" | "text_daily" | "email_daily" | "text_weekly" | "email_weekly")[];
        };
        custom: boolean;
        phone: string;
        phoneFromPeople: string;
        warnings: string[];
    } | null>;
    feed(claims: SessionClaims | null, digest?: string): Promise<{
        id: string;
        event: string;
        label: string;
        title: string;
        body: string | null;
        url: string | null;
        at: string;
    }[]>;
    test(claims: SessionClaims | null): Promise<{
        sent: boolean;
        reason?: string;
    }>;
}
