import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceEntity, InvoiceEntity, DealEntity, TaskEntity, ProjectEntity } from '../database/entities';
import { ProjectTasksModule } from '../project-tasks/project-tasks.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TypeOrmModule.forFeature([FinanceEntity, InvoiceEntity, DealEntity, TaskEntity, ProjectEntity]), ProjectTasksModule, TasksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
