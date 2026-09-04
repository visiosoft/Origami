import { SettingsService } from '../settings/settings.service';
export declare function normalizeNumber(raw: string, defaultCountry?: string): string;
export declare function segmentsFor(body: string): {
    length: number;
    unicode: boolean;
    segments: number;
    limit: number;
};
export declare class SmsService {
    private readonly settings;
    private readonly log;
    constructor(settings: SettingsService);
    private credentials;
    isConfigured(): Promise<boolean>;
    status(): Promise<{
        configured: boolean;
        enabled: boolean;
        fromNumber: string;
        accountSid: string;
    }>;
    send(opts: {
        to: string;
        body: string;
    }): Promise<{
        sent: boolean;
        to: string;
        sid: any;
        segments: number;
    }>;
}
