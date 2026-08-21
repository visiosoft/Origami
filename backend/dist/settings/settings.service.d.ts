import { Repository } from 'typeorm';
import { AppSettingEntity } from '../database/entities';
export declare const SECRET_KEYS: string[];
export declare const PUBLIC_KEYS: string[];
export declare const MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
export declare class SettingsService {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<AppSettingEntity>);
    get(key: string): Promise<string | null>;
    getMany(keys: string[]): Promise<Record<string, string>>;
    set(key: string, value: string | null): Promise<void>;
    setMany(patch: Record<string, unknown>): Promise<void>;
    publicView(): Promise<Record<string, string>>;
    baseUrl(): Promise<string>;
    jwtSecret(): Promise<string>;
}
