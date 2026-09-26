import { SettingsService } from '../settings/settings.service';
import { ManpowerAccess } from './manpower-access.service';
export declare const PICKLISTS_KEY = "manpower.picklists";
export interface Picklists {
    departments: string[];
    designations: string[];
    skills: string[];
}
export declare const DEFAULT_PICKLISTS: Picklists;
export declare function parsePicklists(raw: unknown): Picklists;
export declare class PicklistsService {
    private readonly settings;
    private readonly access;
    constructor(settings: SettingsService, access: ManpowerAccess);
    get(): Promise<Picklists>;
    save(body: unknown, bearer?: string): Promise<Picklists>;
}
export declare class PicklistsController {
    private readonly picklists;
    constructor(picklists: PicklistsService);
    get(): Promise<Picklists>;
    save(body: Picklists, a?: string): Promise<Picklists>;
}
