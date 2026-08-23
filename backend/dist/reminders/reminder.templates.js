"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderEmail = reminderEmail;
const shell_1 = require("../email/shell");
const row = (t, accent) => `
  <tr>
    <td style="padding:9px 0;border-bottom:1px solid rgba(20,8,31,0.06);">
      <div style="font-size:13.5px;font-weight:600;color:#0B1A12;">${(0, shell_1.escapeHtml)(t.title)}</div>
      <div style="font-size:11.5px;color:#7E9B93;margin-top:2px;">
        ${(0, shell_1.escapeHtml)(t.project || 'No project')} ·
        <span style="color:${accent};font-weight:600;">${(0, shell_1.escapeHtml)(t.dueDate)}</span>
      </div>
    </td>
  </tr>`;
const section = (title, tasks, accent) => tasks.length
    ? `<div style="margin-bottom:22px;">
         <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${accent};margin-bottom:6px;">
           ${title} <span style="color:#7E9B93;">${tasks.length}</span>
         </div>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tasks.map((t) => row(t, accent)).join('')}</table>
       </div>`
    : '';
function reminderEmail(opts) {
    const { overdue, today, soon } = opts.buckets;
    const total = overdue.length + today.length + soon.length;
    const first = opts.name.split(/\s+/)[0] || 'there';
    const headline = overdue.length
        ? `${overdue.length} task${overdue.length === 1 ? ' is' : 's are'} overdue`
        : today.length
            ? `${today.length} task${today.length === 1 ? '' : 's'} due today`
            : `${total} task${total === 1 ? '' : 's'} coming up`;
    return {
        subject: `${opts.brand.companyName}: ${headline}`,
        html: (0, shell_1.emailShell)({
            brand: opts.brand,
            eyebrow: 'Your tasks',
            title: `Morning, ${(0, shell_1.escapeHtml)(first)}`,
            body: `
        <p style="margin:0 0 22px;font-size:13.5px;line-height:1.6;color:#43514D;">${(0, shell_1.escapeHtml)(headline)}.</p>
        ${section('Overdue', overdue, '#8E2E0A')}
        ${section('Due today', today, '#8A6D12')}
        ${section('Coming up', soon, '#2F6F68')}`,
            cta: { label: 'Open Origami', url: opts.url },
            footer: "You're getting this because tasks are assigned to you. An administrator can turn these off under Settings &rarr; Integrations.",
        }),
    };
}
//# sourceMappingURL=reminder.templates.js.map