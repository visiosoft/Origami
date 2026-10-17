import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, MeetingEntity, ProjectEntity, ProjectTaskEntity, RfiEntity, RoleEntity, TaskEntity,
} from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { TasksModule } from '../tasks/tasks.module';
import { ProjectTasksModule } from '../project-tasks/project-tasks.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { RfisModule } from '../rfis/rfis.module';
import { FinanceModule } from '../finance/finance.module';
import { SpecialActionsController } from './special-actions.controller';
import { SpecialActionsService } from './special-actions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, ProjectTaskEntity, MeetingEntity, RfiEntity, ChangeOrderEntity, ChangeOrderItemEntity, ProjectEntity, RoleEntity]),
    AuthModule, TasksModule, ProjectTasksModule, MeetingsModule, RfisModule, FinanceModule,
  ],
  controllers: [SpecialActionsController],
  providers: [SpecialActionsService, ManpowerAccess],
})
export class SpecialActionsModule {}
