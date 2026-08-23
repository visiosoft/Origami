// The account emails: invitation and password reset.
// The branded frame they render into lives in ../email/shell.ts, shared with
// the reminder digest and assignment notifications.

import { emailShell, escapeHtml, type EmailBrand } from '../email/shell';

export { escapeHtml };

const paragraph = (html: string) =>
  `<p style="margin:0;font-size:14px;line-height:1.65;color:#43514D;">${html}</p>`;

export function inviteEmail(opts: {
  name: string; url: string; roleName: string; expiresInDays: number; brand: EmailBrand;
}) {
  const first = opts.name.split(/\s+/)[0] || 'there';
  return {
    subject: `Set up your ${opts.brand.companyName} account`,
    html: emailShell({
      brand: opts.brand,
      eyebrow: 'Project delivery platform',
      title: `Welcome, ${escapeHtml(first)}`,
      body: paragraph(
        `An account has been created for you on the ${escapeHtml(opts.brand.companyName)} platform as `
        + `<strong>${escapeHtml(opts.roleName)}</strong>. Choose a password to activate it — after that you `
        + `can sign in with your email and password, or with your Google account.`,
      ),
      cta: { label: 'Create your password', url: opts.url },
      footer: `This link expires in ${opts.expiresInDays} days. If you weren't expecting this invitation you can safely ignore this email.`,
    }),
  };
}

export function resetEmail(opts: { name: string; url: string; expiresInHours: number; brand: EmailBrand }) {
  const first = opts.name.split(/\s+/)[0] || 'there';
  return {
    subject: `Reset your ${opts.brand.companyName} password`,
    html: emailShell({
      brand: opts.brand,
      eyebrow: 'Account security',
      title: `Password reset for ${escapeHtml(first)}`,
      body: paragraph(
        'We received a request to reset the password on your account. Choose a new one using the button below.',
      ),
      cta: { label: 'Choose a new password', url: opts.url },
      footer: `This link expires in ${opts.expiresInHours} hours. If you didn't request a reset, nothing has changed — you can ignore this email.`,
    }),
  };
}
