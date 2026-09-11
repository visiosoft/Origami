"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderEmail = reminderEmail;
exports.overdueEmail = overdueEmail;
exports.progressEmail = progressEmail;
exports.overstretchEmail = overstretchEmail;
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
    const { overdue, today, soon, milestones = [] } = opts.buckets;
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
        ${section('Coming up', soon, '#2F6F68')}
        ${section('Milestones in the next 3 weeks', milestones, '#5B2BC9')}`,
            cta: { label: 'Open Origami', url: opts.url },
            footer: "You're getting this because tasks are assigned to you. An administrator can turn these off under Settings &rarr; Integrations.",
        }),
    };
}
function overdueEmail(opts) {
    const first = opts.name.split(/\s+/)[0] || 'there';
    const n = opts.tasks.length;
    return {
        subject: `${opts.brand.companyName}: ${n} task${n === 1 ? ' is' : 's are'} overdue`,
        html: (0, shell_1.emailShell)({
            brand: opts.brand,
            eyebrow: 'Overdue',
            title: `${first}, ${n} task${n === 1 ? ' needs' : 's need'} attention`,
            body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${opts.tasks.map((t) => row(t, '#8E2E0A')).join('')}</table>`,
            cta: { label: 'Open Origami', url: opts.url },
            footer: "You're getting this because you turned on standalone overdue notices under Settings &rarr; Notifications.",
        }),
    };
}
function progressEmail(opts) {
    const first = opts.name.split(/\s+/)[0] || 'there';
    return {
        subject: `${opts.brand.companyName}: ${opts.projectName} — ${opts.phaseName} is ${opts.threshold}% complete`,
        html: (0, shell_1.emailShell)({
            brand: opts.brand,
            eyebrow: 'Progress',
            title: `${first}, ${opts.phaseName} just hit ${opts.threshold}%`,
            body: `<p style="margin:0;font-size:13.5px;line-height:1.6;color:#43514D;">${(0, shell_1.escapeHtml)(opts.projectName)} &mdash; ${(0, shell_1.escapeHtml)(opts.phaseName)} has reached ${opts.threshold}% complete.</p>`,
            cta: { label: 'Open Origami', url: opts.url },
            footer: "You're getting this because you turned on milestone/progress notices under Settings &rarr; Notifications.",
        }),
    };
}
function overstretchEmail(opts) {
    const first = opts.name.split(/\s+/)[0] || 'there';
    return {
        subject: `${opts.brand.companyName}: ${opts.count} open tasks assigned to you`,
        html: (0, shell_1.emailShell)({
            brand: opts.brand,
            eyebrow: 'Workload',
            title: `${first}, you have ${opts.count} open tasks`,
            body: `<p style="margin:0;font-size:13.5px;line-height:1.6;color:#43514D;">That's above the office's threshold of ${opts.threshold}. Worth a look at what can move to someone else, or be reprioritised.</p>`,
            cta: { label: 'Open Origami', url: opts.url },
            footer: 'You are getting this because your open-task count crossed the configured threshold for today.',
        }),
    };
}
//# sourceMappingURL=reminder.templates.js.map