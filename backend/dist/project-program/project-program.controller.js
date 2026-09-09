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
let ProjectProgramController = class ProjectProgramController {
    constructor(service, google, settings) {
        this.service = service;
        this.google = google;
        this.settings = settings;
    }
    get(projectId) {
        return this.service.get(Number(projectId));
    }
    save(body, req) {
        return this.service.save(Number(body?.projectId), body?.data, req?.user);
    }
    complete(body) {
        return this.service.setComplete(Number(body?.projectId), body?.complete !== false);
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
        await this.service.markSent(Number(body.projectId), body.to, req?.user);
        return { ok: true, filename, to: body.to };
    }
    async render(body) {
        const brand = (0, letterhead_1.brandingFrom)(await this.settings.getMany(letterhead_1.BRAND_KEYS));
        const projectName = body.projectName || `Project ${body.projectId}`;
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
        const pdf = await this.google.htmlToPdf(html, name, { header, footer });
        return { pdf, filename: `${name}.pdf` };
    }
};
exports.ProjectProgramController = ProjectProgramController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectProgramController.prototype, "get", null);
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