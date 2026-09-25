import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsiCodeEntity, DailyLogEntity, EmployeeEntity, LaborLogEntryEntity, ProjectEntity, UserEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';

const STATUS: Record<string, string> = { start: 'Start', continued: 'Continued', completing: 'Completing' };
const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const niceDate = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fileDate = (iso: string) => iso;

export interface DailyLogRow { worker: string; workerId: string; trade: string; code: string; division: string; hours: number; status: string; team: string; detail: string }

/** The day as rows, in the order a reader wants them: by cost code, then name. */
export function dailyLogRows(entries: LaborLogEntryEntity[], employees: EmployeeEntity[], codes: CsiCodeEntity[]): DailyLogRow[] {
  const emp = new Map(employees.map((e) => [e.id, e]));
  const code = new Map(codes.map((c) => [c.id, c]));
  return entries.map((e) => {
    const w = emp.get(e.employeeId);
    const c = e.csiCodeId ? code.get(e.csiCodeId) : undefined;
    return {
      worker: w?.name || e.employeeId, workerId: w?.workerId || '', trade: w?.trade || '', code: c?.code || '', division: c?.division || '',
      hours: Number(e.hours) || 0, status: STATUS[e.taskStatus || ''] || e.taskStatus || '', team: e.team || '', detail: e.taskDetail || '',
    };
  }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }) || a.worker.localeCompare(b.worker));
}

/** The spreadsheet: one row per worker line, then the notes. */
export function dailyLogCsv(meta: { project: string; date: string; supervisor: string; status: string; notes?: string }, rows: DailyLogRow[]) {
  const lines = [
    ['Daily log', meta.project], ['Date', meta.date], ['Superintendent', meta.supervisor], ['Status', meta.status], [],
    ['Worker', 'Worker ID', 'Trade', 'Cost code', 'Division', 'Hours', 'Task', 'Team', 'What they worked on'],
    ...rows.map((r) => [r.worker, r.workerId, r.trade, r.code, r.division, r.hours, r.status, r.team, r.detail]),
    ['Total', '', '', '', '', rows.reduce((a, r) => a + r.hours, 0)],
    [], ['Site notes', meta.notes || ''],
  ];
  return lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
}

/**
 * Backs a submitted daily log up by email -- a PDF to read and an Excel file
 * to work with -- so the day is on record outside the app too. Sent when the
 * superintendent submits, and on request ("Email a copy"). Recipients come
 * from Settings -> Daily log backup (the administrators if none are set), with
 * the superintendent copied.
 */
@Injectable()
export class DailyLogBackupService {
  private readonly log = new Logger('DailyLogBackup');

  constructor(
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(CsiCodeEntity) private readonly codes: Repository<CsiCodeEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  /** Who gets the backup: the configured list, else the administrators. */
  async recipients(): Promise<string[]> {
    const listed = String((await this.settings.get('dailyLogs.backupEmails')) || '')
      .split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (listed.length) return Array.from(new Set(listed.map((s) => s.toLowerCase())));
    const admins = (await this.users.find()).filter((u) => u.roleKey === 'admin' && u.status !== 'suspended' && u.email);
    return Array.from(new Set(admins.map((u) => u.email.trim().toLowerCase())));
  }

  /** Fire-and-forget after a submit: the backup must never block or fail the submission itself. */
  afterSubmit(logId: string) {
    void this.send(logId).catch((e) => this.log.warn(`Daily log ${logId} backup email failed: ${(e as Error).message}`));
  }

  async send(logId: string, to?: string[]) {
    const day = await this.logs.findOneBy({ id: logId });
    if (!day) throw new NotFoundException('Daily log not found');
    if (!(await this.google.isConnected())) throw new BadRequestException('Connect a Google account (Settings -> Integrations) to email daily logs.');
    const recipients = to?.length ? to : await this.recipients();
    if (!recipients.length) throw new BadRequestException('No one to send it to -- add addresses under Settings -> Daily log backup.');

    const [entries, project, employees, codes, supervisor] = await Promise.all([
      this.entries.find({ where: { dailyLogId: day.id } }),
      this.projects.findOneBy({ id: day.projectId }),
      this.employees.find(),
      this.codes.find(),
      day.supervisorId ? this.users.findOneBy({ id: day.supervisorId }) : Promise.resolve(null),
    ]);
    const rows = dailyLogRows(entries, employees, codes);
    const projectName = project?.name || `Project ${day.projectId}`;
    const hours = rows.reduce((a, r) => a + r.hours, 0);
    const brand = await loadEmailBrand(this.settings);
    const meta = { project: projectName, date: niceDate(day.date), supervisor: day.supervisorName || '—', status: day.status, notes: day.notes || '' };

    // Hours by cost code -- the summary a PM reads first.
    const byCode = new Map<string, { label: string; hours: number; people: number }>();
    for (const r of rows) {
      const k = r.code || 'No code';
      const cur = byCode.get(k) || { label: r.code ? `${r.code} ${r.division}` : 'No cost code', hours: 0, people: 0 };
      cur.hours += r.hours; cur.people += 1; byCode.set(k, cur);
    }
    const cell = 'padding:6px 8px;border-bottom:1px solid #E6E9E4;font-size:10.5pt;vertical-align:top;';
    const head = 'padding:6px 8px;border-bottom:2px solid #173326;font-size:9pt;text-transform:uppercase;letter-spacing:.04em;color:#43514D;text-align:left;';
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0B1A12;">
      <div style="font-size:9pt;color:#7E9B93;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(brand.companyName)} · Daily log</div>
      <h1 style="font-size:18pt;margin:4px 0 2px;">${escapeHtml(projectName)}</h1>
      <div style="font-size:11pt;color:#43514D;margin-bottom:12px;">${escapeHtml(meta.date)} · Superintendent: ${escapeHtml(meta.supervisor)} · ${rows.length} worker line${rows.length === 1 ? '' : 's'}, ${hours} h · ${escapeHtml(day.status)}</div>
      <table style="border-collapse:collapse;margin-bottom:14px;"><tr><th style="${head}">Cost code</th><th style="${head}">Workers</th><th style="${head}">Hours</th></tr>
        ${[...byCode.values()].map((c) => `<tr><td style="${cell}">${escapeHtml(c.label)}</td><td style="${cell}">${c.people}</td><td style="${cell}">${c.hours}</td></tr>`).join('')}
      </table>
      <table width="100%" style="border-collapse:collapse;">
        <tr><th style="${head}">Worker</th><th style="${head}">ID</th><th style="${head}">Trade</th><th style="${head}">Cost code</th><th style="${head}">Hours</th><th style="${head}">Task</th><th style="${head}">Team</th><th style="${head}">What they worked on</th></tr>
        ${rows.map((r) => `<tr><td style="${cell}"><b>${escapeHtml(r.worker)}</b></td><td style="${cell}">${escapeHtml(r.workerId)}</td><td style="${cell}">${escapeHtml(r.trade)}</td><td style="${cell}">${escapeHtml(r.code)}${r.division ? `<br><span style="color:#7E9B93;font-size:9pt;">${escapeHtml(r.division)}</span>` : ''}</td><td style="${cell}">${r.hours}</td><td style="${cell}">${escapeHtml(r.status)}</td><td style="${cell}">${escapeHtml(r.team)}</td><td style="${cell}">${escapeHtml(r.detail)}</td></tr>`).join('')}
        <tr><td style="${cell}"><b>Total</b></td><td style="${cell}"></td><td style="${cell}"></td><td style="${cell}"></td><td style="${cell}"><b>${hours}</b></td><td style="${cell}" colspan="3"></td></tr>
      </table>
      ${meta.notes ? `<h2 style="font-size:12pt;margin:16px 0 4px;">Site notes</h2><div style="font-size:10.5pt;white-space:pre-wrap;">${escapeHtml(meta.notes)}</div>` : ''}
    </body></html>`;

    const base = `Daily log ${fileDate(day.date)} - ${projectName}`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120);
    const attachments: { filename: string; mimeType: string; content: Buffer }[] = [];
    try { attachments.push({ filename: `${base}.pdf`, mimeType: 'application/pdf', content: await this.google.htmlToPdf(html, base, undefined, true) }); }
    catch (e) { this.log.warn(`PDF for ${day.id} skipped: ${(e as Error).message}`); }
    const csv = dailyLogCsv(meta, rows);
    try { attachments.push({ filename: `${base}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: await this.google.csvToXlsx(csv, base) }); }
    catch (e) {
      this.log.warn(`Excel for ${day.id} fell back to CSV: ${(e as Error).message}`);
      attachments.push({ filename: `${base}.csv`, mimeType: 'text/csv', content: Buffer.from('﻿' + csv, 'utf8') });
    }

    const base_url = await this.settings.baseUrl();
    const cc = supervisor?.email && !recipients.includes(supervisor.email.toLowerCase()) ? supervisor.email : undefined;
    await this.google.sendMail({
      to: recipients.join(', '), cc,
      subject: `Daily log — ${projectName} — ${meta.date}: ${rows.length} worker${rows.length === 1 ? '' : 's'}, ${hours} h`,
      html: emailShell({
        brand, eyebrow: 'Daily log backup', title: `${escapeHtml(projectName)} — ${escapeHtml(meta.date)}`,
        body: `<p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#43514D;"><b>${escapeHtml(meta.supervisor)}</b> submitted the daily log: ${rows.length} worker line${rows.length === 1 ? '' : 's'}, <b>${hours} hours</b>. The PDF and Excel copies are attached.</p>`
          + (meta.notes ? `<p style="margin:0;font-size:13.5px;line-height:1.6;color:#0B1A12;white-space:pre-wrap;border-left:3px solid #2F7D4A;padding:8px 12px;background:#F4F7F4;">${escapeHtml(meta.notes)}</p>` : ''),
        cta: base_url ? { label: 'Open daily logs', url: `${base_url}/manpower_con` } : undefined,
        footer: `Sent automatically when a daily log is submitted. Change who receives it under Settings → Daily log backup.`,
      }),
      attachments,
    });
    this.log.log(`Daily log ${day.id} backed up to ${recipients.join(', ')}`);
    return { sent: true, to: recipients, attachments: attachments.map((a) => a.filename) };
  }
}
