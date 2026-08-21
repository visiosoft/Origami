"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteEmail = inviteEmail;
exports.resetEmail = resetEmail;
exports.escapeHtml = escapeHtml;
const shell = (title, intro, cta, footer) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FBF8F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F2;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid rgba(20,8,31,0.08);overflow:hidden;">
          <tr><td style="background:#0F2417;padding:22px 28px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">Origami Design + Build</div>
            <div style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;">Project delivery platform</div>
          </td></tr>
          <tr><td style="padding:30px 28px 8px;">
            <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1A12;font-weight:700;">${title}</h1>
            <p style="margin:0;font-size:14px;line-height:1.65;color:#43514D;">${intro}</p>
          </td></tr>
          <tr><td style="padding:24px 28px 8px;">
            <a href="${cta.url}" style="display:inline-block;background:#173326;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 26px;border-radius:10px;">${cta.label}</a>
          </td></tr>
          <tr><td style="padding:18px 28px 28px;">
            <p style="margin:0 0 6px;font-size:11.5px;color:#7E9B93;">Or paste this link into your browser:</p>
            <p style="margin:0;font-size:11.5px;color:#2F7D4A;word-break:break-all;">${cta.url}</p>
          </td></tr>
          <tr><td style="border-top:1px solid rgba(20,8,31,0.07);padding:16px 28px;background:#FBF8F2;">
            <p style="margin:0;font-size:11.5px;line-height:1.6;color:#7E9B93;">${footer}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
function inviteEmail(opts) {
    const first = opts.name.split(/\s+/)[0] || 'there';
    return {
        subject: 'Set up your Origami account',
        html: shell(`Welcome, ${escapeHtml(first)}`, `An account has been created for you on the Origami Design + Build platform as <strong>${escapeHtml(opts.roleName)}</strong>. Choose a password to activate it — after that you can sign in with your email and password, or with your Google account.`, { label: 'Create your password', url: opts.url }, `This link expires in ${opts.expiresInDays} days. If you weren't expecting this invitation you can safely ignore this email.`),
    };
}
function resetEmail(opts) {
    const first = opts.name.split(/\s+/)[0] || 'there';
    return {
        subject: 'Reset your Origami password',
        html: shell(`Password reset for ${escapeHtml(first)}`, 'We received a request to reset the password on your Origami account. Choose a new one using the button below.', { label: 'Choose a new password', url: opts.url }, `This link expires in ${opts.expiresInHours} hours. If you didn't request a reset, nothing has changed — you can ignore this email.`),
    };
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
//# sourceMappingURL=email.templates.js.map