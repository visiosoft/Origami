import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FinanceEntity, InvoiceEntity, DealEntity, TaskEntity, ProjectEntity, RfiEntity, UserEntity } from '../database/entities';
import { ProjectTasksModule } from '../project-tasks/project-tasks.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TypeOrmModule.forFeature([FinanceEntity, InvoiceEntity, DealEntity, TaskEntity, ProjectEntity, RfiEntity, UserEntity]), ProjectTasksModule, TasksModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
