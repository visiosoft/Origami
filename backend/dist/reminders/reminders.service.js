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
    constructor(projectTasks, tasks, users, projects, phases, settings, google) {
        this.projectTasks = projectTasks;
        this.tasks = tasks;
        this.users = users;
        this.projects = projects;
        this.phases = phases;
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
            await this.runOverdueOnly(now.date).catch((err) => this.log.error('Standalone overdue failed: ' + err.message));
            await this.runProgressChecks(now.date).catch((err) => this.log.error('Progress notices failed: ' + err.message));
            await this.runOverstretch(now.date).catch((err) => this.log.error('Overstretch check failed: ' + err.message));
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
            if (user.notifyOnMilestone === true) {
                const horizon = Date.now() + 21 * DAY;
                buckets.milestones = boardTasks
                    .filter((t) => this.isMine(t.assigneeId, t.assignee, user) && !t.completed && t.status !== 'Done' && !t.parentId)
                    .filter((t) => (t.labels || []).includes('Milestone') && t.dueDate)
                    .filter((t) => { const due = Date.parse(t.dueDate); return !Number.isNaN(due) && due <= horizon; })
                    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate || '', project: projectName.get(Number(t.projectId)) || `Project ${t.projectId}`, where: 'board' }))
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            }
            if (!buckets.overdue.length && !buckets.today.length && !buckets.soon.length && !buckets.milestones?.length) {
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
    async runOverdueOnly(today) {
        if ((await this.settings.get('reminders.overdueLastRunDate')) === today)
            return;
        await this.settings.set('reminders.overdueLastRunDate', today);
        if (!(await this.google.isConnected()))
            return;
        const [boardTasks, logTasks, users, projects] = await Promise.all([
            this.projectTasks.find(), this.tasks.find(), this.users.find(), this.projects.find(),
        ]);
        const projectName = new Map(projects.map((p) => [Number(p.id), p.name]));
        const base = await this.settings.baseUrl();
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        for (const user of users) {
            if (!user.email || user.status === 'suspended' || user.notifyOnOverdue !== true)
                continue;
            const mine = [
                ...boardTasks.filter((t) => this.isMine(t.assigneeId, t.assignee, user) && !t.completed && t.status !== 'Done' && !t.parentId)
                    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate || '', project: projectName.get(Number(t.projectId)) || `Project ${t.projectId}`, where: 'board' })),
                ...logTasks.filter((t) => this.isMine(t.assignedToId, t.assignedTo, user) && t.status !== 'Closed')
                    .map((t) => ({ id: t.id, title: t.description?.slice(0, 90) || t.id, dueDate: t.dueDate || '', project: t.project || '', where: 'log' })),
            ].filter((t) => !!t.dueDate);
            const overdue = this.bucket(mine).overdue;
            if (!overdue.length)
                continue;
            const mail = (0, reminder_templates_1.overdueEmail)({ name: user.name, tasks: overdue, url: `${base}/tasks`, brand });
            await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html })
                .catch((err) => this.log.warn(`Overdue notice to ${user.email} failed: ${err.message}`));
        }
    }
    async runProgressChecks(today) {
        if ((await this.settings.get('reminders.progressLastRunDate')) === today)
            return;
        await this.settings.set('reminders.progressLastRunDate', today);
        if (!(await this.google.isConnected()))
            return;
        const [phases, boardTasks, projects, users] = await Promise.all([
            this.phases.find(), this.projectTasks.find(), this.projects.find(), this.users.find(),
        ]);
        const projectName = new Map(projects.map((p) => [Number(p.id), p.name]));
        const base = await this.settings.baseUrl();
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const recipients = users.filter((u) => u.email && u.status !== 'suspended' && u.notifyOnMilestone === true);
        if (!recipients.length)
            return;
        const toStamp = [];
        for (const phase of phases) {
            const own = boardTasks.filter((t) => t.phaseId === phase.id && !t.parentId);
            if (!own.length)
                continue;
            const done = own.filter((t) => t.completed || t.status === 'Done').length;
            const percent = Math.round((done / own.length) * 100);
            const crossings = [
                [100, 'notified100'], [90, 'notified90'], [50, 'notified50'],
            ];
            for (const [threshold, col] of crossings) {
                if (percent < threshold || phase[col])
                    continue;
                const pName = projectName.get(Number(phase.projectId)) || `Project ${phase.projectId}`;
                for (const user of recipients) {
                    const mail = (0, reminder_templates_1.progressEmail)({ name: user.name, phaseName: phase.name, projectName: pName, threshold, url: `${base}/projects`, brand });
                    await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html })
                        .catch((err) => this.log.warn(`Progress notice to ${user.email} failed: ${err.message}`));
                }
                phase[col] = new Date().toISOString();
                if (!toStamp.includes(phase))
                    toStamp.push(phase);
                break;
            }
        }
        if (toStamp.length)
            await this.phases.save(toStamp);
    }
    async runOverstretch(today) {
        if ((await this.settings.get('reminders.overstretchLastRunDate')) === today)
            return;
        await this.settings.set('reminders.overstretchLastRunDate', today);
        const threshold = parseInt((await this.settings.get('reminders.overstretchThreshold')) || '0', 10);
        if (!threshold || !(await this.google.isConnected()))
            return;
        const [boardTasks, users] = await Promise.all([this.projectTasks.find(), this.users.find()]);
        const base = await this.settings.baseUrl();
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const counts = new Map();
        for (const t of boardTasks) {
            if (t.completed || t.status === 'Done' || t.parentId || !t.assigneeId)
                continue;
            counts.set(t.assigneeId, (counts.get(t.assigneeId) ?? 0) + 1);
        }
        for (const user of users) {
            const count = counts.get(user.id) ?? 0;
            if (count <= threshold || !user.email || user.status === 'suspended')
                continue;
            const mail = (0, reminder_templates_1.overstretchEmail)({ name: user.name, count, threshold, url: `${base}/tasks`, brand });
            await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html })
                .catch((err) => this.log.warn(`Overstretch notice to ${user.email} failed: ${err.message}`));
        }
    }
};
exports.RemindersService = RemindersService;
exports.RemindersService = RemindersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ProjectPhaseEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        google_service_1.GoogleService])
], RemindersService);
//# sourceMappingURL=reminders.service.js.map