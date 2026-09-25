"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyLogBackupService = void 0;
exports.dailyLogRows = dailyLogRows;
exports.dailyLogCsv = dailyLogCsv;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const shell_1 = require("../email/shell");
const STATUS = { start: 'Start', continued: 'Continued', completing: 'Completing' };
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const niceDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fileDate = (iso) => iso;
function dailyLogRows(entries, employees, codes) {
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
function dailyLogCsv(meta, rows) {
    const lines = [
        ['Daily log', meta.project], ['Date', meta.date], ['Superintendent', meta.supervisor], ['Status', meta.status], [],
        ['Worker', 'Worker ID', 'Trade', 'Cost code', 'Division', 'Hours', 'Task', 'Team', 'What they worked on'],
        ...rows.map((r) => [r.worker, r.workerId, r.trade, r.code, r.division, r.hours, r.status, r.team, r.detail]),
        ['Total', '', '', '', '', rows.reduce((a, r) => a + r.hours, 0)],
        [], ['Site notes', meta.notes || ''],
    ];
    return lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
}
let DailyLogBackupService = class DailyLogBackupService {
    constructor(logs, entries, projects, employees, codes, users, google, settings) {
        this.logs = logs;
        this.entries = entries;
        this.projects = projects;
        this.employees = employees;
        this.codes = codes;
        this.users = users;
        this.google = google;
        this.settings = settings;
        this.log = new common_1.Logger('DailyLogBackup');
    }
    async recipients() {
        const listed = String((await this.settings.get('dailyLogs.backupEmails')) || '')
            .split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
        if (listed.length)
            return Array.from(new Set(listed.map((s) => s.toLowerCase())));
        const admins = (await this.users.find()).filter((u) => u.roleKey === 'admin' && u.status !== 'suspended' && u.email);
        return Array.from(new Set(admins.map((u) => u.email.trim().toLowerCase())));
    }
    afterSubmit(logId) {
        void this.send(logId).catch((e) => this.log.warn(`Daily log ${logId} backup email failed: ${e.message}`));
    }
    async send(logId, to) {
        const day = await this.logs.findOneBy({ id: logId });
        if (!day)
            throw new common_1.NotFoundException('Daily log not found');
        if (!(await this.google.isConnected()))
            throw new common_1.BadRequestException('Connect a Google account (Settings -> Integrations) to email daily logs.');
        const recipients = to?.length ? to : await this.recipients();
        if (!recipients.length)
            throw new common_1.BadRequestException('No one to send it to -- add addresses under Settings -> Daily log backup.');
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
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const meta = { project: projectName, date: niceDate(day.date), supervisor: day.supervisorName || '—', status: day.status, notes: day.notes || '' };
        const byCode = new Map();
        for (const r of rows) {
            const k = r.code || 'No code';
            const cur = byCode.get(k) || { label: r.code ? `${r.code} ${r.division}` : 'No cost code', hours: 0, people: 0 };
            cur.hours += r.hours;
            cur.people += 1;
            byCode.set(k, cur);
        }
        const cell = 'padding:6px 8px;border-bottom:1px solid #E6E9E4;font-size:10.5pt;vertical-align:top;';
        const head = 'padding:6px 8px;border-bottom:2px solid #173326;font-size:9pt;text-transform:uppercase;letter-spacing:.04em;color:#43514D;text-align:left;';
        const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0B1A12;">
      <div style="font-size:9pt;color:#7E9B93;text-transform:uppercase;letter-spacing:.08em;">${(0, shell_1.escapeHtml)(brand.companyName)} · Daily log</div>
      <h1 style="font-size:18pt;margin:4px 0 2px;">${(0, shell_1.escapeHtml)(projectName)}</h1>
      <div style="font-size:11pt;color:#43514D;margin-bottom:12px;">${(0, shell_1.escapeHtml)(meta.date)} · Superintendent: ${(0, shell_1.escapeHtml)(meta.supervisor)} · ${rows.length} worker line${rows.length === 1 ? '' : 's'}, ${hours} h · ${(0, shell_1.escapeHtml)(day.status)}</div>
      <table style="border-collapse:collapse;margin-bottom:14px;"><tr><th style="${head}">Cost code</th><th style="${head}">Workers</th><th style="${head}">Hours</th></tr>
        ${[...byCode.values()].map((c) => `<tr><td style="${cell}">${(0, shell_1.escapeHtml)(c.label)}</td><td style="${cell}">${c.people}</td><td style="${cell}">${c.hours}</td></tr>`).join('')}
      </table>
      <table width="100%" style="border-collapse:collapse;">
        <tr><th style="${head}">Worker</th><th style="${head}">ID</th><th style="${head}">Trade</th><th style="${head}">Cost code</th><th style="${head}">Hours</th><th style="${head}">Task</th><th style="${head}">Team</th><th style="${head}">What they worked on</th></tr>
        ${rows.map((r) => `<tr><td style="${cell}"><b>${(0, shell_1.escapeHtml)(r.worker)}</b></td><td style="${cell}">${(0, shell_1.escapeHtml)(r.workerId)}</td><td style="${cell}">${(0, shell_1.escapeHtml)(r.trade)}</td><td style="${cell}">${(0, shell_1.escapeHtml)(r.code)}${r.division ? `<br><span style="color:#7E9B93;font-size:9pt;">${(0, shell_1.escapeHtml)(r.division)}</span>` : ''}</td><td style="${cell}">${r.hours}</td><td style="${cell}">${(0, shell_1.escapeHtml)(r.status)}</td><td style="${cell}">${(0, shell_1.escapeHtml)(r.team)}</td><td style="${cell}">${(0, shell_1.escapeHtml)(r.detail)}</td></tr>`).join('')}
        <tr><td style="${cell}"><b>Total</b></td><td style="${cell}"></td><td style="${cell}"></td><td style="${cell}"></td><td style="${cell}"><b>${hours}</b></td><td style="${cell}" colspan="3"></td></tr>
      </table>
      ${meta.notes ? `<h2 style="font-size:12pt;margin:16px 0 4px;">Site notes</h2><div style="font-size:10.5pt;white-space:pre-wrap;">${(0, shell_1.escapeHtml)(meta.notes)}</div>` : ''}
    </body></html>`;
        const base = `Daily log ${fileDate(day.date)} - ${projectName}`.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120);
        const attachments = [];
        try {
            attachments.push({ filename: `${base}.pdf`, mimeType: 'application/pdf', content: await this.google.htmlToPdf(html, base, undefined, true) });
        }
        catch (e) {
            this.log.warn(`PDF for ${day.id} skipped: ${e.message}`);
        }
        const csv = dailyLogCsv(meta, rows);
        try {
            attachments.push({ filename: `${base}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: await this.google.csvToXlsx(csv, base) });
        }
        catch (e) {
            this.log.warn(`Excel for ${day.id} fell back to CSV: ${e.message}`);
            attachments.push({ filename: `${base}.csv`, mimeType: 'text/csv', content: Buffer.from('﻿' + csv, 'utf8') });
        }
        const base_url = await this.settings.baseUrl();
        const cc = supervisor?.email && !recipients.includes(supervisor.email.toLowerCase()) ? supervisor.email : undefined;
        await this.google.sendMail({
            to: recipients.join(', '), cc,
            subject: `Daily log — ${projectName} — ${meta.date}: ${rows.length} worker${rows.length === 1 ? '' : 's'}, ${hours} h`,
            html: (0, shell_1.emailShell)({
                brand, eyebrow: 'Daily log backup', title: `${(0, shell_1.escapeHtml)(projectName)} — ${(0, shell_1.escapeHtml)(meta.date)}`,
                body: `<p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#43514D;"><b>${(0, shell_1.escapeHtml)(meta.supervisor)}</b> submitted the daily log: ${rows.length} worker line${rows.length === 1 ? '' : 's'}, <b>${hours} hours</b>. The PDF and Excel copies are attached.</p>`
                    + (meta.notes ? `<p style="margin:0;font-size:13.5px;line-height:1.6;color:#0B1A12;white-space:pre-wrap;border-left:3px solid #2F7D4A;padding:8px 12px;background:#F4F7F4;">${(0, shell_1.escapeHtml)(meta.notes)}</p>` : ''),
                cta: base_url ? { label: 'Open daily logs', url: `${base_url}/manpower_con` } : undefined,
                footer: `Sent automatically when a daily log is submitted. Change who receives it under Settings → Daily log backup.`,
            }),
            attachments,
        });
        this.log.log(`Daily log ${day.id} backed up to ${recipients.join(', ')}`);
        return { sent: true, to: recipients, attachments: attachments.map((a) => a.filename) };
    }
};
exports.DailyLogBackupService = DailyLogBackupService;
exports.DailyLogBackupService = DailyLogBackupService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LaborLogEntryEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.CsiCodeEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        google_service_1.GoogleService,
        settings_service_1.SettingsService])
], DailyLogBackupService);
//# sourceMappingURL=daily-log-backup.service.js.map