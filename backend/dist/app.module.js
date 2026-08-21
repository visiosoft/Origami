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
const schedule_1 = require("@nestjs/schedule");
const projects_module_1 = require("./projects/projects.module");
const people_module_1 = require("./people/people.module");
const tasks_module_1 = require("./tasks/tasks.module");
const pipeline_module_1 = require("./pipeline/pipeline.module");
const leads_module_1 = require("./leads/leads.module");
const scoring_module_1 = require("./scoring/scoring.module");
const users_module_1 = require("./users/users.module");
const project_tasks_module_1 = require("./project-tasks/project-tasks.module");
const workflows_module_1 = require("./workflows/workflows.module");
const support_module_1 = require("./support/support.module");
const email_templates_module_1 = require("./email-templates/email-templates.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const seed_module_1 = require("./database/seed.module");
const settings_module_1 = require("./settings/settings.module");
const google_module_1 = require("./google/google.module");
const auth_module_1 = require("./auth/auth.module");
const reminders_module_1 = require("./reminders/reminders.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            schedule_1.ScheduleModule.forRoot(),
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
                    synchronize: true,
                    options: { encrypt: true, trustServerCertificate: false },
                    retryAttempts: 5,
                    retryDelay: 3000,
                    extra: { connectTimeout: 30000 },
                }),
            }),
            seed_module_1.SeedModule,
            settings_module_1.SettingsModule,
            google_module_1.GoogleModule,
            auth_module_1.AuthModule,
            reminders_module_1.RemindersModule,
            projects_module_1.ProjectsModule,
            people_module_1.PeopleModule,
            tasks_module_1.TasksModule,
            pipeline_module_1.PipelineModule,
            leads_module_1.LeadsModule,
            scoring_module_1.ScoringModule,
            users_module_1.UsersModule,
            project_tasks_module_1.ProjectTasksModule,
            workflows_module_1.WorkflowsModule,
            support_module_1.SupportModule,
            email_templates_module_1.EmailTemplatesModule,
            dashboard_module_1.DashboardModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map