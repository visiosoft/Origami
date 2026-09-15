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
exports.ProjectProgramService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const people_service_1 = require("../people/people.service");
let ProjectProgramService = class ProjectProgramService {
    constructor(repo, projects, leadRepo, leads, versions, people) {
        this.repo = repo;
        this.projects = projects;
        this.leadRepo = leadRepo;
        this.leads = leads;
        this.versions = versions;
        this.people = people;
        this.log = new common_1.Logger('ProjectProgramService');
    }
    async snapshot(ownerKey, data, savedAt, savedBy) {
        await this.versions.save(this.versions.create({ ownerKey, data, savedAt, savedBy }));
    }
    async listVersions(ownerKey) {
        const rows = await this.versions.find({ where: { ownerKey }, order: { id: 'DESC' } });
        return rows.map((v) => ({ id: v.id, savedAt: v.savedAt, savedBy: v.savedBy }));
    }
    async getVersion(ownerKey, id) {
        const v = await this.versions.findOneBy({ id, ownerKey });
        if (!v)
            throw new common_1.BadRequestException('That version no longer exists.');
        return { id: v.id, savedAt: v.savedAt, savedBy: v.savedBy, data: this.parse(v.data) };
    }
    parse(raw) {
        if (!raw)
            return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        }
        catch {
            return {};
        }
    }
    async get(projectId) {
        if (!Number.isFinite(projectId))
            throw new common_1.BadRequestException('Which project?');
        const row = await this.repo.findOneBy({ projectId });
        return {
            projectId,
            data: this.parse(row?.data),
            updatedAt: row?.updatedAt || '',
            updatedBy: row?.updatedBy || '',
            completedAt: row?.completedAt || '',
            sentAt: row?.sentAt || '',
            sentTo: row?.sentTo || '',
            signedAt: row?.signedAt || '',
            signedByName: row?.signedByName || '',
            signedByEmail: row?.signedByEmail || '',
            signatureImage: row?.signatureImage || '',
        };
    }
    async assertClientAccess(projectId, email) {
        const project = await this.projects.findOneBy({ id: projectId });
        if (!project || !(await this.people.isClientOnProject(email, project.name))) {
            throw new common_1.ForbiddenException('This project is not linked to your account.');
        }
        return project;
    }
    async getForClient(projectId, email) {
        await this.assertClientAccess(projectId, email);
        return this.get(projectId);
    }
    async sign(projectId, signer, image, meta) {
        if (!signer.name?.trim())
            throw new common_1.BadRequestException('Type your name to certify the signature.');
        if (!image?.trim())
            throw new common_1.BadRequestException('Draw your signature before submitting.');
        await this.assertClientAccess(projectId, signer.email);
        const row = await this.repo.findOneBy({ projectId });
        if (!row)
            throw new common_1.BadRequestException('There is nothing to sign yet.');
        row.signedAt = new Date().toISOString();
        row.signedByName = signer.name.trim();
        row.signedByEmail = signer.email;
        row.signatureImage = image;
        row.signerIp = meta.ip || '';
        row.signerUserAgent = meta.userAgent || '';
        await this.repo.save(row);
        await this.snapshot(`project:${projectId}`, row.data, row.signedAt, `${row.signedByName} (signed)`);
        return this.get(projectId);
    }
    async save(projectId, data, actor) {
        if (!Number.isFinite(projectId))
            throw new common_1.BadRequestException('Which project?');
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new common_1.BadRequestException('The program must be an object of answers.');
        }
        if (!(await this.projects.findOneBy({ id: projectId }))) {
            throw new common_1.BadRequestException(`Project ${projectId} not found`);
        }
        const existing = await this.repo.findOneBy({ projectId });
        const row = existing || this.repo.create({ projectId });
        row.data = JSON.stringify(data);
        row.updatedAt = new Date().toISOString();
        row.updatedBy = actor?.name || 'System';
        await this.repo.save(row);
        await this.snapshot(`project:${projectId}`, row.data, row.updatedAt, row.updatedBy);
        return this.get(projectId);
    }
    async listVersionsFor(projectId) {
        return this.listVersions(`project:${projectId}`);
    }
    async getVersionFor(projectId, id) {
        return this.getVersion(`project:${projectId}`, id);
    }
    async restoreVersion(projectId, id, actor) {
        const v = await this.getVersion(`project:${projectId}`, id);
        return this.save(projectId, v.data, actor);
    }
    async markSent(projectId, to, actor) {
        const row = await this.repo.findOneBy({ projectId });
        if (!row)
            return;
        row.sentAt = new Date().toISOString();
        row.sentTo = to || '';
        row.updatedBy = actor?.name || row.updatedBy || 'System';
        await this.repo.save(row);
    }
    async setComplete(projectId, complete) {
        const row = await this.repo.findOneBy({ projectId });
        if (!row)
            throw new common_1.BadRequestException('Nothing has been filled in yet.');
        row.completedAt = complete ? new Date().toISOString() : '';
        await this.repo.save(row);
        return this.get(projectId);
    }
    async getLead(leadId) {
        if (!leadId)
            throw new common_1.BadRequestException('Which lead?');
        const row = await this.leadRepo.findOneBy({ leadId });
        return {
            leadId,
            data: this.parse(row?.data),
            updatedAt: row?.updatedAt || '',
            updatedBy: row?.updatedBy || '',
            completedAt: row?.completedAt || '',
            sentAt: row?.sentAt || '',
            sentTo: row?.sentTo || '',
        };
    }
    async saveLead(leadId, data, actor) {
        if (!leadId)
            throw new common_1.BadRequestException('Which lead?');
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new common_1.BadRequestException('The program must be an object of answers.');
        }
        if (!(await this.leads.findOneBy({ id: leadId }))) {
            throw new common_1.BadRequestException(`Lead ${leadId} not found`);
        }
        const existing = await this.leadRepo.findOneBy({ leadId });
        const row = existing || this.leadRepo.create({ leadId });
        row.data = JSON.stringify(data);
        row.updatedAt = new Date().toISOString();
        row.updatedBy = actor?.name || 'System';
        await this.leadRepo.save(row);
        await this.snapshot(`lead:${leadId}`, row.data, row.updatedAt, row.updatedBy);
        return this.getLead(leadId);
    }
    async listVersionsForLead(leadId) {
        return this.listVersions(`lead:${leadId}`);
    }
    async getVersionForLead(leadId, id) {
        return this.getVersion(`lead:${leadId}`, id);
    }
    async restoreVersionLead(leadId, id, actor) {
        const v = await this.getVersion(`lead:${leadId}`, id);
        return this.saveLead(leadId, v.data, actor);
    }
    async markSentLead(leadId, to, actor) {
        const row = await this.leadRepo.findOneBy({ leadId });
        if (!row)
            return;
        row.sentAt = new Date().toISOString();
        row.sentTo = to || '';
        row.updatedBy = actor?.name || row.updatedBy || 'System';
        await this.leadRepo.save(row);
    }
    async setCompleteLead(leadId, complete) {
        const row = await this.leadRepo.findOneBy({ leadId });
        if (!row)
            throw new common_1.BadRequestException('Nothing has been filled in yet.');
        row.completedAt = complete ? new Date().toISOString() : '';
        await this.leadRepo.save(row);
        return this.getLead(leadId);
    }
};
exports.ProjectProgramService = ProjectProgramService;
exports.ProjectProgramService = ProjectProgramService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectProgramEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.LeadProgramEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ProjectProgramVersionEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        people_service_1.PeopleService])
], ProjectProgramService);
//# sourceMappingURL=project-program.service.js.map