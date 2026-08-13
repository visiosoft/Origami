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
exports.SeedService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("./entities");
const projects_1 = require("../seed-data/projects");
const people_1 = require("../seed-data/people");
const tasks_1 = require("../seed-data/tasks");
const pipeline_1 = require("../seed-data/pipeline");
const dashboard_1 = require("../seed-data/dashboard");
let SeedService = class SeedService {
    constructor(projects, people, tasks, deals, invoices, finance) {
        this.projects = projects;
        this.people = people;
        this.tasks = tasks;
        this.deals = deals;
        this.invoices = invoices;
        this.finance = finance;
        this.log = new common_1.Logger('SeedService');
    }
    async onApplicationBootstrap() {
        try {
            await this.seed();
        }
        catch (err) {
            this.log.error('Seeding failed: ' + err.message);
        }
    }
    async seed() {
        if ((await this.projects.count()) === 0) {
            await this.projects.save(projects_1.PROJECTS);
            this.log.log(`Seeded ${projects_1.PROJECTS.length} projects`);
        }
        if ((await this.people.count()) === 0) {
            await this.people.save(people_1.PEOPLE);
            this.log.log(`Seeded ${people_1.PEOPLE.length} people`);
        }
        if ((await this.tasks.count()) === 0) {
            const rows = [];
            ['internal', 'owner', 'subcontractor'].forEach((tab) => {
                tasks_1.ALL_TASKS[tab].forEach((t) => rows.push({ ...t, tab }));
            });
            await this.tasks.save(rows);
            this.log.log(`Seeded ${rows.length} tasks`);
        }
        if ((await this.deals.count()) === 0) {
            await this.deals.save(pipeline_1.DEALS);
            this.log.log(`Seeded ${pipeline_1.DEALS.length} deals`);
        }
        if ((await this.invoices.count()) === 0) {
            const rows = [];
            ['internal', 'client', 'consultant'].forEach((kind) => {
                dashboard_1.INVOICES[kind].forEach((inv) => rows.push({ invId: inv.id, kind, project: inv.project, month: inv.month, issued: inv.issued, amount: inv.amount, paid: inv.paid }));
            });
            await this.invoices.save(rows);
            this.log.log(`Seeded ${rows.length} invoices`);
        }
        if ((await this.finance.count()) === 0) {
            await this.finance.save(dashboard_1.FINANCE);
            this.log.log(`Seeded ${dashboard_1.FINANCE.length} finance rows`);
        }
    }
};
exports.SeedService = SeedService;
exports.SeedService = SeedService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.DealEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.InvoiceEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.FinanceEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SeedService);
//# sourceMappingURL=seed.service.js.map