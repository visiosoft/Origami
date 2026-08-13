"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const projects_module_1 = require("./projects/projects.module");
const people_module_1 = require("./people/people.module");
const tasks_module_1 = require("./tasks/tasks.module");
const pipeline_module_1 = require("./pipeline/pipeline.module");
const leads_module_1 = require("./leads/leads.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const seed_module_1 = require("./database/seed.module");
const db_config_1 = require("./database/db.config");
const dbImports = db_config_1.DB_ENABLED
    ? [
        typeorm_1.TypeOrmModule.forRootAsync({
            inject: [config_1.ConfigService],
            useFactory: (cfg) => ({
                type: 'mssql',
                host: cfg.get('DB_HOST'),
                port: parseInt(cfg.get('DB_PORT') ?? '1433', 10),
                username: cfg.get('DB_USER'),
                password: cfg.get('DB_PASS'),
                database: cfg.get('DB_NAME'),
                autoLoadEntities: true,
                synchronize: cfg.get('DB_SYNC') === 'true',
                options: { encrypt: true, trustServerCertificate: false },
                retryAttempts: 3,
                retryDelay: 3000,
            }),
        }),
        seed_module_1.SeedModule,
    ]
    : [];
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            ...dbImports,
            projects_module_1.ProjectsModule,
            people_module_1.PeopleModule,
            tasks_module_1.TasksModule,
            pipeline_module_1.PipelineModule,
            leads_module_1.LeadsModule,
            dashboard_module_1.DashboardModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map