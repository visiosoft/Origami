/**
 * Turns letter text into a branded, print-ready HTML document.
 *
 * The output is handed to Drive to convert into a PDF, so it has to survive
 * Google Docs' fairly narrow HTML support: table-based layout, inline styles,
 * no flexbox or grid, and images as inline data URLs.
 */

export interface BrandTeamMember {
  name: string;
  title: string;
  photoDataUrl: string;
}

export interface Branding {
  companyName: string;
  tagline: string;
  logoDataUrl: string;
  accentColor: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  footerNote: string;
  signatureName: string;
  signatureTitle: string;
  signatureDataUrl: string;
  /** The crane mark shown bottom-left on the About Us page and, small, in the footer bar. */
  footerLogoDataUrl: string;
  /** The company description shown on the About Us page, paragraphs separated by blank lines. */
  aboutUsText: string;
  /** Headshots shown under "Team" on the About Us page. */
  team: BrandTeamMember[];
  /** The photo band on a document's cover page. */
  coverPhotoDataUrl: string;
}

export const BRAND_KEYS = [
  'brand.companyName', 'brand.tagline', 'brand.logoDataUrl', 'brand.accentColor',
  'brand.address', 'brand.phone', 'brand.email', 'brand.website', 'brand.footerNote',
  'brand.signatureName', 'brand.signatureTitle', 'brand.signatureDataUrl',
  'brand.footerLogoDataUrl', 'brand.aboutUsText', 'brand.team', 'brand.coverPhotoDataUrl',
];

/** Settings rows -> a branding record with sensible fallbacks. */
export function brandingFrom(settings: Record<string, string>): Branding {
  const pick = (k: string) => (settings[`brand.${k}`] ?? '').trim();
  let team: BrandTeamMember[] = [];
  try {
    const parsed = JSON.parse(pick('team') || '[]');
    if (Array.isArray(parsed)) team = parsed;
  } catch {
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

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The body may arrive as HTML from the composer, or as plain typed text. Plain
 * text is escaped and split into paragraphs so a letter never renders as one
 * unbroken run.
 */
function bodyHtml(body: string) {
  if (/<(p|div|br|ul|ol|table|h[1-6])\b/i.test(body)) return body;
  return body
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12pt 0;">${esc(para).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * A document filename that is safe on every platform and, critically, safe
 * to put straight into a Content-Disposition header -- which only accepts
 * ASCII. An em dash or curly quote in a subject line ("Agreement — Ehsan")
 * throws "Invalid character in header content" if passed through as-is.
 */
export function safeFilename(name: string, fallback = 'document') {
  const clean = name
    .replace(/[‒-―]/g, '-') // en/em dashes -> hyphen
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, '') // drop anything else non-ASCII
    .replace(/[\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean || fallback).slice(0, 90);
}

export function accentOf(brand: Branding) {
  return /^#[0-9a-f]{3,8}$/i.test(brand.accentColor) ? brand.accentColor : '#173326';
}

/** A fixed page number for the cover+About Us+letter flow, where the page order is always known. */
function pageNumberHtml(brand: Branding, n: string | number) {
  return `<div style="text-align:right;font-size:10pt;font-weight:bold;color:${accentOf(brand)};margin-top:20pt;">${n}</div>`;
}

/**
 * A page break, between sections rather than only as a style on the
 * following wrapper -- Google Docs' HTML import is inconsistent about
 * honouring `page-break-before` on an empty/wrapping <div>, but reliably
 * respects it on an actual paragraph carrying visible (if blank) content.
 */
export const PAGE_BREAK = '<p style="page-break-before:always;margin:0;line-height:1pt;">&nbsp;</p>';

/**
 * The branded footer bar: a solid accent-colour band carrying the contact
 * line, with the crane mark sitting just above it. Shared by every generated
 * document so the footer never drifts between the letterhead and the
 * Project Program.
 */
export function footerBarHtml(brand: Branding) {
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

/**
 * The "About Origami" + "Team" page, inserted into a document so the
 * company introduction and headshots never have to be retyped per document.
 */
export function aboutUsPageHtml(brand: Branding, pageBreakBefore = true, pageNumber?: string | number) {
  const accent = accentOf(brand);
  const paragraphs = brand.aboutUsText
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 8pt 0;">${esc(p)}</p>`)
    .join('');

  const members = brand.team || [];
  const rows: string[] = [];
  // Each member's photo and caption are their own inner table with the photo
  // on its own row -- Google Docs' HTML import drops `display:block` on an
  // <img>, which otherwise leaves the name floating beside the photo
  // instead of under it. Kept compact (small photo, tight padding) so all
  // five fit on one page alongside the description above, as in the office's
  // own reference letter.
  for (let i = 0; i < members.length; i += 2) {
    const pair = members.slice(i, i + 2);
    rows.push(`<tr>${pair.map((m) => `
      <td style="width:50%;padding:0 10pt 10pt 0;vertical-align:top;border:none;">
        <table border="0" cellpadding="0" cellspacing="0"><tr><td style="border:none;padding:0 0 3pt 0;">
          ${m.photoDataUrl ? `<img src="${m.photoDataUrl}" alt="${esc(m.name)}" style="width:62pt;height:62pt;object-fit:cover;border-radius:4pt;" />` : ''}
        </td></tr><tr><td style="border:none;font-weight:bold;font-size:10pt;color:#0B1A12;">${esc(m.name)}</td></tr><tr><td style="border:none;font-size:8.5pt;color:${accent};">${esc(m.title)}</td></tr></table>
      </td>`).join('')}${pair.length < 2 ? '<td style="width:50%;border:none;"></td>' : ''}</tr>`);
  }

  return `${pageBreakBefore ? PAGE_BREAK : ''}<div${pageBreakBefore ? ' style="page-break-before:always;"' : ''}>
    <h1 style="font-size:15pt;color:${accent};text-align:center;margin:0 0 10pt 0;">About ${esc(brand.companyName)}</h1>
    <div style="font-size:9.5pt;">${paragraphs}</div>
    ${members.length ? `<h2 style="font-size:12pt;color:${accent};text-align:center;margin:12pt 0 10pt 0;">Team</h2>
    <table width="100%" border="0" cellpadding="0" cellspacing="0">${rows.join('')}</table>` : ''}
    ${pageNumber !== undefined ? pageNumberHtml(brand, pageNumber) : ''}
    ${footerBarHtml(brand)}
  </div>`;
}

/**
 * A cover page: title, date, a short contact block, and a photo band with a
 * "Presented by" strip. Google Docs' HTML import has no clip-path/transform
 * support, so the photo band is a plain rectangle rather than the diagonal
 * cut used in hand-built covers.
 */
export function coverPageHtml(brand: Branding, opts: {
  title: string;
  subtitle?: string;
  date?: string;
  contactName?: string;
  contactPhone?: string;
}) {
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

/**
 * Build the full letter: letterhead, body, signature block, footer rule.
 *
 * `date` is passed in rather than read from the clock so the caller controls
 * the timezone the letter is dated in.
 */
export function buildLetterHtml(opts: {
  brand: Branding;
  /** The email/composer subject -- may be long ("Welcome to ... — {{projectTitle}}"); used for the PDF's <title> only. */
  title?: string;
  /** The short document label shown as the cover/letter heading ("Introduction Letter"). Falls back to `title`. */
  docTitle?: string;
  /** A line under the cover heading -- typically the project name/address. */
  subtitle?: string;
  recipient?: string;
  date?: string;
  body: string;
  /** Prepends a cover page (title, date, contact, photo band) before the letter. */
  includeCoverPage?: boolean;
  /** Inserts the "About Us" + "Team" page right after the cover, before the letter body. */
  includeAboutUs?: boolean;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}) {
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

  // With a cover page, the date/recipient reads as a proper letterhead
  // attention block (Date / Attention / phone / email) rather than two
  // bare lines -- matching the office's own paper Introduction Letter.
  const dateAttention = opts.includeCoverPage
    ? `<table border="0" cellpadding="0" cellspacing="0" style="margin-top:10pt;font-size:10pt;color:#43514D;">
        ${opts.date ? `<tr><td style="padding:1pt 10pt 1pt 0;font-weight:bold;border:none;">Date</td><td style="padding:1pt 0;border:none;">${esc(opts.date)}</td></tr>` : ''}
        ${opts.recipient ? `<tr><td style="padding:1pt 10pt 1pt 0;font-weight:bold;vertical-align:top;border:none;">Attention</td><td style="padding:1pt 0;border:none;">${esc(opts.recipient)}${opts.contactPhone ? `<br/>${esc(opts.contactPhone)}` : ''}${opts.contactEmail ? `<br/>${esc(opts.contactEmail)}` : ''}</td></tr>` : ''}
      </table>`
    : `${opts.date ? `<p style="margin:10pt 0 0 0;font-size:10pt;color:#5C6B65;">${esc(opts.date)}</p>` : ''}${opts.recipient ? `<p style="margin:8pt 0 0 0;">${esc(opts.recipient)}</p>` : ''}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${esc(opts.title || b.companyName)}</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.4;color:#1E2B25;margin:0;">

  ${cover}${about}
  ${(cover || about) ? PAGE_BREAK : ''}
  <div${cover || about ? ' style="page-break-before:always;"' : ''}>
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-bottom:3px solid ${accent};padding-bottom:6pt;margin-bottom:6pt;">
    <tr>
      <td style="vertical-align:middle;border:none;">${logo}</td>
      <td style="vertical-align:middle;text-align:${logo ? 'right' : 'left'};border:none;">
        <div style="font-size:16pt;font-weight:bold;color:#0B1A12;">${esc(b.companyName)}</div>
        ${b.tagline ? `<div style="font-size:9.5pt;color:#7E9B93;letter-spacing:0.06em;">${esc(b.tagline)}</div>` : ''}
      </td>
    </tr>
  </table>

  ${dateAttention}
  ${heading ? `<h1 style="font-size:13pt;color:#0B1A12;margin:12pt 0 6pt 0;">${esc(heading)}</h1>` : '<div style="height:10pt;"></div>'}

  <div>${bodyHtml(opts.body)}</div>

  ${signature ? `<div style="margin-top:14pt;">${signature}</div>` : ''}

  ${opts.includeCoverPage ? pageNumberHtml(b, 2) : ''}
  ${footerBarHtml(b)}
  </div>

</body></html>`;
}
