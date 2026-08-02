import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProjectsModule } from './projects/projects.module';
import { PeopleModule } from './people/people.module';
import { TasksModule } from './tasks/tasks.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ProjectsModule,
    PeopleModule,
    TasksModule,
    PipelineModule,
    DashboardModule,
  ],
})
export class AppModule {}
