import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PayComponentEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { type PayrollSettings } from './payroll.calc';
type Component = Omit<PayComponentEntity, 'id' | 'order'>;
export declare const US_COMPONENTS: Component[];
export declare class PayrollSetupService implements OnApplicationBootstrap {
    private readonly components;
    private readonly store;
    private readonly log;
    constructor(components: Repository<PayComponentEntity>, store: SettingsService);
    onApplicationBootstrap(): Promise<void>;
    convertToUs(): Promise<void>;
    settings(): Promise<PayrollSettings>;
    saveSettings(patch: Partial<PayrollSettings>): Promise<PayrollSettings>;
    listComponents(): Promise<PayComponentEntity[]>;
    private check;
    createComponent(dto: Partial<PayComponentEntity>): Promise<PayComponentEntity>;
    updateComponent(id: string, dto: Partial<PayComponentEntity>): Promise<{
        id: string;
        name: string;
        kind: string;
        calcType: string;
        defaultValue: number;
        appliesTo: string;
        category: string;
        active: boolean;
        order: number;
    } & PayComponentEntity>;
    removeComponent(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
export {};
