"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEmailBrand = loadEmailBrand;
exports.escapeHtml = escapeHtml;
exports.emailShell = emailShell;
const letterhead_1 = require("../documents/letterhead");
async function loadEmailBrand(settings) {
    const brand = (0, letterhead_1.brandingFrom)(await settings.getMany(letterhead_1.BRAND_KEYS));
    return {
        companyName: brand.companyName || 'Origami Design + Build',
        accent: /^#[0-9a-f]{6}$/i.test(brand.accentColor) ? brand.accentColor : '#173326',
    };
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function emailShell(opts) {
    const { brand } = opts;
    const cta = opts.cta;
    const button = cta
        ? `<tr><td style="padding:22px 28px 8px;">
         <a href="${cta.url}" style="display:inline-block;background:${brand.accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 26px;border-radius:10px;">${escapeHtml(cta.label)}</a>
       </td></tr>
       <tr><td style="padding:16px 28px 26px;">
         <p style="margin:0 0 6px;font-size:11.5px;color:#7E9B93;">Or paste this link into your browser:</p>
         <p style="margin:0;font-size:11.5px;color:#2F7D4A;word-break:break-all;">${cta.url}</p>
       </td></tr>`
        : '<tr><td style="padding:0 28px 26px;"></td></tr>';
    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FBF8F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F2;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid rgba(20,8,31,0.08);overflow:hidden;">
          <tr><td style="background:${brand.accent};padding:22px 28px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(brand.companyName)}</div>
            <div style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;">${escapeHtml(opts.eyebrow)}</div>
          </td></tr>
          <tr><td style="padding:30px 28px 4px;">
            <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:#0B1A12;font-weight:700;">${opts.title}</h1>
            ${opts.body}
          </td></tr>
          ${button}
          <tr><td style="border-top:1px solid rgba(20,8,31,0.07);padding:16px 28px;background:#FBF8F2;">
            <p style="margin:0;font-size:11.5px;line-height:1.6;color:#7E9B93;">${opts.footer}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
//# sourceMappingURL=shell.js.map