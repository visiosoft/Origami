"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rfiDate = exports.STATUS_LABEL = exports.RFI_DISCIPLINES = exports.RFI_STATUSES = void 0;
exports.impactLine = impactLine;
exports.rfiDocumentHtml = rfiDocumentHtml;
exports.rfiEmailBody = rfiEmailBody;
const shell_1 = require("../email/shell");
exports.RFI_STATUSES = ['draft', 'open', 'answered', 'closed', 'void'];
exports.RFI_DISCIPLINES = ['Architectural', 'Structural', 'Civil', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Protection', 'Landscape', 'Interior', 'Owner / Client', 'Other'];
exports.STATUS_LABEL = {
    draft: 'Draft', open: 'Sent — awaiting answer', answered: 'Answered', closed: 'Closed', void: 'Void',
};
const IMPACT = { none: 'None', yes: 'Yes', tbd: 'To be determined' };
const rfiDate = (d) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
};
exports.rfiDate = rfiDate;
const para = (s) => (s ? (0, shell_1.escapeHtml)(s).replace(/\n/g, '<br>') : '<span style="color:#9AA39D">—</span>');
const money = (n) => (n == null ? '' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
function impactLine(r) {
    const cost = IMPACT[r.costImpact || ''] || 'Not stated';
    const sched = IMPACT[r.scheduleImpact || ''] || 'Not stated';
    return {
        cost: r.costImpact === 'yes' && r.costAmount ? `${cost} (${money(r.costAmount)})` : cost,
        schedule: r.scheduleImpact === 'yes' && r.scheduleDays ? `${sched} (${r.scheduleDays} day${r.scheduleDays === 1 ? '' : 's'})` : sched,
    };
}
function rfiDocumentHtml(r, project, company) {
    const row = (k, v) => `<tr><td style="padding:6px 10px;width:150px;color:#5C6B65;font-size:10pt;border-bottom:1px solid #E4E1DA;vertical-align:top">${k}</td><td style="padding:6px 10px;font-size:10.5pt;border-bottom:1px solid #E4E1DA;vertical-align:top">${v}</td></tr>`;
    const imp = impactLine(r);
    const drawings = [r.drawingRef, ...(r.drawings || []).map((d) => d.name)].filter(Boolean).map((x) => (0, shell_1.escapeHtml)(String(x))).join('<br>');
    const cc = (r.cc || []).map((c) => (0, shell_1.escapeHtml)([c.name, c.company].filter(Boolean).join(', '))).join('; ');
    const block = (title, body) => `
    <div style="margin-top:16px">
      <div style="font-size:9pt;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#173326;border-bottom:2px solid #173326;padding-bottom:3px;margin-bottom:8px">${title}</div>
      <div style="font-size:11pt;line-height:1.5">${body}</div>
    </div>`;
    return `<html><body style="font-family:Arial,Helvetica,sans-serif;color:#0B1A12;margin:0">
  <table style="width:100%;border-collapse:collapse"><tr>
    <td style="vertical-align:top"><div style="font-size:9pt;color:#5C6B65;text-transform:uppercase;letter-spacing:1px">${(0, shell_1.escapeHtml)(company)}</div>
      <div style="font-size:20pt;font-weight:bold;margin-top:2px">Request for Information</div>
      <div style="font-size:11pt;color:#43514D;margin-top:2px">${(0, shell_1.escapeHtml)(project.name)}${project.location ? ` · ${(0, shell_1.escapeHtml)(project.location)}` : ''}</div></td>
    <td style="vertical-align:top;text-align:right"><div style="font-size:22pt;font-weight:bold;color:#173326">${(0, shell_1.escapeHtml)(r.number)}</div>
      <div style="font-size:10pt;color:#5C6B65">${(0, shell_1.escapeHtml)(exports.STATUS_LABEL[r.status] || r.status)}</div></td>
  </tr></table>
  <table style="width:100%;border-collapse:collapse;margin-top:14px">
    ${row('Subject', `<b>${(0, shell_1.escapeHtml)(r.subject)}</b>`)}
    ${row('To', (0, shell_1.escapeHtml)([r.to?.name, r.to?.company].filter(Boolean).join(', ')) || '—')}
    ${cc ? row('Copy to', cc) : ''}
    ${row('From', (0, shell_1.escapeHtml)([r.ownerName || r.createdBy, company].filter(Boolean).join(', ')))}
    ${row('Date sent', (0, exports.rfiDate)(r.dateSent) || '—')}
    ${row('Answer needed by', `<b>${(0, exports.rfiDate)(r.dateDue) || '—'}</b>`)}
    ${r.discipline ? row('Discipline', (0, shell_1.escapeHtml)(r.discipline)) : ''}
    ${r.specSection ? row('Spec section', (0, shell_1.escapeHtml)(r.specSection)) : ''}
    ${drawings ? row('Drawings', drawings) : ''}
  </table>
  ${block('Question', para(r.question))}
  ${r.suggestion ? block('Proposed solution', para(r.suggestion)) : ''}
  ${block('Answer', r.answer ? `${para(r.answer)}<div style="font-size:9.5pt;color:#5C6B65;margin-top:6px">${(0, shell_1.escapeHtml)(r.answeredBy || '')}${r.dateAnswered ? ` · ${(0, exports.rfiDate)(r.dateAnswered)}` : ''}</div>` : '<div style="height:90px;border:1px dashed #C9C5BC;border-radius:4px"></div>')}
  <table style="width:100%;border-collapse:collapse;margin-top:14px">
    ${row('Cost impact', (0, shell_1.escapeHtml)(imp.cost))}
    ${row('Schedule impact', (0, shell_1.escapeHtml)(imp.schedule))}
  </table>
</body></html>`;
}
function rfiEmailBody(r, project, note) {
    const drawings = [r.drawingRef, ...(r.drawings || []).map((d) => d.name)].filter(Boolean).map((x) => (0, shell_1.escapeHtml)(String(x))).join(', ');
    return `
    ${note ? `<p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#43514D;">${para(note)}</p>` : ''}
    <p style="margin:0 0 6px;font-size:12px;color:#7E9B93;">${(0, shell_1.escapeHtml)(project.name)}${r.discipline ? ` · ${(0, shell_1.escapeHtml)(r.discipline)}` : ''}${drawings ? ` · ${drawings}` : ''}</p>
    <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0B1A12;">${(0, shell_1.escapeHtml)(r.subject)}</p>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2F6F68;margin-bottom:4px;">Question</div>
    <p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#0B1A12;">${para(r.question)}</p>
    ${r.suggestion ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2F6F68;margin-bottom:4px;">Proposed solution</div>
    <p style="margin:0 0 16px;font-size:13.5px;line-height:1.6;color:#0B1A12;">${para(r.suggestion)}</p>` : ''}
    <p style="margin:0;font-size:13.5px;line-height:1.6;color:#43514D;">Please reply to this email with your answer${r.dateDue ? ` by <b>${(0, exports.rfiDate)(r.dateDue)}</b>` : ''}. The full RFI is attached as a PDF.</p>`;
}
//# sourceMappingURL=rfi.document.js.map