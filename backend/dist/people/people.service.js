"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeopleService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let PeopleService = class PeopleService {
    constructor() {
        this.people = [
            { id: '1', name: 'Sarah Chen', kind: 'Internal', role: 'Project Manager', projects: ['Meridian Residence', 'Civic Center Renovation'], email: 'sarah@origami.build' },
            { id: '2', name: 'Marcus Rivera', kind: 'Internal', role: 'Site Superintendent', projects: ['Meridian Residence'], email: 'marcus@origami.build' },
            { id: '3', name: 'James Park', kind: 'Subcontractor', role: 'Electrical', company: 'Park Electric', projects: ['Harbor Office Build', 'Lakeview Custom Home'], complianceDate: '2027-03-15' },
            { id: '4', name: 'Emily Nguyen', kind: 'Consultant', role: 'Structural Engineer', company: 'SN Engineering', projects: ['Downtown Mixed-Use'], complianceDate: '2026-11-01' },
            { id: '5', name: 'David Kim', kind: 'Internal', role: 'Designer', projects: ['Civic Center Renovation', 'Downtown Mixed-Use'], email: 'david@origami.build' },
        ];
    }
    findAll(project) {
        if (project) {
            return this.people.filter((p) => p.projects.includes(project));
        }
        return this.people;
    }
    findOne(id) {
        const person = this.people.find((p) => p.id === id);
        if (!person)
            throw new common_1.NotFoundException(`Person ${id} not found`);
        return person;
    }
    create(dto) {
        const person = { id: (0, crypto_1.randomUUID)(), projects: [], ...dto };
        this.people.push(person);
        return person;
    }
};
exports.PeopleService = PeopleService;
exports.PeopleService = PeopleService = __decorate([
    (0, common_1.Injectable)()
], PeopleService);
//# sourceMappingURL=people.service.js.map