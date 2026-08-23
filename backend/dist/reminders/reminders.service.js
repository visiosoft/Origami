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
exports.RemindersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const google_service_1 = require("../google/google.service");
const reminder_templates_1 = require("./reminder.templates");
const shell_1 = require("../email/shell");
const DAY = 86400000;
const HOUR = 3600000;
let RemindersService = class RemindersService {
    constructor(projectTasks, tasks, users, projects, settings, google) {
        this.projectTasks = projectTasks;
        this.tasks = tasks;
        this.users = users;
        this.projects = projects;
        this.settings = settings;
        this.google = google;
        this.log = new common_1.Logger('RemindersService');
        this.timer = null;
    }
    onApplicationBootstrap() {
        this.timer = setInterval(() => { void this.tick(); }, HOUR);
        this.timer.unref?.();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async tick() {
        try {
            if ((await this.settings.get('reminders.enabled')) !== 'true')
                return;
            const timezone = (await this.settings.get('reminders.timezone')) || 'Asia/Dubai';
            const hour = parseInt((await this.settings.get('reminders.hour')) || '7', 10);
            const now = this.localParts(timezone);
            if (now.hour !== hour)
                return;
            if ((await this.settings.get('reminders.lastRunDate')) === now.date)
                return;
            await this.settings.set('reminders.lastRunDate', now.date);
            await this.run();
        }
        catch (err) {
            this.log.error('Reminder tick failed: ' + err.message);
        }
    }
    localParts(timezone) {
        let date;
        let hour;
        try {
            const fmt = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
            });
            const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
            date = `${parts.year}-${parts.month}-${parts.day}`;
            hour = parseInt(parts.hour, 10);
        }
        catch {
            const d = new Date();
            date = d.toISOString().slice(0, 10);
            hour = d.getUTCHours();
        }
        return { date, hour };
    }
    async run() {
        if (!(await this.google.isConnected())) {
            this.log.warn('Reminders skipped — no Google account connected.');
            return { sent: 0, skipped: 0, recipients: [] };
        }
        const [boardTasks, logTasks, users, projects] = await Promise.all([
            this.projectTasks.find(),
            this.tasks.find(),
            this.users.find(),
            this.projects.find(),
        ]);
        const projectName = new Map(projects.map((p) => [Number(p.id), p.name]));
        const base = await this.settings.baseUrl();
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        let sent = 0;
        let skipped = 0;
        const recipients = [];
        for (const user of users) {
            if (!user.email || user.status === 'suspended') {
                skipped++;
                continue;
            }
            const mine = [
                ...boardTasks
                    .filter((t) => this.isMine(t.assigneeId, t.assignee, user) && !t.completed && t.status !== 'Done' && !t.parentId)
                    .map((t) => ({
                    id: t.id, title: t.title, dueDate: t.dueDate || '',
                    project: projectName.get(Number(t.projectId)) || `Project ${t.projectId}`,
                    where: 'board',
                })),
                ...logTasks
                    .filter((t) => this.isMine(t.assignedToId, t.assignedTo, user) && t.status !== 'Closed')
                    .map((t) => ({
                    id: t.id, title: t.description?.slice(0, 90) || t.id, dueDate: t.dueDate || '',
                    project: t.project || '', where: 'log',
                })),
            ].filter((t) => !!t.dueDate);
            const buckets = this.bucket(mine);
            if (!buckets.overdue.length && !buckets.today.length && !buckets.soon.length) {
                skipped++;
                continue;
            }
            const mail = (0, reminder_templates_1.reminderEmail)({ name: user.name, buckets, url: `${base}/tasks`, brand });
            try {
                await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
                sent++;
                recipients.push(user.email);
            }
            catch (err) {
                this.log.warn(`Reminder to ${user.email} failed: ${err.message}`);
            }
        }
        this.log.log(`Reminders sent to ${sent} user(s), ${skipped} skipped`);
        return { sent, skipped, recipients };
    }
    isMine(assigneeId, assignee, user) {
        if (assigneeId)
            return assigneeId === user.id;
        return !!assignee && assignee.trim().toLowerCase() === user.name.trim().toLowerCase();
    }
    bucket(tasks) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayMs = startOfToday.getTime();
        const out = { overdue: [], today: [], soon: [] };
        for (const task of tasks) {
            const due = Date.parse(task.dueDate);
            if (Number.isNaN(due))
                continue;
            if (due < todayMs)
                out.overdue.push(task);
            else if (due < todayMs + DAY)
                out.today.push(task);
            else if (due < todayMs + 3 * DAY)
                out.soon.push(task);
        }
        const byDate = (a, b) => a.dueDate.localeCompare(b.dueDate);
        out.overdue.sort(byDate);
        out.today.sort(byDate);
        out.soon.sort(byDate);
        return out;
    }
};
exports.RemindersService = RemindersService;
exports.RemindersService = RemindersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        google_service_1.GoogleService])
], RemindersService);
//# sourceMappingURL=reminders.service.js.map