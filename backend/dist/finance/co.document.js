"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coDate = exports.CO_REASON_LABEL = void 0;
exports.changeOrderHtml = changeOrderHtml;
exports.changeOrderEmailBody = changeOrderEmailBody;
const shell_1 = require("../email/shell");
exports.CO_REASON_LABEL = {
    client_request: 'Client request', design_change: 'Design change', unforeseen: 'Unforeseen condition', scope_addition: 'Scope addition',
    scope_reduction: 'Scope reduction', allowance: 'Allowance', code_requirement: 'Code requirement', other: 'Other',
};
const usd = (n) => {
    const v = Number(n) || 0;
    return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const coDate = (d) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
};
exports.coDate = coDate;
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#173326');
const safeImg = (u) => (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(u || '') ? u : '');
function changeOrderHtml(co, brand, projectName) {
    const accent = safeColor(brand.accentColor);
    const logo = safeImg(brand.logoDataUrl);
    const e = (v) => (0, shell_1.escapeHtml)(String(v ?? ''));
    const rows = co.items.map((it) => `<tr>
    <td style="padding:7px 4px;border-bottom:1px solid #eee;vertical-align:top">${e(it.description)}</td>
    <td style="padding:7px 4px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${it.quantity != null && it.quantity !== '' ? `${e(it.quantity)} ${e(it.unit || '')} × ${e(usd(it.rate))}` : ''}</td>
    <td style="padding:7px 4px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${e(usd(it.amount))}</td></tr>`).join('');
    const days = Number(co.scheduleImpactDays) || 0;
    return `<html><body style="font-family:Arial,Helvetica,sans-serif;color:#0B1A12;font-size:10.5pt;margin:0">
<table style="width:100%;border-collapse:collapse;border-bottom:3px solid ${accent}"><tr>
  <td style="vertical-align:top;padding-bottom:12px;font-size:9.5pt;color:#556;line-height:1.5">
    ${logo ? `<img src="${logo}" style="max-height:52px;max-width:210px;display:block;margin-bottom:6px">` : ''}
    <b style="font-size:13pt;color:#0B1A12">${e(brand.companyName)}</b><br>${e(brand.address)}<br>${e([brand.phone, brand.email, brand.website].filter(Boolean).join(' · '))}
  </td>
  <td style="vertical-align:top;text-align:right;padding-bottom:12px;line-height:1.6">
    <div style="font-size:20pt;font-weight:bold;color:${accent}">CHANGE ORDER</div>
    <b>${e(co.number)}</b><br>Date: ${e((0, exports.coDate)(co.dateRequested || co.createdAt))}<br>Project: ${e(projectName)}<br>Reason: ${e(exports.CO_REASON_LABEL[co.reason || ''] || co.reason || '')}
    ${co.requestedBy ? `<br>Requested by: ${e(co.requestedBy)}` : ''}
  </td></tr></table>
<div style="font-size:9pt;text-transform:uppercase;letter-spacing:1px;color:#778;font-weight:bold;margin:16px 0 4px">${e(co.title)}</div>
${co.description ? `<div style="line-height:1.5">${e(co.description).replace(/\n/g, '<br>')}</div>` : ''}
<table style="width:100%;border-collapse:collapse;margin-top:16px">
  <tr><th style="text-align:left;font-size:8.5pt;text-transform:uppercase;color:#778;border-bottom:1px solid #ccc;padding:6px 4px">Description</th>
      <th style="text-align:right;font-size:8.5pt;text-transform:uppercase;color:#778;border-bottom:1px solid #ccc;padding:6px 4px">Quantity</th>
      <th style="text-align:right;font-size:8.5pt;text-transform:uppercase;color:#778;border-bottom:1px solid #ccc;padding:6px 4px">Amount</th></tr>
  ${rows}
  <tr><td style="padding:8px 4px;font-weight:bold;font-size:12.5pt;border-top:2px solid #0B1A12">Total change to the contract</td><td style="border-top:2px solid #0B1A12"></td>
      <td style="padding:8px 4px;font-weight:bold;font-size:12.5pt;border-top:2px solid #0B1A12;text-align:right">${e(usd(co.total))}</td></tr>
</table>
<p>Schedule impact: ${days ? `${days > 0 ? '+' : ''}${days} calendar day${Math.abs(days) === 1 ? '' : 's'}` : 'none'}.</p>
<p style="color:#778;font-size:9.5pt">This change order, once signed, amends the contract by the amount above. All other terms remain unchanged.</p>
<table style="width:100%;border-collapse:collapse;margin-top:56px"><tr>
  <td style="width:48%;border-top:1px solid #0B1A12;padding-top:6px;font-size:9.5pt;color:#556;vertical-align:top">Client signature, name &amp; date${co.clientSigner ? `<br><b style="color:#0B1A12">${e(co.clientSigner)} · ${e((0, exports.coDate)(co.clientApprovedDate))}</b>` : ''}</td>
  <td style="width:4%"></td>
  <td style="width:48%;border-top:1px solid #0B1A12;padding-top:6px;font-size:9.5pt;color:#556;vertical-align:top">For ${e(brand.companyName || 'the contractor')}, name &amp; date</td>
</tr></table>
</body></html>`;
}
function changeOrderEmailBody(co, projectName, note) {
    const e = (v) => (0, shell_1.escapeHtml)(String(v ?? ''));
    const days = Number(co.scheduleImpactDays) || 0;
    return `
    ${note ? `<p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#43514D;">${e(note).replace(/\n/g, '<br>')}</p>` : ''}
    <p style="margin:0 0 4px;font-size:12px;color:#7E9B93;">${e(projectName)} · ${e(co.number)}</p>
    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0B1A12;">${e(co.title)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:13.5px;color:#0B1A12;">
      <tr><td style="padding:2px 16px 2px 0;color:#7E9B93;">Change to the contract</td><td style="font-weight:700;">${e(usd(co.total))}</td></tr>
      <tr><td style="padding:2px 16px 2px 0;color:#7E9B93;">Schedule impact</td><td>${days ? `${days > 0 ? '+' : ''}${days} calendar days` : 'None'}</td></tr>
    </table>
    <p style="margin:0;font-size:13.5px;line-height:1.6;color:#43514D;">The change order is attached as a PDF. Please review it, sign it and send it back — or reply to this email with any questions.</p>`;
}
//# sourceMappingURL=co.document.js.map