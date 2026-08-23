// The frame every transactional email is rendered into.
//
// Table-based with inline styles, because that is the only layout Outlook and
// Gmail both render predictably. Previously this markup existed twice — once
// privately in auth/email.templates.ts and once copy-pasted into the reminder
// digest — so a branding change had to be made in two places and the two had
// already drifted apart.

import type { SettingsService } from '../settings/settings.service';
import { BRAND_KEYS, brandingFrom } from '../documents/letterhead';

/** The parts of the company's branding that an email can carry. */
export interface EmailBrand {
  companyName: string;
  accent: string;
}

/** Read the branding set in Settings, falling back to the Origami defaults. */
export async function loadEmailBrand(settings: SettingsService): Promise<EmailBrand> {
  const brand = brandingFrom(await settings.getMany(BRAND_KEYS));
  return {
    companyName: brand.companyName || 'Origami Design + Build',
    // Guard the colour: it lands in a style attribute, and a hex check is
    // simpler than trusting whatever a settings field happens to hold.
    accent: /^#[0-9a-f]{6}$/i.test(brand.accentColor) ? brand.accentColor : '#173326',
  };
}

export function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Wrap body HTML in the branded frame.
 *
 * `body` is raw HTML the caller has already escaped — the digest passes task
 * tables, the simpler emails pass a paragraph.
 */
export function emailShell(opts: {
  brand: EmailBrand;
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; url: string };
  footer: string;
}) {
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
