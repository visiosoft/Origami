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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const google_service_1 = require("../google/google.service");
const shell_1 = require("../email/shell");
const assignment_template_1 = require("./assignment.template");
let NotificationsService = class NotificationsService {
    constructor(users, projects, settings, google) {
        this.users = users;
        this.projects = projects;
        this.settings = settings;
        this.google = google;
        this.log = new common_1.Logger('Notifications');
    }
    taskAssigned(notice) {
        void this.sendAssignment(notice).catch((err) => {
            this.log.warn(`Assignment email failed for ${notice.taskId}: ${err.message}`);
        });
    }
    async sendAssignment(notice) {
        const skip = (reason) => {
            this.log.log(`No assignment email for ${notice.taskId}: ${reason}`);
            return { sent: false, reason };
        };
        if ((await this.settings.get('notifications.assignmentEmail')) === 'false') {
            return skip('assignment emails are switched off for the workspace');
        }
        if (!notice.assigneeId)
            return skip('assignee is not a platform user');
        if (notice.actor?.id && notice.actor.id === notice.assigneeId)
            return skip('self-assignment');
        const user = await this.users.findOneBy({ id: notice.assigneeId });
        if (!user)
            return skip(`no user ${notice.assigneeId}`);
        if (!user.email)
            return skip(`${user.id} has no email address`);
        if (user.status === 'suspended')
            return skip(`${user.email} is suspended`);
        if (user.notifyOnAssignment === false)
            return skip(`${user.email} has these emails turned off`);
        if (!(await this.google.isConnected()))
            return skip('no Google account is connected');
        const base = await this.settings.baseUrl();
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const mail = (0, assignment_template_1.assignmentEmail)({
            brand,
            recipientName: user.name || user.email,
            assignerName: notice.actor?.name || 'Someone',
            title: notice.title || notice.taskId,
            description: notice.description,
            project: await this.projectLabel(notice),
            dueDate: notice.dueDate,
            priority: notice.priority,
            status: notice.status,
            url: this.taskUrl(base, notice),
            settingsUrl: `${base}/settings?tab=notifications`,
        });
        await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
        this.log.log(`Assignment email sent to ${user.email} for ${notice.taskId}`);
        return { sent: true };
    }
    taskUrl(base, notice) {
        const params = new URLSearchParams({ task: notice.taskId });
        if (notice.surface === 'log')
            params.set('type', 'log');
        else if (notice.projectId != null)
            params.set('project', String(notice.projectId));
        return `${base}/tasks?${params.toString()}`;
    }
    async projectLabel(notice) {
        if (notice.projectName)
            return notice.projectName;
        if (notice.projectId == null)
            return undefined;
        const project = await this.projects.findOneBy({ id: Number(notice.projectId) });
        return project?.name ?? `Project ${notice.projectId}`;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        google_service_1.GoogleService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map