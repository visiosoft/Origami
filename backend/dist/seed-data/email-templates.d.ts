export interface EmailTemplate {
    id: string;
    key: string;
    name: string;
    subject: string;
    body: string;
    kind: string;
    category: string;
    updatedAt: string;
}
export declare const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[];
