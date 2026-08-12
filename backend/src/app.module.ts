import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from './projects/projects.module';
import { PeopleModule } from './people/people.module';
import { TasksModule } from './tasks/tasks.module';
import { PipelineModule } from './pipeline/pipeline.module';
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
          synchronize: true, // dev/demo: auto-create tables from entities
          options: { encrypt: true, trustServerCertificate: false },
          retryAttempts: 10,
          retryDelay: 4000,
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
    DashboardModule,
  ],
})
export class AppModule {}
