"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProgramHtml = buildProgramHtml;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const val = (v) => {
    const t = String(v ?? '').trim();
    return t ? esc(t) : '<span style="color:#B9C2BC;">&mdash;</span>';
};
function accentOf(brand) {
    return /^#[0-9a-f]{3,8}$/i.test(brand.accentColor) ? brand.accentColor : '#173326';
}
function bandHtml(brand, right = '') {
    const accent = accentOf(brand);
    const logo = brand.logoDataUrl
        ? `<img src="${brand.logoDataUrl}" alt="" style="max-height:40px;max-width:150px;" />`
        : `<div style="font-size:12pt;font-weight:bold;color:#0B1A12;">${esc(brand.companyName)}</div>`;
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid ${accent};padding-bottom:6pt;margin-bottom:12pt;">
    <tr>
      <td style="vertical-align:middle;">${logo}</td>
      <td style="vertical-align:middle;text-align:right;font-size:8.5pt;color:#7E9B93;">${esc(right)}</td>
    </tr>
  </table>`;
}
function footerHtml(brand) {
    const line = [brand.address, brand.phone, brand.email, brand.website]
        .filter(Boolean).map((x) => esc(x)).join('  &middot;  ');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #D8DED9;margin-top:20pt;padding-top:6pt;">
    <tr><td style="font-size:8pt;color:#7E9B93;text-align:center;">
      ${line}${brand.footerNote ? `<div style="margin-top:2pt;">${esc(brand.footerNote)}</div>` : ''}
    </td></tr>
  </table>`;
}
function blockHtml(block, accent) {
    const heading = block.title
        ? `<div style="font-size:11pt;font-weight:bold;color:${accent};margin:14pt 0 5pt 0;">${esc(block.title)}</div>`
        : '';
    const note = block.note
        ? `<div style="font-size:8.5pt;color:#7E9B93;margin-bottom:5pt;">${esc(block.note)}</div>`
        : '';
    if (!block.rows.length)
        return heading + note;
    if (block.kind === 'table') {
        const rows = block.rows.map((r) => `<tr>
      <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:9.5pt;">${esc(r.label)}</td>
      <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:9.5pt;text-align:right;">${val(r.budget)}</td>
      <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:9.5pt;text-align:right;">${val(r.actual)}</td>
      <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:9pt;color:#5C6B65;">${val(r.notes)}</td>
    </tr>`).join('');
        return `${heading}${note}<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr style="background:#F4F6F4;">
        <th style="padding:4pt 6pt;text-align:left;font-size:8pt;color:#7E9B93;">Description</th>
        <th style="padding:4pt 6pt;text-align:right;font-size:8pt;color:#7E9B93;width:80pt;">Budget</th>
        <th style="padding:4pt 6pt;text-align:right;font-size:8pt;color:#7E9B93;width:80pt;">Actual</th>
        <th style="padding:4pt 6pt;text-align:left;font-size:8pt;color:#7E9B93;width:130pt;">Notes</th>
      </tr>${rows}</table>`;
    }
    if (block.kind === 'weeks') {
        const rows = block.rows.map((r) => `<tr>
      <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:9.5pt;">${esc(r.label)}</td>
      <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:9.5pt;text-align:right;width:90pt;">${String(r.value ?? '').trim() ? `${esc(r.value)} weeks` : val('')}</td>
    </tr>`).join('');
        return `${heading}${note}<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
    }
    if (block.kind === 'list') {
        const items = block.rows.map((r) => `<li style="margin-bottom:3pt;">${esc(r.value || r.label)}</li>`).join('');
        return `${heading}${note}<ul style="margin:0 0 0 14pt;padding:0;font-size:9.5pt;">${items}</ul>`;
    }
    const rows = block.rows.map((r) => `<tr>
    <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:8.5pt;color:#7E9B93;width:170pt;vertical-align:top;">${esc(r.label)}</td>
    <td style="padding:4pt 6pt;border-bottom:1px solid #EDEFEC;font-size:9.5pt;">${val(r.value)}</td>
  </tr>`).join('');
    return `${heading}${note}<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}
function buildProgramHtml(opts) {
    const b = opts.brand;
    const accent = accentOf(b);
    const contents = opts.steps.map((s, i) => `<tr>
      <td style="padding:3pt 0;font-size:9.5pt;color:#7E9B93;width:24pt;">${i + 1}</td>
      <td style="padding:3pt 0;font-size:9.5pt;">${esc(s.name)}</td>
    </tr>`).join('');
    const body = opts.steps.map((step, i) => {
        const totals = step.totals
            ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10pt;background:#F4F6F4;">
          <tr>
            <td style="padding:6pt 8pt;font-size:9pt;color:#5C6B65;">Budget subtotal</td>
            <td style="padding:6pt 8pt;font-size:11pt;font-weight:bold;text-align:right;color:${accent};">${esc(step.totals.budget)}</td>
            <td style="padding:6pt 8pt;font-size:9pt;color:#5C6B65;">Actual to date</td>
            <td style="padding:6pt 8pt;font-size:11pt;font-weight:bold;text-align:right;color:#0B1A12;">${esc(step.totals.actual)}</td>
          </tr>
        </table>`
            : '';
        return `<div style="page-break-before:always;">
      ${bandHtml(b, `${esc(opts.projectName)}  &middot;  ${i + 1} of ${opts.steps.length}`)}
      <div style="font-size:8.5pt;color:#7E9B93;letter-spacing:0.08em;text-transform:uppercase;">Section ${i + 1}</div>
      <div style="font-size:15pt;font-weight:bold;color:#0B1A12;margin:2pt 0 4pt 0;">${esc(step.name)}</div>
      ${step.blurb ? `<div style="font-size:9pt;color:#5C6B65;margin-bottom:6pt;">${esc(step.blurb)}</div>` : ''}
      ${step.blocks.map((bl) => blockHtml(bl, accent)).join('')}
      ${totals}
      ${footerHtml(b)}
    </div>`;
    }).join('');
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${esc(opts.projectName)} — Project Program</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;color:#1E2B25;margin:0;line-height:1.5;">

  <div>
    ${bandHtml(b, esc(opts.date || ''))}
    <div style="height:60pt;"></div>
    <div style="font-size:9pt;color:#7E9B93;letter-spacing:0.1em;text-transform:uppercase;">Project Program</div>
    <div style="font-size:26pt;font-weight:bold;color:#0B1A12;margin:6pt 0;">${esc(opts.projectName)}</div>
    ${opts.subtitle ? `<div style="font-size:12pt;color:#5C6B65;">${esc(opts.subtitle)}</div>` : ''}
    ${opts.date ? `<div style="font-size:10pt;color:#7E9B93;margin-top:10pt;">${esc(opts.date)}</div>` : ''}

    <div style="height:36pt;"></div>
    <div style="font-size:9pt;color:#7E9B93;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4pt;">Contents</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${contents}</table>
    ${footerHtml(b)}
  </div>

  ${body}

</body></html>`;
}
//# sourceMappingURL=program-document.js.map