import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowEntity, WorkflowItemEntity } from '../database/entities';
import { WorkflowsController } from './workflows.controller';
import { WorkflowItemsController } from './workflow-items.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowItemsService } from './workflow-items.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowEntity, WorkflowItemEntity])],
  controllers: [WorkflowsController, WorkflowItemsController],
  providers: [WorkflowsService, WorkflowItemsService],
})
export class WorkflowsModule {}
