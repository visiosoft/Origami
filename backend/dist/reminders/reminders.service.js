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
exports.RemindersService = exports.DEFAULT_REMINDER_TIMEZONE = void 0;
exports.addDays = addDays;
exports.isoDue = isoDue;
exports.bucketTasks = bucketTasks;
exports.wantsDigest = wantsDigest;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const google_service_1 = require("../google/google.service");
const reminder_templates_1 = require("./reminder.templates");
const shell_1 = require("../email/shell");
const log_statuses_1 = require("../tasks/log-statuses");
const DAY = 86400000;
const HOUR = 3600000;
exports.DEFAULT_REMINDER_TIMEZONE = 'America/Los_Angeles';
function addDays(date, n) {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function isoDue(raw, today) {
    const v = (raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(v))
        return v.slice(0, 10);
    const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})$/.exec(v);
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (!m || month < 0)
        return '';
    return `${today.slice(0, 4)}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
function bucketTasks(tasks, today) {
    const soonEnd = addDays(today, 3);
    const out = { overdue: [], today: [], soon: [] };
    for (const task of tasks) {
        const due = isoDue(task.dueDate, today);
        if (!due)
            continue;
        if (due < today)
            out.overdue.push(task);
        else if (due === today)
            out.today.push(task);
        else if (due < soonEnd)
            out.soon.push(task);
    }
    const byDate = (a, b) => a.dueDate.localeCompare(b.dueDate);
    out.overdue.sort(byDate);
    out.today.sort(byDate);
    out.soon.sort(byDate);
    return out;
}
function wantsDigest(user, today) {
    if (user.notifyByEmail === false)
        return false;
    const freq = user.digestFrequency || 'daily';
    if (freq === 'off')
        return false;
    if (freq === 'weekly')
        return new Date(`${today}T12:00:00Z`).getUTCDay() === 1;
    return true;
}
let RemindersService = class RemindersService {
    constructor(projectTasks, tasks, users, projects, phases, rfis, settings, google) {
        this.projectTasks = projectTasks;
        this.tasks = tasks;
        this.users = users;
        this.projects = projects;
        this.phases = phases;
        this.rfis = rfis;
        this.settings = settings;
        this.google = google;
        this.log = new common_1.Logger('RemindersService');
        this.timer = null;
    }
    onApplicationBootstrap() {
        this.timer = setInterval(() => { void this.tick(); }, HOUR);
        setTimeout(() => { void this.tick(); }, 60000).unref?.();
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
            const timezone = await this.timezone();
            const hour = parseInt((await this.settings.get('reminders.hour')) || '7', 10);
            const now = this.localParts(timezone);
            if (now.hour !== hour)
                return;
            if ((await this.settings.get('reminders.lastRunDate')) === now.date)
                return;
            await this.settings.set('reminders.lastRunDate', now.date);
            await this.run(now.date);
            await this.runOverdueOnly(now.date).catch((err) => this.log.error('Standalone overdue failed: ' + err.message));
            await this.runProgressChecks(now.date).catch((err) => this.log.error('Progress notices failed: ' + err.message));
            await this.runOverstretch(now.date).catch((err) => this.log.error('Overstretch check failed: ' + err.message));
        }
        catch (err) {
            this.log.error('Reminder tick failed: ' + err.message);
        }
    }
    async timezone() {
        return (await this.settings.get('reminders.timezone')) || exports.DEFAULT_REMINDER_TIMEZONE;
    }
    async load() {
        const [boardTasks, logTasks, users, projects] = await Promise.all([
            this.projectTasks.find(), this.tasks.find(), this.users.find(), this.projects.find(),
        ]);
        const openRfis = await this.rfis.find({ where: { status: 'open' } }).catch(() => []);
        const logStatuses = (0, log_statuses_1.parseLogStatuses)(await this.settings.get(log_statuses_1.LOG_STATUSES_KEY).catch(() => null));
        return { boardTasks, logTasks, users, openRfis, logStatuses, projectName: new Map(projects.map((p) => [Number(p.id), p.name])) };
    }
    tasksFor(user, data, base) {
        const following = (list) => Array.isArray(list) && list.some((c) => c?.id === user.id);
        const out = [];
        for (const t of data.boardTasks) {
            if (t.completed || t.status === 'Done' || t.parentId || !t.dueDate)
                continue;
            const mine = this.isMine(t.assigneeId, t.assignee, user);
            if (!mine && !following(t.collaborators))
                continue;
            out.push({
                id: t.id, title: t.title, dueDate: t.dueDate,
                project: data.projectName.get(Number(t.projectId)) || `Project ${t.projectId}`,
                where: 'board', following: !mine,
                url: `${base}/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId}`,
            });
        }
        for (const t of data.logTasks) {
            if ((0, log_statuses_1.isClosedStatus)(data.logStatuses, t.status) || !t.dueDate)
                continue;
            const mine = this.isMine(t.assignedToId, t.assignedTo, user);
            if (!mine && !following(t.collaborators))
                continue;
            out.push({
                id: t.id, title: t.description?.slice(0, 90) || t.id, dueDate: t.dueDate,
                project: t.project || '', where: 'log', following: !mine,
                url: `${base}/tasks?task=${encodeURIComponent(t.id)}&type=log`,
            });
        }
        for (const r of data.openRfis) {
            if (r.ownerId !== user.id || !r.dateDue)
                continue;
            out.push({
                id: r.id, title: `${r.number}: ${r.subject} — awaiting answer${r.to?.name ? ` from ${r.to.name}` : ''}`, dueDate: r.dateDue,
                project: data.projectName.get(Number(r.projectId)) || `Project ${r.projectId}`, where: 'rfi',
                url: `${base}/rfis?rfi=${encodeURIComponent(r.id)}`,
            });
        }
        return out;
    }
    async sendMine(userId) {
        const none = { overdue: 0, today: 0, soon: 0 };
        if (!(await this.google.isConnected()))
            return { sent: false, reason: 'no Google account is connected for sending mail', ...none };
        const data = await this.load();
        const user = data.users.find((u) => u.id === userId);
        if (!user?.email)
            return { sent: false, reason: 'your account has no email address', ...none };
        const today = this.localParts(await this.timezone()).date;
        const base = await this.settings.baseUrl();
        const buckets = bucketTasks(this.tasksFor(user, data, base), today);
        const counts = { overdue: buckets.overdue.length, today: buckets.today.length, soon: buckets.soon.length };
        if (!counts.overdue && !counts.today && !counts.soon)
            return { sent: false, reason: 'nothing of yours is overdue or due in the next 3 days', ...counts };
        const mail = (0, reminder_templates_1.reminderEmail)({ name: user.name, buckets, url: `${base}/tasks`, brand: await (0, shell_1.loadEmailBrand)(this.settings) });
        await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
        return { sent: true, ...counts };
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
    async run(today) {
        if (!(await this.google.isConnected())) {
            this.log.warn('Reminders skipped — no Google account connected.');
            return { sent: 0, skipped: 0, recipients: [] };
        }
        const data = await this.load();
        const { boardTasks, users, projectName } = data;
        const date = today || this.localParts(await this.timezone()).date;
        const base = await this.settings.baseUrl();
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        let sent = 0;
        let skipped = 0;
        const recipients = [];
        for (const user of users) {
            if (!user.email || user.status === 'suspended' || !wantsDigest(user, date)) {
                skipped++;
                continue;
            }
            const buckets = bucketTasks(this.tasksFor(user, data, base), date);
            if (user.notifyOnMilestone === true) {
                const horizon = Date.now() + 21 * DAY;
                buckets.milestones = boardTasks
                    .filter((t) => this.isMine(t.assigneeId, t.assignee, user) && !t.completed && t.status !== 'Done' && !t.parentId)
                    .filter((t) => (t.labels || []).includes('Milestone') && t.dueDate)
                    .filter((t) => { const due = Date.parse(t.dueDate); return !Number.isNaN(due) && due <= horizon; })
                    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate || '', project: projectName.get(Number(t.projectId)) || `Project ${t.projectId}`, where: 'board', url: `${base}/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId}` }))
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
    async runOverdueOnly(today) {
        if ((await this.settings.get('reminders.overdueLastRunDate')) === today)
            return;
        await this.settings.set('reminders.overdueLastRunDate', today);
        if (!(await this.google.isConnected()))
            return;
        const data = await this.load();
        const base = await this.settings.baseUrl();
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        for (const user of data.users) {
            if (!user.email || user.status === 'suspended' || user.notifyOnOverdue !== true || user.notifyByEmail === false)
                continue;
            const overdue = bucketTasks(this.tasksFor(user, data, base), today).overdue;
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
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.RfiEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        google_service_1.GoogleService])
], RemindersService);
//# sourceMappingURL=reminders.service.js.map