export declare function inviteEmail(opts: {
    name: string;
    url: string;
    roleName: string;
    expiresInDays: number;
}): {
    subject: string;
    html: string;
};
export declare function resetEmail(opts: {
    name: string;
    url: string;
    expiresInHours: number;
}): {
    subject: string;
    html: string;
};
export declare function escapeHtml(s: string): string;
