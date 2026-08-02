"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let ProjectsService = class ProjectsService {
    constructor() {
        this.projects = [
            { id: '1', name: 'Meridian Residence', client: 'Whitfield Family', phase: 'Construction', contractValue: 1_327_000, exec: 'DB', contractType: 'Fixed' },
            { id: '2', name: 'Civic Center Renovation', client: 'City of Westbrook', phase: 'Design', contractValue: 3_405_000, exec: 'DBB', contractType: 'T&M' },
            { id: '3', name: 'Harbor Office Build', client: 'Pacific Maritime LLC', phase: 'Preconstruction', contractValue: 535_000, exec: 'D', contractType: 'Cost+' },
            { id: '4', name: 'Lakeview Custom Home', client: 'Moreno Family', phase: 'Construction', contractValue: 892_000, exec: 'DB', contractType: 'Fixed' },
            { id: '5', name: 'Downtown Mixed-Use', client: 'Urban Dev Partners', phase: 'Design', contractValue: 6_200_000, exec: 'DBB', contractType: 'Cost+' },
            { id: '6', name: 'Hillcrest ADU', client: 'Thompson Estate', phase: 'Closeout', contractValue: 285_000, exec: 'B', contractType: 'Fixed' },
        ];
    }
    findAll() {
        return this.projects;
    }
    findOne(id) {
        const project = this.projects.find((p) => p.id === id);
        if (!project)
            throw new common_1.NotFoundException(`Project ${id} not found`);
        return project;
    }
    create(dto) {
        const project = { id: (0, crypto_1.randomUUID)(), ...dto };
        this.projects.push(project);
        return project;
    }
    update(id, dto) {
        const index = this.projects.findIndex((p) => p.id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Project ${id} not found`);
        this.projects[index] = { ...this.projects[index], ...dto };
        return this.projects[index];
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)()
], ProjectsService);
//# sourceMappingURL=projects.service.js.map