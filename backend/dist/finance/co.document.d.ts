export interface CoDoc {
    number: string;
    title: string;
    description?: string | null;
    reason?: string | null;
    requestedBy?: string | null;
    dateRequested?: string | null;
    createdAt?: string | null;
    scheduleImpactDays?: number | null;
    total: number;
    clientSigner?: string | null;
    clientApprovedDate?: string | null;
    items: {
        description: string;
        quantity?: number | string | null;
        unit?: string | null;
        rate?: number | string | null;
        amount: number | string;
    }[];
}
export interface CoBrand {
    companyName?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    accentColor?: string;
    logoDataUrl?: string;
}
export declare const CO_REASON_LABEL: Record<string, string>;
export declare const coDate: (d?: string | null) => string;
export declare function changeOrderHtml(co: CoDoc, brand: CoBrand, projectName: string): string;
export declare function changeOrderEmailBody(co: CoDoc, projectName: string, note?: string): string;
