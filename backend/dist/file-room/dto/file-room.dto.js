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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveFilesDto = exports.EmailFilesDto = exports.FileIdsDto = exports.EmailFileDto = exports.MoveFileDto = exports.UpdateFileDto = exports.CreateFolderDto = void 0;
const class_validator_1 = require("class-validator");
class CreateFolderDto {
}
exports.CreateFolderDto = CreateFolderDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateFolderDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateFolderDto.prototype, "path", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFolderDto.prototype, "name", void 0);
class UpdateFileDto {
}
exports.UpdateFileDto = UpdateFileDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateFileDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateFileDto.prototype, "notes", void 0);
class MoveFileDto {
}
exports.MoveFileDto = MoveFileDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], MoveFileDto.prototype, "folderPath", void 0);
class EmailFileDto {
}
exports.EmailFileDto = EmailFileDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EmailFileDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmailFileDto.prototype, "note", void 0);
class FileIdsDto {
}
exports.FileIdsDto = FileIdsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(25),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], FileIdsDto.prototype, "ids", void 0);
class EmailFilesDto extends FileIdsDto {
}
exports.EmailFilesDto = EmailFilesDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EmailFilesDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmailFilesDto.prototype, "note", void 0);
class MoveFilesDto extends FileIdsDto {
}
exports.MoveFilesDto = MoveFilesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], MoveFilesDto.prototype, "folderPath", void 0);
//# sourceMappingURL=file-room.dto.js.map