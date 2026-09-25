import type { RfiEntity } from '../database/entities';
export declare const RFI_STATUSES: readonly ["draft", "open", "answered", "closed", "void"];
export type RfiStatus = typeof RFI_STATUSES[number];
export declare const RFI_DISCIPLINES: string[];
export declare const STATUS_LABEL: Record<string, string>;
export declare const rfiDate: (d?: string | null) => string;
export declare function impactLine(r: Pick<RfiEntity, 'costImpact' | 'costAmount' | 'scheduleImpact' | 'scheduleDays'>): {
    cost: string;
    schedule: string;
};
export declare function rfiDocumentHtml(r: RfiEntity, project: {
    name: string;
    location?: string;
}, company: string): string;
export declare function rfiEmailBody(r: RfiEntity, project: {
    name: string;
}, note?: string): string;
