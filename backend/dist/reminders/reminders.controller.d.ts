import { RemindersService } from './reminders.service';
import { SettingsService } from '../settings/settings.service';
export declare class RemindersController {
    private readonly reminders;
    private readonly settings;
    constructor(reminders: RemindersService, settings: SettingsService);
    run(token?: string): Promise<{
        sent: number;
        skipped: number;
        recipients: string[];
    }>;
}
