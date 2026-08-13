import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from './projects/projects.module';
import { PeopleModule } from './people/people.module';
import { TasksModule } from './tasks/tasks.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { LeadsModule } from './leads/leads.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedModule } from './database/seed.module';
import { DB_ENABLED } from './database/db.config';

const dbImports = DB_ENABLED
  ? [
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
        synchronize: cfg.get<string>('DB_SYNC') === 'true',
        options: { encrypt: true, trustServerCertificate: false },
        retryAttempts: 2,
        retryDelay: 2000,
        extra: { connectTimeout: 10000 },
      }),
    }),
    SeedModule,
  ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...dbImports,
    ProjectsModule,
    PeopleModule,
    TasksModule,
    PipelineModule,
    LeadsModule,
    DashboardModule,
  ],
})
export class AppModule { }
