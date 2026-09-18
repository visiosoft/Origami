"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRAND_KEYS = void 0;
exports.brandingFrom = brandingFrom;
exports.safeFilename = safeFilename;
exports.accentOf = accentOf;
exports.footerBarHtml = footerBarHtml;
exports.aboutUsPageHtml = aboutUsPageHtml;
exports.coverPageHtml = coverPageHtml;
exports.buildLetterHtml = buildLetterHtml;
exports.BRAND_KEYS = [
    'brand.companyName', 'brand.tagline', 'brand.logoDataUrl', 'brand.accentColor',
    'brand.address', 'brand.phone', 'brand.email', 'brand.website', 'brand.footerNote',
    'brand.signatureName', 'brand.signatureTitle', 'brand.signatureDataUrl',
    'brand.footerLogoDataUrl', 'brand.aboutUsText', 'brand.team', 'brand.coverPhotoDataUrl',
];
function brandingFrom(settings) {
    const pick = (k) => (settings[`brand.${k}`] ?? '').trim();
    let team = [];
    try {
        const parsed = JSON.parse(pick('team') || '[]');
        if (Array.isArray(parsed))
            team = parsed;
    }
    catch {
        team = [];
    }
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
        footerLogoDataUrl: pick('footerLogoDataUrl'),
        aboutUsText: pick('aboutUsText'),
        team,
        coverPhotoDataUrl: pick('coverPhotoDataUrl'),
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
    const clean = name
        .replace(/[‒-―]/g, '-')
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/[\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return (clean || fallback).slice(0, 90);
}
function accentOf(brand) {
    return /^#[0-9a-f]{3,8}$/i.test(brand.accentColor) ? brand.accentColor : '#173326';
}
function pageNumberHtml(brand, n) {
    return `<div style="text-align:right;font-size:10pt;font-weight:bold;color:${accentOf(brand)};margin-top:20pt;">${n}</div>`;
}
function footerBarHtml(brand) {
    const accent = accentOf(brand);
    const line = [brand.address, brand.phone, brand.email, brand.website].filter(Boolean).map(esc).join('  &middot;  ');
    const crane = brand.footerLogoDataUrl
        ? `<img src="${brand.footerLogoDataUrl}" alt="" style="width:40pt;height:auto;display:block;" />`
        : '';
    return `<div style="margin-top:24pt;">
    ${crane ? `<table width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td style="width:50pt;border:none;">${crane}</td><td style="border:none;"></td></tr></table>` : ''}
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background:${accent};margin-top:${crane ? '-10pt' : '0'};">
      <tr><td style="padding:7pt 16pt;color:#ffffff;font-size:8.5pt;text-align:right;border:none;">
        ${line}${brand.footerNote ? `<div style="margin-top:2pt;">${esc(brand.footerNote)}</div>` : ''}
      </td></tr>
    </table>
  </div>`;
}
function aboutUsPageHtml(brand, pageBreakBefore = true, pageNumber) {
    const accent = accentOf(brand);
    const paragraphs = brand.aboutUsText
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p) => `<p style="margin:0 0 12pt 0;">${esc(p)}</p>`)
        .join('');
    const members = brand.team || [];
    const rows = [];
    for (let i = 0; i < members.length; i += 2) {
        const pair = members.slice(i, i + 2);
        rows.push(`<tr>${pair.map((m) => `
      <td style="width:50%;padding:0 10pt 22pt 0;vertical-align:top;border:none;">
        <table border="0" cellpadding="0" cellspacing="0"><tr><td style="border:none;padding:0 0 6pt 0;">
          ${m.photoDataUrl ? `<img src="${m.photoDataUrl}" alt="${esc(m.name)}" style="width:90pt;height:90pt;object-fit:cover;border-radius:4pt;" />` : ''}
        </td></tr><tr><td style="border:none;font-weight:bold;font-size:10.5pt;color:#0B1A12;">${esc(m.name)}</td></tr><tr><td style="border:none;font-size:9pt;color:${accent};">${esc(m.title)}</td></tr></table>
      </td>`).join('')}${pair.length < 2 ? '<td style="width:50%;border:none;"></td>' : ''}</tr>`);
    }
    return `<div${pageBreakBefore ? ' style="page-break-before:always;"' : ''}>
    <h1 style="font-size:17pt;color:${accent};text-align:center;margin:0 0 14pt 0;">About ${esc(brand.companyName)}</h1>
    <div style="font-size:10.5pt;">${paragraphs}</div>
    ${members.length ? `<h2 style="font-size:15pt;color:${accent};text-align:center;margin:18pt 0 16pt 0;">Team</h2>
    <table width="100%" border="0" cellpadding="0" cellspacing="0">${rows.join('')}</table>` : ''}
    ${pageNumber !== undefined ? pageNumberHtml(brand, pageNumber) : ''}
    ${footerBarHtml(brand)}
  </div>`;
}
function coverPageHtml(brand, opts) {
    const accent = accentOf(brand);
    const logo = brand.logoDataUrl
        ? `<img src="${brand.logoDataUrl}" alt="" style="max-height:64px;max-width:220px;" />`
        : '';
    return `<div>
    ${logo ? `<table width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td style="text-align:right;border:none;">${logo}</td></tr></table>` : ''}
    <h1 style="font-size:24pt;color:${accent};margin:26pt 0 6pt 0;line-height:1.2;">${esc(opts.title)}</h1>
    ${opts.subtitle ? `<div style="font-size:13pt;color:#43514D;margin-bottom:4pt;">${esc(opts.subtitle)}</div>` : ''}
    ${opts.date ? `<div style="font-size:11pt;color:#7E9B93;">${esc(opts.date)}</div>` : ''}
    ${(opts.contactName || opts.contactPhone) ? `<div style="margin-top:22pt;">
      <div style="font-size:10pt;font-weight:bold;color:${accent};text-transform:uppercase;letter-spacing:0.06em;">Client Contact Information</div>
      ${opts.contactName ? `<div style="font-size:11pt;margin-top:2pt;">${esc(opts.contactName)}</div>` : ''}
      ${opts.contactPhone ? `<div style="font-size:11pt;">${esc(opts.contactPhone)}</div>` : ''}
    </div>` : ''}
    ${brand.coverPhotoDataUrl ? `<div style="margin-top:26pt;">
      <img src="${brand.coverPhotoDataUrl}" alt="" style="width:100%;height:240pt;object-fit:cover;" />
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td style="padding:10pt 16pt;border:none;">
        <div style="font-size:11pt;font-weight:bold;color:#0B1A12;">Presented by</div>
        <div style="font-size:11pt;color:#43514D;">${esc(brand.companyName)}</div>
      </td></tr></table>
    </div>` : ''}
  </div>`;
}
function buildLetterHtml(opts) {
    const b = opts.brand;
    const accent = accentOf(b);
    const heading = opts.docTitle || opts.title;
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
    const cover = opts.includeCoverPage
        ? coverPageHtml(b, { title: heading || b.companyName, subtitle: opts.subtitle, date: opts.date, contactName: opts.contactName, contactPhone: opts.contactPhone })
        : '';
    const about = opts.includeAboutUs ? aboutUsPageHtml(b, true, opts.includeCoverPage ? 1 : undefined) : '';
    const dateAttention = opts.includeCoverPage
        ? `<table border="0" cellpadding="0" cellspacing="0" style="margin-top:18pt;font-size:10pt;color:#43514D;">
        ${opts.date ? `<tr><td style="padding:1pt 10pt 1pt 0;font-weight:bold;border:none;">Date</td><td style="padding:1pt 0;border:none;">${esc(opts.date)}</td></tr>` : ''}
        ${opts.recipient ? `<tr><td style="padding:1pt 10pt 1pt 0;font-weight:bold;vertical-align:top;border:none;">Attention</td><td style="padding:1pt 0;border:none;">${esc(opts.recipient)}${opts.contactPhone ? `<br/>${esc(opts.contactPhone)}` : ''}${opts.contactEmail ? `<br/>${esc(opts.contactEmail)}` : ''}</td></tr>` : ''}
      </table>`
        : `${opts.date ? `<p style="margin:18pt 0 0 0;font-size:10pt;color:#5C6B65;">${esc(opts.date)}</p>` : ''}${opts.recipient ? `<p style="margin:12pt 0 0 0;">${esc(opts.recipient)}</p>` : ''}`;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${esc(opts.title || b.companyName)}</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.65;color:#1E2B25;margin:0;">

  ${cover}${about}
  <div${cover || about ? ' style="page-break-before:always;"' : ''}>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-bottom:3px solid ${accent};padding-bottom:10pt;margin-bottom:8pt;">
    <tr>
      <td style="vertical-align:middle;border:none;">${logo}</td>
      <td style="vertical-align:middle;text-align:${logo ? 'right' : 'left'};border:none;">
        <div style="font-size:16pt;font-weight:bold;color:#0B1A12;">${esc(b.companyName)}</div>
        ${b.tagline ? `<div style="font-size:9.5pt;color:#7E9B93;letter-spacing:0.06em;">${esc(b.tagline)}</div>` : ''}
      </td>
    </tr>
  </table>

  ${dateAttention}
  ${heading ? `<h1 style="font-size:13pt;color:#0B1A12;margin:20pt 0 10pt 0;">${esc(heading)}</h1>` : '<div style="height:14pt;"></div>'}

  <div>${bodyHtml(opts.body)}</div>

  ${signature ? `<div style="margin-top:26pt;">${signature}</div>` : ''}

  ${opts.includeCoverPage ? pageNumberHtml(b, 2) : ''}
  ${footerBarHtml(b)}
  </div>

</body></html>`;
}
//# sourceMappingURL=letterhead.js.map