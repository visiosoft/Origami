"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentEmail = assignmentEmail;
const shell_1 = require("../email/shell");
const EXCERPT_CHARS = 300;
function prettyDate(value) {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed))
        return value;
    return new Date(parsed).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
const metaRow = (label, value) => `
  <tr>
    <td style="padding:7px 14px 7px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7E9B93;white-space:nowrap;vertical-align:top;">${(0, shell_1.escapeHtml)(label)}</td>
    <td style="padding:7px 0;font-size:13.5px;color:#0B1A12;">${(0, shell_1.escapeHtml)(value)}</td>
  </tr>`;
function assignmentEmail(input) {
    const first = input.recipientName.split(/\s+/)[0] || 'there';
    const meta = [
        input.project ? metaRow('Project', input.project) : '',
        input.dueDate ? metaRow('Due', prettyDate(input.dueDate)) : '',
        input.priority ? metaRow('Priority', input.priority) : '',
        input.status ? metaRow('Status', input.status) : '',
    ].filter(Boolean).join('');
    const raw = (input.description || '').trim();
    const excerpt = raw.length > EXCERPT_CHARS ? `${raw.slice(0, EXCERPT_CHARS).trimEnd()}…` : raw;
    const body = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#43514D;">
      Hi ${(0, shell_1.escapeHtml)(first)} — <strong>${(0, shell_1.escapeHtml)(input.assignerName)}</strong> assigned you a task.
    </p>
    <div style="border:1px solid rgba(20,8,31,0.09);border-radius:10px;padding:16px 18px;margin-bottom:4px;">
      <div style="font-size:15.5px;font-weight:700;color:#0B1A12;line-height:1.4;">${(0, shell_1.escapeHtml)(input.title)}</div>
      ${meta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px;">${meta}</table>` : ''}
      ${excerpt
        ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#43514D;white-space:pre-wrap;">${(0, shell_1.escapeHtml)(excerpt)}</p>`
        : ''}
    </div>`;
    return {
        subject: `${input.assignerName} assigned you: ${input.title}`,
        html: (0, shell_1.emailShell)({
            brand: input.brand,
            eyebrow: 'Task assigned',
            title: 'You have a new task',
            body,
            cta: { label: 'Open task', url: input.url },
            footer: `You're receiving this because you were assigned this task. `
                + `<a href="${input.settingsUrl}" style="color:#2F7D4A;">Turn these emails off</a>.`,
        }),
    };
}
//# sourceMappingURL=assignment.template.js.map