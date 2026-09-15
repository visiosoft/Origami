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
exports.ProjectProgramController = void 0;
const common_1 = require("@nestjs/common");
const project_program_service_1 = require("./project-program.service");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const letterhead_1 = require("../documents/letterhead");
const program_document_1 = require("../documents/program-document");
const actorFrom = (req) => ({ id: req.claims?.sub, name: req.claims?.name });
let ProjectProgramController = class ProjectProgramController {
    constructor(service, google, settings) {
        this.service = service;
        this.google = google;
        this.settings = settings;
    }
    get(projectId, leadId) {
        return leadId ? this.service.getLead(leadId) : this.service.get(Number(projectId));
    }
    getMine(projectId, req) {
        if (!req.claims?.email)
            throw new common_1.ForbiddenException('Sign in to continue.');
        return this.service.getForClient(Number(projectId), req.claims.email);
    }
    sign(body, req) {
        if (!req.claims?.email)
            throw new common_1.ForbiddenException('Sign in to continue.');
        return this.service.sign(Number(body?.projectId), { name: body?.name, email: req.claims.email }, body?.image, { ip: req.ip || '', userAgent: String(req.headers['user-agent'] || '') });
    }
    save(body, req) {
        return body?.leadId
            ? this.service.saveLead(body.leadId, body.data, actorFrom(req))
            : this.service.save(Number(body?.projectId), body?.data, actorFrom(req));
    }
    complete(body) {
        return body?.leadId
            ? this.service.setCompleteLead(body.leadId, body.complete !== false)
            : this.service.setComplete(Number(body?.projectId), body.complete !== false);
    }
    listVersions(projectId, leadId) {
        return leadId ? this.service.listVersionsForLead(leadId) : this.service.listVersionsFor(Number(projectId));
    }
    getVersion(id, projectId, leadId) {
        return leadId ? this.service.getVersionForLead(leadId, Number(id)) : this.service.getVersionFor(Number(projectId), Number(id));
    }
    restoreVersion(id, body, req) {
        return body?.leadId
            ? this.service.restoreVersionLead(body.leadId, Number(id), actorFrom(req))
            : this.service.restoreVersion(Number(body?.projectId), Number(id), actorFrom(req));
    }
    async pdf(body, res) {
        const { pdf, filename } = await this.render(body);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.end(pdf);
    }
    async send(body, req) {
        const { pdf, filename } = await this.render(body);
        await this.google.sendMail({
            to: body.to,
            cc: body.cc,
            subject: body.subject,
            html: body.html,
            attachments: [{ filename, mimeType: 'application/pdf', content: pdf }],
        });
        if (body.leadId)
            await this.service.markSentLead(body.leadId, body.to, actorFrom(req));
        else
            await this.service.markSent(Number(body.projectId), body.to, actorFrom(req));
        return { ok: true, filename, to: body.to };
    }
    async render(body) {
        const brand = (0, letterhead_1.brandingFrom)(await this.settings.getMany(letterhead_1.BRAND_KEYS));
        const projectName = body.projectName || (body.leadId ? `Lead ${body.leadId}` : `Project ${body.projectId}`);
        const html = (0, program_document_1.buildProgramHtml)({
            brand,
            projectName,
            subtitle: body.subtitle,
            date: body.date,
            steps: Array.isArray(body.steps) ? body.steps : [],
        });
        const name = (0, letterhead_1.safeFilename)(`${projectName} - Project Program`);
        const header = [brand.companyName, projectName, 'Project Program'].filter(Boolean).join('  ·  ');
        const footer = [brand.address, brand.phone, brand.email, brand.website].filter(Boolean).join('  ·  ');
        const pdf = await this.google.htmlToPdf(html, name, { header, footer }, true);
        return { pdf, filename: `${name}.pdf` };
    }
};
exports.ProjectProgramController = ProjectProgramController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Query)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "get", null);
__decorate([
    (0, roles_decorator_1.Tiers)('internal', 'client'),
    (0, common_1.Get)('mine'),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "getMine", null);
__decorate([
    (0, roles_decorator_1.Tiers)('internal', 'client'),
    (0, common_1.Post)('sign'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "sign", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "save", null);
__decorate([
    (0, common_1.Put)('complete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "complete", null);
__decorate([
    (0, common_1.Get)('versions'),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Query)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Get)('versions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('projectId')),
    __param(2, (0, common_1.Query)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "getVersion", null);
__decorate([
    (0, common_1.Post)('versions/:id/restore'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "restoreVersion", null);
__decorate([
    (0, common_1.Post)('pdf'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectProgramController.prototype, "pdf", null);
__decorate([
    (0, common_1.Post)('send'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectProgramController.prototype, "send", null);
exports.ProjectProgramController = ProjectProgramController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('project-program'),
    __metadata("design:paramtypes", [project_program_service_1.ProjectProgramService,
        google_service_1.GoogleService,
        settings_service_1.SettingsService])
], ProjectProgramController);
//# sourceMappingURL=project-program.controller.js.map