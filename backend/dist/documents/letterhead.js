"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRAND_KEYS = void 0;
exports.brandingFrom = brandingFrom;
exports.safeFilename = safeFilename;
exports.buildLetterHtml = buildLetterHtml;
exports.BRAND_KEYS = [
    'brand.companyName', 'brand.tagline', 'brand.logoDataUrl', 'brand.accentColor',
    'brand.address', 'brand.phone', 'brand.email', 'brand.website', 'brand.footerNote',
    'brand.signatureName', 'brand.signatureTitle', 'brand.signatureDataUrl',
];
function brandingFrom(settings) {
    const pick = (k) => (settings[`brand.${k}`] ?? '').trim();
    return {
        companyName: pick('companyName') || 'Origami',
        tagline: pick('tagline'),
        logoDataUrl: pick('logoDataUrl'),
        accentColor: pick('accentColor') || '#173326',
        address: pick('address'),
        phone: pick('phone'),
        email: pick('email'),
        website: pick('website'),
        footerNote: pick('footerNote'),
        signatureName: pick('signatureName'),
        signatureTitle: pick('signatureTitle'),
        signatureDataUrl: pick('signatureDataUrl'),
    };
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function bodyHtml(body) {
    if (/<(p|div|br|ul|ol|table|h[1-6])\b/i.test(body))
        return body;
    return body
        .split(/\n{2,}/)
        .map((para) => `<p style="margin:0 0 12pt 0;">${esc(para).replace(/\n/g, '<br/>')}</p>`)
        .join('');
}
function safeFilename(name, fallback = 'document') {
    const clean = name.replace(/[\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (clean || fallback).slice(0, 90);
}
function buildLetterHtml(opts) {
    const b = opts.brand;
    const accent = /^#[0-9a-f]{3,8}$/i.test(b.accentColor) ? b.accentColor : '#173326';
    const footerLine = [b.address, b.phone, b.email, b.website].filter(Boolean).map(esc).join('  &middot;  ');
    const logo = b.logoDataUrl
        ? `<img src="${b.logoDataUrl}" alt="" style="max-height:56px;max-width:200px;" />`
        : '';
    const signature = [
        b.signatureDataUrl
            ? `<img src="${b.signatureDataUrl}" alt="" style="max-height:52px;display:block;margin-bottom:4pt;" />`
            : '',
        b.signatureName ? `<div style="font-weight:bold;color:#0B1A12;">${esc(b.signatureName)}</div>` : '',
        b.signatureTitle ? `<div style="font-size:10pt;color:#5C6B65;">${esc(b.signatureTitle)}</div>` : '',
        b.companyName ? `<div style="font-size:10pt;color:#5C6B65;">${esc(b.companyName)}</div>` : '',
    ].filter(Boolean).join('');
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${esc(opts.title || b.companyName)}</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.65;color:#1E2B25;margin:0;">

  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px solid ${accent};padding-bottom:10pt;margin-bottom:8pt;">
    <tr>
      <td style="vertical-align:middle;">${logo}</td>
      <td style="vertical-align:middle;text-align:${logo ? 'right' : 'left'};">
        <div style="font-size:16pt;font-weight:bold;color:#0B1A12;">${esc(b.companyName)}</div>
        ${b.tagline ? `<div style="font-size:9.5pt;color:#7E9B93;letter-spacing:0.06em;">${esc(b.tagline)}</div>` : ''}
      </td>
    </tr>
  </table>

  ${opts.date ? `<p style="margin:18pt 0 0 0;font-size:10pt;color:#5C6B65;">${esc(opts.date)}</p>` : ''}
  ${opts.recipient ? `<p style="margin:12pt 0 0 0;">${esc(opts.recipient)}</p>` : ''}
  ${opts.title ? `<h1 style="font-size:13pt;color:#0B1A12;margin:20pt 0 10pt 0;">${esc(opts.title)}</h1>` : '<div style="height:14pt;"></div>'}

  <div>${bodyHtml(opts.body)}</div>

  ${signature ? `<div style="margin-top:26pt;">${signature}</div>` : ''}

  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #D8DED9;margin-top:34pt;padding-top:8pt;">
    <tr><td style="font-size:8.5pt;color:#7E9B93;text-align:center;">
      ${footerLine}
      ${b.footerNote ? `<div style="margin-top:3pt;">${esc(b.footerNote)}</div>` : ''}
    </td></tr>
  </table>

</body></html>`;
}
//# sourceMappingURL=letterhead.js.map