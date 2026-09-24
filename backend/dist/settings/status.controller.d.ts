import { SettingsService } from './settings.service';
export declare class StatusController {
    private readonly settings;
    constructor(settings: SettingsService);
    status(): Promise<{
        build: string;
        notice: string | null;
    }>;
}
