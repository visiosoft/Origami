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
exports.ProjectHoldService = exports.holdDate = exports.HOLD_TASK_LABEL = void 0;
exports.holdTaskText = holdTaskText;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const project_tasks_service_1 = require("./project-tasks.service");
exports.HOLD_TASK_LABEL = 'kind:hold-follow-up';
const holdDate = (d) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : d;
};
exports.holdDate = holdDate;
function holdTaskText(project, input, since, by) {
    const reason = (input.reason || '').trim();
    return {
        title: `Follow up: ${project.name} is on hold`,
        description: [
            `Put on hold ${(0, exports.holdDate)(since.slice(0, 10))} by ${by}.`,
            reason ? `Reason: ${reason}` : '',
            `Check in with the client and either resume the project or push the follow-up date.`,
        ].filter(Boolean).join('\n'),
    };
}
let ProjectHoldService = class ProjectHoldService {
    constructor(projects, taskRepo, users, tasks) {
        this.projects = projects;
        this.taskRepo = taskRepo;
        this.users = users;
        this.tasks = tasks;
    }
    async project(id) {
        const p = await this.projects.findOneBy({ id });
        if (!p)
            throw new common_1.NotFoundException('Project not found');
        return p;
    }
    async hold(projectId, input, actor) {
        const until = String(input?.until || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(until))
            throw new common_1.BadRequestException('Pick the date to follow up.');
        const reason = String(input?.reason || '').trim().slice(0, 2000);
        const project = await this.project(projectId);
        const followUp = (input?.followUpId && (await this.users.findOneBy({ id: input.followUpId })))
            || (actor.id ? await this.users.findOneBy({ id: actor.id }) : null);
        const changing = !!project.holdSince;
        const since = project.holdSince || new Date().toISOString();
        const text = holdTaskText(project, { until, reason }, since, changing ? project.holdBy || actor.name : actor.name);
        const existing = project.holdTaskId ? await this.taskRepo.findOneBy({ id: project.holdTaskId }) : null;
        let taskId;
        if (existing && existing.status !== 'Done' && !existing.completed) {
            await this.tasks.update(existing.id, {
                title: text.title, description: text.description, dueDate: until,
                ...(followUp ? { assigneeId: followUp.id, assignee: followUp.name } : {}),
            }, actor);
            taskId = existing.id;
        }
        else {
            const created = await this.tasks.create({
                id: `T-HOLD-${projectId}-${Date.now()}`,
                projectId, title: text.title, description: text.description, dueDate: until,
                priority: 'Medium', labels: [exports.HOLD_TASK_LABEL],
                assigneeId: followUp?.id, assignee: followUp?.name,
            }, actor);
            taskId = created.id;
        }
        project.holdSince = since;
        project.holdUntil = until;
        project.holdReason = reason;
        project.holdBy = changing ? project.holdBy || actor.name : actor.name;
        project.holdTaskId = taskId;
        project.holdHistory = [...(project.holdHistory || []), {
                action: changing ? 'changed' : 'hold', at: new Date().toISOString(), by: actor.name, until, reason, followUp: followUp?.name,
            }];
        return this.projects.save(project);
    }
    async resume(projectId, actor) {
        const project = await this.project(projectId);
        if (!project.holdSince)
            return project;
        if (project.holdTaskId) {
            const task = await this.taskRepo.findOneBy({ id: project.holdTaskId });
            if (task && task.status !== 'Done' && !task.completed)
                await this.tasks.update(task.id, { status: 'Done' }, actor);
        }
        project.holdHistory = [...(project.holdHistory || []), { action: 'resumed', at: new Date().toISOString(), by: actor.name }];
        project.holdSince = '';
        project.holdUntil = '';
        project.holdReason = '';
        project.holdBy = '';
        project.holdTaskId = '';
        return this.projects.save(project);
    }
};
exports.ProjectHoldService = ProjectHoldService;
exports.ProjectHoldService = ProjectHoldService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        project_tasks_service_1.ProjectTasksService])
], ProjectHoldService);
//# sourceMappingURL=project-hold.service.js.map