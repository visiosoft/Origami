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
exports.PeopleImportController = exports.ImportPeopleDto = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const class_validator_1 = require("class-validator");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const google_service_1 = require("../google/google.service");
const entities_1 = require("../database/entities");
const people_service_1 = require("./people.service");
const people_import_1 = require("./people-import");
class ImportPeopleDto {
}
exports.ImportPeopleDto = ImportPeopleDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ImportPeopleDto.prototype, "rows", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ImportPeopleDto.prototype, "dryRun", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ImportPeopleDto.prototype, "update", void 0);
let PeopleImportController = class PeopleImportController {
    constructor(people, google, repo, projects) {
        this.people = people;
        this.google = google;
        this.repo = repo;
        this.projects = projects;
    }
    columns() {
        return people_import_1.IMPORT_COLUMNS;
    }
    async convert(file) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('No file was uploaded.');
        if (!(await this.google.isConnected()))
            throw new common_1.BadRequestException('Reading Excel files needs the Google account connected (Settings → Integrations) — or save the sheet as CSV and upload that.');
        const mime = file.mimetype && file.mimetype !== 'application/octet-stream'
            ? file.mimetype
            : /\.xls$/i.test(file.originalname) ? 'application/vnd.ms-excel'
                : /\.ods$/i.test(file.originalname) ? 'application/vnd.oasis.opendocument.spreadsheet'
                    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        return { csv: await this.google.spreadsheetToCsv(file.buffer, mime, `Import ${file.originalname}`) };
    }
    async import(dto) {
        const rows = (dto.rows || []).slice(0, 2000);
        const [existing, projects] = await Promise.all([this.repo.find(), this.projects.find()]);
        const plan = (0, people_import_1.planImport)(rows, existing, projects.map((p) => p.name), { update: !!dto.update });
        const summary = () => ({
            create: plan.filter((p) => p.action === 'create').length, update: plan.filter((p) => p.action === 'update').length,
            skip: plan.filter((p) => p.action === 'skip').length, error: plan.filter((p) => p.action === 'error').length,
        });
        if (dto.dryRun)
            return { dryRun: true, summary: summary(), rows: plan.map(({ person: _p, ...r }) => r) };
        const done = [];
        for (const p of plan) {
            try {
                if (p.action === 'create') {
                    const saved = await this.people.create({ ...p.person, since: new Date().toISOString().slice(0, 10), last: 'Imported' });
                    done.push({ row: p.row, action: 'created', id: saved.id });
                }
                else if (p.action === 'update' && p.matchId) {
                    await this.people.update(String(p.matchId), p.person);
                    done.push({ row: p.row, action: 'updated', id: p.matchId });
                }
            }
            catch (e) {
                done.push({ row: p.row, action: 'failed', error: e.message });
            }
        }
        return {
            dryRun: false,
            created: done.filter((d) => d.action === 'created').length,
            updated: done.filter((d) => d.action === 'updated').length,
            failed: done.filter((d) => d.action === 'failed'),
        };
    }
};
exports.PeopleImportController = PeopleImportController;
__decorate([
    (0, common_1.Get)('columns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PeopleImportController.prototype, "columns", null);
__decorate([
    (0, common_1.Post)('convert'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PeopleImportController.prototype, "convert", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ImportPeopleDto]),
    __metadata("design:returntype", Promise)
], PeopleImportController.prototype, "import", null);
exports.PeopleImportController = PeopleImportController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('people/import'),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [people_service_1.PeopleService,
        google_service_1.GoogleService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], PeopleImportController);
//# sourceMappingURL=people-import.controller.js.map