import { escapeHtml, type EmailBrand } from '../email/shell';
export { escapeHtml };
export declare function inviteEmail(opts: {
    name: string;
    url: string;
    roleName: string;
    expiresInDays: number;
    brand: EmailBrand;
}): {
    subject: string;
    html: string;
};
export declare function resetEmail(opts: {
    name: string;
    url: string;
    expiresInHours: number;
    brand: EmailBrand;
}): {
    subject: string;
    html: string;
};
