"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileRoomModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const google_module_1 = require("../google/google.module");
const auth_module_1 = require("../auth/auth.module");
const file_room_controller_1 = require("./file-room.controller");
const file_room_service_1 = require("./file-room.service");
let FileRoomModule = class FileRoomModule {
};
exports.FileRoomModule = FileRoomModule;
exports.FileRoomModule = FileRoomModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([entities_1.FileRoomFileEntity, entities_1.FileRoomFolderEntity, entities_1.ProjectEntity]),
            google_module_1.GoogleModule,
            auth_module_1.AuthModule,
        ],
        controllers: [file_room_controller_1.FileRoomController],
        providers: [file_room_service_1.FileRoomService],
    })
], FileRoomModule);
//# sourceMappingURL=file-room.module.js.map