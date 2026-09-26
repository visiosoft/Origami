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
exports.ClientUploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const public_decorator_1 = require("../auth/guards/public.decorator");
const attachments_service_1 = require("../google/attachments.service");
const client_welcome_service_1 = require("./client-welcome.service");
let ClientUploadController = class ClientUploadController {
    constructor(welcome) {
        this.welcome = welcome;
    }
    view(token) {
        return this.welcome.publicView(token);
    }
    upload(token, files, body) {
        return this.welcome.publicUpload(token, files, body?.item);
    }
};
exports.ClientUploadController = ClientUploadController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClientUploadController.prototype, "view", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('files'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Query)('token')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", void 0)
], ClientUploadController.prototype, "upload", null);
exports.ClientUploadController = ClientUploadController = __decorate([
    (0, common_1.Controller)('client-upload'),
    __metadata("design:paramtypes", [client_welcome_service_1.ClientWelcomeService])
], ClientUploadController);
//# sourceMappingURL=client-upload.controller.js.map