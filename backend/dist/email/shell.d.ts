import type { SettingsService } from '../settings/settings.service';
export interface EmailBrand {
    companyName: string;
    accent: string;
}
export declare function loadEmailBrand(settings: SettingsService): Promise<EmailBrand>;
export declare function escapeHtml(s: string): string;
export declare function emailShell(opts: {
    brand: EmailBrand;
    eyebrow: string;
    title: string;
    body: string;
    cta?: {
        label: string;
        url: string;
    };
    footer: string;
}): string;
