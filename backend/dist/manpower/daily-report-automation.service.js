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
exports.DailyReportAutomationService = exports.STOP_NOTICE_DAYS = exports.UNKNOWN_STOP_FOLLOW_UP_DAYS = void 0;
exports.noWorkRange = noWorkRange;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const google_service_1 = require("../google/google.service");
const project_hold_service_1 = require("../project-tasks/project-hold.service");
const shell_1 = require("../email/shell");
const HOUR = 60 * 60 * 1000;
const DEFAULT_TZ = 'America/Los_Angeles';
exports.UNKNOWN_STOP_FOLLOW_UP_DAYS = 14;
exports.STOP_NOTICE_DAYS = [7, 2];
const MAX_DAYS = 366;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const niceDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const activityOf = (log) => (log.sections && typeof log.sections === 'object' ? log.sections.activity || {} : {});
function noWorkRange(log) {
    const a = activityOf(log);
    if (a.worked !== 'no')
        return null;
    if (a.reason === 'stop') {
        const from = ISO.test(a.stop?.asOf || '') ? a.stop.asOf : log.date;
        const to = !a.stop?.endUnknown && ISO.test(a.stop?.end || '') ? a.stop.end : null;
        return { reason: 'stop', from, to };
    }
    if (a.reason === 'holiday') {
        const from = ISO.test(a.holiday?.start || '') ? a.holiday.start : log.date;
        const to = ISO.test(a.holiday?.end || '') ? a.holiday.end : from;
        return { reason: 'holiday', from, to };
    }
    return null;
}
let DailyReportAutomationService = class DailyReportAutomationService {
    constructor(logs, projects, users, settings, hold, google) {
        this.logs = logs;
        this.projects = projects;
        this.users = users;
        this.settings = settings;
        this.hold = hold;
        this.google = google;
        this.log = new common_1.Logger('DailyReportAutomation');
        this.timer = null;
    }
    onApplicationBootstrap() {
        this.timer = setInterval(() => { void this.tick(); }, HOUR);
        this.timer.unref?.();
        setTimeout(() => { void this.tick(); }, 90_000).unref?.();
    }
    onApplicationShutdown() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async today() {
        const tz = (await this.settings.get('reminders.timezone')) || DEFAULT_TZ;
        try {
            const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
            return `${p.year}-${p.month}-${p.day}`;
        }
        catch {
            return new Date().toISOString().slice(0, 10);
        }
    }
    async tick() {
        try {
            const today = await this.today();
            if ((await this.settings.get('dailyReports.autoRunDate')) === today)
                return;
            await this.settings.set('dailyReports.autoRunDate', today);
            await this.runDaily(today);
        }
        catch (e) {
            this.log.error('Daily report automation failed: ' + e.message);
        }
    }
    async afterSubmit(logId, actor) {
        const log = await this.logs.findOneBy({ id: logId });
        if (!log)
            return { held: false, created: 0 };
        const range = noWorkRange(log);
        if (!range)
            return { held: false, created: 0 };
        const today = await this.today();
        let held = false;
        if (range.reason === 'stop') {
            const a = activityOf(log);
            const until = range.to || plus(today, exports.UNKNOWN_STOP_FOLLOW_UP_DAYS);
            const reason = [
                `Stop order${a.stop?.by ? ` by ${a.stop.by}` : ''}${range.from ? ` as of ${niceDate(range.from)}` : ''}${range.to ? `, projected to end ${niceDate(range.to)}` : ' — end date unknown, follow up by this date'}.`,
                (a.stop?.details || '').trim(),
                `From the daily report for ${niceDate(log.date)}.`,
            ].filter(Boolean).join(' ');
            try {
                await this.hold.hold(Number(log.projectId), { until, reason, followUpId: log.supervisorId || actor.id }, { id: actor.id, name: actor.name });
                held = true;
            }
            catch (e) {
                this.log.warn(`Could not put project ${log.projectId} on hold: ${e.message}`);
            }
        }
        const created = await this.fillDays(log, today);
        return { held, created };
    }
    async runDaily(today) {
        const sources = (await this.logs.find()).filter((l) => !l.autoReason && (l.status === 'submitted' || l.status === 'approved') && noWorkRange(l));
        let created = 0, notices = 0;
        for (const s of sources) {
            created += await this.fillDays(s, today);
            notices += await this.stopNotices(s, today);
        }
        if (created || notices)
            this.log.log(`Daily reports: ${created} made automatically, ${notices} stop-order reminders sent`);
        return { created, notices };
    }
    async fillDays(source, today) {
        const range = noWorkRange(source);
        if (!range)
            return 0;
        let end = range.to && range.to < today ? range.to : today;
        if (range.reason === 'stop') {
            const project = await this.projects.findOneBy({ id: Number(source.projectId) });
            if (!project?.holdSince)
                return 0;
        }
        if (range.from > end)
            return 0;
        if (daysBetween(range.from, end) > MAX_DAYS)
            end = plus(range.from, MAX_DAYS);
        const existing = new Set((await this.logs.find({ where: { projectId: source.projectId } })).map((l) => l.date));
        const activity = activityOf(source);
        let n = 0;
        for (let d = range.from; d <= end; d = plus(d, 1)) {
            if (existing.has(d))
                continue;
            const now = new Date().toISOString();
            await this.logs.save(this.logs.create({
                id: 'DL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
                projectId: source.projectId, date: d, version: 1, status: 'approved', autoReason: range.reason,
                sections: { activity }, notes: '',
                supervisorId: source.supervisorId, supervisorName: source.supervisorName,
                submittedAt: now, approvedByName: 'Automatic', approvedAt: now, createdAt: now,
            }));
            existing.add(d);
            n++;
        }
        return n;
    }
    async stopNotices(source, today) {
        const range = noWorkRange(source);
        if (!range || range.reason !== 'stop' || !range.to || !this.google)
            return 0;
        const left = daysBetween(today, range.to);
        if (!exports.STOP_NOTICE_DAYS.includes(left))
            return 0;
        const project = await this.projects.findOneBy({ id: Number(source.projectId) });
        if (!project?.holdSince)
            return 0;
        const key = `dailyReports.notice.${source.id}.${left}`;
        if (await this.settings.get(key))
            return 0;
        await this.settings.set(key, today);
        const users = await this.users.find();
        const to = Array.from(new Set(users
            .filter((u) => u.status !== 'suspended' && u.email && (u.id === source.supervisorId || u.roleKey === 'admin'))
            .map((u) => u.email.trim().toLowerCase())));
        if (!to.length || !(await this.google.isConnected().catch(() => false)))
            return 0;
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const base = await this.settings.baseUrl();
        const a = activityOf(source);
        const html = (0, shell_1.emailShell)({
            brand, eyebrow: 'Stop order', title: `${escapeHtml(project.name)}: the stop order ends ${niceDate(range.to)}`,
            body: `<p style="margin:0 0 10px;">That's ${left} days from today. Time to plan the restart — crew, subs and deliveries.</p>`
                + `<p style="margin:0 0 10px;color:#43514D;">Stopped by ${escapeHtml(a.stop?.by || '—')} as of ${escapeHtml(range.from ? niceDate(range.from) : '—')}.${a.stop?.details ? ` ${escapeHtml(a.stop.details)}` : ''}</p>`
                + `<p style="margin:0;color:#43514D;">The project stays on hold until someone resumes it in Projects.</p>`,
            cta: { label: 'Open the project', url: `${base}/projects?open=${project.id}` },
            footer: 'Sent because a daily report put this project on a stop order. You get it as the person who filed it, or as an admin.',
        });
        for (const addr of to) {
            await this.google.sendMail({ to: addr, subject: `${project.name}: stop order ends in ${left} days`, html }).catch((e) => this.log.warn(`Stop notice to ${addr} failed: ${e.message}`));
        }
        return 1;
    }
};
exports.DailyReportAutomationService = DailyReportAutomationService;
exports.DailyReportAutomationService = DailyReportAutomationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        project_hold_service_1.ProjectHoldService,
        google_service_1.GoogleService])
], DailyReportAutomationService);
//# sourceMappingURL=daily-report-automation.service.js.map