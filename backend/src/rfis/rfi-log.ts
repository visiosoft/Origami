import { escapeHtml } from '../email/shell';

/**
 * Nov 19 (Edward, "Is there a way to send out the RFI Log to all?"): the
 * project's RFI Log as one page -- every RFI that isn't void, open ones first,
 * overdue marked -- for the PDF and the email.
 */
export interface LogRow { number: string; subject: string; status: string; to?: { name?: string | null; company?: string | null } | null; dateSent?: string | null; dateDue?: string | null; ballInCourt?: string | null; answer?: string | null }

const ORDER: Record<string, number> = { open: 0, draft: 1, answered: 2, closed: 3 };
const day = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—');

export function logRows(rows: LogRow[]): LogRow[] {
  return rows.filter((r) => r.status !== 'void').sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || String(a.number).localeCompare(String(b.number)));
}

export function logCounts(rows: LogRow[], today: string) {
  const live = logRows(rows);
  return {
    total: live.length,
    open: live.filter((r) => r.status === 'open').length,
    overdue: live.filter((r) => r.status === 'open' && !!r.dateDue && r.dateDue.slice(0, 10) < today).length,
    answered: live.filter((r) => r.status === 'answered').length,
    closed: live.filter((r) => r.status === 'closed').length,
  };
}

export function rfiLogHtml(rows: LogRow[], project: string, company: string, today: string): string {
  const live = logRows(rows);
  const c = logCounts(rows, today);
  const cell = 'padding:6px 8px;border-bottom:1px solid #E3E8E5;font-size:10.5pt;vertical-align:top;';
  const body = live.map((r) => {
    const late = r.status === 'open' && !!r.dateDue && r.dateDue.slice(0, 10) < today;
    return `<tr><td style="${cell}font-weight:700;">${escapeHtml(r.number)}</td><td style="${cell}">${escapeHtml(r.subject || '')}</td>`
      + `<td style="${cell}">${escapeHtml(r.status)}${late ? ' <b style="color:#8E2E0A;">overdue</b>' : ''}</td>`
      + `<td style="${cell}">${escapeHtml([r.to?.name, r.to?.company].filter(Boolean).join(', ') || '—')}</td>`
      + `<td style="${cell}">${day(r.dateSent)}</td><td style="${cell}">${day(r.dateDue)}</td><td style="${cell}">${escapeHtml(r.ballInCourt || '—')}</td></tr>`;
  }).join('');
  const head = ['No.', 'Subject', 'Status', 'To', 'Sent', 'Due', 'Ball in court'].map((h) => `<th style="${cell}text-align:left;font-size:9pt;color:#5C6B65;text-transform:uppercase;">${h}</th>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#1B2A24;">
<div style="font-size:9pt;color:#5C6B65;">${escapeHtml(company)}</div>
<h1 style="font-size:18pt;margin:2px 0 4px;">RFI Log — ${escapeHtml(project)}</h1>
<p style="font-size:10pt;color:#5C6B65;margin:0 0 12px;">As of ${day(today)} · ${c.total} RFIs · ${c.open} open${c.overdue ? ` (${c.overdue} overdue)` : ''} · ${c.answered} answered · ${c.closed} closed</p>
<table style="width:100%;border-collapse:collapse;"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td style="${cell}" colspan="7">No RFIs yet.</td></tr>`}</tbody></table>
</div>`;
}
