import { SettingsService } from './settings.service';
export declare class SettingsController {
    private readonly settings;
    constructor(settings: SettingsService);
    read(): Promise<Record<string, string>>;
    update(body: Record<string, unknown>): Promise<Record<string, string>>;
}
