import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from './projects/projects.module';
import { PeopleModule } from './people/people.module';
import { TasksModule } from './tasks/tasks.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { LeadsModule } from './leads/leads.module';
import { ScoringModule } from './scoring/scoring.module';
import { UsersModule } from './users/users.module';
import { ProjectTasksModule } from './project-tasks/project-tasks.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { SupportModule } from './support/support.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedModule } from './database/seed.module';
import { SettingsModule } from './settings/settings.module';
import { GoogleModule } from './google/google.module';
import { AuthModule } from './auth/auth.module';

// SQL is the single source of truth — TypeORM is always on (no in-memory
// fallback). The app requires a reachable SQL database to run.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mssql' as const,
        host: cfg.get<string>('DB_HOST'),
        port: parseInt(cfg.get<string>('DB_PORT') ?? '1433', 10),
        username: cfg.get<string>('DB_USER'),
        password: cfg.get<string>('DB_PASS'),
        database: cfg.get<string>('DB_NAME'),
        autoLoadEntities: true,
        // Schema is managed by TypeORM synchronize (no migrations in this app),
        // so it stays on to create new tables/columns. (Consider migrations later.)
        synchronize: true,
        options: { encrypt: true, trustServerCertificate: false },
        retryAttempts: 5,
        retryDelay: 3000,
        extra: { connectTimeout: 30000 },
      }),
    }),
    SeedModule,
    SettingsModule,
    GoogleModule,
    AuthModule,
    ProjectsModule,
    PeopleModule,
    TasksModule,
    PipelineModule,
    LeadsModule,
    ScoringModule,
    UsersModule,
    ProjectTasksModule,
    WorkflowsModule,
    SupportModule,
    EmailTemplatesModule,
    DashboardModule,
  ],
})
export class AppModule { }
