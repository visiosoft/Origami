"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = void 0;
exports.inviteEmail = inviteEmail;
exports.resetEmail = resetEmail;
const shell_1 = require("../email/shell");
Object.defineProperty(exports, "escapeHtml", { enumerable: true, get: function () { return shell_1.escapeHtml; } });
const paragraph = (html) => `<p style="margin:0;font-size:14px;line-height:1.65;color:#43514D;">${html}</p>`;
function inviteEmail(opts) {
    const first = opts.name.split(/\s+/)[0] || 'there';
    return {
        subject: `Set up your ${opts.brand.companyName} account`,
        html: (0, shell_1.emailShell)({
            brand: opts.brand,
            eyebrow: 'Project delivery platform',
            title: `Welcome, ${(0, shell_1.escapeHtml)(first)}`,
            body: paragraph(`An account has been created for you on the ${(0, shell_1.escapeHtml)(opts.brand.companyName)} platform as `
                + `<strong>${(0, shell_1.escapeHtml)(opts.roleName)}</strong>. Choose a password to activate it — after that you `
                + `can sign in with your email and password, or with your Google account.`),
            cta: { label: 'Create your password', url: opts.url },
            footer: `This link expires in ${opts.expiresInDays} days. If you weren't expecting this invitation you can safely ignore this email.`,
        }),
    };
}
function resetEmail(opts) {
    const first = opts.name.split(/\s+/)[0] || 'there';
    return {
        subject: `Reset your ${opts.brand.companyName} password`,
        html: (0, shell_1.emailShell)({
            brand: opts.brand,
            eyebrow: 'Account security',
            title: `Password reset for ${(0, shell_1.escapeHtml)(first)}`,
            body: paragraph('We received a request to reset the password on your account. Choose a new one using the button below.'),
            cta: { label: 'Choose a new password', url: opts.url },
            footer: `This link expires in ${opts.expiresInHours} hours. If you didn't request a reset, nothing has changed — you can ignore this email.`,
        }),
    };
}
//# sourceMappingURL=email.templates.js.map