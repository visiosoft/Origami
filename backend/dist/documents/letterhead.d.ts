export interface BrandTeamMember {
    name: string;
    title: string;
    photoDataUrl: string;
}
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
    footerLogoDataUrl: string;
    aboutUsText: string;
    team: BrandTeamMember[];
    coverPhotoDataUrl: string;
}
export declare const BRAND_KEYS: string[];
export declare function brandingFrom(settings: Record<string, string>): Branding;
export declare function safeFilename(name: string, fallback?: string): string;
export declare function accentOf(brand: Branding): string;
export declare const PAGE_BREAK = "<p style=\"page-break-before:always;margin:0;line-height:1pt;\">&nbsp;</p>";
export declare function footerBarHtml(brand: Branding): string;
export declare function aboutUsPageHtml(brand: Branding, pageBreakBefore?: boolean, pageNumber?: string | number): string;
export declare function coverPageHtml(brand: Branding, opts: {
    title: string;
    subtitle?: string;
    date?: string;
    contactName?: string;
    contactPhone?: string;
}): string;
export declare function buildLetterHtml(opts: {
    brand: Branding;
    title?: string;
    docTitle?: string;
    subtitle?: string;
    recipient?: string;
    date?: string;
    body: string;
    includeCoverPage?: boolean;
    includeAboutUs?: boolean;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
}): string;
