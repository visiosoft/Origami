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
exports.AllFilesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const task_types_1 = require("../database/task.types");
const headline = (s) => String(s || '').split('\n')[0].trim().slice(0, 80);
let AllFilesService = class AllFilesService {
    constructor(leadFiles, leads, logTasks, projects, boardTasks, phases, rfis, fileRoom) {
        this.leadFiles = leadFiles;
        this.leads = leads;
        this.logTasks = logTasks;
        this.projects = projects;
        this.boardTasks = boardTasks;
        this.phases = phases;
        this.rfis = rfis;
        this.fileRoom = fileRoom;
    }
    async forLead(leadId) {
        const project = await this.projects.findOneBy({ leadId });
        return this.collect(leadId, project);
    }
    async forProject(projectId) {
        const project = await this.projects.findOneBy({ id: projectId });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        return this.collect(project.leadId || null, project);
    }
    async collect(leadId, project) {
        const out = [];
        const base = (a) => ({ id: a.id, name: a.name, kind: a.kind, mimeType: a.mimeType, size: a.size, uploadedAt: a.uploadedAt, uploadedBy: a.uploadedBy, ...(a.kind === 'link' ? { url: a.url } : {}) });
        if (leadId) {
            const lf = await this.leadFiles.findOneBy({ leadId });
            for (const a of (0, task_types_1.normalizeAttachments)(lf?.attachments)) {
                const client = a.stage === 'client_upload';
                out.push({ ...base(a), source: client ? 'client' : 'lead', where: client ? (a.stageName && a.stageName !== 'Uploaded by the client' ? `From the client · ${String(a.stageName).replace(/^Client: /, '')}` : 'From the client') : a.stageName || 'Lead', scope: 'lead-files', ownerId: leadId });
            }
            const tasks = (await this.logTasks.find()).filter((t) => t.project === leadId || (project && (t.project === project.name || t.project === String(project.id))));
            for (const t of tasks) {
                for (const a of (0, task_types_1.normalizeAttachments)(t.attachments)) {
                    out.push({ ...base(a), source: 'lead-task', where: `Task ${t.id}${headline(t.description) ? ` · ${headline(t.description)}` : ''}`, taskNumber: t.id, scope: 'tasks', ownerId: t.id });
                }
            }
        }
        if (project) {
            const [tasks, phases, rfis, rooms] = await Promise.all([
                this.boardTasks.find({ where: { projectId: project.id } }), this.phases.find({ where: { projectId: project.id } }),
                this.rfis.find({ where: { projectId: project.id } }), this.fileRoom.find({ where: { projectId: project.id } }),
            ]);
            const phaseName = new Map(phases.map((p) => [p.id, p.name]));
            for (const t of tasks) {
                for (const a of (0, task_types_1.normalizeAttachments)(t.attachments)) {
                    const phase = t.phaseId ? phaseName.get(t.phaseId) : '';
                    out.push({ ...base(a), source: 'project-task', where: `${phase ? `${phase} · ` : ''}Task: ${t.title}`, scope: 'project-tasks', ownerId: t.id });
                }
            }
            for (const r of rfis) {
                for (const a of (0, task_types_1.normalizeAttachments)(r.attachments))
                    out.push({ ...base(a), source: 'rfi', where: `${r.number} · ${r.subject}`, scope: 'rfis', ownerId: r.id });
            }
            for (const f of rooms.filter((x) => x.isLatest !== false)) {
                out.push({
                    id: f.id, name: f.name, kind: 'drive', mimeType: f.mimeType, size: Number(f.size) || undefined, uploadedAt: f.updatedAt, uploadedBy: f.uploadedBy,
                    source: 'file-room', where: `Plan & File Room${(f.folderPath || []).length ? ' › ' + f.folderPath.join(' › ') : ''}`, scope: 'file-room', ownerId: String(project.id),
                });
            }
        }
        const numbered = out
            .map((f, i) => ({ f, i }))
            .sort((a, b) => (a.f.uploadedAt || '').localeCompare(b.f.uploadedAt || '') || a.i - b.i)
            .map(({ f }, i) => ({ ...f, n: i + 1 }));
        const lead = leadId ? await this.leads.findOneBy({ id: leadId }) : null;
        return {
            leadId, projectId: project?.id ?? null, projectName: project?.name || lead?.leadName || '',
            files: numbered.reverse(),
        };
    }
};
exports.AllFilesService = AllFilesService;
exports.AllFilesService = AllFilesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.LeadFilesEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.ProjectPhaseEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.RfiEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.FileRoomFileEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AllFilesService);
//# sourceMappingURL=all-files.service.js.map