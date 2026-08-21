export interface Branding {
    companyName: string;
    tagline: string;
    logoDataUrl: string;
    accentColor: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    footerNote: string;
    signatureName: string;
    signatureTitle: string;
    signatureDataUrl: string;
}
export declare const BRAND_KEYS: string[];
export declare function brandingFrom(settings: Record<string, string>): Branding;
export declare function safeFilename(name: string, fallback?: string): string;
export declare function buildLetterHtml(opts: {
    brand: Branding;
    title?: string;
    recipient?: string;
    date?: string;
    body: string;
}): string;
