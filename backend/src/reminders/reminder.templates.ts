import { escapeHtml } from '../auth/email.templates';

export interface ReminderTask {
  id: string;
  title: string;
  dueDate: string;
  project: string;
  where: 'board' | 'log';
}

export interface ReminderBuckets {
  overdue: ReminderTask[];
  today: ReminderTask[];
  soon: ReminderTask[];
}

const row = (t: ReminderTask, accent: string) => `
  <tr>
    <td style="padding:9px 0;border-bottom:1px solid rgba(20,8,31,0.06);">
      <div style="font-size:13.5px;font-weight:600;color:#0B1A12;">${escapeHtml(t.title)}</div>
      <div style="font-size:11.5px;color:#7E9B93;margin-top:2px;">
        ${escapeHtml(t.project || 'No project')} ·
        <span style="color:${accent};font-weight:600;">${escapeHtml(t.dueDate)}</span>
      </div>
    </td>
  </tr>`;

const section = (title: string, tasks: ReminderTask[], accent: string) =>
  tasks.length
    ? `<div style="margin-bottom:22px;">
         <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${accent};margin-bottom:6px;">
           ${title} <span style="color:#7E9B93;">${tasks.length}</span>
         </div>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tasks.map((t) => row(t, accent)).join('')}</table>
       </div>`
    : '';

export function reminderEmail(opts: { name: string; buckets: ReminderBuckets; url: string }) {
  const { overdue, today, soon } = opts.buckets;
  const total = overdue.length + today.length + soon.length;
  const first = opts.name.split(/\s+/)[0] || 'there';
  const headline = overdue.length
    ? `${overdue.length} task${overdue.length === 1 ? ' is' : 's are'} overdue`
    : today.length
      ? `${today.length} task${today.length === 1 ? '' : 's'} due today`
      : `${total} task${total === 1 ? '' : 's'} coming up`;

  return {
    subject: `Origami: ${headline}`,
    html: `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FBF8F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F2;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid rgba(20,8,31,0.08);overflow:hidden;">
          <tr><td style="background:#0F2417;padding:22px 28px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">Origami Design + Build</div>
            <div style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;">Your tasks</div>
          </td></tr>
          <tr><td style="padding:28px 28px 4px;">
            <h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;color:#0B1A12;font-weight:700;">Morning, ${escapeHtml(first)}</h1>
            <p style="margin:0 0 22px;font-size:13.5px;line-height:1.6;color:#43514D;">${escapeHtml(headline)}.</p>
            ${section('Overdue', overdue, '#8E2E0A')}
            ${section('Due today', today, '#8A6D12')}
            ${section('Coming up', soon, '#2F6F68')}
          </td></tr>
          <tr><td style="padding:4px 28px 28px;">
            <a href="${opts.url}" style="display:inline-block;background:#173326;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:10px;">Open Origami</a>
          </td></tr>
          <tr><td style="border-top:1px solid rgba(20,8,31,0.07);padding:16px 28px;background:#FBF8F2;">
            <p style="margin:0;font-size:11.5px;line-height:1.6;color:#7E9B93;">You're getting this because tasks are assigned to you. An administrator can turn these off under Settings &rarr; Integrations.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
