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
exports.PeopleController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const people_service_1 = require("./people.service");
const create_person_dto_1 = require("./dto/create-person.dto");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
let PeopleController = class PeopleController {
    constructor(peopleService, auth, attachments) {
        this.peopleService = peopleService;
        this.auth = auth;
        this.attachments = attachments;
    }
    findAll(project) {
        return this.peopleService.findAll(project);
    }
    async scanCard(files, auth) {
        const front = files?.front?.[0];
        const back = files?.back?.[0];
        if (!front && !back)
            throw new common_1.BadRequestException('Add a photo of the card.');
        for (const f of [front, back])
            if (f && !/^image\//.test(f.mimetype || ''))
                throw new common_1.BadRequestException('The card must be a photo (JPG, PNG or HEIC).');
        return this.peopleService.scanCard({ front, back }, await this.auth.requireActor(auth));
    }
    async addCard(id, files, auth) {
        return this.peopleService.addCardPhotos(id, { front: files?.front?.[0], back: files?.back?.[0] }, await this.auth.requireActor(auth));
    }
    removeCard(id, side) {
        if (side !== 'front' && side !== 'back')
            throw new common_1.NotFoundException();
        return this.peopleService.removeCardPhoto(id, side);
    }
    async cardContent(id, side, thumb, res) {
        if (side !== 'front' && side !== 'back')
            throw new common_1.NotFoundException();
        const att = await this.peopleService.cardPhoto(id, side);
        const file = await this.attachments.download(att, thumb === '1');
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream_1.Readable.fromWeb(file.body).pipe(res);
    }
    findOne(id) {
        return this.peopleService.findOne(id);
    }
    create(dto) {
        return this.peopleService.create(dto);
    }
    update(id, dto) {
        return this.peopleService.update(id, dto);
    }
    remove(id) {
        return this.peopleService.remove(id);
    }
};
exports.PeopleController = PeopleController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('project')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PeopleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('business-card/scan'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }], { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PeopleController.prototype, "scanCard", null);
__decorate([
    (0, common_1.Post)(':id/business-card'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }], { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], PeopleController.prototype, "addCard", null);
__decorate([
    (0, common_1.Delete)(':id/business-card/:side'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('side')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PeopleController.prototype, "removeCard", null);
__decorate([
    (0, common_1.Get)(':id/business-card/:side/content'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('side')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], PeopleController.prototype, "cardContent", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PeopleController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_person_dto_1.CreatePersonDto]),
    __metadata("design:returntype", void 0)
], PeopleController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PeopleController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PeopleController.prototype, "remove", null);
exports.PeopleController = PeopleController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('people'),
    __metadata("design:paramtypes", [people_service_1.PeopleService,
        auth_service_1.AuthService,
        attachments_service_1.AttachmentsService])
], PeopleController);
//# sourceMappingURL=people.controller.js.map